import { useState } from "react";
import { BrowserProvider, ethers } from "ethers";
import type { NetworkName } from "../lib/ccipConfig";
import {
  CCIP_NETWORKS,
  getAvailableDestinationNetworks,
  getSupportedTokens,
  DEFAULT_SOURCE_NETWORK,
} from "../lib/ccipConfig";
import {
  calculateCCIPFee,
  proposeCCIPTransfer,
  checkCCIPTransferBalance,
  getCCIPMessageId,
  checkCCIPTransferStatus,
} from "../lib/safeFlow";
import type { CCIPTransferParams, CCIPFeeEstimate } from "../lib/safeFlow";

interface CCIPTransferProps {
  safeAddress: string;
  provider: BrowserProvider;
  userAddress: string;
  onSuccess: () => void;
}

export default function CCIPTransfer({
  safeAddress,
  provider,
  onSuccess,
}: CCIPTransferProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [feeEstimate, setFeeEstimate] = useState<CCIPFeeEstimate | null>(null);
  const [balanceCheck, setBalanceCheck] = useState<{
    hasTokenBalance: boolean;
    hasFeeBalance: boolean;
    tokenBalance: string;
    nativeBalance: string;
  } | null>(null);

  // CCIP tracking state
  const [ccipMessageId, setCcipMessageId] = useState<string>("");
  const [trackingTxHash, setTrackingTxHash] = useState<string>("");
  const [messageStatus, setMessageStatus] = useState<{
    status: string;
    explorerUrl?: string;
  } | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    destinationNetwork: "" as NetworkName | "",
    tokenSymbol: "",
    amount: "",
    recipientAddress: "",
  });

  const sourceNetwork = DEFAULT_SOURCE_NETWORK;
  const destinationNetworks = getAvailableDestinationNetworks(sourceNetwork);
  const supportedTokens = getSupportedTokens(sourceNetwork);

  // Handle destination network change
  const handleNetworkChange = (network: string) => {
    setFormData({
      ...formData,
      destinationNetwork: network as NetworkName,
      tokenSymbol: "", // Reset token selection
    });
    setFeeEstimate(null);
    setBalanceCheck(null);
  };

  // Handle token change
  const handleTokenChange = (symbol: string) => {
    setFormData({
      ...formData,
      tokenSymbol: symbol,
    });
    setFeeEstimate(null);
    setBalanceCheck(null);
  };

  // Calculate fee
  const handleCalculateFee = async () => {
    if (!validateForm(false)) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const token = supportedTokens.find(
        (t) => t.symbol === formData.tokenSymbol
      );
      if (!token) {
        throw new Error("Token not found");
      }

      // Convert amount to smallest unit (wei for ETH-like tokens)
      const amountInSmallestUnit = ethers
        .parseUnits(formData.amount, token.decimals)
        .toString();

      const params: CCIPTransferParams = {
        sourceNetwork,
        destinationNetwork: formData.destinationNetwork as NetworkName,
        tokenSymbol: formData.tokenSymbol,
        amount: amountInSmallestUnit,
        recipientAddress: formData.recipientAddress,
      };

      // Get fee estimate
      const fee = await calculateCCIPFee(params, provider);
      setFeeEstimate(fee);

      // Check balances
      const balances = await checkCCIPTransferBalance(
        params,
        safeAddress,
        provider
      );
      setBalanceCheck(balances);

      setSuccess("Fee calculated successfully!");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to calculate fee";
      setError(errorMessage);
      console.error("Error calculating fee:", err);
    } finally {
      setLoading(false);
    }
  };

  // Validate form
  const validateForm = (checkFee: boolean): boolean => {
    if (!formData.destinationNetwork) {
      setError("Please select a destination network");
      return false;
    }

    if (!formData.tokenSymbol) {
      setError("Please select a token");
      return false;
    }

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      setError("Please enter a valid amount");
      return false;
    }

    if (
      !formData.recipientAddress ||
      !ethers.isAddress(formData.recipientAddress)
    ) {
      setError("Please enter a valid recipient address");
      return false;
    }

    if (checkFee && !feeEstimate) {
      setError("Please calculate fee first");
      return false;
    }

    return true;
  };

  // Propose CCIP transfer
  const handleProposeTransfer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm(true)) return;

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const token = supportedTokens.find(
        (t) => t.symbol === formData.tokenSymbol
      );
      if (!token) {
        throw new Error("Token not found");
      }

      const amountInSmallestUnit = ethers
        .parseUnits(formData.amount, token.decimals)
        .toString();

      const params: CCIPTransferParams = {
        sourceNetwork,
        destinationNetwork: formData.destinationNetwork as NetworkName,
        tokenSymbol: formData.tokenSymbol,
        amount: amountInSmallestUnit,
        recipientAddress: formData.recipientAddress,
      };

      const result = await proposeCCIPTransfer(params, safeAddress, provider);

      if (result.needsApproval) {
        // Approval transaction was proposed
        setSuccess(
          `⚠️ Token approval needed! Approval transaction proposed: ${result.approvalTxHash!.substring(
            0,
            10
          )}...\n\n` +
            `Please:\n` +
            `1. Find the approval transaction in "Pending Transactions"\n` +
            `2. Confirm it with other owners if needed\n` +
            `3. Execute the approval transaction\n` +
            `4. Then come back and propose the CCIP transfer again`
        );
      } else {
        // CCIP transfer was proposed directly (no approval needed)
        setSuccess(
          `✅ CCIP transfer proposed successfully! Transaction hash: ${result.safeTxHash.substring(
            0,
            10
          )}...`
        );
      }

      // Reset form
      setFormData({
        destinationNetwork: "",
        tokenSymbol: "",
        amount: "",
        recipientAddress: "",
      });
      setFeeEstimate(null);
      setBalanceCheck(null);

      // Call success callback to refresh parent
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to propose CCIP transfer";
      setError(errorMessage);
      console.error("Error proposing transfer:", err);
    } finally {
      setLoading(false);
    }
  };

  // Track CCIP message by transaction hash
  const handleTrackMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setMessageStatus(null);

    if (!trackingTxHash.trim()) {
      setError("Please enter a transaction hash");
      return;
    }

    setLoading(true);

    try {
      // Get message ID from transaction
      const messageId = await getCCIPMessageId(trackingTxHash, provider);

      if (!messageId) {
        setError("Could not find CCIP message ID in transaction");
        setLoading(false);
        return;
      }

      setCcipMessageId(messageId);

      // Check message status
      const status = await checkCCIPTransferStatus(messageId);
      setMessageStatus(status);

      setSuccess(`Found CCIP message! Track it on CCIP Explorer`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to track message";
      setError(errorMessage);
      console.error("Error tracking message:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ccip-transfer">
      <h3>
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          style={{ marginRight: "8px", verticalAlign: "middle" }}
        >
          <path
            d="M17 8L21 12M21 12L17 16M21 12H3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Cross-Chain Transfer (CCIP)
      </h3>

      <p className="info-text">
        Transfer tokens securely across different blockchains using Chainlink
        CCIP. This transaction will require multi-sig approval from Safe owners.
      </p>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <form onSubmit={handleProposeTransfer}>
        {/* Source Network (Read-only) */}
        <div className="form-group">
          <label>Source Network</label>
          <input
            type="text"
            value={CCIP_NETWORKS[sourceNetwork].name}
            disabled
            className="readonly-input"
          />
          <small>Your Safe is deployed on this network</small>
        </div>

        {/* Destination Network */}
        <div className="form-group">
          <label>Destination Network *</label>
          <select
            value={formData.destinationNetwork}
            onChange={(e) => handleNetworkChange(e.target.value)}
            disabled={loading}
            required
          >
            <option value="">Select destination network</option>
            {destinationNetworks.map((network) => (
              <option
                key={network.chainId}
                value={Object.keys(CCIP_NETWORKS).find(
                  (key) =>
                    CCIP_NETWORKS[key as NetworkName].chainId ===
                    network.chainId
                )}
              >
                {network.name}
              </option>
            ))}
          </select>
        </div>

        {/* Token Selection */}
        {formData.destinationNetwork && (
          <div className="form-group">
            <label>Token *</label>
            <select
              value={formData.tokenSymbol}
              onChange={(e) => handleTokenChange(e.target.value)}
              disabled={loading}
              required
            >
              <option value="">Select token to transfer</option>
              {supportedTokens.map((token) => (
                <option key={token.address} value={token.symbol}>
                  {token.name} ({token.symbol})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Amount */}
        {formData.tokenSymbol && (
          <div className="form-group">
            <label>Amount *</label>
            <input
              type="number"
              step="any"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              placeholder="0.0"
              disabled={loading}
              required
            />
            <small>
              Amount in {formData.tokenSymbol}
              {balanceCheck && (
                <span
                  style={{
                    color: balanceCheck.hasTokenBalance ? "green" : "red",
                    marginLeft: "8px",
                  }}
                >
                  (Balance:{" "}
                  {ethers.formatUnits(
                    balanceCheck.tokenBalance,
                    supportedTokens.find(
                      (t) => t.symbol === formData.tokenSymbol
                    )?.decimals || 18
                  )}{" "}
                  {formData.tokenSymbol})
                </span>
              )}
            </small>
          </div>
        )}

        {/* Recipient Address */}
        {formData.tokenSymbol && (
          <div className="form-group">
            <label>Recipient Address *</label>
            <input
              type="text"
              value={formData.recipientAddress}
              onChange={(e) =>
                setFormData({ ...formData, recipientAddress: e.target.value })
              }
              placeholder="0x..."
              disabled={loading}
              required
            />
            <small>
              The address that will receive tokens on the destination network
            </small>
          </div>
        )}

        {/* Calculate Fee Button */}
        {formData.recipientAddress && (
          <button
            type="button"
            onClick={handleCalculateFee}
            disabled={loading}
            className="secondary"
          >
            {loading ? "Calculating..." : "Calculate Transfer Fee"}
          </button>
        )}

        {/* Fee Display */}
        {feeEstimate && (
          <div className="fee-estimate">
            <h4>Estimated Fee</h4>
            <p>
              <strong>Fee:</strong> {feeEstimate.feeInEther} ETH
            </p>
            <p className="fee-note">
              This fee is paid on the source network (
              {CCIP_NETWORKS[sourceNetwork].name})
            </p>
            {balanceCheck && (
              <p
                style={{
                  color: balanceCheck.hasFeeBalance ? "green" : "red",
                  fontWeight: "bold",
                }}
              >
                {balanceCheck.hasFeeBalance
                  ? "✓ Safe has sufficient balance for fees"
                  : "✗ Insufficient balance for fees"}
              </p>
            )}
          </div>
        )}

        {/* Submit Button */}
        {feeEstimate && (
          <button
            type="submit"
            disabled={
              loading ||
              !balanceCheck?.hasTokenBalance ||
              !balanceCheck?.hasFeeBalance
            }
            className="primary"
          >
            {loading ? "Proposing..." : "Propose Cross-Chain Transfer"}
          </button>
        )}
      </form>

      <style>{`
        .ccip-transfer {
          background: var(--bg-primary);
          padding: 1.5rem;
          border-radius: 12px;
          margin-bottom: 1.5rem;
          border: 1px solid var(--border-light);
          box-shadow: var(--shadow-sm);
        }

        .ccip-transfer h3 {
          color: var(--text-primary);
          margin-bottom: 0.75rem;
          display: flex;
          align-items: center;
        }

        .info-text {
          color: var(--text-secondary);
          font-size: 0.875rem;
          margin-bottom: 1.5rem;
          line-height: 1.5;
        }

        .form-group {
          margin-bottom: 1.25rem;
        }

        .form-group label {
          display: block;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 0.625rem 0.875rem;
          border: 1px solid var(--border-color);
          border-radius: 8px;
          font-size: 0.875rem;
          transition: all 0.2s ease;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 3px var(--primary-light);
        }

        .form-group small {
          display: block;
          margin-top: 0.375rem;
          color: var(--text-tertiary);
          font-size: 0.75rem;
        }

        .readonly-input {
          background-color: var(--bg-tertiary) !important;
          cursor: not-allowed;
        }

        .fee-estimate {
          background-color: var(--primary-light);
          padding: 1rem;
          border-radius: 8px;
          margin: 1rem 0;
          border-left: 4px solid var(--primary-color);
        }

        .fee-estimate h4 {
          margin: 0 0 0.75rem 0;
          color: var(--text-primary);
          font-size: 0.875rem;
          font-weight: 600;
        }

        .fee-estimate p {
          margin: 0.375rem 0;
          font-size: 0.875rem;
          color: var(--text-secondary);
        }

        .fee-note {
          font-size: 0.75rem !important;
          font-style: italic;
          color: var(--text-tertiary) !important;
        }

        button.primary {
          background-color: var(--primary-color);
          color: white;
          width: 100%;
          padding: 0.75rem;
          margin-top: 1rem;
        }

        button.primary:hover:not(:disabled) {
          background-color: var(--primary-hover);
        }

        button.secondary {
          background-color: var(--bg-primary);
          color: var(--text-primary);
          border: 1px solid var(--border-color);
          width: 100%;
          padding: 0.75rem;
          margin-top: 0.5rem;
        }

        button.secondary:hover:not(:disabled) {
          background-color: var(--bg-tertiary);
        }

        .tracking-section {
          margin-top: 3rem;
          padding-top: 2rem;
          border-top: 1px solid var(--border-light);
        }

        .tracking-result {
          margin-top: 1rem;
          padding: 1rem;
          background-color: var(--bg-tertiary);
          border-radius: 8px;
        }

        .tracking-result a {
          color: var(--primary-color);
          text-decoration: none;
          font-weight: 500;
        }

        .tracking-result a:hover {
          text-decoration: underline;
        }

        .message-id {
          font-family: monospace;
          font-size: 0.875rem;
          padding: 0.5rem;
          background-color: var(--bg-primary);
          border-radius: 4px;
          word-break: break-all;
          margin-top: 0.5rem;
        }
      `}</style>

      {/* CCIP Message Tracking Section */}
      <div className="tracking-section">
        <h3>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            style={{ marginRight: "8px", verticalAlign: "middle" }}
          >
            <path
              d="M21 12C21 16.9706 16.9706 21 12 21M21 12C21 7.02944 16.9706 3 12 3M21 12H3M12 21C7.02944 21 3 16.9706 3 12M12 21C13.6569 21 15 16.9706 15 12C15 7.02944 13.6569 3 12 3M12 21C10.3431 21 9 16.9706 9 12C9 7.02944 10.3431 3 12 3M3 12C3 7.02944 7.02944 3 12 3"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          Track CCIP Transfer
        </h3>

        <p className="info-text">
          After executing a CCIP transfer, track its status using the
          transaction hash from the executed Safe transaction.
        </p>

        <form onSubmit={handleTrackMessage}>
          <div className="form-group">
            <label htmlFor="trackingTxHash">Transaction Hash</label>
            <input
              type="text"
              id="trackingTxHash"
              placeholder="0x..."
              value={trackingTxHash}
              onChange={(e) => setTrackingTxHash(e.target.value)}
            />
            <small>
              Enter the transaction hash from the executed Safe transaction
            </small>
          </div>

          <button
            type="submit"
            className="primary"
            disabled={loading || !trackingTxHash.trim()}
          >
            {loading ? "Tracking..." : "Track Message"}
          </button>
        </form>

        {messageStatus && (
          <div className="tracking-result">
            <p>
              <strong>Status:</strong> {messageStatus.status}
            </p>

            {ccipMessageId && (
              <div>
                <p>
                  <strong>Message ID:</strong>
                </p>
                <div className="message-id">{ccipMessageId}</div>
              </div>
            )}

            {messageStatus.explorerUrl && (
              <p style={{ marginTop: "1rem" }}>
                <a
                  href={messageStatus.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View on CCIP Explorer →
                </a>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

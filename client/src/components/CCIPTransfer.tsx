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
import {
  debugCCIPSafeTransfer,
  verifyCCIPTransactionOnChain,
} from "../lib/ccipDebug";
import {
  checkApprovalStatus,
  analyzeSafeTransactionFailure,
  checkSafeCCIPReadiness,
} from "../lib/ccipSafeDebug";

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

  // Verification state
  const [verifyTxHash, setVerifyTxHash] = useState<string>("");
  const [verificationResult, setVerificationResult] = useState<{
    success: boolean;
    message: string;
    ccipMessageId?: string;
    explorerUrl?: string;
    diagnostics?: {
      blockchainTxSuccess: boolean;
      safeExecutionSuccess: boolean;
      hasCCIPEvent: boolean;
      hasExecutionFailure: boolean;
      etherscanUrl: string;
    };
  } | null>(null);

  // Approval check state
  const [approvalCheckResult, setApprovalCheckResult] = useState<{
    isApproved: boolean;
    currentAllowance: string;
    currentAllowanceFormatted: string;
    routerAddress: string;
    tokenAddress: string;
    recommendation: string;
  } | null>(null);

  // Readiness check state
  const [readinessCheckResult, setReadinessCheckResult] = useState<{
    isReady: boolean;
    checks: {
      hasTokenBalance: boolean;
      tokenBalance: string;
      tokenBalanceFormatted: string;
      hasNativeBalance: boolean;
      nativeBalance: string;
      nativeBalanceFormatted: string;
      isTokenApproved: boolean;
      approvalAmount: string;
      approvalAmountFormatted: string;
    };
    issues: string[];
    recommendations: string[];
  } | null>(null);

  // Transaction analysis state
  const [analyzeTxHash, setAnalyzeTxHash] = useState<string>("");
  const [analysisResult, setAnalysisResult] = useState<{
    blockchainTxSuccess: boolean;
    safeExecutionSuccess: boolean;
    failureReason: string;
    diagnostics: {
      hasExecutionFailure: boolean;
      hasCCIPEvent: boolean;
      gasUsed: string;
      etherscanUrl: string;
    };
    recommendation: string;
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
      tokenSymbol: "",
      recipientAddress: formData.recipientAddress,
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

  // Validate form WITHOUT setting error (for use in render/disabled checks)
  const isFormValid = (checkFee: boolean): boolean => {
    if (!formData.destinationNetwork) return false;
    if (!formData.tokenSymbol) return false;
    if (!formData.amount || parseFloat(formData.amount) <= 0) return false;
    if (
      !formData.recipientAddress ||
      !ethers.isAddress(formData.recipientAddress)
    )
      return false;
    if (checkFee && !feeEstimate) return false;
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
        // Both transactions were proposed
        setSuccess(
          `✅ TWO Transactions Proposed Successfully!\n\n` +
            `Transaction 1 (Approval):\n` +
            `Hash: ${result.approvalTxHash!.substring(0, 20)}...\n` +
            `Purpose: Approve LINK token to CCIP Router\n\n` +
            `Transaction 2 (CCIP Transfer):\n` +
            `Hash: ${result.ccipTxHash!.substring(0, 20)}...\n` +
            `Purpose: Cross-chain token transfer\n\n` +
            `⚠️ IMPORTANT - Execute in ORDER:\n\n` +
            `Step 1: Execute Approval Transaction\n` +
            `1. Go to "Pending Transactions" tab\n` +
            `2. Find the approval transaction (to: LINK Token)\n` +
            `3. Confirm with other owners (if needed)\n` +
            `4. ⭐ EXECUTE the approval transaction FIRST ⭐\n\n` +
            `Step 2: Execute CCIP Transfer\n` +
            `5. Still in "Pending Transactions" tab\n` +
            `6. Find the CCIP transfer transaction (to: CCIP Router)\n` +
            `7. Confirm with other owners (if needed)\n` +
            `8. EXECUTE to send tokens cross-chain! 🚀\n\n` +
            `Why 2 transactions? Safe cannot batch approval + transfer due to technical limitations.\n\n` +
            `After execution, track your transfer below.`
        );

        // Clear saved transfer (not needed anymore)
      } else {
        // CCIP transfer was proposed directly (no approval needed)
        setSuccess(
          `✅ CCIP Transfer Transaction Proposed!\n\n` +
            `Transfer Tx Hash: ${result.safeTxHash.substring(0, 20)}...\n\n` +
            `Token already approved - ready to transfer!\n\n` +
            `Next Steps:\n` +
            `1. Go to "Pending Transactions" tab\n` +
            `2. Find the CCIP transfer transaction (to: CCIP Router)\n` +
            `3. Confirm with other owners (if needed)\n` +
            `4. Execute to send tokens cross-chain! 🚀\n\n` +
            `After execution, track your transfer below.`
        );
      }

      // Reset form after successful proposal
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

  // Verify CCIP transaction was actually executed on-chain
  const handleVerifyTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setVerificationResult(null);

    if (!verifyTxHash.trim()) {
      setError("Please enter a transaction hash to verify");
      return;
    }

    setLoading(true);

    try {
      const result = await verifyCCIPTransactionOnChain(verifyTxHash, provider);
      setVerificationResult(result);

      if (result.success && result.ccipMessageId) {
        setCcipMessageId(result.ccipMessageId);
        setSuccess(
          `✅ CCIP Transfer Verified!\n\nMessage ID: ${result.ccipMessageId}\n\nTrack on CCIP Explorer: ${result.explorerUrl}`
        );
      } else {
        setError(`❌ ${result.message}`);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to verify CCIP transaction";
      setError(errorMessage);
      console.error("Error verifying transaction:", err);
    } finally {
      setLoading(false);
    }
  };

  // Debug: Check Safe balance and approval before proposing
  const handleDebugBalance = async () => {
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

      const debugResult = await debugCCIPSafeTransfer(
        safeAddress,
        formData.tokenSymbol,
        amountInSmallestUnit,
        sourceNetwork,
        formData.destinationNetwork as NetworkName,
        feeEstimate!.feeInWei,
        provider
      );

      if (debugResult.allChecksPass) {
        setSuccess(
          `✅ All checks passed!\n\n` +
            `Safe ETH Balance: ${debugResult.balanceCheck.safeBalanceEth} ETH\n` +
            `Fee Required: ${debugResult.balanceCheck.feeRequiredEth} ETH\n` +
            (debugResult.approvalCheck
              ? `Token Approval: ${debugResult.approvalCheck.currentAllowanceFormatted} ${formData.tokenSymbol}\n`
              : "") +
            `\nSafe is ready to execute CCIP transfer!`
        );
      } else {
        setError(
          `❌ Pre-flight checks failed:\n\n${debugResult.issues.join(
            "\n\n"
          )}\n\n` +
            `Current Safe ETH Balance: ${debugResult.balanceCheck.safeBalanceEth} ETH\n` +
            `Fee Required: ${debugResult.balanceCheck.feeRequiredEth} ETH`
        );
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to debug balance";
      setError(errorMessage);
      console.error("Error debugging balance:", err);
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

  // NEW: Check if token is approved before executing
  const handleCheckApproval = async () => {
    if (!formData.tokenSymbol) {
      setError("Please select a token first");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await checkApprovalStatus(
        safeAddress,
        formData.tokenSymbol,
        sourceNetwork,
        provider
      );

      setApprovalCheckResult(result);

      if (result.isApproved) {
        setSuccess(
          `✅ Token Approved!\n\n` +
            `${result.recommendation}\n\n` +
            `Router: ${result.routerAddress}\n` +
            `Token: ${result.tokenAddress}`
        );
      } else {
        setError(
          `❌ Token NOT Approved!\n\n` +
            `${result.recommendation}\n\n` +
            `You must execute the APPROVAL transaction first!\n\n` +
            `Steps:\n` +
            `1. Go to "Pending Transactions" tab\n` +
            `2. Find the approval transaction (to: ${formData.tokenSymbol} Token)\n` +
            `3. Execute it BEFORE executing CCIP send\n\n` +
            `Router: ${result.routerAddress}\n` +
            `Token: ${result.tokenAddress}`
        );
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to check approval";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // NEW: Full readiness check before execution
  const handleCheckReadiness = async () => {
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

      const result = await checkSafeCCIPReadiness(
        safeAddress,
        formData.tokenSymbol,
        formData.amount,
        sourceNetwork,
        formData.destinationNetwork as NetworkName,
        provider
      );

      setReadinessCheckResult(result);

      if (result.isReady) {
        setSuccess(
          `✅ Safe is READY for CCIP Transfer!\n\n` +
            `✓ Token Balance: ${result.checks.tokenBalanceFormatted} ${formData.tokenSymbol}\n` +
            `✓ ETH Balance: ${result.checks.nativeBalanceFormatted} ETH\n` +
            `✓ Token Approved: ${result.checks.approvalAmountFormatted} ${formData.tokenSymbol}\n\n` +
            `You can now execute the CCIP transfer transaction!`
        );
      } else {
        setError(
          `❌ Safe NOT Ready!\n\n` +
            `Issues Found:\n${result.issues
              .map((issue, i) => `${i + 1}. ${issue}`)
              .join("\n")}\n\n` +
            `Recommendations:\n${result.recommendations
              .map((rec, i) => `${i + 1}. ${rec}`)
              .join("\n")}\n\n` +
            `Current Status:\n` +
            `- Token Balance: ${result.checks.tokenBalanceFormatted} ${formData.tokenSymbol}\n` +
            `- ETH Balance: ${result.checks.nativeBalanceFormatted} ETH\n` +
            `- Token Approved: ${result.checks.approvalAmountFormatted} ${formData.tokenSymbol}`
        );
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to check readiness";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // NEW: Analyze a failed transaction
  const handleAnalyzeTransaction = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!analyzeTxHash) {
      setError("Please enter a transaction hash");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await analyzeSafeTransactionFailure(
        analyzeTxHash,
        provider
      );

      setAnalysisResult(result);

      const statusEmoji = result.blockchainTxSuccess
        ? result.safeExecutionSuccess
          ? "✅"
          : "⚠️"
        : "❌";

      setSuccess(
        `${statusEmoji} Transaction Analysis\n\n` +
          `Blockchain Success: ${result.blockchainTxSuccess ? "✅" : "❌"}\n` +
          `Safe Execution Success: ${
            result.safeExecutionSuccess ? "✅" : "❌"
          }\n` +
          `Has CCIP Event: ${result.diagnostics.hasCCIPEvent ? "✅" : "❌"}\n` +
          `Has Execution Failure: ${
            result.diagnostics.hasExecutionFailure ? "✅" : "❌"
          }\n\n` +
          `Failure Reason:\n${result.failureReason}\n\n` +
          `Recommendation:\n${result.recommendation}\n\n` +
          `Gas Used: ${result.diagnostics.gasUsed}\n` +
          `Etherscan: ${result.diagnostics.etherscanUrl}`
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to analyze transaction";
      setError(errorMessage);
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

            {/* Debug Balance Button */}
            <button
              type="button"
              onClick={handleDebugBalance}
              disabled={loading}
              className="secondary"
              style={{
                marginTop: "1rem",
                backgroundColor: "#17a2b8",
                color: "white",
                border: "none",
              }}
            >
              {loading ? "Checking..." : "🔍 Debug: Check Safe Balance"}
            </button>
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

      {/* NEW: Pre-Execution Checks Section */}
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
              d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Pre-Execution Checks
        </h3>
        <p className="info-text">
          ⚠️ Before executing CCIP transfer, check if everything is ready!
        </p>

        <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
          <button
            type="button"
            onClick={handleCheckApproval}
            disabled={loading || !formData.tokenSymbol}
            style={{
              flex: 1,
              padding: "0.75rem",
              backgroundColor: "#ffc107",
              color: "black",
              border: "none",
              borderRadius: "8px",
              fontWeight: "500",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Checking..." : "🔍 Check Token Approval"}
          </button>

          <button
            type="button"
            onClick={handleCheckReadiness}
            disabled={loading || !isFormValid(false)}
            style={{
              flex: 1,
              padding: "0.75rem",
              backgroundColor: "#28a745",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: "500",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Checking..." : "✅ Full Readiness Check"}
          </button>
        </div>

        <div
          style={{
            backgroundColor: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: "8px",
            padding: "1rem",
            marginBottom: "1rem",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.875rem", lineHeight: "1.5" }}>
            <strong>⚠️ IMPORTANT:</strong> When CCIP transfer needs approval,
            TWO transactions are proposed:
            <br />
            <br />
            1️⃣ <strong>Approval Transaction</strong> - Must execute FIRST
            <br />
            2️⃣ <strong>CCIP Transfer Transaction</strong> - Execute AFTER
            approval
            <br />
            <br />
            Use these checks to verify approval status before executing!
          </p>
        </div>
      </div>

      {/* NEW: Transaction Analysis Section */}
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
              d="M9 5H7C5.89543 5 5 5.89543 5 7V19C5 20.1046 5.89543 21 7 21H17C18.1046 21 19 20.1046 19 19V7C19 5.89543 18.1046 5 17 5H15M9 5C9 6.10457 9.89543 7 11 7H13C14.1046 7 15 6.10457 15 5M9 5C9 3.89543 9.89543 3 11 3H13C14.1046 3 15 3.89543 15 5M12 12H15M12 16H15M9 12H9.01M9 16H9.01"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Analyze Failed Transaction
        </h3>
        <p className="info-text">
          If your CCIP transfer failed (isSuccessful: false), analyze it here to
          find the exact cause!
        </p>

        <form onSubmit={handleAnalyzeTransaction}>
          <div className="form-group">
            <label>Transaction Hash</label>
            <input
              type="text"
              placeholder="0x..."
              value={analyzeTxHash}
              onChange={(e) => setAnalyzeTxHash(e.target.value)}
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !analyzeTxHash}
            style={{
              width: "100%",
              padding: "0.75rem",
              backgroundColor: "#dc3545",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontWeight: "500",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Analyzing..." : "🔍 Analyze Transaction"}
          </button>
        </form>
      </div>

      {/* CCIP Transaction Verification Section */}
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
              d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          ⚠️ Verify CCIP Transaction
        </h3>

        <div
          className="info-text"
          style={{
            backgroundColor: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: "4px",
            padding: "1rem",
            marginBottom: "1rem",
          }}
        >
          <strong>⚠️ IMPORTANT: Use This First!</strong>
          <p style={{ marginTop: "0.5rem", marginBottom: 0 }}>
            After executing a CCIP transfer through Safe, use this verification
            tool to confirm the CCIP message was actually sent on-chain. This
            will check if the transaction contains a CCIP message ID.
          </p>
        </div>

        <form onSubmit={handleVerifyTransaction}>
          <div className="form-group">
            <label htmlFor="verifyTxHash">
              Transaction Hash (from executed Safe transaction)
            </label>
            <input
              type="text"
              id="verifyTxHash"
              placeholder="0x..."
              value={verifyTxHash}
              onChange={(e) => setVerifyTxHash(e.target.value)}
            />
            <small>
              Enter the blockchain transaction hash after executing your CCIP
              transfer
            </small>
          </div>

          <button
            type="submit"
            className="primary"
            disabled={loading || !verifyTxHash.trim()}
            style={{ backgroundColor: "#28a745" }}
          >
            {loading ? "Verifying..." : "✓ Verify CCIP Transaction"}
          </button>
        </form>

        {verificationResult && (
          <div
            className="tracking-result"
            style={{
              backgroundColor: verificationResult.success
                ? "#d4edda"
                : "#f8d7da",
              border: `1px solid ${
                verificationResult.success ? "#c3e6cb" : "#f5c6cb"
              }`,
            }}
          >
            <p
              style={{
                fontWeight: "bold",
                color: verificationResult.success ? "#155724" : "#721c24",
              }}
            >
              {verificationResult.success ? "✅ Success!" : "❌ Failed"}
            </p>
            <p style={{ whiteSpace: "pre-wrap" }}>
              {verificationResult.message}
            </p>

            {/* Diagnostics Info */}
            {verificationResult.diagnostics && (
              <div
                style={{
                  marginTop: "1rem",
                  padding: "0.75rem",
                  backgroundColor: "rgba(0,0,0,0.05)",
                  borderRadius: "4px",
                  fontSize: "0.875rem",
                }}
              >
                <p style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>
                  📊 Diagnostics:
                </p>
                <ul style={{ margin: 0, paddingLeft: "1.5rem" }}>
                  <li>
                    Blockchain TX:{" "}
                    {verificationResult.diagnostics.blockchainTxSuccess
                      ? "✅ Success"
                      : "❌ Failed"}
                  </li>
                  <li>
                    Safe Execution:{" "}
                    {verificationResult.diagnostics.safeExecutionSuccess
                      ? "✅ Success"
                      : "❌ Failed"}
                  </li>
                  <li>
                    CCIP Event Found:{" "}
                    {verificationResult.diagnostics.hasCCIPEvent
                      ? "✅ Yes"
                      : "❌ No"}
                  </li>
                </ul>
                <p style={{ marginTop: "0.5rem", marginBottom: 0 }}>
                  <a
                    href={verificationResult.diagnostics.etherscanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#007bff" }}
                  >
                    🔗 View on Etherscan →
                  </a>
                </p>
              </div>
            )}

            {verificationResult.ccipMessageId && (
              <div style={{ marginTop: "1rem" }}>
                <p>
                  <strong>CCIP Message ID:</strong>
                </p>
                <div className="message-id">
                  {verificationResult.ccipMessageId}
                </div>

                {verificationResult.explorerUrl && (
                  <p style={{ marginTop: "1rem" }}>
                    <a
                      href={verificationResult.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#007bff" }}
                    >
                      🔗 View on CCIP Explorer →
                    </a>
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

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
          If verification succeeded, you can also track the CCIP transfer status
          using the transaction hash.
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

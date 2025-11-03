import { useState } from "react";
import { BrowserProvider, ethers } from "ethers";
import {
  getNetworkConfig,
  getSupportedTokens,
  DEFAULT_SOURCE_NETWORK,
} from "../lib/ccipConfig";
import { proposeTransaction } from "../lib/safeFlow";

interface TokenApprovalProps {
  safeAddress: string;
  provider: BrowserProvider;
  onSuccess: () => void;
}

const IERC20ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

export default function TokenApproval({
  safeAddress,
  provider,
  onSuccess,
}: TokenApprovalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  // Form state
  const [formData, setFormData] = useState({
    tokenSymbol: "",
    amount: "",
    spenderType: "router" as "router" | "custom",
    customSpender: "",
  });

  // Current allowance display
  const [currentAllowance, setCurrentAllowance] = useState<string>("");

  const sourceNetwork = DEFAULT_SOURCE_NETWORK;
  const supportedTokens = getSupportedTokens(sourceNetwork);
  const networkConfig = getNetworkConfig(sourceNetwork);

  // Check current allowance
  const handleCheckAllowance = async () => {
    if (!formData.tokenSymbol) {
      setError("Please select a token");
      return;
    }

    setLoading(true);
    setError("");
    setCurrentAllowance("");

    try {
      const token = supportedTokens.find(
        (t) => t.symbol === formData.tokenSymbol
      );
      if (!token) {
        throw new Error("Token not found");
      }

      const spender =
        formData.spenderType === "router"
          ? networkConfig.routerAddress
          : formData.customSpender;

      if (!spender || !ethers.isAddress(spender)) {
        throw new Error("Invalid spender address");
      }

      const tokenContract = new ethers.Contract(
        token.address,
        IERC20ABI,
        provider
      );

      const allowance = (await tokenContract.allowance(
        safeAddress,
        spender
      )) as bigint;
      const decimals = (await tokenContract.decimals()) as number;

      const formatted = ethers.formatUnits(allowance, decimals);
      setCurrentAllowance(formatted);
      setSuccess(
        `Current allowance: ${formatted} ${formData.tokenSymbol}\nSpender: ${spender}`
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to check allowance";
      setError(errorMessage);
      console.error("Error checking allowance:", err);
    } finally {
      setLoading(false);
    }
  };

  // Propose approval transaction
  const handleProposeApproval = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      // Validation
      if (!formData.tokenSymbol) {
        throw new Error("Please select a token");
      }

      if (!formData.amount || parseFloat(formData.amount) <= 0) {
        throw new Error("Please enter a valid amount");
      }

      const token = supportedTokens.find(
        (t) => t.symbol === formData.tokenSymbol
      );
      if (!token) {
        throw new Error("Token not found");
      }

      const spender =
        formData.spenderType === "router"
          ? networkConfig.routerAddress
          : formData.customSpender;

      if (!spender || !ethers.isAddress(spender)) {
        throw new Error("Invalid spender address");
      }

      // Convert amount to smallest unit
      const amountInSmallestUnit = ethers.parseUnits(
        formData.amount,
        token.decimals
      );

      // Build approval transaction
      const tokenContract = new ethers.Contract(
        token.address,
        IERC20ABI,
        provider
      );

      const approvalData = tokenContract.interface.encodeFunctionData(
        "approve",
        [spender, amountInSmallestUnit]
      );

      // Propose transaction
      const safeTxHash = await proposeTransaction(
        safeAddress,
        {
          to: token.address,
          value: "0",
          data: approvalData,
          operation: 0, // Call
        },
        provider
      );

      setSuccess(
        `✅ Approval Transaction Proposed!\n\n` +
          `Token: ${token.symbol}\n` +
          `Amount: ${formData.amount} ${token.symbol}\n` +
          `Spender: ${spender.substring(0, 10)}...${spender.substring(38)}\n` +
          `Transaction Hash: ${safeTxHash.substring(0, 20)}...\n\n` +
          `💡 This is a STANDALONE approval transaction.\n` +
          `After execution, future CCIP transfers won't need approval!\n\n` +
          `Next Steps:\n` +
          `1. Go to "Pending Transactions" tab\n` +
          `2. Confirm with other owners (if needed)\n` +
          `3. Execute to approve tokens! 🚀`
      );

      // Reset form
      setFormData({
        tokenSymbol: "",
        amount: "",
        spenderType: "router",
        customSpender: "",
      });
      setCurrentAllowance("");

      onSuccess();
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to propose approval";
      setError(errorMessage);
      console.error("Error proposing approval:", err);
    } finally {
      setLoading(false);
    }
  };

  // Quick preset amounts
  const setPresetAmount = (preset: string) => {
    setFormData({ ...formData, amount: preset });
  };

  return (
    <div className="token-approval">
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
        Pre-Approve Tokens
      </h3>

      <p className="info-text">
        Pre-approve tokens for CCIP Router to avoid approval step in every
        transfer. Set a large allowance once, then execute CCIP transfers
        without additional approvals.
      </p>

      <div className="info-box" style={{ marginBottom: "1.5rem" }}>
        <strong>💡 Why Pre-Approve?</strong>
        <ul style={{ marginTop: "0.5rem", paddingLeft: "1.5rem" }}>
          <li>
            <strong>Solves nonce conflict issue</strong> when using native fees
          </li>
          <li>
            Future CCIP transfers only need <strong>1 transaction</strong>{" "}
            (ccipSend)
          </li>
          <li>
            Faster execution - no waiting for approval confirmation first
          </li>
          <li>Lower gas costs overall (approve once, transfer many times)</li>
        </ul>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <form onSubmit={handleProposeApproval}>
        {/* Token Selection */}
        <div className="form-group">
          <label>Token to Approve *</label>
          <select
            value={formData.tokenSymbol}
            onChange={(e) =>
              setFormData({ ...formData, tokenSymbol: e.target.value })
            }
            disabled={loading}
            required
          >
            <option value="">Select token</option>
            {supportedTokens.map((token) => (
              <option key={token.address} value={token.symbol}>
                {token.name} ({token.symbol})
              </option>
            ))}
          </select>
          <small>Token to grant spending permission for</small>
        </div>

        {/* Spender Type */}
        {formData.tokenSymbol && (
          <div className="form-group">
            <label>Approve For *</label>
            <div style={{ display: "flex", gap: "1rem", marginBottom: "0.5rem" }}>
              <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                <input
                  type="radio"
                  value="router"
                  checked={formData.spenderType === "router"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      spenderType: e.target.value as "router" | "custom",
                    })
                  }
                  style={{ marginRight: "0.5rem" }}
                />
                CCIP Router (Recommended)
              </label>
              <label style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                <input
                  type="radio"
                  value="custom"
                  checked={formData.spenderType === "custom"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      spenderType: e.target.value as "router" | "custom",
                    })
                  }
                  style={{ marginRight: "0.5rem" }}
                />
                Custom Address
              </label>
            </div>

            {formData.spenderType === "router" ? (
              <div
                style={{
                  padding: "0.75rem",
                  background: "#f5f5f5",
                  borderRadius: "4px",
                  fontSize: "0.85rem",
                  wordBreak: "break-all",
                }}
              >
                <strong>Router:</strong> {networkConfig.routerAddress}
              </div>
            ) : (
              <input
                type="text"
                placeholder="0x..."
                value={formData.customSpender}
                onChange={(e) =>
                  setFormData({ ...formData, customSpender: e.target.value })
                }
                disabled={loading}
                required
              />
            )}
          </div>
        )}

        {/* Amount */}
        {formData.tokenSymbol && (
          <>
            <div className="form-group">
              <label>Approval Amount *</label>
              <input
                type="text"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                placeholder="e.g., 1000000 (1 million tokens)"
                disabled={loading}
                required
              />
              <small>Amount of {formData.tokenSymbol} to approve</small>
            </div>

            {/* Quick Presets */}
            <div
              className="form-group"
              style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}
            >
              <button
                type="button"
                onClick={() => setPresetAmount("1000")}
                disabled={loading}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.85rem",
                  background: "#e3f2fd",
                  border: "1px solid #2196f3",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                1,000
              </button>
              <button
                type="button"
                onClick={() => setPresetAmount("10000")}
                disabled={loading}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.85rem",
                  background: "#e3f2fd",
                  border: "1px solid #2196f3",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                10,000
              </button>
              <button
                type="button"
                onClick={() => setPresetAmount("100000")}
                disabled={loading}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.85rem",
                  background: "#e3f2fd",
                  border: "1px solid #2196f3",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                100,000
              </button>
              <button
                type="button"
                onClick={() => setPresetAmount("1000000")}
                disabled={loading}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.85rem",
                  background: "#fff3e0",
                  border: "1px solid #ff9800",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                1,000,000 ⭐
              </button>
              <button
                type="button"
                onClick={() =>
                  setPresetAmount(
                    "115792089237316195423570985008687907853269984665640564039457584007913129639935"
                  )
                }
                disabled={loading}
                style={{
                  padding: "0.5rem 1rem",
                  fontSize: "0.85rem",
                  background: "#fce4ec",
                  border: "1px solid #e91e63",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                MAX (uint256)
              </button>
            </div>
          </>
        )}

        {/* Action Buttons */}
        <div
          style={{
            display: "flex",
            gap: "1rem",
            marginTop: "1.5rem",
          }}
        >
          <button
            type="button"
            onClick={handleCheckAllowance}
            disabled={loading || !formData.tokenSymbol}
            style={{
              flex: 1,
              padding: "0.75rem",
              background: "#fff",
              border: "2px solid #2196f3",
              color: "#2196f3",
              borderRadius: "4px",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: "bold",
            }}
          >
            {loading ? "Checking..." : "Check Current Allowance"}
          </button>

          <button
            type="submit"
            disabled={
              loading ||
              !formData.tokenSymbol ||
              !formData.amount ||
              parseFloat(formData.amount || "0") <= 0
            }
            style={{
              flex: 1,
              padding: "0.75rem",
              background: "#4caf50",
              border: "none",
              color: "white",
              borderRadius: "4px",
              cursor:
                loading ||
                !formData.tokenSymbol ||
                !formData.amount ||
                parseFloat(formData.amount || "0") <= 0
                  ? "not-allowed"
                  : "pointer",
              fontWeight: "bold",
            }}
          >
            {loading ? "Proposing..." : "Propose Approval"}
          </button>
        </div>
      </form>

      {/* Current Allowance Display */}
      {currentAllowance && (
        <div
          style={{
            marginTop: "1.5rem",
            padding: "1rem",
            background: "#e8f5e9",
            borderLeft: "4px solid #4caf50",
            borderRadius: "4px",
          }}
        >
          <strong>Current Allowance:</strong> {currentAllowance}{" "}
          {formData.tokenSymbol}
        </div>
      )}

      <style>{`
        .token-approval {
          padding: 1.5rem;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .token-approval h3 {
          margin: 0 0 1rem 0;
          color: #333;
          display: flex;
          align-items: center;
        }

        .info-text {
          color: #666;
          margin-bottom: 1rem;
          line-height: 1.6;
        }

        .info-box {
          padding: 1rem;
          background: #e3f2fd;
          border-left: 4px solid #2196f3;
          border-radius: 4px;
        }

        .info-box strong {
          color: #1976d2;
        }

        .info-box ul {
          color: #424242;
          line-height: 1.8;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: 500;
          color: #333;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 0.75rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 1rem;
        }

        .form-group small {
          display: block;
          margin-top: 0.25rem;
          color: #666;
          font-size: 0.85rem;
        }

        .error-message {
          padding: 1rem;
          background: #ffebee;
          color: #c62828;
          border-left: 4px solid #c62828;
          border-radius: 4px;
          margin-bottom: 1rem;
          white-space: pre-wrap;
        }

        .success-message {
          padding: 1rem;
          background: #e8f5e9;
          color: #2e7d32;
          border-left: 4px solid #4caf50;
          border-radius: 4px;
          margin-bottom: 1rem;
          white-space: pre-wrap;
        }
      `}</style>
    </div>
  );
}

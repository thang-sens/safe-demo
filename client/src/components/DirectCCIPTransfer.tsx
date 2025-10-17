import { useState } from "react";
import { BrowserProvider, ethers } from "ethers";
import {
  createClient,
  ethersProviderToPublicClient,
  ethersSignerToWalletClient,
} from "@chainlink/ccip-js";
import {
  sepolia,
  baseSepolia,
  arbitrumSepolia,
  avalancheFuji,
  polygonAmoy,
} from "viem/chains";
import {
  getNetworkConfig,
  getTokenBySymbol,
  getAvailableDestinationNetworks,
  getSupportedTokens,
  DEFAULT_SOURCE_NETWORK,
  NetworkNameMapping,
} from "../lib/ccipConfig";
import type { NetworkName } from "../lib/ccipConfig";

interface DirectCCIPTransferProps {
  provider: BrowserProvider;
  userAddress: string;
}

export default function DirectCCIPTransfer({
  provider,
  userAddress,
}: DirectCCIPTransferProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [txHash, setTxHash] = useState<string>("");
  const [messageId, setMessageId] = useState<string>("");

  // Form state
  const [formData, setFormData] = useState({
    destinationNetwork: "" as NetworkName | "",
    tokenSymbol: "",
    amount: "",
    recipientAddress: "",
  });

  const [feeEstimate, setFeeEstimate] = useState<string>("");

  const sourceNetwork = DEFAULT_SOURCE_NETWORK;
  const destinationNetworks = getAvailableDestinationNetworks(sourceNetwork);
  const supportedTokens = getSupportedTokens(sourceNetwork);

  // Handle destination network change
  const handleNetworkChange = (network: string) => {
    setFormData({
      ...formData,
      destinationNetwork: NetworkNameMapping[network],
      tokenSymbol: "",
    });
    setFeeEstimate("");
  };

  // Handle token change
  const handleTokenChange = (symbol: string) => {
    setFormData({
      ...formData,
      tokenSymbol: symbol,
    });
    setFeeEstimate("");
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

  // Get viem chain config - use standard Viem chains
  const getViemChain = (networkName: NetworkName) => {
    switch (networkName) {
      case "ethereum-sepolia":
        return sepolia;
      case "base-sepolia":
        return baseSepolia;
      case "arbitrum-sepolia":
        return arbitrumSepolia;
      case "avalanche-fuji":
        return avalancheFuji;
      case "polygon-amoy":
        return polygonAmoy;
      default:
        throw new Error(`Unsupported network: ${networkName}`);
    }
  };

  // Calculate fee using SDK
  const handleCalculateFee = async () => {
    if (!validateForm(false)) return;

    setLoading(true);
    setError("");
    setFeeEstimate("");

    try {
      const sourceConfig = getNetworkConfig(sourceNetwork);
      const destConfig = getNetworkConfig(
        formData.destinationNetwork as NetworkName
      );
      const token = getTokenBySymbol(sourceNetwork, formData.tokenSymbol);

      if (!token) {
        throw new Error(`Token not found: ${formData.tokenSymbol}`);
      }

      // Convert amount to smallest unit
      const amountInSmallestUnit = ethers.parseUnits(
        formData.amount,
        token.decimals
      );

      // Create viem public client using ethers adapter
      const sourceChain = getViemChain(sourceNetwork);
      const publicClient = ethersProviderToPublicClient(
        provider as any, // Type cast to work around version differences
        sourceChain
      );

      const ccipClient = createClient();

      // Get fee with proper extraArgs
      const fee = await ccipClient.getFee({
        client: publicClient as any,
        routerAddress: sourceConfig.routerAddress as `0x${string}`,
        destinationChainSelector: destConfig.chainSelector,
        destinationAccount: formData.recipientAddress as `0x${string}`,
        amount: amountInSmallestUnit,
        tokenAddress: token.address as `0x${string}`,
        extraArgs: {
          gasLimit: 200000, // 200k gas for destination
          allowOutOfOrderExecution: true,
        },
      });

      const feeInEth = ethers.formatEther(fee);
      setFeeEstimate(feeInEth);
      setSuccess(`Fee calculated: ${feeInEth} ETH`);
    } catch (err) {
      console.error("Fee calculation error:", err);
      setError(err instanceof Error ? err.message : "Failed to calculate fee");
    } finally {
      setLoading(false);
    }
  };

  // Execute direct transfer using SDK
  const handleDirectTransfer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm(true)) return;

    setLoading(true);
    setError("");
    setSuccess("");
    setTxHash("");
    setMessageId("");

    try {
      const sourceConfig = getNetworkConfig(sourceNetwork);
      const destConfig = getNetworkConfig(
        formData.destinationNetwork as NetworkName
      );
      const token = getTokenBySymbol(sourceNetwork, formData.tokenSymbol);

      if (!token) {
        throw new Error(`Token not found: ${formData.tokenSymbol}`);
      }

      console.log("[Direct CCIP] Starting transfer...");
      console.log("[Direct CCIP] Source:", sourceNetwork);
      console.log("[Direct CCIP] Destination:", formData.destinationNetwork);
      console.log("[Direct CCIP] Token:", formData.tokenSymbol);
      console.log("[Direct CCIP] Amount:", formData.amount);
      console.log("[Direct CCIP] Recipient:", formData.recipientAddress);

      // Convert amount to smallest unit
      const amountInSmallestUnit = ethers.parseUnits(
        formData.amount,
        token.decimals
      );

      // Get signer from the provider
      const signer = await provider.getSigner();

      // Create viem clients using ethers adapters
      const sourceChain = getViemChain(sourceNetwork);

      console.log("[Direct CCIP] Creating wallet client...");
      const walletClient = await ethersSignerToWalletClient(
        signer as any, // Type cast to work around version differences
        sourceChain
      );

      console.log("[Direct CCIP] Creating public client...");
      const publicClient = ethersProviderToPublicClient(
        provider as any, // Type cast to work around version differences
        sourceChain
      );

      const ccipClient = createClient();

      // Step 1: Check allowance
      console.log("[Direct CCIP] Checking token allowance...");
      const allowance = await ccipClient.getAllowance({
        client: publicClient as any,
        routerAddress: sourceConfig.routerAddress as `0x${string}`,
        tokenAddress: token.address as `0x${string}`,
        account: userAddress as `0x${string}`,
      });

      console.log(
        `[Direct CCIP] Current allowance: ${allowance}, needed: ${amountInSmallestUnit}`
      );

      // Step 2: Approve if needed
      if (allowance < amountInSmallestUnit) {
        console.log("[Direct CCIP] Approving token...");
        setSuccess("Approving token for transfer...");

        const { txHash: approveTxHash } = await ccipClient.approveRouter({
          client: walletClient,
          routerAddress: sourceConfig.routerAddress as `0x${string}`,
          tokenAddress: token.address as `0x${string}`,
          amount: amountInSmallestUnit,
          waitForReceipt: true,
        });

        console.log("[Direct CCIP] Approval tx:", approveTxHash);
        setSuccess(`Token approved! Tx: ${approveTxHash.slice(0, 10)}...`);
      } else {
        console.log("[Direct CCIP] Token already approved");
      }

      // Step 3: Calculate the fee before sending
      console.log("[Direct CCIP] Calculating CCIP fee...");
      const ccipFee = await ccipClient.getFee({
        client: publicClient as any,
        routerAddress: sourceConfig.routerAddress as `0x${string}`,
        destinationChainSelector: destConfig.chainSelector,
        destinationAccount: formData.recipientAddress as `0x${string}`,
        amount: amountInSmallestUnit,
        tokenAddress: token.address as `0x${string}`,
        extraArgs: {
          gasLimit: 200000, // 200k gas for destination
          allowOutOfOrderExecution: true,
        },
      });

      const ccipFeeInEth = ethers.formatEther(ccipFee);
      console.log("[Direct CCIP] CCIP fee:", ccipFeeInEth, "ETH");

      // Step 3.5: Check wallet balance (need CCIP fee + gas for the transaction)
      console.log("[Direct CCIP] Checking wallet balance...");
      const balance = await provider.getBalance(userAddress);
      const balanceInEth = ethers.formatEther(balance);
      console.log("[Direct CCIP] Wallet balance:", balanceInEth, "ETH");

      // Estimate gas buffer (typically 0.001-0.002 ETH for gas on Sepolia)
      const gasBuffer = ethers.parseEther("0.002"); // 0.002 ETH safety buffer for gas
      const totalNeeded = ccipFee + gasBuffer;
      const totalNeededInEth = ethers.formatEther(totalNeeded);

      if (balance < totalNeeded) {
        throw new Error(
          `Insufficient ETH balance. Need ${totalNeededInEth} ETH (${ccipFeeInEth} ETH fee + 0.002 ETH gas), but only have ${balanceInEth} ETH. Please add more ETH to your wallet.`
        );
      }

      console.log(
        `[Direct CCIP] Balance check passed: ${balanceInEth} ETH >= ${totalNeededInEth} ETH (fee + gas)`
      );

      setSuccess(
        `Fee: ${ccipFeeInEth} ETH (Balance: ${balanceInEth} ETH). Sending transaction...`
      );

      // Step 4: Execute transfer with extraArgs
      console.log("[Direct CCIP] Executing CCIP transfer...");

      const result = await ccipClient.transferTokens({
        client: walletClient as any,
        routerAddress: sourceConfig.routerAddress as `0x${string}`,
        destinationChainSelector: destConfig.chainSelector,
        destinationAccount: formData.recipientAddress as `0x${string}`,
        amount: amountInSmallestUnit,
        tokenAddress: token.address as `0x${string}`,
        extraArgs: {
          gasLimit: 200000, // 200k gas for destination
          allowOutOfOrderExecution: true,
        },
      });

      console.log("[Direct CCIP] ✅ Transfer successful!");
      console.log("[Direct CCIP] Transaction hash:", result.txHash);
      console.log("[Direct CCIP] Message ID:", result.messageId);

      setTxHash(result.txHash);
      setMessageId(result.messageId);
      setSuccess(`✅ Transfer successful! Check CCIP Explorer for status.`);
    } catch (err) {
      console.error("[Direct CCIP] ❌ Transfer failed:", err);
      setError(
        err instanceof Error ? err.message : "Failed to execute transfer"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="direct-ccip-transfer">
      <h3>🚀 Direct CCIP Transfer (No Multisig)</h3>
      <p className="info-text">
        Test CCIP SDK integration directly without Safe multisig workflow
      </p>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <form onSubmit={handleDirectTransfer}>
        {/* Destination Network */}
        <div className="form-group">
          <label>Destination Network:</label>
          <select
            value={formData.destinationNetwork}
            onChange={(e) => handleNetworkChange(e.target.value)}
            disabled={loading}
          >
            <option value="">Select destination...</option>
            {destinationNetworks.map((network) => (
              <option key={network.name} value={network.name}>
                {network.name}
              </option>
            ))}
          </select>
        </div>

        {/* Token */}
        {formData.destinationNetwork && (
          <div className="form-group">
            <label>Token:</label>
            <select
              value={formData.tokenSymbol}
              onChange={(e) => handleTokenChange(e.target.value)}
              disabled={loading}
            >
              <option value="">Select token...</option>
              {supportedTokens.map((token) => (
                <option key={token.symbol} value={token.symbol}>
                  {token.symbol} - {token.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Amount */}
        {formData.tokenSymbol && (
          <div className="form-group">
            <label>Amount:</label>
            <input
              type="number"
              step="0.000001"
              value={formData.amount}
              onChange={(e) =>
                setFormData({ ...formData, amount: e.target.value })
              }
              placeholder="0.001"
              disabled={loading}
            />
          </div>
        )}

        {/* Recipient */}
        {formData.amount && (
          <div className="form-group">
            <label>Recipient Address:</label>
            <input
              type="text"
              value={formData.recipientAddress}
              onChange={(e) =>
                setFormData({ ...formData, recipientAddress: e.target.value })
              }
              placeholder="0x..."
              disabled={loading}
            />
          </div>
        )}

        {/* Calculate Fee Button */}
        {formData.recipientAddress && (
          <button
            type="button"
            onClick={handleCalculateFee}
            disabled={loading}
            className="secondary-button"
          >
            {loading ? "Calculating..." : "Calculate Fee"}
          </button>
        )}

        {/* Fee Display */}
        {feeEstimate && (
          <div className="fee-display">
            <strong>Estimated Fee:</strong> {feeEstimate} ETH
          </div>
        )}

        {/* Execute Transfer Button */}
        {feeEstimate && (
          <button type="submit" disabled={loading} className="primary-button">
            {loading ? "Processing..." : "🚀 Execute Direct Transfer"}
          </button>
        )}
      </form>

      {/* Results */}
      {txHash && (
        <div className="result-section">
          <h4>✅ Transfer Results:</h4>
          <div className="result-item">
            <strong>Transaction Hash:</strong>
            <a
              href={`https://sepolia.etherscan.io/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {txHash}
            </a>
          </div>
          {messageId && (
            <div className="result-item">
              <strong>CCIP Message ID:</strong>
              <a
                href={`https://ccip.chain.link/msg/${messageId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {messageId}
              </a>
            </div>
          )}
          <p className="info-text">
            🔍 Track your cross-chain transfer on CCIP Explorer using the
            message ID above
          </p>
        </div>
      )}

      <style>{`
        .direct-ccip-transfer {
          padding: 20px;
          background: #f8f9fa;
          border-radius: 8px;
          margin: 20px 0;
        }

        .info-text {
          color: #666;
          font-size: 0.9em;
          margin-bottom: 15px;
        }

        .form-group {
          margin-bottom: 15px;
        }

        .form-group label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
          color: #333;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 10px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #4CAF50;
        }

        .secondary-button,
        .primary-button {
          padding: 12px 24px;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          margin-top: 10px;
          width: 100%;
        }

        .secondary-button {
          background: #2196F3;
          color: white;
        }

        .secondary-button:hover:not(:disabled) {
          background: #1976D2;
        }

        .primary-button {
          background: #4CAF50;
          color: white;
          font-weight: bold;
        }

        .primary-button:hover:not(:disabled) {
          background: #45a049;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .fee-display {
          padding: 12px;
          background: #e3f2fd;
          border-left: 4px solid #2196F3;
          margin: 15px 0;
          border-radius: 4px;
        }

        .error-message {
          padding: 12px;
          background: #ffebee;
          border-left: 4px solid #f44336;
          color: #c62828;
          margin-bottom: 15px;
          border-radius: 4px;
        }

        .success-message {
          padding: 12px;
          background: #e8f5e9;
          border-left: 4px solid #4CAF50;
          color: #2e7d32;
          margin-bottom: 15px;
          border-radius: 4px;
        }

        .result-section {
          margin-top: 20px;
          padding: 15px;
          background: white;
          border-radius: 8px;
          border: 2px solid #4CAF50;
        }

        .result-section h4 {
          margin-top: 0;
          color: #4CAF50;
        }

        .result-item {
          margin: 10px 0;
          padding: 10px;
          background: #f5f5f5;
          border-radius: 4px;
        }

        .result-item strong {
          display: block;
          margin-bottom: 5px;
          color: #333;
        }

        .result-item a {
          color: #2196F3;
          text-decoration: none;
          word-break: break-all;
        }

        .result-item a:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}

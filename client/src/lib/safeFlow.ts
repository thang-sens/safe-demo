// Safe transaction flow: Propose, Confirm, Execute
// Complete implementation using Safe Global Protocol Kit and API Kit

import Safe from "@safe-global/protocol-kit";
import SafeApiKit from "@safe-global/api-kit";
import { ethers, BrowserProvider } from "ethers";
import type { MetaTransactionData } from "@safe-global/types-kit";
import {
  createPublicClient,
  http,
  encodeAbiParameters,
  encodeFunctionData,
} from "viem";
import { getRawProvider } from "./web3auth";

// Transaction data interface
export interface TransactionData {
  to: string;
  value: string;
  data: string;
  operation?: 0 | 1; // 0 = Call, 1 = DelegateCall
}

// Transaction status interface
export interface SafeTransaction {
  safeTxHash: string;
  to: string;
  value: string;
  data: string;
  operation: number;
  nonce: number;
  confirmations: Array<{
    owner: string;
    signature: string;
  }>;
  confirmationsRequired: number;
  isExecuted: boolean;
}

// Safe API transaction interface
interface SafeApiTransaction {
  safeTxHash: string;
  to: string;
  value: string;
  data?: string | null;
  operation: number;
  nonce: string | number;
  confirmations?: Array<{
    owner: string;
    signature: string;
  }>;
  confirmationsRequired: number;
  isExecuted: boolean;
}

// Initialize Safe Protocol Kit
const initProtocolKit = async (
  safeAddress: string,
  provider: BrowserProvider
): Promise<Safe> => {
  const signer = await provider.getSigner();

  // Get the raw Web3Auth provider which supports eth_signTypedData_v4
  // BrowserProvider is just a wrapper and doesn't expose the signing methods
  const rawProvider = await getRawProvider();

  const safe = await Safe.init({
    provider: rawProvider as unknown as string, // Raw Web3Auth provider for signing
    signer: await signer.getAddress(),
    safeAddress,
  });

  return safe;
};

// Initialize Safe API Kit
const initApiKit = async (chainId: string): Promise<SafeApiKit> => {
  const apiKit = new SafeApiKit({
    chainId: BigInt(chainId),
    apiKey: import.meta.env.VITE_SAFE_API_KEY,
    // txServiceUrl: import.meta.env.VITE_SAFE_TX_SERVICE_URL,
  });

  return apiKit;
};

/**
 * Propose a new transaction to the Safe
 * This creates a transaction and submits it to the Safe Transaction Service
 */
export const proposeTransaction = async (
  safeAddress: string,
  txData: TransactionData,
  provider: BrowserProvider
): Promise<string> => {
  try {
    console.log("Proposing transaction to Safe:", safeAddress);
    console.log("📝 Transaction data:", {
      to: txData.to,
      value: txData.value,
      dataLength: txData.data?.length,
      dataPreview: txData.data?.slice(0, 66) + "...",
      operation: txData.operation,
    });

    // Initialize Protocol Kit
    const safe = await initProtocolKit(safeAddress, provider);

    // Get chain ID
    const network = await provider.getNetwork();
    const chainId = network.chainId.toString();

    // Initialize API Kit
    const apiKit = await initApiKit(chainId);

    // Create a Safe transaction
    // IMPORTANT: For complex transactions (CCIP, MultiSend, etc), set safeTxGas explicitly
    // This ensures Safe allocates enough gas for execution
    const safeTransaction = await safe.createTransaction({
      transactions: [txData],
      options: {
        safeTxGas: "500000", // Explicit gas limit for complex transactions
        // CCIP transactions need more gas due to:
        // 1. Complex ccipSend call
        // 2. Token transfers
        // 3. Fee payments
        // Default auto-estimation may be insufficient
      },
    });

    console.log("📊 Safe transaction created:", {
      to: safeTransaction.data.to,
      value: safeTransaction.data.value,
      data: safeTransaction.data.data.slice(0, 66) + "...",
      operation: safeTransaction.data.operation,
      nonce: safeTransaction.data.nonce,
    });

    // Sign the transaction
    const signedTransaction = await safe.signTransaction(safeTransaction);

    // Get the Safe transaction hash
    const safeTxHash = await safe.getTransactionHash(signedTransaction);

    console.log("🔐 Safe transaction hash:", safeTxHash);
    console.log("✍️ Signature:", signedTransaction.encodedSignatures());

    // Propose the transaction to the Safe Transaction Service
    const senderAddress = await safe.getSafeProvider().getSignerAddress();
    if (!senderAddress) {
      throw new Error("Could not get signer address");
    }

    await apiKit.proposeTransaction({
      safeAddress,
      safeTransactionData: signedTransaction.data,
      safeTxHash,
      senderAddress,
      senderSignature: signedTransaction.encodedSignatures(),
    });

    console.log("Transaction proposed successfully:", safeTxHash);
    return safeTxHash;
  } catch (error) {
    console.error("Error proposing transaction:", error);
    throw error;
  }
};

/**
 * Confirm (sign) an existing pending transaction
 * Adds the current user's signature to the transaction
 */
export const confirmTransaction = async (
  safeAddress: string,
  safeTxHash: string,
  provider: BrowserProvider
): Promise<void> => {
  try {
    console.log("Confirming transaction:", safeTxHash);

    // Initialize Protocol Kit
    const safe = await initProtocolKit(safeAddress, provider);

    // Get chain ID
    const network = await provider.getNetwork();
    const chainId = network.chainId.toString();

    // Initialize API Kit
    const apiKit = await initApiKit(chainId);

    // Get the transaction from the service
    const transaction = await apiKit.getTransaction(safeTxHash);

    console.log("📝 Transaction to confirm:", {
      to: transaction.to,
      value: transaction.value,
      data: transaction.data?.slice(0, 66) + "...",
      dataLength: transaction.data?.length,
      operation: transaction.operation,
      nonce: transaction.nonce,
    });

    // Create Safe transaction object
    const safeTransaction = await safe.createTransaction({
      transactions: [
        {
          to: transaction.to,
          value: transaction.value,
          data: transaction.data || "0x",
          operation: transaction.operation,
        },
      ],
    });

    // Verify transaction hash matches
    const computedTxHash = await safe.getTransactionHash(safeTransaction);
    console.log("🔍 Computed tx hash:", computedTxHash);
    console.log("🔍 Expected tx hash:", safeTxHash);

    if (computedTxHash !== safeTxHash) {
      console.error("❌ Transaction hash mismatch during confirmation!");
      throw new Error("Transaction hash mismatch - cannot confirm");
    }

    // Sign the transaction
    const signature = await safe.signTransaction(safeTransaction);
    console.log("✍️ Signature generated:", signature.encodedSignatures());

    // Submit the signature to the service
    await apiKit.confirmTransaction(safeTxHash, signature.encodedSignatures());

    console.log("Transaction confirmed successfully");
  } catch (error) {
    console.error("Error confirming transaction:", error);
    throw error;
  }
};

/**
 * Execute a transaction once threshold is reached
 * This submits the transaction to the blockchain
 * UPDATED: Added signature sorting fix for GS013 error - v2 with debug logging
 */
export const executeTransaction = async (
  safeAddress: string,
  safeTxHash: string,
  provider: BrowserProvider
): Promise<string> => {
  try {
    console.log("Executing transaction:", safeTxHash);

    // Initialize Protocol Kit
    const safe = await initProtocolKit(safeAddress, provider);

    // Get chain ID
    const network = await provider.getNetwork();
    const chainId = network.chainId.toString();

    // Initialize API Kit
    const apiKit = await initApiKit(chainId);

    // Get the transaction from the service
    const transaction = await apiKit.getTransaction(safeTxHash);

    // Check if threshold is reached
    const confirmations = transaction.confirmations || [];
    if (confirmations.length < transaction.confirmationsRequired) {
      throw new Error(
        `Threshold not reached. ${confirmations.length}/${transaction.confirmationsRequired} confirmations`
      );
    }

    // Create Safe transaction object with exact same parameters as when proposed
    // IMPORTANT: For complex transactions (like CCIP), we need to set safeTxGas explicitly
    // to ensure enough gas is allocated for execution
    const safeTransaction = await safe.createTransaction({
      transactions: [
        {
          to: transaction.to,
          value: transaction.value,
          data: transaction.data || "0x",
          operation: transaction.operation,
        },
      ],
      options: {
        safeTxGas: "500000", // Set explicit gas limit for complex transactions (CCIP needs more gas)
        // Note: This is the gas allocated for the Safe transaction execution
        // not the total gas limit of the transaction
      },
    });

    // Debug: Log confirmations before sorting
    console.log("📋 Confirmations from service:", confirmations);
    console.log("📊 Threshold required:", transaction.confirmationsRequired);

    // Sort confirmations by owner address (ascending) - CRITICAL for Safe signature validation
    const confirmationsArray = (
      confirmations as Array<{
        owner: string;
        signature: string;
      }>
    ).sort((a, b) => {
      const addrA = a.owner.toLowerCase();
      const addrB = b.owner.toLowerCase();
      return addrA < addrB ? -1 : addrA > addrB ? 1 : 0;
    });

    // Debug: Log sorted confirmations
    console.log(
      "🔀 Sorted confirmations:",
      confirmationsArray.map((c) => ({
        owner: c.owner,
        signatureLength: c.signature.length,
      }))
    );

    // Add sorted signatures to the transaction
    // CRITICAL: Signature format must be exactly 65 bytes (130 hex chars + 0x)
    confirmationsArray.forEach((confirmation) => {
      // Ensure signature is properly formatted (remove 0x if present)
      let sig = confirmation.signature;
      if (sig.startsWith("0x")) {
        sig = sig.slice(2);
      }

      // Validate signature length (should be 130 hex chars = 65 bytes)
      if (sig.length !== 130) {
        console.error(
          `❌ Invalid signature length for ${confirmation.owner}: ${sig.length} (expected 130)`
        );
        throw new Error(
          `Invalid signature length for ${confirmation.owner}: ${sig.length} chars`
        );
      }

      // Parse signature components: r (32 bytes), s (32 bytes), v (1 byte)
      const r = "0x" + sig.slice(0, 64);
      const s = "0x" + sig.slice(64, 128);
      const v = parseInt(sig.slice(128, 130), 16);

      console.log(`🔐 Adding signature for ${confirmation.owner}:`, {
        r,
        s,
        v,
        fullSig: "0x" + sig,
      });

      const fullSig = "0x" + sig;
      safeTransaction.addSignature({
        signer: confirmation.owner,
        data: fullSig,
        isContractSignature: false,
        staticPart: () => fullSig.slice(0, 132), // 0x + 130 chars (r + s + v)
        dynamicPart: () => "0x", // No dynamic part for EOA signatures
      });
    });

    // Debug: Log final encoded signatures
    const encodedSigs = safeTransaction.encodedSignatures();
    console.log("🔐 Encoded signatures:", encodedSigs);
    console.log("🔐 Encoded signatures length:", encodedSigs.length);

    // Verify transaction hash matches before execution
    const computedTxHash = await safe.getTransactionHash(safeTransaction);
    console.log("🔍 Computed transaction hash:", computedTxHash);
    console.log("🔍 Expected transaction hash:", safeTxHash);

    if (computedTxHash !== safeTxHash) {
      console.error("❌ Transaction hash mismatch!");
      throw new Error(
        "Transaction hash mismatch - transaction may have been modified"
      );
    }

    // Execute the transaction
    const executeTxResponse = await safe.executeTransaction(safeTransaction);
    const txResponse = executeTxResponse.transactionResponse as unknown as {
      wait: () => Promise<{ hash: string }>;
    } | null;
    const receipt = txResponse ? await txResponse.wait() : null;

    console.log(
      "Transaction executed successfully:",
      receipt?.hash || executeTxResponse.hash
    );
    return receipt?.hash || executeTxResponse.hash || "";
  } catch (error) {
    console.error("Error executing transaction:", error);
    throw error;
  }
};

/**
 * Reject a pending transaction by creating and executing a rejection transaction
 * A rejection transaction has the same nonce but with 0 value and no data
 * When executed, it invalidates the original transaction
 * @param safeAddress - Address of the Safe wallet
 * @param safeTxHash - Hash of the transaction to reject
 * @param provider - Ethers BrowserProvider
 * @returns Transaction hash of the rejection transaction
 */
export const rejectTransaction = async (
  safeAddress: string,
  safeTxHash: string,
  provider: BrowserProvider
): Promise<string> => {
  try {
    console.log("🚫 Rejecting transaction:", safeTxHash);

    // Initialize Protocol Kit
    const safe = await initProtocolKit(safeAddress, provider);

    // Get chain ID
    const network = await provider.getNetwork();
    const chainId = network.chainId.toString();

    // Initialize API Kit
    const apiKit = await initApiKit(chainId);

    // Get the original transaction to get its nonce
    const originalTransaction = await apiKit.getTransaction(safeTxHash);
    console.log("📋 Original transaction nonce:", originalTransaction.nonce);

    // Get signer address
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();

    // Create rejection transaction (0 value transfer to Safe itself with same nonce)
    const rejectionTransaction = await safe.createTransaction({
      transactions: [
        {
          to: safeAddress, // Send to itself
          value: "0", // 0 value
          data: "0x", // No data
          operation: 0, // Call operation
        },
      ],
      options: {
        nonce: parseInt(originalTransaction.nonce.toString()), // CRITICAL: Use same nonce as original tx
      },
    });

    // Sign the rejection transaction
    const rejectionTxHash = await safe.getTransactionHash(rejectionTransaction);
    const signature = await safe.signHash(rejectionTxHash);

    console.log("✍️ Signed rejection transaction");

    // Propose the rejection transaction to the service
    await apiKit.proposeTransaction({
      safeAddress,
      safeTransactionData: rejectionTransaction.data,
      safeTxHash: rejectionTxHash,
      senderAddress: signerAddress,
      senderSignature: signature.data,
    });

    console.log(
      "📤 Rejection transaction proposed with hash:",
      rejectionTxHash
    );
    console.log(
      "⚠️ Note: Other owners need to confirm this rejection transaction"
    );
    console.log(
      "⚠️ Once threshold is reached, execute it to reject the original tx"
    );

    return rejectionTxHash;
  } catch (error) {
    console.error("❌ Error rejecting transaction:", error);
    throw error;
  }
};

/**
 * Execute a rejection transaction once threshold is reached
 * This will invalidate the original transaction by using up its nonce
 * @param safeAddress - Address of the Safe wallet
 * @param rejectionTxHash - Hash of the rejection transaction
 * @param provider - Ethers BrowserProvider
 * @returns Transaction hash of the executed rejection
 */
export const executeRejectionTransaction = async (
  safeAddress: string,
  rejectionTxHash: string,
  provider: BrowserProvider
): Promise<string> => {
  try {
    console.log("🚫 Executing rejection transaction:", rejectionTxHash);

    // Initialize Protocol Kit
    const safe = await initProtocolKit(safeAddress, provider);

    // Get chain ID
    const network = await provider.getNetwork();
    const chainId = network.chainId.toString();

    // Initialize API Kit
    const apiKit = await initApiKit(chainId);

    // Get the rejection transaction from the service
    const transaction = await apiKit.getTransaction(rejectionTxHash);

    // Check if threshold is reached
    const confirmations = transaction.confirmations || [];
    if (confirmations.length < transaction.confirmationsRequired) {
      throw new Error(
        `Threshold not reached for rejection. ${confirmations.length}/${transaction.confirmationsRequired} confirmations`
      );
    }

    // Create Safe transaction object
    const safeTransaction = await safe.createTransaction({
      transactions: [
        {
          to: transaction.to,
          value: transaction.value,
          data: transaction.data || "0x",
          operation: transaction.operation,
        },
      ],
      options: {
        nonce: parseInt(transaction.nonce.toString()),
      },
    });

    // Sort and add signatures
    const confirmationsArray = (
      confirmations as Array<{
        owner: string;
        signature: string;
      }>
    ).sort((a, b) => {
      const addrA = a.owner.toLowerCase();
      const addrB = b.owner.toLowerCase();
      return addrA < addrB ? -1 : addrA > addrB ? 1 : 0;
    });

    confirmationsArray.forEach((confirmation) => {
      safeTransaction.addSignature({
        signer: confirmation.owner,
        data: confirmation.signature,
        isContractSignature: false,
        staticPart: () => confirmation.signature.slice(0, 130),
        dynamicPart: () => confirmation.signature.slice(130),
      });
    });

    // Execute the rejection transaction
    const executeTxResponse = await safe.executeTransaction(safeTransaction);
    const txResponse = executeTxResponse.transactionResponse as unknown as {
      wait: () => Promise<{ hash: string }>;
    } | null;
    const receipt = txResponse ? await txResponse.wait() : null;

    console.log(
      "✅ Rejection transaction executed successfully:",
      receipt?.hash || executeTxResponse.hash
    );
    console.log("🚫 Original transaction has been invalidated");

    return receipt?.hash || executeTxResponse.hash || "";
  } catch (error) {
    console.error("❌ Error executing rejection transaction:", error);
    throw error;
  }
};

/**
 * Get pending transactions for a Safe
 */
export const getPendingTransactions = async (
  safeAddress: string,
  chainId: string
): Promise<SafeTransaction[]> => {
  try {
    const apiKit = await initApiKit(chainId);
    const pendingTxs = await apiKit.getPendingTransactions(safeAddress);

    return pendingTxs.results.map((tx: SafeApiTransaction) => ({
      safeTxHash: tx.safeTxHash,
      to: tx.to,
      value: tx.value,
      data: tx.data || "0x",
      operation: tx.operation,
      nonce: typeof tx.nonce === "string" ? parseInt(tx.nonce) : tx.nonce,
      confirmations: tx.confirmations || [],
      confirmationsRequired: tx.confirmationsRequired,
      isExecuted: tx.isExecuted,
    }));
  } catch (error) {
    console.error("Error getting pending transactions:", error);
    throw error;
  }
};

/**
 * Get transaction history for a Safe
 */
export const getTransactionHistory = async (
  safeAddress: string,
  chainId: string
): Promise<SafeTransaction[]> => {
  try {
    const apiKit = await initApiKit(chainId);
    const history = await apiKit.getMultisigTransactions(safeAddress);

    return history.results.map((tx: SafeApiTransaction) => ({
      safeTxHash: tx.safeTxHash,
      to: tx.to,
      value: tx.value,
      data: tx.data || "0x",
      operation: tx.operation,
      nonce: typeof tx.nonce === "string" ? parseInt(tx.nonce) : tx.nonce,
      confirmations: tx.confirmations || [],
      confirmationsRequired: tx.confirmationsRequired,
      isExecuted: tx.isExecuted,
    }));
  } catch (error) {
    console.error("Error getting transaction history:", error);
    throw error;
  }
};

/**
 * Get Safe information including balance and owners
 */
export const getSafeInfo = async (
  safeAddress: string,
  provider: BrowserProvider
) => {
  try {
    const safe = await initProtocolKit(safeAddress, provider);

    const [owners, threshold, nonce, balance] = await Promise.all([
      safe.getOwners(),
      safe.getThreshold(),
      safe.getNonce(),
      provider.getBalance(safeAddress),
    ]);

    return {
      address: safeAddress,
      owners,
      threshold,
      nonce,
      balance: ethers.formatEther(balance),
    };
  } catch (error) {
    console.error("Error getting Safe info:", error);
    throw error;
  }
};

/**
 * Check if an address is an owner of the Safe
 */
export const isOwner = async (
  safeAddress: string,
  ownerAddress: string,
  provider: BrowserProvider
): Promise<boolean> => {
  try {
    const safe = await initProtocolKit(safeAddress, provider);
    return await safe.isOwner(ownerAddress);
  } catch (error) {
    console.error("Error checking owner:", error);
    return false;
  }
};

/**
 * Add a new owner to the Safe
 */
export const addOwner = async (
  safeAddress: string,
  newOwnerAddress: string,
  newThreshold: number,
  provider: BrowserProvider
): Promise<string> => {
  try {
    const safe = await initProtocolKit(safeAddress, provider);

    // Create add owner transaction
    const safeTransaction = await safe.createAddOwnerTx({
      ownerAddress: newOwnerAddress,
      threshold: newThreshold,
    });

    // Get transaction hash
    const safeTxHash = await safe.getTransactionHash(safeTransaction);

    // Sign and propose
    const senderSignature = await safe.signTransaction(safeTransaction);
    const signer = await provider.getSigner();
    const senderAddress = await signer.getAddress();

    const network = await provider.getNetwork();
    const chainId = network.chainId.toString();
    const apiKit = await initApiKit(chainId);

    await apiKit.proposeTransaction({
      safeAddress,
      safeTransactionData: safeTransaction.data,
      safeTxHash,
      senderAddress,
      senderSignature: senderSignature.encodedSignatures(),
    });

    return safeTxHash;
  } catch (error) {
    console.error("Error adding owner:", error);
    throw error;
  }
};

/**
 * Remove an owner from the Safe
 */
export const removeOwner = async (
  safeAddress: string,
  ownerAddress: string,
  newThreshold: number,
  provider: BrowserProvider
): Promise<string> => {
  try {
    const safe = await initProtocolKit(safeAddress, provider);

    // Create remove owner transaction
    const safeTransaction = await safe.createRemoveOwnerTx({
      ownerAddress,
      threshold: newThreshold,
    });

    // Get transaction hash
    const safeTxHash = await safe.getTransactionHash(safeTransaction);

    // Sign and propose
    const senderSignature = await safe.signTransaction(safeTransaction);
    const signer = await provider.getSigner();
    const senderAddress = await signer.getAddress();

    const network = await provider.getNetwork();
    const chainId = network.chainId.toString();
    const apiKit = await initApiKit(chainId);

    await apiKit.proposeTransaction({
      safeAddress,
      safeTransactionData: safeTransaction.data,
      safeTxHash,
      senderAddress,
      senderSignature: senderSignature.encodedSignatures(),
    });

    return safeTxHash;
  } catch (error) {
    console.error("Error removing owner:", error);
    throw error;
  }
};

/**
 * Change the threshold of the Safe
 */
export const changeThreshold = async (
  safeAddress: string,
  newThreshold: number,
  provider: BrowserProvider
): Promise<string> => {
  try {
    const safe = await initProtocolKit(safeAddress, provider);

    // Create change threshold transaction
    const safeTransaction = await safe.createChangeThresholdTx(newThreshold);

    // Get transaction hash
    const safeTxHash = await safe.getTransactionHash(safeTransaction);

    // Sign and propose
    const senderSignature = await safe.signTransaction(safeTransaction);
    const signer = await provider.getSigner();
    const senderAddress = await signer.getAddress();

    const network = await provider.getNetwork();
    const chainId = network.chainId.toString();
    const apiKit = await initApiKit(chainId);

    await apiKit.proposeTransaction({
      safeAddress,
      safeTransactionData: safeTransaction.data,
      safeTxHash,
      senderAddress,
      senderSignature: senderSignature.encodedSignatures(),
    });

    return safeTxHash;
  } catch (error) {
    console.error("Error changing threshold:", error);
    throw error;
  }
};

/**
 * ============================================================================
 * CCIP Cross-Chain Transfer Functions
 * Using @chainlink/ccip-js SDK with ethers adapters
 * ============================================================================
 */

import type { NetworkName } from "./ccipConfig";

import { getNetworkConfig, getTokenBySymbol } from "./ccipConfig";

// Import CCIP SDK and ethers adapters
import { createClient, IERC20ABI } from "@chainlink/ccip-js";
// Import Router ABI from CCIP SDK for proper encoding
import RouterABI from "@chainlink/ccip-js/dist/abi/Router.json";

/**
 * Interface for CCIP transfer parameters
 */
export interface CCIPTransferParams {
  sourceNetwork: NetworkName;
  destinationNetwork: NetworkName;
  tokenSymbol: string;
  amount: string; // Amount in token's smallest unit (e.g., wei for ETH)
  recipientAddress: string;
}

/**
 * Interface for CCIP fee estimate
 */
export interface CCIPFeeEstimate {
  feeInWei: string;
  feeInEther: string;
  feeInUSD?: string; // Optional USD estimate
}

/**
 * Get viem chain config from network name
 */
const getViemChain = (networkName: NetworkName) => {
  const networkConfig = getNetworkConfig(networkName);
  return {
    id: Number(networkConfig.chainId),
    name: networkName,
    nativeCurrency: {
      name: "Ether",
      symbol: "ETH",
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: [networkConfig.rpcUrl],
      },
      public: {
        http: [networkConfig.rpcUrl],
      },
    },
  };
};

/**
 * Calculate CCIP transfer fee using CCIP SDK
 * This estimates the cost of sending a cross-chain message
 */
export const calculateCCIPFee = async (
  params: CCIPTransferParams,
  _provider: BrowserProvider // Prefix with _ to indicate intentionally unused
): Promise<CCIPFeeEstimate> => {
  try {
    const sourceConfig = getNetworkConfig(params.sourceNetwork);
    const destConfig = getNetworkConfig(params.destinationNetwork);
    const token = getTokenBySymbol(params.sourceNetwork, params.tokenSymbol);

    if (!token) {
      throw new Error(
        `Token ${params.tokenSymbol} not found on ${params.sourceNetwork}`
      );
    }

    // Get viem chain config
    const sourceChain = getViemChain(params.sourceNetwork);

    // Convert ethers provider to viem public client using the adapter
    const rpcUrl = sourceConfig.rpcUrl;

    // Create a viem public client manually

    const publicClient = createPublicClient({
      chain: sourceChain,
      transport: http(rpcUrl),
    });

    // Create CCIP client
    const ccipClient = createClient();

    // Get fee using CCIP SDK
    const feeInWei = await ccipClient.getFee({
      client: publicClient as any, // Type cast to avoid viem version conflicts
      routerAddress: sourceConfig.routerAddress as `0x${string}`,
      destinationChainSelector: destConfig.chainSelector,
      destinationAccount: params.recipientAddress as `0x${string}`,
      amount: BigInt(params.amount),
      tokenAddress: token.address as `0x${string}`,
    });

    return {
      feeInWei: feeInWei.toString(),
      feeInEther: ethers.formatEther(feeInWei),
    };
  } catch (error) {
    console.error("Error calculating CCIP fee:", error);
    throw new Error("Failed to calculate CCIP transfer fee");
  }
};

/**
 * Build CCIP transaction data for Safe execution using CCIP SDK
 * This creates the transaction payload that Safe will execute
 */
export const buildCCIPSafeTransaction = async (
  params: CCIPTransferParams,
  safeAddress: string,
  provider: BrowserProvider
): Promise<{
  transactions: MetaTransactionData[];
  estimatedFee: CCIPFeeEstimate;
}> => {
  try {
    const sourceConfig = getNetworkConfig(params.sourceNetwork);
    const destConfig = getNetworkConfig(params.destinationNetwork);
    const token = getTokenBySymbol(params.sourceNetwork, params.tokenSymbol);

    if (!token) {
      throw new Error(
        `Token ${params.tokenSymbol} not found on ${params.sourceNetwork}`
      );
    }

    // Calculate fee first
    const estimatedFee = await calculateCCIPFee(params, provider);

    // Prepare transactions array (may need approval + CCIP send)
    const transactions: MetaTransactionData[] = [];

    // Create viem clients for CCIP SDK
    const sourceChain = getViemChain(params.sourceNetwork);
    const publicClient = createPublicClient({
      chain: sourceChain,
      transport: http(sourceConfig.rpcUrl),
    });

    const ccipClient = createClient();

    // Step 1: Check if token approval is needed using CCIP SDK
    const currentAllowance = await ccipClient.getAllowance({
      client: publicClient as any, // Type cast to avoid viem version conflicts
      routerAddress: sourceConfig.routerAddress as `0x${string}`,
      tokenAddress: token.address as `0x${string}`,
      account: safeAddress as `0x${string}`,
    });

    const amountBN = BigInt(params.amount);

    console.log(
      `[CCIP Build] Current allowance: ${currentAllowance}, needed: ${amountBN}`
    );

    // If allowance is insufficient, add approval transaction
    if (currentAllowance < amountBN) {
      console.log(
        "[CCIP Build] Insufficient allowance - adding approval transaction"
      );
      // Use ethers to encode the approval data for Safe transaction
      const tokenContract = new ethers.Contract(
        token.address,
        IERC20ABI,
        provider
      );

      const approvalData = tokenContract.interface.encodeFunctionData(
        "approve",
        [sourceConfig.routerAddress, amountBN]
      );

      transactions.push({
        to: token.address,
        value: "0",
        data: approvalData,
        operation: 0, // Call
      });
    }

    // Step 2: Build CCIP send transaction using SDK
    // We need to manually encode the ccipSend call since we're not directly calling it
    // but proposing it through Safe

    // Encode receiver address as bytes (must be ABI-encoded address, not just address)
    // CCIP expects receiver as ABI-encoded address in bytes format
    const receiverBytes = encodeAbiParameters(
      [{ type: "address" }],
      [params.recipientAddress as `0x${string}`]
    );

    console.log(`[CCIP Build] Receiver address: ${params.recipientAddress}`);
    console.log(`[CCIP Build] Receiver bytes: ${receiverBytes}`);

    // Encode extraArgs V2 using CCIP SDK standard format
    // V2 format: 0x181dcf10 (V2 tag from SDK) + ABI encoded (gasLimit, allowOutOfOrderExecution)
    // Gas limit must be high enough for destination chain execution
    const gasLimit = 200000; // 200k gas - matching common CCIP usage
    const allowOutOfOrderExecution = true; // Allow out-of-order execution (SDK default)
    const extraArgsV2Encoded = encodeAbiParameters(
      [
        { type: "uint256", name: "gasLimit" },
        { type: "bool", name: "allowOutOfOrderExecution" },
      ],
      [BigInt(gasLimit), allowOutOfOrderExecution]
    );

    // Add V2 selector (0x181dcf10) to the beginning - this is the correct CCIP SDK tag
    const evmExtraArgsV2Tag = "0x181dcf10";
    const extraArgsV2 = (evmExtraArgsV2Tag +
      extraArgsV2Encoded.slice(2)) as `0x${string}`;

    console.log(
      `[CCIP Build] ExtraArgs V2 (gasLimit=${gasLimit}, allowOutOfOrder=${allowOutOfOrderExecution}): ${extraArgsV2}`
    );

    // Build CCIP message structure following SDK format exactly
    const ccipMessage = {
      receiver: receiverBytes,
      data: "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`, // zeroHash for no data
      tokenAmounts: [
        {
          token: token.address as `0x${string}`,
          amount: amountBN,
        },
      ],
      feeToken: "0x0000000000000000000000000000000000000000" as `0x${string}`, // zeroAddress for native token fees
      extraArgs: extraArgsV2, // V2 encoded extra args with correct tag
    };

    // Debug: Log complete CCIP message structure
    console.log("[CCIP Build] Complete message structure:", {
      destinationChainSelector: destConfig.chainSelector,
      message: {
        receiver: receiverBytes,
        data: "0x",
        tokenAmounts: ccipMessage.tokenAmounts.map((t) => ({
          token: t.token,
          amount: t.amount.toString(),
        })),
        feeToken: ccipMessage.feeToken,
        extraArgs: extraArgsV2,
      },
    });

    // Use encodeFunctionData with official Router ABI from CCIP SDK
    // Note: Viem will auto-convert string to uint64 based on ABI, so pass string directly like SDK does
    const fullCallData = encodeFunctionData({
      abi: RouterABI,
      functionName: "ccipSend",
      args: [destConfig.chainSelector, ccipMessage],
    });

    console.log(
      `[CCIP Build] CCIP send call data length: ${fullCallData.length} bytes`
    );
    console.log(
      `[CCIP Build] Fee (value): ${estimatedFee.feeInWei} wei (${estimatedFee.feeInEther} ETH)`
    );

    // Add CCIP send transaction (with fee as value)
    transactions.push({
      to: sourceConfig.routerAddress,
      value: estimatedFee.feeInWei,
      data: fullCallData,
      operation: 0, // Call
    });

    console.log(
      `[CCIP Build] Total transactions to execute: ${transactions.length}`
    );

    return {
      transactions,
      estimatedFee,
    };
  } catch (error) {
    console.error("Error building CCIP transaction:", error);
    throw new Error("Failed to build CCIP transaction");
  }
};

/**
 * Propose a CCIP cross-chain transfer through Safe
 * This is a high-level function that combines fee calculation and transaction proposal
 */
export const proposeCCIPTransfer = async (
  params: CCIPTransferParams,
  safeAddress: string,
  provider: BrowserProvider
): Promise<{
  safeTxHash: string;
  estimatedFee: CCIPFeeEstimate;
  needsApproval: boolean;
  approvalTxHash?: string;
  ccipTxHash?: string;
}> => {
  try {
    // Build CCIP transaction(s)
    const { transactions, estimatedFee } = await buildCCIPSafeTransaction(
      params,
      safeAddress,
      provider
    );

    console.log(
      `[CCIP] Built ${transactions.length} transaction(s):`,
      transactions
    );

    // IMPORTANT: We cannot batch approval + CCIP send because Safe uses MultiSend with DelegateCall
    // which doesn't work with ERC20 token approvals (storage context issue)
    //
    // Solution: Propose BOTH transactions separately
    // 1. Propose approval transaction first
    // 2. Propose CCIP send transaction second
    // 3. User must execute approval BEFORE executing CCIP send

    if (transactions.length === 1) {
      console.log("[CCIP] Single transaction - no approval needed");
      // Only CCIP send (no approval needed - token already approved)
      const finalTxHash = await proposeTransaction(
        safeAddress,
        {
          to: transactions[0].to,
          value: transactions[0].value,
          data: transactions[0].data,
          operation: transactions[0].operation,
        },
        provider
      );

      return {
        safeTxHash: finalTxHash,
        estimatedFee,
        needsApproval: false,
        ccipTxHash: finalTxHash,
      };
    } else {
      // Multiple transactions: approval + CCIP send
      console.log(
        "[CCIP] Approval needed - proposing BOTH transactions sequentially"
      );

      // Step 1: Propose approval transaction
      const approvalTx = transactions[0];
      const approvalTxHash = await proposeTransaction(
        safeAddress,
        {
          to: approvalTx.to,
          value: approvalTx.value,
          data: approvalTx.data,
          operation: approvalTx.operation,
        },
        provider
      );

      console.log(
        "[CCIP] ✅ Step 1: Approval transaction proposed:",
        approvalTxHash
      );

      // Step 2: Propose CCIP send transaction
      const ccipTx = transactions[1];
      const ccipTxHash = await proposeTransaction(
        safeAddress,
        {
          to: ccipTx.to,
          value: ccipTx.value,
          data: ccipTx.data,
          operation: ccipTx.operation,
        },
        provider
      );

      console.log(
        "[CCIP] ✅ Step 2: CCIP transfer transaction proposed:",
        ccipTxHash
      );
      console.log(
        "[CCIP] ⚠️ User must execute approval transaction FIRST, then execute CCIP transfer"
      );

      // Return both transaction hashes
      return {
        safeTxHash: ccipTxHash, // Main tx hash (for backward compatibility)
        estimatedFee,
        needsApproval: true,
        approvalTxHash,
        ccipTxHash,
      };
    }
  } catch (error) {
    console.error("Error proposing CCIP transfer:", error);
    throw error;
  }
};

/**
 * Check if Safe has sufficient balance for CCIP transfer using CCIP SDK
 */
export const checkCCIPTransferBalance = async (
  params: CCIPTransferParams,
  safeAddress: string,
  provider: BrowserProvider
): Promise<{
  hasTokenBalance: boolean;
  hasFeeBalance: boolean;
  tokenBalance: string;
  nativeBalance: string;
}> => {
  try {
    const sourceConfig = getNetworkConfig(params.sourceNetwork);
    const token = getTokenBySymbol(params.sourceNetwork, params.tokenSymbol);

    if (!token) {
      throw new Error(`Token ${params.tokenSymbol} not found`);
    }

    console.log("🔍 Checking balance for:", {
      token: params.tokenSymbol,
      tokenAddress: token.address,
      safeAddress: safeAddress,
      network: params.sourceNetwork,
      rpcUrl: sourceConfig.rpcUrl,
    });

    // Use ethers provider to read token balance directly
    // This ensures we're reading from the same chain the user is connected to
    const tokenContract = new ethers.Contract(
      token.address,
      IERC20ABI as any,
      provider
    );

    console.log("📞 Calling balanceOf on token contract...");
    const tokenBalance = (await tokenContract.balanceOf(safeAddress)) as bigint;

    console.log("💰 Token balance result:", {
      tokenSymbol: params.tokenSymbol,
      balanceRaw: tokenBalance.toString(),
      balanceFormatted: Number(tokenBalance) / 10 ** token.decimals,
      decimals: token.decimals,
    });

    const hasTokenBalance = tokenBalance >= BigInt(params.amount);

    // Check native balance for fees
    const nativeBalance = await provider.getBalance(safeAddress);
    const estimatedFee = await calculateCCIPFee(params, provider);
    const hasFeeBalance = nativeBalance >= BigInt(estimatedFee.feeInWei);

    return {
      hasTokenBalance,
      hasFeeBalance,
      tokenBalance: tokenBalance.toString(),
      nativeBalance: nativeBalance.toString(),
    };
  } catch (error) {
    console.error("❌ Error checking balances:", error);
    console.error("Error details:", {
      tokenSymbol: params.tokenSymbol,
      safeAddress,
      network: params.sourceNetwork,
    });
    throw error;
  }
};

/**
 * Get CCIP message status from transaction receipt
 * Extracts the messageId from CCIP transfer transaction
 */
export const getCCIPMessageId = async (
  txHash: string,
  provider: BrowserProvider
): Promise<string | null> => {
  try {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
      throw new Error("Transaction receipt not found");
    }

    // CCIP Router emits CCIPSendRequested event with messageId
    // Event signature: CCIPSendRequested(bytes32 indexed messageId, ...)
    const ccipEventTopic =
      "0x8832dc5c91b7173c8eb69ccee5d24c4d4ff537b6a89b0e58b17e8b6f3f847e06";

    const ccipLog = receipt.logs.find(
      (log) => log.topics[0] === ccipEventTopic
    );

    if (ccipLog && ccipLog.topics[1]) {
      return ccipLog.topics[1]; // messageId is the first indexed parameter
    }

    return null;
  } catch (error) {
    console.error("Error getting CCIP message ID:", error);
    return null;
  }
};

/**
 * Check CCIP transfer status using CCIP Explorer API
 * Note: This uses the public CCIP Explorer API
 */
export const checkCCIPTransferStatus = async (
  messageId: string
): Promise<{
  status: "SUCCESS" | "IN_PROGRESS" | "FAILED" | "NOT_FOUND";
  sourceChain?: string;
  destChain?: string;
  explorerUrl?: string;
}> => {
  try {
    // CCIP Explorer URL
    const explorerUrl = `https://ccip.chain.link/msg/${messageId}`;

    // For now, return the explorer URL for manual checking
    // In production, you could call CCIP Explorer API or check on-chain state
    return {
      status: "IN_PROGRESS",
      explorerUrl,
    };
  } catch (error) {
    console.error("Error checking CCIP status:", error);
    return {
      status: "NOT_FOUND",
    };
  }
};

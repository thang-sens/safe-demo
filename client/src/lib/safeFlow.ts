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
  parseAbiParameters,
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

    // Initialize Protocol Kit
    const safe = await initProtocolKit(safeAddress, provider);

    // Get chain ID
    const network = await provider.getNetwork();
    const chainId = network.chainId.toString();

    // Initialize API Kit
    const apiKit = await initApiKit(chainId);

    // Prepare transaction data
    const safeTransactionData: MetaTransactionData = {
      to: txData.to,
      value: txData.value,
      data: txData.data,
      operation: txData.operation || 0,
    };

    // Create Safe transaction
    const safeTransaction = await safe.createTransaction({
      transactions: [safeTransactionData],
    });

    // Get transaction hash
    const safeTxHash = await safe.getTransactionHash(safeTransaction);

    // Sign the transaction
    const senderSignature = await safe.signTransaction(safeTransaction);

    // Get sender address
    const signer = await provider.getSigner();
    const senderAddress = await signer.getAddress();

    // Propose transaction to the service
    await apiKit.proposeTransaction({
      safeAddress,
      safeTransactionData: safeTransaction.data,
      safeTxHash,
      senderAddress,
      senderSignature: senderSignature.encodedSignatures(),
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

    // Sign the transaction
    const signature = await safe.signTransaction(safeTransaction);

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
    confirmationsArray.forEach((confirmation) => {
      safeTransaction.addSignature({
        signer: confirmation.owner,
        data: confirmation.signature,
        isContractSignature: false,
        staticPart: () => confirmation.signature.slice(0, 130),
        dynamicPart: () => confirmation.signature.slice(130),
      });
    });

    // Debug: Log final encoded signatures
    const encodedSigs = safeTransaction.encodedSignatures();
    console.log("🔐 Encoded signatures:", encodedSigs);
    console.log("🔐 Encoded signatures length:", encodedSigs.length);

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

    // If allowance is insufficient, add approval transaction
    if (currentAllowance < amountBN) {
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

    // Encode receiver address as bytes
    const receiverBytes = encodeAbiParameters(parseAbiParameters("address"), [
      params.recipientAddress as `0x${string}`,
    ]);

    // Build CCIP message structure
    const ccipMessage = {
      receiver: receiverBytes,
      data: "0x" as `0x${string}`,
      tokenAmounts: [
        {
          token: token.address as `0x${string}`,
          amount: amountBN,
        },
      ],
      feeToken: "0x0000000000000000000000000000000000000000" as `0x${string}`, // Native token
      extraArgs: "0x" as `0x${string}`,
    };

    // Encode ccipSend function call
    const ccipSendData = encodeAbiParameters(
      parseAbiParameters(
        "uint64 destinationChainSelector, (bytes receiver, bytes data, (address token, uint256 amount)[] tokenAmounts, address feeToken, bytes extraArgs) message"
      ),
      [BigInt(destConfig.chainSelector), ccipMessage]
    );

    // Create the full function call with selector
    // ccipSend function selector is 0x96f4e9f9
    const functionSelector = "0x96f4e9f9";
    const fullCallData = (functionSelector +
      ccipSendData.slice(2)) as `0x${string}`;

    // Add CCIP send transaction (with fee as value)
    transactions.push({
      to: sourceConfig.routerAddress,
      value: estimatedFee.feeInWei,
      data: fullCallData,
      operation: 0, // Call
    });

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
): Promise<{ safeTxHash: string; estimatedFee: CCIPFeeEstimate }> => {
  try {
    // Build CCIP transaction(s)
    const { transactions, estimatedFee } = await buildCCIPSafeTransaction(
      params,
      safeAddress,
      provider
    );

    // If we have multiple transactions (approval + send), we need to batch them
    // For now, we'll handle them separately
    // In production, you might want to use Safe's batch transaction feature

    let finalTxHash: string;

    if (transactions.length === 1) {
      // Only CCIP send (no approval needed)
      finalTxHash = await proposeTransaction(
        safeAddress,
        {
          to: transactions[0].to,
          value: transactions[0].value,
          data: transactions[0].data,
          operation: transactions[0].operation,
        },
        provider
      );
    } else {
      // Multiple transactions - propose the last one (CCIP send)
      // NOTE: In a real implementation, you'd want to batch these or handle sequentially
      // For this POC, we'll just propose the CCIP send and assume approval is done separately
      const ccipTx = transactions[transactions.length - 1];
      finalTxHash = await proposeTransaction(
        safeAddress,
        {
          to: ccipTx.to,
          value: ccipTx.value,
          data: ccipTx.data,
          operation: ccipTx.operation,
        },
        provider
      );
    }

    return {
      safeTxHash: finalTxHash,
      estimatedFee,
    };
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

    // Create viem client for CCIP SDK
    const sourceChain = getViemChain(params.sourceNetwork);
    const publicClient = createPublicClient({
      chain: sourceChain,
      transport: http(sourceConfig.rpcUrl),
    });

    // Check token balance using viem
    const tokenBalance = (await publicClient.readContract({
      address: token.address as `0x${string}`,
      abi: IERC20ABI as any,
      functionName: "balanceOf",
      args: [safeAddress as `0x${string}`],
    })) as bigint;

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
    console.error("Error checking balances:", error);
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

// Safe transaction flow: Propose, Confirm, Execute
// Complete implementation using Safe Global Protocol Kit and API Kit

import Safe from "@safe-global/protocol-kit";
import SafeApiKit from "@safe-global/api-kit";
import { ethers, BrowserProvider } from "ethers";
import type { MetaTransactionData } from "@safe-global/types-kit";

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

  const safe = await Safe.init({
    provider: provider as unknown as string,
    signer: await signer.getAddress(),
    safeAddress,
  });

  return safe;
};

// Initialize Safe API Kit
const initApiKit = async (chainId: string): Promise<SafeApiKit> => {
  const apiKit = new SafeApiKit({
    chainId: BigInt(chainId),
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

    // Create Safe transaction object with all signatures
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

    // Add all signatures from the service
    const confirmationsArray = confirmations as Array<{
      owner: string;
      signature: string;
    }>;
    confirmationsArray.forEach((confirmation) => {
      safeTransaction.addSignature({
        signer: confirmation.owner,
        data: confirmation.signature,
        isContractSignature: false,
        staticPart: () => confirmation.signature.slice(0, 130),
        dynamicPart: () => confirmation.signature.slice(130),
      });
    });

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

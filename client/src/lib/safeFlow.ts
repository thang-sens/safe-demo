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
import { sepolia } from "viem/chains";
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
        safeTxGas: "3000000", // 3M gas for CCIP transactions
        // CCIP transactions through Safe need significantly more gas:
        // 1. Safe's internal execution overhead (~100k)
        // 2. Complex ccipSend call to Router (~500k)
        // 3. Router → FeeQuoter validation (~300k)
        // 4. Router → TokenPool interactions (~400k)
        // 5. OnRamp processing & event emission (~200k)
        // 6. Multiple nested calls and state changes (~500k+)
        // Total: ~2-2.5M gas, setting 3M for safety margin
        // Note: This is ONLY for Safe internal accounting, actual gas used will be less
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

    // 🔍 CRITICAL: Verify Safe has enough ETH before execution
    const safeBalance = await provider.getBalance(safeAddress);
    const requiredValue = BigInt(transaction.value);

    console.log("💰 Pre-execution balance check:");
    console.log(
      `  Safe Balance: ${safeBalance.toString()} wei (${ethers.formatEther(
        safeBalance
      )} ETH)`
    );
    console.log(
      `  Transaction Value: ${requiredValue.toString()} wei (${ethers.formatEther(
        requiredValue
      )} ETH)`
    );

    if (safeBalance < requiredValue) {
      const shortfall = requiredValue - safeBalance;
      throw new Error(
        `❌ INSUFFICIENT SAFE BALANCE!\n\n` +
          `Safe needs ${ethers.formatEther(
            requiredValue
          )} ETH to execute this transaction,\n` +
          `but only has ${ethers.formatEther(safeBalance)} ETH.\n\n` +
          `Shortfall: ${ethers.formatEther(shortfall)} ETH\n\n` +
          `Please send ${ethers.formatEther(
            shortfall
          )} ETH to Safe at:\n${safeAddress}\n\n` +
          `This ETH is needed as msg.value for the CCIP Router to pay cross-chain fees.`
      );
    }

    console.log("✅ Safe has sufficient balance for transaction value");

    // 🚨 SAFETY CHECK: Detect if this is a MultiSend transaction with value > 0
    // MultiSend uses DELEGATECALL which cannot forward msg.value to sub-calls
    // This would cause CCIP Router to receive 0 value instead of required fee

    // Check: Look at transaction data to detect MultiSend signature
    const multiSendSignature = "0x8d80ff0a"; // multiSend(bytes)
    const isLikelyMultiSend =
      transaction.data && transaction.data.startsWith(multiSendSignature);

    if (isLikelyMultiSend && BigInt(transaction.value) > 0n) {
      console.error(
        `[Execute] ❌ CRITICAL: Detected MultiSend transaction with value > 0!`
      );
      console.error(
        `[Execute] This will FAIL due to DELEGATECALL not forwarding msg.value`
      );
      console.error(`[Execute] Transaction details:`, {
        to: transaction.to,
        value: transaction.value,
        dataPrefix: transaction.data?.substring(0, 10),
      });

      throw new Error(
        `❌ CANNOT EXECUTE: MultiSend with ETH value!\n\n` +
          `This transaction uses Safe's MultiSend contract, which uses DELEGATECALL.\n` +
          `DELEGATECALL does NOT forward msg.value to sub-calls, so the CCIP Router\n` +
          `would receive 0 ETH instead of the required ${ethers.formatEther(
            transaction.value
          )} ETH fee.\n\n` +
          `📋 TO FIX:\n` +
          `1. This transaction should have been proposed separately (not batched)\n` +
          `2. Go back and re-propose using native fee mode correctly\n` +
          `3. Or switch to LINK fees (batching works with LINK)\n\n` +
          `⚠️ Executing this transaction WILL FAIL and waste gas!`
      );
    }

    // Create Safe transaction object with EXACT same parameters as stored in the service
    // CRITICAL: Must match all parameters to get the same transaction hash
    const safeTransaction = await safe.createTransaction({
      transactions: [
        {
          to: transaction.to,
          value: transaction.value, // ← This MUST be forwarded as msg.value when Safe calls target
          data: transaction.data || "0x",
          operation: transaction.operation,
        },
      ],
      options: {
        // Use the EXACT parameters from the proposed transaction
        nonce: parseInt(transaction.nonce.toString()),
        safeTxGas: transaction.safeTxGas?.toString() || "0",
        baseGas: transaction.baseGas?.toString() || "0",
        gasPrice: transaction.gasPrice?.toString() || "0",
        gasToken:
          transaction.gasToken || "0x0000000000000000000000000000000000000000",
        refundReceiver:
          transaction.refundReceiver ||
          "0x0000000000000000000000000000000000000000",
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

    // Execute the transaction with sufficient gas limit
    // CRITICAL: For CCIP transactions, we need to set a HIGH gas limit
    // Safe's internal safeTxGas (3M) is for internal accounting
    // But blockchain transaction needs actual gas limit (5M for CCIP)
    console.log("⛽ Executing with high gas limit for CCIP compatibility...");
    console.log("📋 Final transaction details:", {
      to: safeTransaction.data.to,
      value: safeTransaction.data.value,
      data: safeTransaction.data.data.slice(0, 66) + "...",
      operation: safeTransaction.data.operation,
      safeTxGas: safeTransaction.data.safeTxGas,
    });

    // 🔥 CRITICAL FIX: For transactions with value > 0, we need to ensure
    // Safe forwards the value from its own balance to the target contract.
    //
    // Safe's execTransaction() should automatically forward value when:
    // - operation = 0 (Call)
    // - value > 0 in transaction data
    //
    // But there may be a bug in Protocol Kit not handling this correctly.
    // Let's add explicit logging to debug this.

    console.log("🔍 Pre-execution value check:", {
      hasValue: BigInt(safeTransaction.data.value) > 0n,
      valueAmount: safeTransaction.data.value,
      operation: safeTransaction.data.operation === 0 ? "Call" : "DelegateCall",
      willForwardValue:
        safeTransaction.data.operation === 0 &&
        BigInt(safeTransaction.data.value) > 0n,
    });

    const executeTxResponse = await safe.executeTransaction(safeTransaction, {
      gasLimit: "5000000", // 5M gas for blockchain transaction
      // This ensures the EVM has enough gas to complete:
      // 1. Safe's execTransaction logic (~100k)
      // 2. CCIP Router's ccipSend (~2-2.5M)
      // 3. All nested calls and state changes (~500k+)
      // 4. Buffer for network variations (~1M+)
    });

    const txResponse = executeTxResponse.transactionResponse as unknown as {
      wait: () => Promise<{ hash: string }>;
    } | null;
    const receipt = txResponse ? await txResponse.wait() : null;

    console.log(
      "✅ Transaction executed successfully:",
      receipt?.hash || executeTxResponse.hash
    );

    // 🔍 Verify Safe balance decreased by transaction value
    const safeBalanceAfter = await provider.getBalance(safeAddress);
    const balanceChange = safeBalance - safeBalanceAfter;

    console.log("💰 Post-execution balance check:");
    console.log(
      `  Safe Balance After: ${safeBalanceAfter.toString()} wei (${ethers.formatEther(
        safeBalanceAfter
      )} ETH)`
    );
    console.log(
      `  Balance Change: ${balanceChange.toString()} wei (${ethers.formatEther(
        balanceChange
      )} ETH)`
    );
    console.log(
      `  Expected Value Transfer: ${requiredValue.toString()} wei (${ethers.formatEther(
        requiredValue
      )} ETH)`
    );

    // Note: Balance change will be higher than value due to gas costs
    // But it should be at least equal to the transaction value
    if (balanceChange < requiredValue) {
      console.warn(
        `⚠️ WARNING: Safe balance decreased by ${ethers.formatEther(
          balanceChange
        )} ETH, ` +
          `but transaction value was ${ethers.formatEther(
            requiredValue
          )} ETH. ` +
          `This may indicate the value was not forwarded correctly!`
      );
    } else {
      console.log(
        `✅ Safe balance correctly decreased by at least transaction value`
      );
    }

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
    console.log("Transaction history fetched, total txs:", history);

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
  feeToken: "LINK" | "native"; // Track which token is used for fee
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
 *
 * 🎯 DUAL FEE SUPPORT: You can now choose between LINK or native ETH fees!
 *
 * @param feeToken - "LINK" (recommended) or "native" (ETH) for fee payment
 *
 * ✅ LINK Fee (Recommended):
 *    - More reliable with Safe multisig
 *    - Standard ERC20 approval flow
 *    - No msg.value forwarding issues
 *
 * ⚠️ Native ETH Fee (Advanced):
 *    - Works with Safe but requires proper value forwarding
 *    - Slightly lower gas cost (fewer transactions)
 *    - Safe MUST have sufficient ETH balance
 */
export const calculateCCIPFee = async (
  params: CCIPTransferParams,
  _provider: BrowserProvider, // Prefix with _ to indicate intentionally unused
  feeToken: "LINK" | "native" = "LINK" // Default to LINK for maximum compatibility
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

    // Get LINK token only if using LINK for fees
    const linkToken =
      feeToken === "LINK"
        ? getTokenBySymbol(params.sourceNetwork, "LINK")
        : null;

    if (feeToken === "LINK" && !linkToken) {
      throw new Error(
        `LINK token not found on ${params.sourceNetwork}. ` +
          `LINK is required when feeToken="LINK".`
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
    // When feeToken="LINK", fee is returned in LINK token amount
    // When feeToken="native", fee is returned in native token (ETH)
    const feeInWei = await ccipClient.getFee({
      client: publicClient as any, // Type cast to avoid viem version conflicts
      routerAddress: sourceConfig.routerAddress as `0x${string}`,
      destinationChainSelector: destConfig.chainSelector,
      destinationAccount: params.recipientAddress as `0x${string}`,
      amount: BigInt(params.amount),
      tokenAddress: token.address as `0x${string}`,
      feeTokenAddress:
        feeToken === "LINK" ? (linkToken!.address as `0x${string}`) : undefined, // undefined = native token
    });

    console.log(`💰 CCIP Fee calculated: ${feeInWei.toString()} (${feeToken})`);

    return {
      feeInWei: feeInWei.toString(),
      feeInEther: ethers.formatEther(feeInWei),
      feeToken: feeToken, // Track which token was used
    };
  } catch (error) {
    console.error("Error calculating CCIP fee:", error);
    throw new Error("Failed to calculate CCIP transfer fee");
  }
};

/**
 * Build CCIP transaction data for Safe execution using CCIP SDK
 * This creates the transaction payload that Safe will execute
 *
 * 🎯 DUAL FEE SUPPORT: Choose between LINK or native ETH fees!
 *
 * @param feeToken - "LINK" (recommended) or "native" (ETH)
 *
 * ✅ LINK Fee Transaction Flow:
 *    1. Token approval (transfer amount)
 *    2. LINK approval (fee amount) - if needed
 *    3. ccipSend with value="0"
 *
 * ⚠️ Native ETH Fee Transaction Flow:
 *    1. Token approval (transfer amount)
 *    2. ccipSend with value=feeAmount
 */
export const buildCCIPSafeTransaction = async (
  params: CCIPTransferParams,
  safeAddress: string,
  provider: BrowserProvider,
  feeToken: "LINK" | "native" = "LINK" // Default to LINK
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

    // ✅ CRITICAL: Check if token is supported for CCIP transfer to destination
    console.log(
      `[CCIP Build] 🔍 Checking if ${params.tokenSymbol} is supported for transfer from ${params.sourceNetwork} to ${params.destinationNetwork}...`
    );

    const ccipClient = createClient();

    // Create viem PublicClient for proper RPC interaction
    const rpcUrl = import.meta.env.VITE_INFURA_RPC_URL;
    if (!rpcUrl) {
      throw new Error("RPC URL not configured in environment variables");
    }

    const viemClient = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });

    const isSupported = await ccipClient.isTokenSupported({
      client: viemClient as any, // Cast to handle viem type compatibility
      routerAddress: sourceConfig.routerAddress as `0x${string}`,
      destinationChainSelector: destConfig.chainSelector,
      tokenAddress: token.address as `0x${string}`,
    });

    if (!isSupported) {
      throw new Error(
        `❌ Token ${params.tokenSymbol} is NOT supported for CCIP transfer!\n\n` +
          `Transfer from: ${params.sourceNetwork}\n` +
          `Transfer to: ${params.destinationNetwork}\n` +
          `Token address: ${token.address}\n` +
          `Router: ${sourceConfig.routerAddress}\n\n` +
          `This token cannot be transferred via CCIP to the destination chain.\n` +
          `Please select a different token or destination network.`
      );
    }

    console.log(
      `[CCIP Build] ✅ Token ${params.tokenSymbol} is supported for CCIP transfer`
    );

    // 🎯 Get LINK token (only needed if using LINK for fees)
    const linkToken =
      feeToken === "LINK"
        ? getTokenBySymbol(params.sourceNetwork, "LINK")
        : null;

    if (feeToken === "LINK" && !linkToken) {
      throw new Error(
        `❌ LINK token not found on ${params.sourceNetwork}!\n\n` +
          `LINK is selected for CCIP fee payment but not configured.\n` +
          `Please ensure LINK token is configured in ccipConfig.ts for this network.`
      );
    }

    if (feeToken === "LINK" && linkToken) {
      console.log(`🔗 Using LINK token for fees: ${linkToken.address}`);
    } else {
      console.log(`💰 Using native ETH for fees`);
    }

    // Calculate fee (in LINK or ETH depending on feeToken)
    const estimatedFee = await calculateCCIPFee(params, provider, feeToken);

    // Prepare transactions array (may need token approval + LINK approval + CCIP send)
    const transactions: MetaTransactionData[] = [];

    // Step 1: Check if token approval is needed using DIRECT blockchain call
    // CRITICAL: Always check fresh on-chain data, don't trust cache
    const tokenContract = new ethers.Contract(
      token.address,
      IERC20ABI,
      provider
    );

    const currentAllowance = (await tokenContract.allowance(
      safeAddress,
      sourceConfig.routerAddress
    )) as bigint;

    const amountBN = BigInt(params.amount);

    console.log(
      `[CCIP Build] ⚡ FRESH token allowance check: ${currentAllowance.toString()}, needed: ${amountBN.toString()}`
    );
    console.log(
      `[CCIP Build] Safe: ${safeAddress}, Router: ${sourceConfig.routerAddress}, Token: ${token.address}`
    );

    // If token allowance is insufficient, add approval transaction
    if (currentAllowance < amountBN) {
      console.log(
        "[CCIP Build] ⚠️ Insufficient token allowance - adding token approval transaction"
      );
      console.log(
        `[CCIP Build] 💡 TIP: Pre-approve tokens in "Token Approvals" tab to skip this step!`
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
    } else {
      console.log(
        "[CCIP Build] ✅ Token already approved - skipping approval transaction"
      );
      console.log(
        `[CCIP Build] 🎉 This allows single-transaction CCIP transfer (even with native fees)!`
      );
    }

    // Step 2: Check if LINK approval is needed for fee payment (only if using LINK)
    if (feeToken === "LINK" && linkToken) {
      const linkContract = new ethers.Contract(
        linkToken.address,
        IERC20ABI,
        provider
      );

      const linkAllowance = (await linkContract.allowance(
        safeAddress,
        sourceConfig.routerAddress
      )) as bigint;

      const linkFeeAmount = BigInt(estimatedFee.feeInWei);

      console.log(
        `[CCIP Build] 💰 LINK allowance check: ${linkAllowance.toString()}, needed for fee: ${linkFeeAmount.toString()}`
      );

      // If LINK allowance is insufficient, add LINK approval transaction
      if (linkAllowance < linkFeeAmount) {
        console.log(
          "[CCIP Build] Insufficient LINK allowance - adding LINK approval transaction for fee payment"
        );

        const linkApprovalData = linkContract.interface.encodeFunctionData(
          "approve",
          [sourceConfig.routerAddress, linkFeeAmount]
        );

        transactions.push({
          to: linkToken.address,
          value: "0", // No ETH value for approval
          data: linkApprovalData,
          operation: 0, // Call
        });
      }
    }

    // Step 3: Build CCIP send transaction using SDK
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

    // 🔥 Build CCIP message with LINK fee token (NOT native ETH!)
    const ccipMessage = {
      receiver: receiverBytes,
      data: "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`, // zeroHash for no data
      tokenAmounts: [
        {
          token: token.address as `0x${string}`,
          amount: amountBN,
        },
      ],
      feeToken:
        feeToken === "LINK" && linkToken
          ? (linkToken.address as `0x${string}`) // LINK token address
          : ("0x0000000000000000000000000000000000000000" as `0x${string}`), // Zero address = native ETH
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
        feeToken: ccipMessage.feeToken, // LINK address or zero address
        feeType: feeToken === "LINK" ? "LINK" : "Native ETH",
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
      `[CCIP Build] Fee: ${estimatedFee.feeInWei} wei (${estimatedFee.feeInEther} ${feeToken})`
    );

    // 🎯 Add CCIP send transaction with appropriate value
    // - LINK fees: value = "0" (fee paid via ERC20 transfer)
    // - Native fees: value = feeInWei (fee paid via msg.value)
    const ccipTxValue = feeToken === "native" ? estimatedFee.feeInWei : "0";

    console.log(`[CCIP Build] 🔍 Transaction value calculation:`, {
      feeToken,
      estimatedFeeInWei: estimatedFee.feeInWei,
      ccipTxValue,
      willHaveValue: BigInt(ccipTxValue) > 0n,
    });

    // 🚨 CRITICAL VALIDATION: Ensure native fee has actual value
    if (feeToken === "native" && BigInt(ccipTxValue) === 0n) {
      console.error(
        `[CCIP Build] ❌ CRITICAL: Native fee selected but transaction value is 0!`
      );
      throw new Error(
        `Internal error: Native fee mode has 0 transaction value. ` +
          `Fee amount: ${estimatedFee.feeInWei} wei. ` +
          `This would cause CCIP transfer to fail.`
      );
    }

    transactions.push({
      to: sourceConfig.routerAddress,
      value: ccipTxValue,
      data: fullCallData,
      operation: 0, // Call
    });

    console.log(
      `[CCIP Build] Total transactions to execute: ${transactions.length}`
    );
    console.log(
      `[CCIP Build] 💰 Fee payment method: ${feeToken} (${estimatedFee.feeInEther} ${feeToken})`
    );
    console.log(
      `[CCIP Build] 💵 Transaction value: ${
        feeToken === "native" ? estimatedFee.feeInEther + " ETH" : "0 ETH"
      }`
    );

    // 🚨 FINAL VALIDATION: Check transaction array integrity
    console.log(`[CCIP Build] 🔍 Final transaction validation:`, {
      totalTransactions: transactions.length,
      transactionsWithValue: transactions.filter((tx) => BigInt(tx.value) > 0n)
        .length,
      feeTokenUsed: feeToken,
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
  provider: BrowserProvider,
  feeToken: "LINK" | "native" = "LINK" // Default to LINK
): Promise<{
  safeTxHash: string;
  estimatedFee: CCIPFeeEstimate;
  needsApproval: boolean;
  approvalTxHash?: string;
  ccipTxHash?: string;
}> => {
  try {
    // 🚨 CRITICAL: Force LINK fees for Safe multisig
    // Native ETH fees DO NOT work with Safe due to value forwarding limitations
    // See NATIVE_FEE_SAFE_LIMITATION.md for detailed explanation
    let actualFeeToken: "LINK" | "native" = feeToken;

    if (feeToken === "native") {
      console.error(
        "[CCIP] ❌ CRITICAL: Native ETH fees are NOT supported for Safe multisig!"
      );
      console.error(
        "[CCIP] Reason: Safe's value forwarding doesn't work with CCIP Router's msg.value validation"
      );
      console.error("[CCIP] 🔄 FORCING LINK fees for compatibility...");

      // Force switch to LINK
      actualFeeToken = "LINK";

      alert(
        "⚠️ IMPORTANT NOTICE\n\n" +
          "Native ETH fees are NOT supported for Safe multisig wallets.\n\n" +
          "This is due to how Safe forwards value vs. how CCIP Router validates fees.\n\n" +
          "Automatically switching to LINK fees for you.\n\n" +
          "✅ LINK fees work perfectly with Safe and support transaction batching!"
      );
    }

    // Build CCIP transaction(s)
    const { transactions, estimatedFee } = await buildCCIPSafeTransaction(
      params,
      safeAddress,
      provider,
      actualFeeToken // Use actual fee token (forced to LINK if was native)
    );

    console.log(
      `[CCIP] Built ${transactions.length} transaction(s):`,
      transactions
    );

    // 🔍 DEBUG: Log each transaction value for native fee detection
    transactions.forEach((tx, i) => {
      console.log(`[CCIP] Transaction ${i + 1}:`, {
        to: tx.to,
        value: tx.value,
        valueType: typeof tx.value,
        valueBigInt: BigInt(tx.value).toString(),
        hasValue: BigInt(tx.value) > 0n,
      });
    });

    // � CRITICAL DECISION: Batch vs Separate based on fee token type!
    //
    // ✅ LINK Fees (value = "0"): CAN batch with MultiSend
    //    - All transactions have value="0"
    //    - MultiSend DELEGATECALL works perfectly
    //    - Atomically executes: approval(s) + ccipSend
    //
    // ❌ Native Fees (value = feeAmount): MUST propose separately!
    //    - Last transaction has value=feeAmount
    //    - MultiSend DELEGATECALL does NOT forward msg.value to sub-calls
    //    - Would cause "insufficient fee" error
    //    - Must execute approval first, then ccipSend separately
    //
    // See: https://docs.safe.global/advanced/smart-account-transactions
    //      "Transactions with value must be executed individually"

    const hasValueTransaction = transactions.some(
      (tx) => BigInt(tx.value) > 0n
    );
    const useNativeFee = feeToken === "native" && hasValueTransaction;

    console.log(`[CCIP] 🔍 Native fee detection:`, {
      feeToken,
      transactionCount: transactions.length,
      hasValueTransaction,
      useNativeFee,
      willProposeSeparately: useNativeFee,
    });

    // 🚨 CRITICAL CHECK: If using native fees, MUST propose separately!
    if (feeToken === "native" && !useNativeFee && transactions.length > 0) {
      console.error(
        `[CCIP] ❌ CRITICAL ERROR: Native fee selected but useNativeFee=false!`
      );
      console.error(
        `[CCIP] This will cause MultiSend DELEGATECALL to drop msg.value!`
      );
      console.error(`[CCIP] Transaction details:`, transactions);
      throw new Error(
        `Internal error: Native fee mode misconfigured. ` +
          `This would cause transaction failure due to MultiSend DELEGATECALL limitations. ` +
          `Please report this bug.`
      );
    }

    if (useNativeFee) {
      console.log(
        `[CCIP] ⚠️ NATIVE FEE MODE: Proposing ${transactions.length} transaction(s) SEPARATELY`
      );
      console.log(
        `[CCIP] 💡 Reason: MultiSend cannot forward msg.value for CCIP Router fees`
      );

      // Initialize Protocol Kit
      const safe = await initProtocolKit(safeAddress, provider);

      // Get chain ID
      const network = await provider.getNetwork();
      const chainId = network.chainId.toString();

      // Initialize API Kit
      const apiKit = await initApiKit(chainId);

      let approvalTxHash: string | undefined;
      let ccipTxHash: string;

      // Propose each transaction separately (preserving order)
      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i];
        const isApproval = i < transactions.length - 1; // All except last are approvals
        const isCCIPSend = i === transactions.length - 1; // Last is CCIP send

        console.log(
          `[CCIP] Proposing transaction ${i + 1}/${transactions.length}: ${
            isApproval ? "Approval" : "CCIP Send"
          }`
        );

        // Create individual Safe transaction
        const safeTransaction = await safe.createTransaction({
          transactions: [tx], // Single transaction
          options: {
            safeTxGas: isCCIPSend ? "3000000" : "100000", // More gas for CCIP
          },
        });

        console.log(`  Nonce: ${safeTransaction.data.nonce}`);
        console.log(`  Value: ${tx.value} wei`);
        console.log(`  To: ${tx.to.substring(0, 10)}...`);

        // Sign the transaction
        const signedTransaction = await safe.signTransaction(safeTransaction);

        // Get the Safe transaction hash
        const safeTxHash = await safe.getTransactionHash(signedTransaction);

        console.log(`  Safe TX Hash: ${safeTxHash}`);

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

        console.log(`  ✅ Transaction ${i + 1} proposed successfully`);

        // Track which transaction is which
        if (isApproval) {
          approvalTxHash = safeTxHash;
        } else if (isCCIPSend) {
          ccipTxHash = safeTxHash;
        }
      }

      console.log("[CCIP] ✅ All transactions proposed separately");
      console.log(
        "[CCIP] 💡 Execute IN ORDER: First approval(s), then CCIP send"
      );

      return {
        safeTxHash: ccipTxHash!, // Return CCIP send hash as primary
        estimatedFee,
        needsApproval: transactions.length > 1,
        approvalTxHash,
        ccipTxHash: ccipTxHash!,
      };
    } else {
      // LINK fee or no approvals needed - can batch safely
      console.log(
        `[CCIP] ✅ LINK FEE MODE: Batching ${transactions.length} transaction(s)`
      );
      console.log(
        `[CCIP] 💡 Reason: No msg.value required, MultiSend works perfectly`
      );

      // Initialize Protocol Kit
      const safe = await initProtocolKit(safeAddress, provider);

      // Get chain ID
      const network = await provider.getNetwork();
      const chainId = network.chainId.toString();

      // Initialize API Kit
      const apiKit = await initApiKit(chainId);

      // Create batched Safe transaction (MultiSend if multiple txs)
      const safeTransaction = await safe.createTransaction({
        transactions: transactions, // Array of MetaTransactionData
        options: {
          safeTxGas: "3000000", // 3M gas for CCIP + approvals
        },
      });

      console.log("[CCIP] Safe transaction created:", {
        nonce: safeTransaction.data.nonce,
        operations: transactions.length,
        safeTxGas: safeTransaction.data.safeTxGas,
      });

      // Log each operation in the batch
      transactions.forEach((tx, i) => {
        console.log(
          `  [${i + 1}] to: ${tx.to.substring(0, 10)}..., value: ${tx.value}`
        );
      });

      // Sign the transaction
      const signedTransaction = await safe.signTransaction(safeTransaction);

      // Get the Safe transaction hash
      const safeTxHash = await safe.getTransactionHash(signedTransaction);

      console.log("🔐 Safe transaction hash:", safeTxHash);

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

      console.log("[CCIP] ✅ Batched transaction proposed:", safeTxHash);
      console.log(
        "[CCIP] 💡 Execute this ONE transaction to run all operations atomically"
      );

      return {
        safeTxHash,
        estimatedFee,
        needsApproval: transactions.length > 1, // True if had approval
        ccipTxHash: safeTxHash, // Same hash (batched)
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

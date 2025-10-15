// Safe transaction flow: Propose, Confirm, Execute
// Complete implementation using Safe Global Protocol Kit and API Kit

import Safe from "@safe-global/protocol-kit";
import SafeApiKit from "@safe-global/api-kit";
import { ethers, BrowserProvider } from "ethers";
import type { MetaTransactionData } from "@safe-global/types-kit";
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

/**
 * ============================================================================
 * CCIP Cross-Chain Transfer Functions
 * ============================================================================
 */

import type {
  NetworkName,
} from "./ccipConfig";

import {
  getNetworkConfig,
  getTokenBySymbol,
} from "./ccipConfig";

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
 * Get the CCIP Router ABI (minimal interface needed for transfers)
 */
const getCCIPRouterABI = () => {
  return [
    // Function to get fee for sending a message
    "function getFee(uint64 destinationChainSelector, tuple(bytes receiver, bytes data, tuple(address token, uint256 amount)[] tokenAmounts, address feeToken, bytes extraArgs) message) view returns (uint256 fee)",
    
    // Function to send a CCIP message
    "function ccipSend(uint64 destinationChainSelector, tuple(bytes receiver, bytes data, tuple(address token, uint256 amount)[] tokenAmounts, address feeToken, bytes extraArgs) message) payable returns (bytes32 messageId)",
  ];
};

/**
 * Get ERC20 Token ABI for approval
 */
const getERC20ABI = () => {
  return [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function balanceOf(address account) view returns (uint256)",
  ];
};

/**
 * Calculate CCIP transfer fee
 * This estimates the cost of sending a cross-chain message
 */
export const calculateCCIPFee = async (
  params: CCIPTransferParams,
  provider: BrowserProvider
): Promise<CCIPFeeEstimate> => {
  try {
    const sourceConfig = getNetworkConfig(params.sourceNetwork);
    const destConfig = getNetworkConfig(params.destinationNetwork);
    const token = getTokenBySymbol(params.sourceNetwork, params.tokenSymbol);

    if (!token) {
      throw new Error(`Token ${params.tokenSymbol} not found on ${params.sourceNetwork}`);
    }

    // Create router contract instance
    const routerContract = new ethers.Contract(
      sourceConfig.routerAddress,
      getCCIPRouterABI(),
      provider
    );

    // Encode receiver address for CCIP (must be bytes)
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const receiverBytes = abiCoder.encode(
      ["address"],
      [params.recipientAddress]
    );

    // Build CCIP message structure
    const message = {
      receiver: receiverBytes,
      data: "0x", // No additional data
      tokenAmounts: [
        {
          token: token.address,
          amount: params.amount,
        },
      ],
      feeToken: ethers.ZeroAddress, // Pay fees in native token (ETH)
      extraArgs: "0x", // Default extra args
    };

    // Get fee from router
    const feeInWei = await routerContract.getFee(
      destConfig.chainSelector,
      message
    );

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
 * Build CCIP transaction data for Safe execution
 * This creates the transaction payload that Safe will execute
 */
export const buildCCIPSafeTransaction = async (
  params: CCIPTransferParams,
  safeAddress: string,
  provider: BrowserProvider
): Promise<{ transactions: MetaTransactionData[]; estimatedFee: CCIPFeeEstimate }> => {
  try {
    const sourceConfig = getNetworkConfig(params.sourceNetwork);
    const destConfig = getNetworkConfig(params.destinationNetwork);
    const token = getTokenBySymbol(params.sourceNetwork, params.tokenSymbol);

    if (!token) {
      throw new Error(`Token ${params.tokenSymbol} not found on ${params.sourceNetwork}`);
    }

    // Calculate fee first
    const estimatedFee = await calculateCCIPFee(params, provider);

    // Prepare transactions array (may need approval + CCIP send)
    const transactions: MetaTransactionData[] = [];

    // Step 1: Check if token approval is needed
    const tokenContract = new ethers.Contract(
      token.address,
      getERC20ABI(),
      provider
    );

    const currentAllowance = await tokenContract.allowance(
      safeAddress,
      sourceConfig.routerAddress
    );

    const amountBN = BigInt(params.amount);

    // If allowance is insufficient, add approval transaction
    if (currentAllowance < amountBN) {
      const approvalData = tokenContract.interface.encodeFunctionData("approve", [
        sourceConfig.routerAddress,
        amountBN,
      ]);

      transactions.push({
        to: token.address,
        value: "0",
        data: approvalData,
        operation: 0, // Call
      });
    }

    // Step 2: Build CCIP send transaction
    const routerContract = new ethers.Contract(
      sourceConfig.routerAddress,
      getCCIPRouterABI(),
      provider
    );

    // Encode receiver address
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    const receiverBytes = abiCoder.encode(
      ["address"],
      [params.recipientAddress]
    );

    // Build CCIP message
    const message = {
      receiver: receiverBytes,
      data: "0x",
      tokenAmounts: [
        {
          token: token.address,
          amount: amountBN,
        },
      ],
      feeToken: ethers.ZeroAddress, // Pay in native token
      extraArgs: "0x",
    };

    // Encode ccipSend function call
    const ccipSendData = routerContract.interface.encodeFunctionData("ccipSend", [
      destConfig.chainSelector,
      message,
    ]);

    // Add CCIP send transaction (with fee as value)
    transactions.push({
      to: sourceConfig.routerAddress,
      value: estimatedFee.feeInWei,
      data: ccipSendData,
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
 * Check if Safe has sufficient balance for CCIP transfer
 */
export const checkCCIPTransferBalance = async (
  params: CCIPTransferParams,
  safeAddress: string,
  provider: BrowserProvider
): Promise<{ hasTokenBalance: boolean; hasFeeBalance: boolean; tokenBalance: string; nativeBalance: string }> => {
  try {
    const token = getTokenBySymbol(params.sourceNetwork, params.tokenSymbol);
    
    if (!token) {
      throw new Error(`Token ${params.tokenSymbol} not found`);
    }

    // Check token balance
    const tokenContract = new ethers.Contract(
      token.address,
      getERC20ABI(),
      provider
    );

    const tokenBalance = await tokenContract.balanceOf(safeAddress);
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

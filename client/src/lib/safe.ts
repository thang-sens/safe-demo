// Safe SDK setup for frontend
// Helper functions for Safe interactions

import { BrowserProvider } from "ethers";
import {
  getSafeInfo as getSafeInfoFlow,
  getPendingTransactions,
  getTransactionHistory,
  isOwner as isOwnerFlow,
} from "./safeFlow";

/**
 * Get Safe information from blockchain
 * @param safeAddress - Address of the Safe wallet
 * @param provider - Ethers BrowserProvider
 */
export const getSafeInfo = async (
  safeAddress: string,
  provider: BrowserProvider
) => {
  return await getSafeInfoFlow(safeAddress, provider);
};

/**
 * Get all pending transactions for a Safe
 * @param safeAddress - Address of the Safe wallet
 * @param chainId - Chain ID (e.g., "11155111" for Sepolia)
 */
export const getPendingSafeTransactions = async (
  safeAddress: string,
  chainId: string = "11155111"
) => {
  return await getPendingTransactions(safeAddress, chainId);
};

/**
 * Get transaction history for a Safe
 * @param safeAddress - Address of the Safe wallet
 * @param chainId - Chain ID (e.g., "11155111" for Sepolia)
 */
export const getSafeTransactionHistory = async (
  safeAddress: string,
  chainId: string = "11155111"
) => {
  return await getTransactionHistory(safeAddress, chainId);
};

/**
 * Check if an address is an owner of the Safe
 * @param safeAddress - Address of the Safe wallet
 * @param ownerAddress - Address to check
 * @param provider - Ethers BrowserProvider
 */
export const checkIsOwner = async (
  safeAddress: string,
  ownerAddress: string,
  provider: BrowserProvider
) => {
  return await isOwnerFlow(safeAddress, ownerAddress, provider);
};

/**
 * Get Safe balance in ETH
 * @param safeAddress - Address of the Safe wallet
 * @param provider - Ethers BrowserProvider
 */
export const getSafeBalance = async (
  safeAddress: string,
  provider: BrowserProvider
) => {
  const info = await getSafeInfoFlow(safeAddress, provider);
  return info.balance;
};

/**
 * Get Safe owners
 * @param safeAddress - Address of the Safe wallet
 * @param provider - Ethers BrowserProvider
 */
export const getSafeOwners = async (
  safeAddress: string,
  provider: BrowserProvider
) => {
  const info = await getSafeInfoFlow(safeAddress, provider);
  return info.owners;
};

/**
 * Get Safe threshold
 * @param safeAddress - Address of the Safe wallet
 * @param provider - Ethers BrowserProvider
 */
export const getSafeThreshold = async (
  safeAddress: string,
  provider: BrowserProvider
) => {
  const info = await getSafeInfoFlow(safeAddress, provider);
  return info.threshold;
};

/**
 * Get chain ID from provider
 * @param provider - Ethers BrowserProvider
 */
export const getChainId = async (provider: BrowserProvider): Promise<string> => {
  const network = await provider.getNetwork();
  return network.chainId.toString();
};

/**
 * CCIP Safe Transaction Debugging Utilities
 * Helper functions to debug why CCIP transfers through Safe fail
 */

import { BrowserProvider, ethers } from "ethers";
import { getNetworkConfig } from "./ccipConfig";
import type { NetworkName } from "./ccipConfig";

/**
 * Check if Safe has sufficient balance for CCIP transfer
 */
export const checkSafeBalanceForCCIP = async (
  safeAddress: string,
  feeInWei: string,
  provider: BrowserProvider
): Promise<{
  safeBalance: string;
  safeBalanceEth: string;
  feeRequired: string;
  feeRequiredEth: string;
  hasSufficientBalance: boolean;
  shortfall: string;
  shortfallEth: string;
}> => {
  const balance = await provider.getBalance(safeAddress);
  const feeRequired = BigInt(feeInWei);

  const hasSufficientBalance = balance >= feeRequired;
  const shortfall = hasSufficientBalance ? 0n : feeRequired - balance;

  return {
    safeBalance: balance.toString(),
    safeBalanceEth: ethers.formatEther(balance),
    feeRequired: feeRequired.toString(),
    feeRequiredEth: ethers.formatEther(feeRequired),
    hasSufficientBalance,
    shortfall: shortfall.toString(),
    shortfallEth: ethers.formatEther(shortfall),
  };
};

/**
 * Check if Safe has approved enough tokens for CCIP router
 */
export const checkSafeTokenApproval = async (
  safeAddress: string,
  tokenAddress: string,
  routerAddress: string,
  amountRequired: string,
  provider: BrowserProvider
): Promise<{
  currentAllowance: string;
  currentAllowanceFormatted: string;
  amountRequired: string;
  amountRequiredFormatted: string;
  hasApproval: boolean;
  shortfall: string;
  shortfallFormatted: string;
  decimals: number;
}> => {
  const tokenAbi = [
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)",
  ];

  const tokenContract = new ethers.Contract(tokenAddress, tokenAbi, provider);
  const allowance = await tokenContract.allowance(safeAddress, routerAddress);
  const decimals = await tokenContract.decimals();

  const amountRequiredBN = BigInt(amountRequired);
  const hasApproval = allowance >= amountRequiredBN;
  const shortfall = hasApproval ? 0n : amountRequiredBN - allowance;

  return {
    currentAllowance: allowance.toString(),
    currentAllowanceFormatted: ethers.formatUnits(allowance, decimals),
    amountRequired: amountRequired,
    amountRequiredFormatted: ethers.formatUnits(amountRequired, decimals),
    hasApproval,
    shortfall: shortfall.toString(),
    shortfallFormatted: ethers.formatUnits(shortfall, decimals),
    decimals: Number(decimals),
  };
};

/**
 * Parse Safe transaction receipt to find actual execution result
 */
export const parseSafeExecutionReceipt = async (
  txHash: string,
  provider: BrowserProvider
): Promise<{
  success: boolean;
  executionSuccess: boolean;
  ccipMessageId?: string;
  events: Array<{
    name: string;
    address: string;
    args: any;
  }>;
  gasUsed: string;
  effectiveGasPrice: string;
}> => {
  const receipt = await provider.getTransactionReceipt(txHash);

  if (!receipt) {
    throw new Error("Transaction receipt not found");
  }

  // Safe ExecutionSuccess event signature
  const executionSuccessSignature =
    "0x442e715f626346e8c54381002da614f62bee8d27386535b2521ec8540898556e";

  // Safe ExecutionFailure event signature
  const executionFailureSignature =
    "0x23428b18acfb3ea64b08dc0c1d296ea9c09702c09083ca5272e64d115b687d23";

  // CCIP CCIPSendRequested event signature (topic0)
  const ccipSendRequestedSignature =
    "0xd0c3c799bf9e2639de44391e7f524d229b2b55f5b1ea94b2bf7da42f7243dddd";

  let executionSuccess = false;
  let ccipMessageId: string | undefined;
  const events: Array<{ name: string; address: string; args: any }> = [];

  // Parse logs
  for (const log of receipt.logs) {
    // Check for Safe ExecutionSuccess
    if (log.topics[0] === executionSuccessSignature) {
      executionSuccess = true;
      events.push({
        name: "ExecutionSuccess",
        address: log.address,
        args: {
          txHash: log.topics[1],
          payment: log.topics[2],
        },
      });
    }

    // Check for Safe ExecutionFailure
    if (log.topics[0] === executionFailureSignature) {
      executionSuccess = false;
      events.push({
        name: "ExecutionFailure",
        address: log.address,
        args: {
          txHash: log.topics[1],
          payment: log.topics[2],
        },
      });
    }

    // Check for CCIP CCIPSendRequested
    if (log.topics[0] === ccipSendRequestedSignature) {
      // Message ID is in topics[1]
      ccipMessageId = log.topics[1];
      events.push({
        name: "CCIPSendRequested",
        address: log.address,
        args: {
          messageId: ccipMessageId,
        },
      });
    }
  }

  return {
    success: receipt.status === 1,
    executionSuccess,
    ccipMessageId,
    events,
    gasUsed: receipt.gasUsed.toString(),
    effectiveGasPrice: receipt.gasPrice?.toString() || "0",
  };
};

/**
 * Debug CCIP transfer execution through Safe
 * Comprehensive check for all potential issues
 */
export const debugCCIPSafeTransfer = async (
  safeAddress: string,
  tokenSymbol: string,
  amount: string,
  sourceNetwork: NetworkName,
  _destinationNetwork: NetworkName,
  feeInWei: string,
  provider: BrowserProvider
): Promise<{
  balanceCheck: Awaited<ReturnType<typeof checkSafeBalanceForCCIP>>;
  approvalCheck?: Awaited<ReturnType<typeof checkSafeTokenApproval>>;
  allChecksPass: boolean;
  issues: string[];
}> => {
  const issues: string[] = [];

  // Get network configs
  const sourceConfig = getNetworkConfig(sourceNetwork);

  // Check 1: Safe ETH balance for fees
  const balanceCheck = await checkSafeBalanceForCCIP(
    safeAddress,
    feeInWei,
    provider
  );

  if (!balanceCheck.hasSufficientBalance) {
    issues.push(
      `Insufficient ETH balance. Safe has ${balanceCheck.safeBalanceEth} ETH but needs ${balanceCheck.feeRequiredEth} ETH (shortfall: ${balanceCheck.shortfallEth} ETH)`
    );
  }

  // Check 2: Token approval (if not native token)
  let approvalCheck;
  if (tokenSymbol !== "ETH" && tokenSymbol !== "MATIC") {
    const sourceTokens = sourceConfig.supportedTokens;
    const token = sourceTokens.find((t) => t.symbol === tokenSymbol);

    if (token) {
      approvalCheck = await checkSafeTokenApproval(
        safeAddress,
        token.address,
        sourceConfig.routerAddress,
        amount,
        provider
      );

      if (!approvalCheck.hasApproval) {
        issues.push(
          `Insufficient token approval. Approved: ${approvalCheck.currentAllowanceFormatted} ${tokenSymbol}, Required: ${approvalCheck.amountRequiredFormatted} ${tokenSymbol} (shortfall: ${approvalCheck.shortfallFormatted} ${tokenSymbol})`
        );
      }
    }
  }

  return {
    balanceCheck,
    approvalCheck,
    allChecksPass: issues.length === 0,
    issues,
  };
};

/**
 * Verify CCIP transaction was actually sent on-chain
 * Use this AFTER executing a CCIP transaction through Safe
 */
export const verifyCCIPTransactionOnChain = async (
  txHash: string,
  provider: BrowserProvider
): Promise<{
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
}> => {
  try {
    const result = await parseSafeExecutionReceipt(txHash, provider);

    // Build diagnostics
    const diagnostics = {
      blockchainTxSuccess: result.success,
      safeExecutionSuccess: result.executionSuccess,
      hasCCIPEvent: !!result.ccipMessageId,
      hasExecutionFailure: !result.executionSuccess && result.success,
      etherscanUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
    };

    // Case 1: Blockchain transaction failed
    if (!result.success) {
      return {
        success: false,
        message:
          "❌ Blockchain transaction failed (status = 0).\n\n" +
          "This means the transaction was reverted on-chain. Check Etherscan for error details.",
        diagnostics,
      };
    }

    // Case 2: Safe execution failed (ExecutionFailure event)
    if (!result.executionSuccess) {
      return {
        success: false,
        message:
          "❌ Safe execution failed (ExecutionFailure event detected).\n\n" +
          "Most common causes:\n" +
          "• Safe doesn't have enough ETH to pay CCIP fees\n" +
          "• Token approval insufficient or not executed\n" +
          "• Gas limit too low\n\n" +
          "💡 Solution: Check Safe ETH balance and token approval, then retry.",
        diagnostics,
      };
    }

    // Case 3: Safe executed but no CCIP message
    if (!result.ccipMessageId) {
      return {
        success: false,
        message:
          "⚠️ Safe transaction succeeded but NO CCIP message found!\n\n" +
          "This usually means:\n" +
          "• CCIP Router call failed silently (insufficient ETH for fees)\n" +
          "• Wrong transaction - this may not be a CCIP transfer\n" +
          "• Token approval not executed before CCIP send\n\n" +
          "💡 Check Etherscan logs for 'CCIPSendRequested' event.",
        diagnostics,
      };
    }

    // Case 4: Success! CCIP message was sent
    return {
      success: true,
      message:
        "✅ CCIP transfer executed successfully!\n\n" +
        `Message ID: ${result.ccipMessageId}\n\n` +
        "Your tokens are being transferred cross-chain. Track the status on CCIP Explorer.",
      ccipMessageId: result.ccipMessageId,
      explorerUrl: `https://ccip.chain.link/msg/${result.ccipMessageId}`,
      diagnostics,
    };
  } catch (error) {
    return {
      success: false,
      message: `❌ Error verifying transaction:\n\n${error instanceof Error ? error.message : "Unknown error"}\n\nPlease check if the transaction hash is correct.`,
    };
  }
};

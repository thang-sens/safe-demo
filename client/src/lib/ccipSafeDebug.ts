/**
 * Advanced CCIP Safe Transaction Debugging
 * Helps diagnose why Safe CCIP transfers fail
 */
import { BrowserProvider, ethers } from "ethers";
import { IERC20ABI } from "@chainlink/ccip-js";
import { getNetworkConfig, getTokenBySymbol } from "./ccipConfig";
import type { NetworkName } from "./ccipConfig";

/**
 * Check if approval transaction was executed before CCIP send
 * This is the most common cause of failure
 */
export const checkApprovalStatus = async (
  safeAddress: string,
  tokenSymbol: string,
  sourceNetwork: NetworkName,
  provider: BrowserProvider
): Promise<{
  isApproved: boolean;
  currentAllowance: string;
  currentAllowanceFormatted: string;
  routerAddress: string;
  tokenAddress: string;
  recommendation: string;
}> => {
  try {
    const sourceConfig = getNetworkConfig(sourceNetwork);
    const token = getTokenBySymbol(sourceNetwork, tokenSymbol);

    if (!token) {
      throw new Error(`Token ${tokenSymbol} not found`);
    }

    // Check current allowance
    const tokenContract = new ethers.Contract(
      token.address,
      IERC20ABI,
      provider
    );

    const allowance = (await tokenContract.allowance(
      safeAddress,
      sourceConfig.routerAddress
    )) as bigint;

    const isApproved = allowance > 0n;
    const allowanceFormatted = ethers.formatUnits(allowance, token.decimals);

    let recommendation = "";
    if (!isApproved) {
      recommendation =
        "❌ NO APPROVAL! You must execute the approval transaction FIRST before executing CCIP send!";
    } else if (allowance < ethers.parseUnits("1000000", token.decimals)) {
      recommendation = `⚠️ Low approval (${allowanceFormatted} ${tokenSymbol}). Consider approving more if you plan multiple transfers.`;
    } else {
      recommendation = `✅ Token is approved! Current allowance: ${allowanceFormatted} ${tokenSymbol}`;
    }

    return {
      isApproved,
      currentAllowance: allowance.toString(),
      currentAllowanceFormatted: allowanceFormatted,
      routerAddress: sourceConfig.routerAddress,
      tokenAddress: token.address,
      recommendation,
    };
  } catch (error) {
    console.error("Error checking approval:", error);
    throw error;
  }
};

/**
 * Analyze a failed Safe transaction to determine exact failure reason
 */
export const analyzeSafeTransactionFailure = async (
  txHash: string,
  provider: BrowserProvider
): Promise<{
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
}> => {
  try {
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      return {
        blockchainTxSuccess: false,
        safeExecutionSuccess: false,
        failureReason: "Transaction not found on blockchain",
        diagnostics: {
          hasExecutionFailure: false,
          hasCCIPEvent: false,
          gasUsed: "0",
          etherscanUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
        },
        recommendation: "Check if transaction hash is correct",
      };
    }

    const blockchainTxSuccess = receipt.status === 1;

    // Event signatures
    const EXECUTION_SUCCESS =
      "0x442e715f626346e8c54381002da614f62bee8d27386535b2521ec8540898556e";
    const EXECUTION_FAILURE =
      "0x23428b18acfb3ea64b08dc0c1d296ea9c09702c09083ca5272e64d115b687d23";
    const CCIP_SEND_REQUESTED =
      "0xd0c3c799bf9e2639de44391e7f524d229b2b55f5b1ea94b2bf7da42f7243dddd";

    const hasExecutionSuccess = receipt.logs.some(
      (log) => log.topics[0] === EXECUTION_SUCCESS
    );
    const hasExecutionFailure = receipt.logs.some(
      (log) => log.topics[0] === EXECUTION_FAILURE
    );
    const hasCCIPEvent = receipt.logs.some(
      (log) => log.topics[0] === CCIP_SEND_REQUESTED
    );

    let failureReason = "";
    let recommendation = "";

    if (!blockchainTxSuccess) {
      failureReason = "Transaction reverted on blockchain (not Safe-specific)";
      recommendation =
        "Check gas limit, contract state, or network issues. This is a blockchain-level failure.";
    } else if (hasExecutionFailure) {
      failureReason =
        "Safe executed but internal call FAILED (isSuccessful: false)";

      if (!hasCCIPEvent) {
        recommendation =
          "🔴 MOST LIKELY CAUSE: Token not approved to CCIP Router!\n\n" +
          "SOLUTION:\n" +
          "1. Check if you executed the APPROVAL transaction first\n" +
          "2. Go to 'Pending Transactions' and look for approval tx\n" +
          "3. Execute approval transaction BEFORE CCIP send\n" +
          "4. Verify approval using the debug tool above\n\n" +
          "OTHER POSSIBLE CAUSES:\n" +
          "- Insufficient Safe balance for CCIP fees\n" +
          "- Token balance too low\n" +
          "- Gas limit too low\n" +
          "- Wrong CCIP Router address";
      } else {
        recommendation =
          "Internal call failed but CCIP event was emitted (rare). Check Safe balance or gas limits.";
      }
    } else if (hasExecutionSuccess && hasCCIPEvent) {
      failureReason = "No failure - transaction succeeded!";
      recommendation = "✅ Transaction executed successfully!";
    } else {
      failureReason = "Unknown failure mode";
      recommendation =
        "Check transaction logs on Etherscan for detailed error messages.";
    }

    return {
      blockchainTxSuccess,
      safeExecutionSuccess: hasExecutionSuccess,
      failureReason,
      diagnostics: {
        hasExecutionFailure,
        hasCCIPEvent,
        gasUsed: receipt.gasUsed.toString(),
        etherscanUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
      },
      recommendation,
    };
  } catch (error) {
    console.error("Error analyzing transaction:", error);
    throw error;
  }
};

/**
 * Check Safe's complete readiness for CCIP transfer
 */
export const checkSafeCCIPReadiness = async (
  safeAddress: string,
  tokenSymbol: string,
  amount: string,
  sourceNetwork: NetworkName,
  _destinationNetwork: NetworkName,
  provider: BrowserProvider
): Promise<{
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
}> => {
  try {
    const sourceConfig = getNetworkConfig(sourceNetwork);
    const token = getTokenBySymbol(sourceNetwork, tokenSymbol);

    if (!token) {
      throw new Error(`Token ${tokenSymbol} not found`);
    }

    const amountBN = ethers.parseUnits(amount, token.decimals);
    const issues: string[] = [];
    const recommendations: string[] = [];

    // Check 1: Token balance
    const tokenContract = new ethers.Contract(
      token.address,
      IERC20ABI,
      provider
    );
    const tokenBalance = (await tokenContract.balanceOf(safeAddress)) as bigint;
    const hasTokenBalance = tokenBalance >= amountBN;

    if (!hasTokenBalance) {
      issues.push(
        `Insufficient ${tokenSymbol} balance. Have: ${ethers.formatUnits(tokenBalance, token.decimals)}, Need: ${amount}`
      );
      recommendations.push(
        `Send at least ${amount} ${tokenSymbol} to Safe: ${safeAddress}`
      );
    }

    // Check 2: Native balance for fees (estimate ~0.001 ETH minimum)
    const nativeBalance = await provider.getBalance(safeAddress);
    const minFeeEstimate = ethers.parseEther("0.001"); // 0.001 ETH minimum
    const hasNativeBalance = nativeBalance >= minFeeEstimate;

    if (!hasNativeBalance) {
      issues.push(
        `Insufficient ETH for CCIP fees. Have: ${ethers.formatEther(nativeBalance)} ETH, Need: ~0.001 ETH minimum`
      );
      recommendations.push(`Send at least 0.01 ETH to Safe: ${safeAddress}`);
    }

    // Check 3: Token approval
    const allowance = (await tokenContract.allowance(
      safeAddress,
      sourceConfig.routerAddress
    )) as bigint;
    const isTokenApproved = allowance >= amountBN;

    if (!isTokenApproved) {
      issues.push(
        `Token not approved to CCIP Router. Current allowance: ${ethers.formatUnits(allowance, token.decimals)} ${tokenSymbol}`
      );
      recommendations.push(
        `⭐ EXECUTE the approval transaction first! Check 'Pending Transactions' tab.`
      );
    }

    const isReady = hasTokenBalance && hasNativeBalance && isTokenApproved;

    return {
      isReady,
      checks: {
        hasTokenBalance,
        tokenBalance: tokenBalance.toString(),
        tokenBalanceFormatted: ethers.formatUnits(tokenBalance, token.decimals),
        hasNativeBalance,
        nativeBalance: nativeBalance.toString(),
        nativeBalanceFormatted: ethers.formatEther(nativeBalance),
        isTokenApproved,
        approvalAmount: allowance.toString(),
        approvalAmountFormatted: ethers.formatUnits(allowance, token.decimals),
      },
      issues,
      recommendations,
    };
  } catch (error) {
    console.error("Error checking CCIP readiness:", error);
    throw error;
  }
};

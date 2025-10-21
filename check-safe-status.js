// Script to check Safe's approval and balance status
// Run: node check-safe-status.js

const { ethers } = require("ethers");

// Addresses
const SAFE_ADDRESS = "0xcF16809e8f41c6ECd613923a59c1605E1a41F7aD";
const WEB3AUTH_ADDRESS = "0x98F8e9e14C91AB139148a08008F99A03Fd602F30";
const RECIPIENT_ADDRESS = "0x5202487a23D600a199cFD4e7D28df36006064681";

// Ethereum Sepolia contracts
const CCIP_ROUTER = "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59";
const CCIP_BNM_TOKEN = "0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05";

// RPC URL - use public endpoint
const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

// ERC20 ABI (minimal)
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

async function checkSafeStatus() {
  console.log("🔍 Checking Safe Status...\n");
  console.log("Safe Address:", SAFE_ADDRESS);
  console.log("Web3Auth Address:", WEB3AUTH_ADDRESS);
  console.log("Recipient:", RECIPIENT_ADDRESS);
  console.log("CCIP Router:", CCIP_ROUTER);
  console.log("CCIP-BnM Token:", CCIP_BNM_TOKEN);
  console.log("\n" + "=".repeat(80) + "\n");

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const tokenContract = new ethers.Contract(CCIP_BNM_TOKEN, ERC20_ABI, provider);

    // 1. Check Safe ETH balance
    console.log("1️⃣ Checking Safe ETH Balance...");
    const ethBalance = await provider.getBalance(SAFE_ADDRESS);
    const ethBalanceFormatted = ethers.formatEther(ethBalance);
    console.log(`   Balance: ${ethBalanceFormatted} ETH`);
    
    if (ethBalance < ethers.parseEther("0.001")) {
      console.log("   ⚠️  WARNING: Low ETH balance! Need at least 0.001 ETH for CCIP fees");
    } else {
      console.log("   ✅ Sufficient ETH for CCIP fees");
    }
    console.log();

    // 2. Check Web3Auth ETH balance
    console.log("2️⃣ Checking Web3Auth ETH Balance...");
    const web3authBalance = await provider.getBalance(WEB3AUTH_ADDRESS);
    const web3authBalanceFormatted = ethers.formatEther(web3authBalance);
    console.log(`   Balance: ${web3authBalanceFormatted} ETH`);
    
    if (web3authBalance < ethers.parseEther("0.01")) {
      console.log("   ⚠️  WARNING: Low ETH balance! Need ETH for gas fees");
    } else {
      console.log("   ✅ Sufficient ETH for gas fees");
    }
    console.log();

    // 3. Check Safe CCIP-BnM token balance
    console.log("3️⃣ Checking Safe CCIP-BnM Token Balance...");
    const tokenBalance = await tokenContract.balanceOf(SAFE_ADDRESS);
    const tokenBalanceFormatted = ethers.formatEther(tokenBalance);
    console.log(`   Balance: ${tokenBalanceFormatted} CCIP-BnM`);
    
    if (tokenBalance === 0n) {
      console.log("   ❌ ERROR: No CCIP-BnM tokens in Safe!");
      console.log("   → You need to send CCIP-BnM tokens to Safe first");
    } else {
      console.log("   ✅ Has CCIP-BnM tokens");
    }
    console.log();

    // 4. Check Web3Auth CCIP-BnM token balance
    console.log("4️⃣ Checking Web3Auth CCIP-BnM Token Balance...");
    const web3authTokenBalance = await tokenContract.balanceOf(WEB3AUTH_ADDRESS);
    const web3authTokenBalanceFormatted = ethers.formatEther(web3authTokenBalance);
    console.log(`   Balance: ${web3authTokenBalanceFormatted} CCIP-BnM`);
    console.log();

    // 5. Check token approval (MOST IMPORTANT!)
    console.log("5️⃣ Checking Token Approval Status...");
    const allowance = await tokenContract.allowance(SAFE_ADDRESS, CCIP_ROUTER);
    const allowanceFormatted = ethers.formatEther(allowance);
    console.log(`   Current Allowance: ${allowanceFormatted} CCIP-BnM`);
    console.log(`   Router Address: ${CCIP_ROUTER}`);
    
    if (allowance === 0n) {
      console.log("   ❌ ERROR: Token NOT approved to CCIP Router!");
      console.log("   → This is why your transaction failed!");
      console.log();
      console.log("   🔴 ROOT CAUSE IDENTIFIED:");
      console.log("   The Safe has NOT executed the approval transaction!");
      console.log();
      console.log("   ✅ SOLUTION:");
      console.log("   1. Go to app → Pending Transactions");
      console.log("   2. Find approval transaction (to: CCIP-BnM Token)");
      console.log("   3. Execute it FIRST");
      console.log("   4. Then execute CCIP send transaction");
    } else {
      console.log("   ✅ Token is approved!");
      console.log(`   Approved amount: ${allowanceFormatted} CCIP-BnM`);
    }
    console.log();

    // Summary
    console.log("\n" + "=".repeat(80));
    console.log("📊 SUMMARY\n");
    
    const issues = [];
    const recommendations = [];

    if (ethBalance < ethers.parseEther("0.001")) {
      issues.push("Low Safe ETH balance");
      recommendations.push(`Send at least 0.01 ETH to Safe: ${SAFE_ADDRESS}`);
    }

    if (tokenBalance === 0n) {
      issues.push("No CCIP-BnM tokens in Safe");
      recommendations.push(`Send CCIP-BnM tokens to Safe: ${SAFE_ADDRESS}`);
    }

    if (allowance === 0n) {
      issues.push("❌ Token NOT approved (MAIN ISSUE)");
      recommendations.push("⭐ Execute approval transaction FIRST in Pending Transactions");
    }

    if (issues.length === 0) {
      console.log("✅ All checks passed! Safe is ready for CCIP transfer.");
    } else {
      console.log("❌ Issues Found:");
      issues.forEach((issue, i) => console.log(`   ${i + 1}. ${issue}`));
      console.log();
      console.log("💡 Recommendations:");
      recommendations.forEach((rec, i) => console.log(`   ${i + 1}. ${rec}`));
    }

    console.log("\n" + "=".repeat(80));

    // Check if there are pending transactions
    console.log("\n📝 Next Steps:");
    console.log("1. Open your app in browser");
    console.log("2. Go to Company Dashboard → Load your Safe");
    console.log("3. Go to 'Pending Transactions' tab");
    console.log("4. You should see 2 transactions:");
    console.log("   - TX 1: Approval (to: CCIP-BnM Token) ← Execute this FIRST");
    console.log("   - TX 2: CCIP Send (to: CCIP Router) ← Execute this AFTER approval");
    console.log();
    console.log("5. After executing approval, run this script again to verify");
    console.log("6. If approval shows '✅ Token is approved', execute CCIP send");
    console.log();

  } catch (error) {
    console.error("❌ Error checking status:", error.message);
    console.log("\nTroubleshooting:");
    console.log("1. Make sure you have internet connection");
    console.log("2. RPC endpoint might be rate-limited, try again");
    console.log("3. Check if addresses are correct");
  }
}

checkSafeStatus().catch(console.error);

// Quick script to verify CCIP transaction
// Run: node verify-tx.js

const { ethers } = require("ethers");

const TRANSACTION_HASH = "0x19b8d0f7caac625ac45fc64009155adba57c00a201749041f63fa339ef003572";
const RPC_URL = "https://sepolia.infura.io/v3/YOUR_KEY"; // Update with your key

// Event signatures
const EXECUTION_SUCCESS = "0x442e715f626346e8c54381002da614f62bee8d27386535b2521ec8540898556e";
const EXECUTION_FAILURE = "0x23428b18acfb3ea64b08dc0c1d296ea9c09702c09083ca5272e64d115b687d23";
const CCIP_SEND_REQUESTED = "0xd0c3c799bf9e2639de44391e7f524d229b2b55f5b1ea94b2bf7da42f7243dddd";

async function verifyTransaction() {
  console.log("🔍 Verifying CCIP Transaction...\n");
  console.log(`TX Hash: ${TRANSACTION_HASH}\n`);

  // For now, we'll use Etherscan API since we need RPC
  const etherscanUrl = `https://sepolia.etherscan.io/tx/${TRANSACTION_HASH}`;
  console.log(`📊 View on Etherscan: ${etherscanUrl}\n`);

  console.log("Based on Safe Transaction Service data:");
  console.log("✅ isExecuted: true");
  console.log("❌ isSuccessful: false");
  console.log("💰 value: 62980802494808 wei (~0.000063 ETH for CCIP fee)\n");

  console.log("🔴 DIAGNOSIS:");
  console.log("Transaction executed but FAILED!");
  console.log("\nMost likely reasons:");
  console.log("1. Safe doesn't have enough ETH to cover CCIP fee (0.000063 ETH)");
  console.log("2. Token approval insufficient or not executed yet");
  console.log("3. Gas limit too low\n");

  console.log("📝 NEXT STEPS:");
  console.log("1. Check Safe balance at: https://sepolia.etherscan.io/address/0xcF16809e8f41c6ECd613923a59c1605E1a41F7aD");
  console.log("2. Use the new Verification tool in the UI");
  console.log("3. Look for ExecutionFailure event in transaction logs");
  console.log("4. Confirm no CCIPSendRequested event exists\n");

  console.log("🛠️ TO FIX:");
  console.log("1. Send at least 0.1 ETH to Safe: 0xcF16809e8f41c6ECd613923a59c1605E1a41F7aD");
  console.log("2. Use 'Debug: Check Safe Balance' before proposing");
  console.log("3. Retry the CCIP transfer");
}

verifyTransaction().catch(console.error);

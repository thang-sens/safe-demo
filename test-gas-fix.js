// Test CCIP Safe Transfer with New Gas Settings
// Verifies that the gas limit fix resolves the issue
// Run: node test-gas-fix.js <SAFE_TX_HASH>

const axios = require("axios");
const { ethers } = require("ethers");

const SAFE_ADDRESS = "0xcF16809e8f41c6ECd613923a59c1605E1a41F7aD";
const SAFE_SERVICE_URL = "https://safe-transaction-sepolia.safe.global";
const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

// Safe ABI events
const EXECUTION_SUCCESS = "0x442e715f626346e8c54381002da614f62bee8d27386535b2521ec8540898556e";
const EXECUTION_FAILURE = "0x23428b18acfb3ea64b08dc0c1d296ea9c09083ca5272e64d115b687d23428b18";
const CCIP_SEND_REQUESTED = "0xd0c3c799bf9e2639de44391e7f524d229b2b55f5b1ea94b2bf7da42f7243dddd";

async function testGasFix(txHash) {
  console.log("🧪 Testing CCIP Safe Transfer Gas Fix\n");
  console.log("=" .repeat(80));
  console.log(`Transaction Hash: ${txHash}`);
  console.log(`Safe Address: ${SAFE_ADDRESS}`);
  console.log("=" .repeat(80) + "\n");

  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Get transaction receipt
    console.log("1️⃣ Fetching transaction receipt...");
    const receipt = await provider.getTransactionReceipt(txHash);

    if (!receipt) {
      console.log("❌ Transaction not found or not mined yet");
      return;
    }

    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Status: ${receipt.status === 1 ? "✅ Success" : "❌ Failed"}`);
    console.log(`   Gas Used: ${receipt.gasUsed.toString()} / ${receipt.gasLimit?.toString() || "N/A"}`);
    console.log(`   Gas Percentage: ${((Number(receipt.gasUsed) / Number(receipt.gasLimit || 1)) * 100).toFixed(2)}%`);
    console.log();

    // Check transaction status
    if (receipt.status === 0) {
      console.log("❌ Transaction failed on blockchain level");
      console.log("   This means the gas fix may not be applied yet.\n");
      console.log("🔧 Solution:");
      console.log("   1. Rebuild frontend: cd client && npm run dev");
      console.log("   2. Hard refresh browser (Ctrl+Shift+R)");
      console.log("   3. Retry the CCIP transfer\n");
      return;
    }

    // Analyze logs
    console.log("2️⃣ Analyzing transaction logs...\n");

    let hasExecutionSuccess = false;
    let hasExecutionFailure = false;
    let hasCCIPSend = false;
    let ccipMessageId = null;

    for (const log of receipt.logs) {
      const topic0 = log.topics[0];

      if (topic0 === EXECUTION_SUCCESS) {
        hasExecutionSuccess = true;
        console.log("   ✅ Found ExecutionSuccess event");
        console.log(`      Address: ${log.address}`);
      } else if (topic0 === EXECUTION_FAILURE) {
        hasExecutionFailure = true;
        console.log("   ❌ Found ExecutionFailure event");
        console.log(`      Address: ${log.address}`);
      } else if (topic0 === CCIP_SEND_REQUESTED) {
        hasCCIPSend = true;
        ccipMessageId = log.topics[1];
        console.log("   🚀 Found CCIPSendRequested event");
        console.log(`      Message ID: ${ccipMessageId}`);
      }
    }

    console.log();

    // Final verdict
    console.log("=" .repeat(80));
    console.log("📊 ANALYSIS RESULT:\n");

    if (receipt.status === 1 && hasExecutionSuccess && hasCCIPSend) {
      console.log("✅ ✅ ✅ SUCCESS! Gas fix is working!\n");
      console.log("Details:");
      console.log(`   • Blockchain transaction: ✅ Success`);
      console.log(`   • Safe execution: ✅ Success`);
      console.log(`   • CCIP message sent: ✅ Yes`);
      console.log(`   • Message ID: ${ccipMessageId}`);
      console.log(`   • Gas used: ${receipt.gasUsed.toString()}`);
      console.log();
      console.log("🔗 Track your CCIP message:");
      console.log(`   https://ccip.chain.link/msg/${ccipMessageId}`);
      console.log();
      console.log("⏳ Delivery time: ~20 minutes (Sepolia finality)");
      console.log("   See: https://docs.chain.link/ccip/ccip-execution-latency\n");
    } else if (receipt.status === 1 && hasExecutionSuccess && !hasCCIPSend) {
      console.log("⚠️  PARTIAL SUCCESS - Safe executed but no CCIP send\n");
      console.log("Details:");
      console.log(`   • Blockchain transaction: ✅ Success`);
      console.log(`   • Safe execution: ✅ Success`);
      console.log(`   • CCIP message sent: ❌ No`);
      console.log();
      console.log("Possible causes:");
      console.log("   1. This is an approval transaction (not CCIP send)");
      console.log("   2. Gas was sufficient but CCIP call failed for other reason");
      console.log("   3. Check if you need to execute the NEXT pending transaction\n");
    } else if (receipt.status === 1 && hasExecutionFailure) {
      console.log("❌ SAFE EXECUTION FAILED - Gas might still be insufficient\n");
      console.log("Details:");
      console.log(`   • Blockchain transaction: ✅ Success (gas paid)`);
      console.log(`   • Safe execution: ❌ Failed`);
      console.log(`   • Gas used: ${receipt.gasUsed.toString()}`);
      console.log();
      console.log("🔧 Next steps:");
      console.log("   1. Check if you're using the latest code");
      console.log("   2. Verify safeTxGas = 3M and gasLimit = 5M");
      console.log("   3. Rebuild: cd client && npm run dev");
      console.log("   4. Clear cache and retry\n");
    } else {
      console.log("❓ UNKNOWN STATE - Manual investigation needed\n");
      console.log("Details:");
      console.log(`   • Blockchain transaction: ${receipt.status === 1 ? "✅ Success" : "❌ Failed"}`);
      console.log(`   • ExecutionSuccess: ${hasExecutionSuccess ? "✅" : "❌"}`);
      console.log(`   • ExecutionFailure: ${hasExecutionFailure ? "✅" : "❌"}`);
      console.log(`   • CCIPSendRequested: ${hasCCIPSend ? "✅" : "❌"}`);
      console.log();
      console.log("Check Etherscan for details:");
      console.log(`   https://sepolia.etherscan.io/tx/${txHash}\n`);
    }

    console.log("=" .repeat(80) + "\n");

    // Get Safe transaction details
    console.log("3️⃣ Checking Safe Transaction Service...\n");
    try {
      const safeTxResponse = await axios.get(
        `${SAFE_SERVICE_URL}/api/v1/multisig-transactions/${txHash}/`
      );
      const safeTx = safeTxResponse.data;
      
      console.log(`   Safe TX Hash: ${safeTx.safeTxHash}`);
      console.log(`   Executed: ${safeTx.isExecuted ? "✅ Yes" : "❌ No"}`);
      console.log(`   Successful: ${safeTx.isSuccessful ? "✅ Yes" : "❌ No"}`);
      console.log(`   Safe TX Gas: ${safeTx.safeTxGas}`);
      console.log(`   Base Gas: ${safeTx.baseGas}`);
      console.log();

      if (safeTx.safeTxGas < 3000000) {
        console.log("⚠️  WARNING: safeTxGas is less than 3M!");
        console.log("   This transaction was created with old code.");
        console.log("   You need to create a NEW transaction with updated code.\n");
      } else {
        console.log("✅ Safe TX Gas is correctly set to 3M+\n");
      }
    } catch (error) {
      // Might be a regular blockchain tx hash, not Safe service tx
      console.log("   ℹ️  Not found in Safe service (might be blockchain tx hash)\n");
    }

  } catch (error) {
    console.error("❌ Error testing transaction:", error.message);
    if (error.response) {
      console.error("Response:", error.response.data);
    }
  }
}

// Parse command line arguments
const txHash = process.argv[2];

if (!txHash) {
  console.log("Usage: node test-gas-fix.js <transaction_hash>");
  console.log("\nExamples:");
  console.log("  node test-gas-fix.js 0x123abc... (blockchain tx hash)");
  console.log("  node test-gas-fix.js 0x456def... (Safe tx hash)");
  console.log("\nThis script will:");
  console.log("  1. Check if transaction succeeded");
  console.log("  2. Verify CCIP message was sent");
  console.log("  3. Analyze gas usage");
  console.log("  4. Provide next steps\n");
  process.exit(1);
}

testGasFix(txHash).catch(console.error);

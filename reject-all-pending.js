// Reject all pending Safe transactions
// This is useful when you have many old failed transactions
// Run: node reject-all-pending.js

const axios = require("axios");
const readline = require("readline");

const SAFE_ADDRESS = "0xcF16809e8f41c6ECd613923a59c1605E1a41F7aD";
const SAFE_SERVICE_URL = "https://safe-transaction-sepolia.safe.global";

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function getPendingTransactions() {
  try {
    const response = await axios.get(
      `${SAFE_SERVICE_URL}/api/v1/safes/${SAFE_ADDRESS}/multisig-transactions/`,
      { params: { executed: false } }
    );
    return response.data.results;
  } catch (error) {
    console.error("❌ Error fetching transactions:", error.message);
    return [];
  }
}

async function main() {
  console.log("🗑️  Reject All Pending Safe Transactions\n");
  console.log("=" .repeat(80));
  console.log(`Safe: ${SAFE_ADDRESS}`);
  console.log("=" .repeat(80) + "\n");

  const pendingTxs = await getPendingTransactions();

  if (pendingTxs.length === 0) {
    console.log("✅ No pending transactions to reject\n");
    rl.close();
    return;
  }

  console.log(`Found ${pendingTxs.length} pending transaction(s)\n`);

  // Group by nonce
  const nonces = [...new Set(pendingTxs.map((tx) => tx.nonce))].sort(
    (a, b) => a - b
  );

  console.log("Transactions by nonce:");
  for (const nonce of nonces) {
    const txsAtNonce = pendingTxs.filter((tx) => tx.nonce === nonce);
    console.log(`\nNonce ${nonce}: ${txsAtNonce.length} transaction(s)`);
    for (const tx of txsAtNonce) {
      console.log(`  - SafeTxHash: ${tx.safeTxHash}`);
      console.log(`    To: ${tx.to}`);
      console.log(
        `    Confirmations: ${tx.confirmations?.length || 0}/${
          tx.confirmationsRequired
        }`
      );
      console.log(`    SafeTxGas: ${tx.safeTxGas}`);
    }
  }

  console.log("\n" + "=" .repeat(80));
  console.log(
    "⚠️  To reject these transactions, you need to use the Safe web app:"
  );
  console.log(
    "   https://app.safe.global/transactions/queue?safe=sep:" + SAFE_ADDRESS
  );
  console.log();
  console.log("Steps:");
  console.log("1. Connect your wallet (same address used to sign)");
  console.log("2. Go to Transactions → Queue");
  console.log("3. For each transaction, click '...' → 'Replace'");
  console.log("4. In the replacement form:");
  console.log(
    '   - Select "Send" (or keep any action, it will be rejected)'
  );
  console.log("   - Use the same nonce as the transaction you want to reject");
  console.log("   - Set gas = 0 or minimal (this creates rejection tx)");
  console.log("5. Confirm and execute the rejection transaction");
  console.log("6. The old transaction at that nonce will be invalidated");
  console.log();
  console.log("Alternative (easier):");
  console.log("Just execute NEW transactions with the next available nonce.");
  console.log(
    "Old transactions will become invalid once their nonce is consumed."
  );
  console.log("=" .repeat(80) + "\n");

  console.log("💡 Tip: The easiest way is to:");
  console.log("1. Rebuild your frontend (cd client && npm run dev)");
  console.log("2. Hard refresh browser (Ctrl+Shift+R)");
  console.log("3. Propose NEW CCIP transfer with correct SafeTxGas");
  console.log("4. Confirm and execute the new transaction");
  console.log("5. Old transactions at lower nonces will auto-reject\n");

  const answer = await question(
    "Do you want to see detailed transaction data? (y/n): "
  );

  if (answer.toLowerCase() === "y") {
    console.log("\n" + "=" .repeat(80));
    console.log("DETAILED TRANSACTION DATA");
    console.log("=" .repeat(80) + "\n");

    for (let i = 0; i < pendingTxs.length; i++) {
      const tx = pendingTxs[i];
      console.log(`Transaction ${i + 1}/${pendingTxs.length}`);
      console.log("-" .repeat(80));
      console.log(JSON.stringify(tx, null, 2));
      console.log("\n");
    }
  }

  rl.close();
}

main().catch((error) => {
  console.error("Error:", error);
  rl.close();
  process.exit(1);
});

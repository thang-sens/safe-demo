// Inspect Safe Pending Transaction
// Decodes and analyzes transaction data
// Run: node inspect-pending-tx.js

const { ethers } = require("ethers");
const axios = require("axios");

const SAFE_ADDRESS = "0xcF16809e8f41c6ECd613923a59c1605E1a41F7aD";
const SAFE_SERVICE_URL = "https://safe-transaction-sepolia.safe.global";

// ABIs for decoding
const ROUTER_ABI = [
  "function ccipSend(uint64 destinationChainSelector, tuple(bytes receiver, bytes data, tuple(address token, uint256 amount)[] tokenAmounts, address feeToken, bytes extraArgs) message) payable returns (bytes32)"
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)"
];

const MULTISEND_ABI = [
  "function multiSend(bytes transactions)"
];

async function inspectPendingTransactions() {
  console.log("🔍 Inspecting Pending Safe Transactions\n");
  console.log("=" .repeat(80));
  console.log(`Safe: ${SAFE_ADDRESS}`);
  console.log("=" .repeat(80) + "\n");

  try {
    // Get pending transactions
    const response = await axios.get(
      `${SAFE_SERVICE_URL}/api/v1/safes/${SAFE_ADDRESS}/multisig-transactions/`,
      { params: { executed: false } }
    );

    const pendingTxs = response.data.results;

    if (pendingTxs.length === 0) {
      console.log("✅ No pending transactions\n");
      return;
    }

    console.log(`Found ${pendingTxs.length} pending transaction(s)\n`);

    for (let i = 0; i < pendingTxs.length; i++) {
      const tx = pendingTxs[i];
      console.log(`Transaction #${i + 1}`);
      console.log("-" .repeat(80));
      console.log(`Safe TX Hash: ${tx.safeTxHash}`);
      console.log(`Nonce: ${tx.nonce}`);
      console.log(`To: ${tx.to}`);
      console.log(`Value: ${ethers.formatEther(tx.value)} ETH`);
      console.log(`Operation: ${tx.operation === 0 ? 'Call' : tx.operation === 1 ? 'DelegateCall' : 'Unknown'}`);
      console.log(`Data Length: ${tx.data ? tx.data.length : 0} bytes`);
      console.log(`Confirmations: ${tx.confirmations?.length || 0}/${tx.confirmationsRequired}`);
      console.log(`SafeTxGas: ${tx.safeTxGas}`);
      console.log(`BaseGas: ${tx.baseGas}`);
      console.log();

      // Try to decode the data
      if (tx.data && tx.data !== "0x" && tx.data.length > 10) {
        console.log("Decoding Transaction Data:");
        console.log("-" .repeat(40));

        try {
          // Check if it's MultiSend (common for batched transactions)
          if (tx.to.toLowerCase() === "0xfb1bffC9A739B0D46bE72F5C8907C05D8960E371".toLowerCase()) {
            console.log("📦 MultiSend Transaction Detected");
            
            const multisendIface = new ethers.Interface(MULTISEND_ABI);
            const decoded = multisendIface.parseTransaction({ data: tx.data });
            console.log(`  Function: ${decoded.name}`);
            console.log(`  Contains multiple sub-transactions`);
            
            // Try to decode the packed transactions
            const transactionsData = decoded.args[0];
            console.log(`  Packed Data Length: ${transactionsData.length} bytes`);
            console.log();
          }
          // Check if it's CCIP Router call
          else if (tx.to.toLowerCase() === "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59".toLowerCase()) {
            console.log("🌉 CCIP Router Transaction Detected");
            
            const routerIface = new ethers.Interface(ROUTER_ABI);
            const decoded = routerIface.parseTransaction({ data: tx.data });
            
            console.log(`  Function: ${decoded.name}`);
            console.log(`  Destination Chain Selector: ${decoded.args[0]}`);
            
            const message = decoded.args[1];
            console.log(`  Receiver: ${message.receiver}`);
            console.log(`  Data: ${message.data}`);
            console.log(`  Token Amounts: ${message.tokenAmounts.length} token(s)`);
            
            if (message.tokenAmounts.length > 0) {
              for (let j = 0; j < message.tokenAmounts.length; j++) {
                const tokenAmount = message.tokenAmounts[j];
                console.log(`    Token ${j + 1}:`);
                console.log(`      Address: ${tokenAmount.token}`);
                console.log(`      Amount: ${ethers.formatEther(tokenAmount.amount)} (raw: ${tokenAmount.amount.toString()})`);
              }
            }
            
            console.log(`  Fee Token: ${message.feeToken}`);
            console.log(`  Extra Args: ${message.extraArgs}`);
            console.log(`  Value (CCIP Fee): ${ethers.formatEther(tx.value)} ETH`);
            console.log();

            // Validation checks
            console.log("Validation Checks:");
            console.log("-" .repeat(40));
            
            if (message.tokenAmounts.length === 0) {
              console.log("  ❌ NO TOKENS to transfer!");
            } else {
              console.log("  ✅ Has token amounts");
            }
            
            if (message.feeToken === "0x0000000000000000000000000000000000000000") {
              console.log("  ✅ Using native ETH for fees");
            } else {
              console.log(`  ⚠️  Using token for fees: ${message.feeToken}`);
            }
            
            if (tx.value === "0") {
              console.log("  ❌ NO ETH value for CCIP fee!");
            } else {
              console.log(`  ✅ Has ETH value for fee: ${ethers.formatEther(tx.value)} ETH`);
            }
            
            console.log();
          }
          // Check if it's ERC20 approval
          else if (tx.data.startsWith("0x095ea7b3")) {
            console.log("✅ ERC20 Approval Transaction");
            
            const erc20Iface = new ethers.Interface(ERC20_ABI);
            const decoded = erc20Iface.parseTransaction({ data: tx.data });
            
            console.log(`  Function: ${decoded.name}`);
            console.log(`  Spender: ${decoded.args[0]}`);
            console.log(`  Amount: ${ethers.formatEther(decoded.args[1])} tokens`);
            console.log();
          }
          else {
            console.log("❓ Unknown transaction type");
            console.log(`  First 10 bytes: ${tx.data.slice(0, 10)}`);
            console.log();
          }
        } catch (decodeError) {
          console.log(`⚠️  Could not decode: ${decodeError.message}`);
          console.log(`  Raw data: ${tx.data.slice(0, 66)}...`);
          console.log();
        }
      }

      console.log("=" .repeat(80) + "\n");
    }

  } catch (error) {
    console.error("❌ Error fetching transactions:", error.message);
    if (error.response) {
      console.error("Response:", error.response.data);
    }
  }
}

inspectPendingTransactions().catch(console.error);

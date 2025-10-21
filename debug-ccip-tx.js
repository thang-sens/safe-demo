// Debug script to analyze CCIP transaction failure
// Run: node debug-ccip-tx.js <TX_HASH>

const { ethers } = require("ethers");

// Configuration
const SAFE_ADDRESS = "0xcF16809e8f41c6ECd613923a59c1605E1a41F7aD";
const CCIP_ROUTER = "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59";
const CCIP_BNM_TOKEN = "0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05";
const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

// ABIs
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
  "event Approval(address indexed owner, address indexed spender, uint256 value)"
];

const ROUTER_ABI = [
  "function ccipSend(uint64 destinationChainSelector, tuple(bytes receiver, bytes data, tuple(address token, uint256 amount)[] tokenAmounts, address feeToken, bytes extraArgs) message) payable returns (bytes32)",
  "event CCIPSendRequested(bytes32 indexed messageId)"
];

const SAFE_ABI = [
  "event ExecutionSuccess(bytes32 txHash, uint256 payment)",
  "event ExecutionFailure(bytes32 txHash, uint256 payment)"
];

async function debugTransaction(txHash) {
  console.log("🔍 Debugging CCIP Transaction\n");
  console.log("=" .repeat(80));
  console.log(`Transaction: ${txHash}`);
  console.log("=" .repeat(80) + "\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const tokenContract = new ethers.Contract(CCIP_BNM_TOKEN, ERC20_ABI, provider);
  
  try {
    // Get transaction receipt
    console.log("1️⃣ Fetching transaction receipt...");
    const receipt = await provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      console.log("❌ Transaction not found!");
      return;
    }

    console.log(`   Block: ${receipt.blockNumber}`);
    console.log(`   Status: ${receipt.status === 1 ? '✅ Success' : '❌ Failed'}`);
    console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
    console.log(`   Effective Gas Price: ${ethers.formatGwei(receipt.gasPrice)} gwei\n`);

    // Analyze logs
    console.log("2️⃣ Analyzing Transaction Logs...\n");
    
    let hasExecutionSuccess = false;
    let hasExecutionFailure = false;
    let hasCCIPSend = false;
    let hasTokenTransfer = false;
    let hasTokenApproval = false;
    let executionFailureData = null;
    let ccipMessageId = null;
    let tokenTransferAmount = null;
    let approvalAmount = null;

    for (const log of receipt.logs) {
      // Check for Safe ExecutionSuccess
      if (log.topics[0] === ethers.id("ExecutionSuccess(bytes32,uint256)")) {
        hasExecutionSuccess = true;
        console.log("   ✅ ExecutionSuccess event found");
        console.log(`      Safe Transaction Hash: ${log.topics[1]}`);
      }

      // Check for Safe ExecutionFailure
      if (log.topics[0] === ethers.id("ExecutionFailure(bytes32,uint256)")) {
        hasExecutionFailure = true;
        executionFailureData = log.data;
        console.log("   ❌ ExecutionFailure event found!");
        console.log(`      Safe Transaction Hash: ${log.topics[1]}`);
        console.log(`      Payment: ${log.data}`);
      }

      // Check for CCIPSendRequested
      if (log.topics[0] === ethers.id("CCIPSendRequested(bytes32)")) {
        hasCCIPSend = true;
        ccipMessageId = log.topics[1];
        console.log("   ✅ CCIPSendRequested event found!");
        console.log(`      Message ID: ${ccipMessageId}`);
        console.log(`      CCIP Explorer: https://ccip.chain.link/msg/${ccipMessageId}`);
      }

      // Check for Token Transfer
      if (log.address.toLowerCase() === CCIP_BNM_TOKEN.toLowerCase() &&
          log.topics[0] === ethers.id("Transfer(address,address,uint256)")) {
        const from = ethers.getAddress("0x" + log.topics[1].slice(26));
        const to = ethers.getAddress("0x" + log.topics[2].slice(26));
        const amount = BigInt(log.data);
        const amountFormatted = ethers.formatEther(amount);

        if (from.toLowerCase() === SAFE_ADDRESS.toLowerCase()) {
          hasTokenTransfer = true;
          tokenTransferAmount = amountFormatted;
          console.log("   📤 Token Transfer (from Safe):");
          console.log(`      From: ${from}`);
          console.log(`      To: ${to}`);
          console.log(`      Amount: ${amountFormatted} CCIP-BnM`);
        }
      }

      // Check for Token Approval
      if (log.address.toLowerCase() === CCIP_BNM_TOKEN.toLowerCase() &&
          log.topics[0] === ethers.id("Approval(address,address,uint256)")) {
        const owner = ethers.getAddress("0x" + log.topics[1].slice(26));
        const spender = ethers.getAddress("0x" + log.topics[2].slice(26));
        const amount = BigInt(log.data);
        const amountFormatted = ethers.formatEther(amount);

        if (owner.toLowerCase() === SAFE_ADDRESS.toLowerCase() &&
            spender.toLowerCase() === CCIP_ROUTER.toLowerCase()) {
          hasTokenApproval = true;
          approvalAmount = amountFormatted;
          console.log("   ✅ Token Approval event found:");
          console.log(`      Owner: ${owner}`);
          console.log(`      Spender (Router): ${spender}`);
          console.log(`      Amount: ${amountFormatted} CCIP-BnM`);
        }
      }
    }

    console.log();

    // Check current state
    console.log("3️⃣ Checking Current On-Chain State...\n");
    
    const safeBalance = await provider.getBalance(SAFE_ADDRESS);
    console.log(`   Safe ETH Balance: ${ethers.formatEther(safeBalance)} ETH`);
    
    const tokenBalance = await tokenContract.balanceOf(SAFE_ADDRESS);
    console.log(`   Safe Token Balance: ${ethers.formatEther(tokenBalance)} CCIP-BnM`);
    
    const allowance = await tokenContract.allowance(SAFE_ADDRESS, CCIP_ROUTER);
    console.log(`   Current Allowance: ${ethers.formatEther(allowance)} CCIP-BnM\n`);

    // Diagnosis
    console.log("4️⃣ Diagnosis:\n");
    console.log("=" .repeat(80));

    if (hasExecutionFailure) {
      console.log("❌ SAFE EXECUTION FAILED");
      console.log("\nThe transaction was sent to blockchain successfully, but Safe's");
      console.log("internal execution failed. This means:");
      console.log("- The multisig confirmation was valid");
      console.log("- But the actual CCIP Router call inside Safe failed\n");
    }

    if (hasCCIPSend) {
      console.log("✅ CCIP SEND SUCCESSFUL!");
      console.log(`   Message ID: ${ccipMessageId}`);
      console.log(`   Track at: https://ccip.chain.link/msg/${ccipMessageId}\n`);
    } else {
      console.log("❌ NO CCIP SEND EVENT");
      console.log("   The CCIP Router was never successfully called.\n");
    }

    if (!hasTokenTransfer && !hasTokenApproval) {
      console.log("⚠️  NO TOKEN EVENTS");
      console.log("   Neither Transfer nor Approval events were emitted.");
      console.log("   This suggests the transaction failed BEFORE token operations.\n");
      
      console.log("💡 POSSIBLE CAUSES:");
      console.log("   1. Approval was already consumed in a previous transaction");
      console.log("   2. Safe doesn't have permission to spend tokens");
      console.log("   3. CCIP Router rejected the transaction (invalid params)\n");
    }

    if (allowance === 0n) {
      console.log("🔴 CRITICAL: Current allowance is ZERO!");
      console.log("   The approval was either:");
      console.log("   1. Never executed");
      console.log("   2. Already consumed by previous transaction");
      console.log("   3. Revoked\n");
    }

    // Recommendations
    console.log("=" .repeat(80));
    console.log("\n5️⃣ Recommendations:\n");

    if (allowance === 0n) {
      console.log("1. ✅ Execute NEW APPROVAL transaction first:");
      console.log("   - Go to CCIP Transfer tab");
      console.log("   - Propose approval for desired amount");
      console.log("   - Confirm and Execute it");
      console.log("   - Wait for confirmation\n");
      
      console.log("2. ✅ Then propose NEW CCIP transfer:");
      console.log("   - Will automatically detect approval");
      console.log("   - Will skip approval step");
      console.log("   - Only send CCIP transaction\n");
    } else {
      console.log("1. ✅ Approval exists, try CCIP transfer again");
      console.log("   - Current approval: " + ethers.formatEther(allowance) + " CCIP-BnM");
      console.log("   - Make sure transfer amount ≤ approval amount\n");
    }

    console.log("3. 🔍 Check transaction params in browser console");
    console.log("   - Open DevTools → Console");
    console.log("   - Look for [CCIP Build] logs");
    console.log("   - Verify token address, amount, receiver\n");

  } catch (error) {
    console.error("\n❌ Error during debugging:", error.message);
  }
}

// Run
const txHash = process.argv[2];
if (!txHash) {
  console.log("Usage: node debug-ccip-tx.js <transaction_hash>");
  console.log("Example: node debug-ccip-tx.js 0x123abc...");
  process.exit(1);
}

debugTransaction(txHash).catch(console.error);

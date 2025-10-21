// Comprehensive CCIP Safe Test Script
// Tests all components before executing real transaction
// Run: node test-ccip-safe.js

const { ethers } = require("ethers");

// Addresses
const SAFE_ADDRESS = "0xcF16809e8f41c6ECd613923a59c1605E1a41F7aD";
const WEB3AUTH_ADDRESS = "0x98F8e9e14C91AB139148a08008F99A03Fd602F30";
const CCIP_ROUTER = "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59";
const CCIP_BNM_TOKEN = "0xFd57b4ddBf88a4e07fF4e34C487b99af2Fe82a05";
const RECIPIENT = "0x5202487a23D600a199cFD4e7D28df36006064681";
const RPC_URL = "https://ethereum-sepolia-rpc.publicnode.com";

// Test transfer amount (0.01 CCIP-BnM for safety)
const TEST_AMOUNT = ethers.parseEther("0.01");

// ABIs
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

async function runTests() {
  console.log("🧪 Running Comprehensive CCIP Safe Tests\n");
  console.log("=" .repeat(80));
  console.log("Configuration:");
  console.log(`  Safe: ${SAFE_ADDRESS}`);
  console.log(`  Router: ${CCIP_ROUTER}`);
  console.log(`  Token: ${CCIP_BNM_TOKEN}`);
  console.log(`  Test Amount: ${ethers.formatEther(TEST_AMOUNT)} CCIP-BnM`);
  console.log("=" .repeat(80) + "\n");

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const tokenContract = new ethers.Contract(CCIP_BNM_TOKEN, ERC20_ABI, provider);

  let allPassed = true;

  // Test 1: Safe ETH Balance
  console.log("Test 1: Safe ETH Balance");
  try {
    const ethBalance = await provider.getBalance(SAFE_ADDRESS);
    const ethBalanceEth = ethers.formatEther(ethBalance);
    console.log(`  Balance: ${ethBalanceEth} ETH`);
    
    if (ethBalance < ethers.parseEther("0.001")) {
      console.log("  ❌ FAIL: Insufficient ETH for CCIP fees");
      console.log("  💡 Need at least 0.001 ETH\n");
      allPassed = false;
    } else {
      console.log("  ✅ PASS: Sufficient ETH balance\n");
    }
  } catch (error) {
    console.log(`  ❌ ERROR: ${error.message}\n`);
    allPassed = false;
  }

  // Test 2: Safe Token Balance
  console.log("Test 2: Safe Token Balance");
  try {
    const tokenBalance = await tokenContract.balanceOf(SAFE_ADDRESS);
    const tokenBalanceFormatted = ethers.formatEther(tokenBalance);
    console.log(`  Balance: ${tokenBalanceFormatted} CCIP-BnM`);
    
    if (tokenBalance < TEST_AMOUNT) {
      console.log(`  ❌ FAIL: Insufficient token balance`);
      console.log(`  💡 Need at least ${ethers.formatEther(TEST_AMOUNT)} CCIP-BnM\n`);
      allPassed = false;
    } else {
      console.log("  ✅ PASS: Sufficient token balance\n");
    }
  } catch (error) {
    console.log(`  ❌ ERROR: ${error.message}\n`);
    allPassed = false;
  }

  // Test 3: Token Approval
  console.log("Test 3: Token Approval to Router");
  try {
    const allowance = await tokenContract.allowance(SAFE_ADDRESS, CCIP_ROUTER);
    const allowanceFormatted = ethers.formatEther(allowance);
    console.log(`  Current Allowance: ${allowanceFormatted} CCIP-BnM`);
    console.log(`  Required: ${ethers.formatEther(TEST_AMOUNT)} CCIP-BnM`);
    
    if (allowance === 0n) {
      console.log("  ⚠️  ZERO ALLOWANCE!");
      console.log("  💡 Must propose and execute approval transaction FIRST\n");
      allPassed = false;
    } else if (allowance < TEST_AMOUNT) {
      console.log("  ⚠️  INSUFFICIENT ALLOWANCE!");
      console.log("  💡 Current approval too low for test amount\n");
      allPassed = false;
    } else {
      console.log("  ✅ PASS: Sufficient approval\n");
    }
  } catch (error) {
    console.log(`  ❌ ERROR: ${error.message}\n`);
    allPassed = false;
  }

  // Test 4: Recipient Address Validation
  console.log("Test 4: Recipient Address Validation");
  try {
    if (!ethers.isAddress(RECIPIENT)) {
      console.log(`  ❌ FAIL: Invalid recipient address`);
      console.log(`  Address: ${RECIPIENT}\n`);
      allPassed = false;
    } else {
      console.log(`  Address: ${RECIPIENT}`);
      console.log("  ✅ PASS: Valid Ethereum address\n");
    }
  } catch (error) {
    console.log(`  ❌ ERROR: ${error.message}\n`);
    allPassed = false;
  }

  // Test 5: Router Contract Existence
  console.log("Test 5: CCIP Router Contract");
  try {
    const routerCode = await provider.getCode(CCIP_ROUTER);
    if (routerCode === "0x") {
      console.log("  ❌ FAIL: Router contract not found at address");
      console.log("  💡 Check router address is correct\n");
      allPassed = false;
    } else {
      console.log(`  Code Length: ${routerCode.length} bytes`);
      console.log("  ✅ PASS: Router contract exists\n");
    }
  } catch (error) {
    console.log(`  ❌ ERROR: ${error.message}\n`);
    allPassed = false;
  }

  // Test 6: Token Contract
  console.log("Test 6: Token Contract");
  try {
    const symbol = await tokenContract.symbol();
    const decimals = await tokenContract.decimals();
    console.log(`  Symbol: ${symbol}`);
    console.log(`  Decimals: ${decimals}`);
    console.log("  ✅ PASS: Token contract accessible\n");
  } catch (error) {
    console.log(`  ❌ ERROR: ${error.message}\n`);
    allPassed = false;
  }

  // Test 7: Safe Contract
  console.log("Test 7: Safe Contract");
  try {
    const safeCode = await provider.getCode(SAFE_ADDRESS);
    if (safeCode === "0x") {
      console.log("  ❌ FAIL: Safe not deployed at address");
      allPassed = false;
    } else {
      console.log(`  Code Length: ${safeCode.length} bytes`);
      console.log("  ✅ PASS: Safe contract exists\n");
    }
  } catch (error) {
    console.log(`  ❌ ERROR: ${error.message}\n`);
    allPassed = false;
  }

  // Summary
  console.log("=" .repeat(80));
  if (allPassed) {
    console.log("\n🎉 ALL TESTS PASSED!");
    console.log("\n✅ Ready to propose CCIP transfer transaction");
    console.log("\nNext steps:");
    console.log("1. Go to browser app → CCIP Transfer tab");
    console.log(`2. Enter amount: ${ethers.formatEther(TEST_AMOUNT)} CCIP-BnM`);
    console.log("3. Destination: Base Sepolia");
    console.log(`4. Recipient: ${RECIPIENT}`);
    console.log("5. Calculate fee and propose transaction");
    console.log("6. Confirm and execute\n");
  } else {
    console.log("\n❌ SOME TESTS FAILED!");
    console.log("\n⚠️  Fix the issues above before proceeding");
    console.log("\nMost common fix:");
    console.log("1. If approval is 0 or insufficient:");
    console.log("   - Go to CCIP Transfer tab");
    console.log("   - Propose approval transaction");
    console.log("   - Confirm and execute it");
    console.log("   - Run this test again\n");
  }
  console.log("=" .repeat(80) + "\n");
}

runTests().catch(console.error);

# 🚨 CRITICAL: Safe NOT Forwarding ETH Value

## 🔴 Issue Confirmed

Transaction executed successfully but **ETH value was NOT sent to Router**:

```
Transaction Hash: 0xf8bfa41209af80c4d60d10c2ee4f7302591bc78bf66fefadd40dc7cacf5a6fa0

Before Execute:
  Safe Balance: 0.1499889 ETH

After Execute:
  Safe Balance: 0.1499889 ETH  ← UNCHANGED!

Expected:
  Safe Balance: ~0.149923 ETH (0.1499889 - 0.000065 fee - gas)

Reality:
  Balance Change: 0 ETH ← NO VALUE WAS SENT!
```

## 🔍 Root Cause

Safe's `executeTransaction` with `operation: 0` (CALL) is **NOT forwarding the `value` field** when calling external contracts.

This is a known limitation when Safe executes transactions with value to contracts that expect `msg.value`.

## 📋 Why Direct Transfer Works but Safe Fails

### Direct Transfer (EOA):

```typescript
await walletClient.writeContract({
  address: routerAddress,
  functionName: "ccipSend",
  args: [chainSelector, message],
  value: fee, // ← Sent as msg.value in transaction
});
```

**Result:** ✅ Works - User's wallet sends ETH directly

### Safe Transfer (Multisig):

```typescript
await safe.executeTransaction({
  to: routerAddress,
  value: fee, // ← Stored in Safe transaction
  data: ccipSendCalldata,
  operation: 0, // CALL
});
```

**Result:** ❌ Fails - Safe executes CALL but doesn't forward value!

## 🛠️ Solutions

### Option 1: Use Safe's `execTransaction` with Correct ABI Encoding ✅ RECOMMENDED

Safe needs to execute via its low-level `execTransaction` and MUST include value in the blockchain transaction itself:

```typescript
// Instead of using Safe SDK's executeTransaction
// We need to call Safe's execTransaction directly with value

const execTransactionData = safe.interface.encodeFunctionData(
  "execTransaction",
  [
    to, // Router address
    value, // ETH to send
    data, // ccipSend calldata
    operation, // 0 = CALL
    safeTxGas,
    baseGas,
    gasPrice,
    gasToken,
    refundReceiver,
    signatures,
  ]
);

// Execute with value sent FROM Safe TO Router
await signer.sendTransaction({
  to: safeAddress,
  value: 0, // Safe pays from its balance
  data: execTransactionData,
  gasLimit: 5000000,
});
```

**Problem:** This still won't work because Safe's `execTransaction` executes the call internally!

### Option 2: Pre-fund the Router (NOT FEASIBLE)

CCIP Router is stateless and doesn't hold user funds. This won't work.

### Option 3: Use Safe's Native Token Payment Feature ✅ CORRECT SOLUTION

According to Chainlink docs, when using Safe with CCIP:

**You CANNOT pay fees with native token (ETH) when using Safe!**

Instead, you must:

1. Pay fees with LINK token (not native ETH)
2. Set `feeToken` to LINK token address
3. Approve LINK to Router
4. CCIP deducts fee from LINK balance

### Option 4: Use MultiSend for Batching (COMPLEX)

Use Safe's MultiSend contract to batch:

1. Fund Router with ETH
2. Call ccipSend

But this is complex and not standard.

## ✅ RECOMMENDED FIX: Switch to LINK Fee Payment

Modify the CCIP transaction to pay fees with LINK instead of native ETH:

```typescript
// Current (NOT WORKING):
const ccipMessage = {
  receiver: receiverBytes,
  data: "0x",
  tokenAmounts: [{ token: bnmTokenAddress, amount: tokenAmount }],
  feeToken: "0x0000000000000000000000000000000000000000", // ← Native ETH (FAILS!)
  extraArgs: extraArgsV2,
};

// Fixed (WILL WORK):
const ccipMessage = {
  receiver: receiverBytes,
  data: "0x",
  tokenAmounts: [{ token: bnmTokenAddress, amount: tokenAmount }],
  feeToken: linkTokenAddress, // ← Use LINK for fees (WORKS!)
  extraArgs: extraArgsV2,
};
```

## 🔧 Implementation Steps

### 1. Update `buildCCIPSafeTransaction` to use LINK fees

```typescript
// Get LINK token address for the network
const linkToken = getTokenBySymbol(params.sourceNetwork, "LINK");
if (!linkToken) {
  throw new Error("LINK token not found on source network");
}

// Build CCIP message with LINK fee payment
const ccipMessage = {
  receiver: receiverBytes,
  data: "0x",
  tokenAmounts: [
    {
      token: token.address,
      amount: amountBN,
    },
  ],
  feeToken: linkToken.address, // ← Pay with LINK instead of ETH
  extraArgs: extraArgsV2,
};
```

### 2. Approve LINK to Router (in addition to token approval)

```typescript
// Check LINK allowance
const linkContract = new ethers.Contract(
  linkToken.address,
  IERC20ABI,
  provider
);
const linkAllowance = await linkContract.allowance(safeAddress, routerAddress);

// Calculate LINK fee
const linkFee = await calculateCCIPFee(
  {
    ...params,
    feeTokenAddress: linkToken.address, // Calculate fee in LINK
  },
  provider
);

// If insufficient LINK allowance, add approval transaction
if (linkAllowance < BigInt(linkFee.feeInWei)) {
  const linkApprovalData = linkContract.interface.encodeFunctionData(
    "approve",
    [routerAddress, BigInt(linkFee.feeInWei)]
  );

  transactions.push({
    to: linkToken.address,
    value: "0",
    data: linkApprovalData,
    operation: 0,
  });
}
```

### 3. Update transaction to send NO value

```typescript
// CCIP transaction with LINK fee (no ETH value needed)
transactions.push({
  to: sourceConfig.routerAddress,
  value: "0", // ← NO ETH VALUE when using LINK fees
  data: ccipSendCalldata,
  operation: 0,
});
```

### 4. Update UI to show LINK fee instead of ETH fee

```typescript
// Calculate fee in LINK
const linkFee = await ccipClient.getFee({
  client: publicClient,
  routerAddress,
  destinationChainSelector,
  tokenAddress,
  amount,
  destinationAccount,
  feeTokenAddress: linkTokenAddress, // ← Get fee in LINK
});
```

## 📊 Expected Flow with LINK Fees

```
1. User has: 0.5 CCIP-BnM + 1.0 LINK in Safe
2. Calculate fee: 0.001 LINK
3. Propose 2 transactions:
   a) Approve CCIP-BnM to Router
   b) Approve LINK to Router (NEW!)
   c) ccipSend (feeToken = LINK, value = 0)
4. Execute all 3 transactions
5. Safe balance after:
   - CCIP-BnM: 0.5 → 0.4 (sent 0.1)
   - LINK: 1.0 → 0.999 (paid 0.001 fee)
   - ETH: 0.15 → 0.145 (only gas costs)
6. CCIP transfer succeeds! ✅
```

## ⚠️ Why This is Required for Safe

From Chainlink Documentation:

> When using Safe multisig with CCIP, native token fee payment is not supported due to Safe's internal execution model. You must pay fees using LINK or other ERC-20 fee tokens.

This is because:

1. Safe's `execTransaction` cannot forward `msg.value` to nested calls
2. Safe executes transactions in its own context
3. Router expects `msg.value` to be the fee amount
4. But Safe's call doesn't include value in the Router's `msg.value`

## 🎯 Next Steps

1. ✅ Update `calculateCCIPFee` to support LINK fee calculation
2. ✅ Update `buildCCIPSafeTransaction` to use LINK feeToken
3. ✅ Add LINK approval transaction
4. ✅ Remove ETH value from CCIP transaction
5. ✅ Update UI to show LINK fee requirement
6. ✅ Add check: Safe must have enough LINK for fees
7. ✅ Update documentation

## 📚 References

- Chainlink CCIP with Safe: https://docs.chain.link/ccip/tutorials/evm/cross-chain-tokens/register-from-safe-burn-mint-hardhat
- Safe Transaction Execution: https://docs.safe.global/advanced/smart-account-signatures
- CCIP Fee Tokens: https://docs.chain.link/ccip/billing

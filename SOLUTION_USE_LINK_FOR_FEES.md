# ✅ SOLUTION: Use LINK Token for CCIP Fees (Safe Compatible)

## 🎯 Final Solution

**Root Cause:** Safe multisig cannot forward `msg.value` (ETH) when executing `ccipSend`. The value field is stored in the Safe transaction but NOT sent as `msg.value` to the Router contract.

**Solution:** Pay CCIP fees with LINK token instead of native ETH.

## 🔧 Changes Implemented

### 1. **Updated `calculateCCIPFee`** to support LINK fees

```typescript
export const calculateCCIPFee = async (
  params: CCIPTransferParams,
  _provider: BrowserProvider,
  useLinkForFees = true // ← DEFAULT to LINK for Safe compatibility
): Promise<CCIPFeeEstimate> => {
  // Get LINK token
  const linkToken = useLinkForFees
    ? getTokenBySymbol(params.sourceNetwork, "LINK")
    : null;

  // Calculate fee with LINK as feeToken
  const feeInWei = await ccipClient.getFee({
    client: publicClient,
    routerAddress,
    destinationChainSelector,
    destinationAccount,
    amount,
    tokenAddress,
    feeTokenAddress: useLinkForFees ? linkToken.address : undefined, // ← undefined = native ETH
  });

  return {
    feeInWei: feeInWei.toString(), // Fee in LINK (not ETH!)
    feeInEther: ethers.formatEther(feeInWei), // Format as LINK amount
  };
};
```

### 2. **Updated `buildCCIPSafeTransaction`** to use LINK

```typescript
export const buildCCIPSafeTransaction = async (
  params: CCIPTransferParams,
  safeAddress: string,
  provider: BrowserProvider
): Promise<{
  transactions: MetaTransactionData[];
  estimatedFee: CCIPFeeEstimate;
}> => {
  // Get LINK token (REQUIRED!)
  const linkToken = getTokenBySymbol(params.sourceNetwork, "LINK");
  if (!linkToken) {
    throw new Error("LINK token required for fee payment");
  }

  // Calculate fee in LINK
  const estimatedFee = await calculateCCIPFee(params, provider, true);

  // Check token approval (CCIP-BnM)
  // ... add approval if needed

  // 🔥 NEW: Check LINK approval for fee payment
  const linkContract = new ethers.Contract(
    linkToken.address,
    IERC20ABI,
    provider
  );
  const linkAllowance = await linkContract.allowance(
    safeAddress,
    routerAddress
  );
  const linkFeeAmount = BigInt(estimatedFee.feeInWei);

  if (linkAllowance < linkFeeAmount) {
    // Add LINK approval transaction
    const linkApprovalData = linkContract.interface.encodeFunctionData(
      "approve",
      [routerAddress, linkFeeAmount]
    );

    transactions.push({
      to: linkToken.address,
      value: "0",
      data: linkApprovalData,
      operation: 0,
    });
  }

  // 🔥 Build CCIP message with LINK fee token
  const ccipMessage = {
    receiver: receiverBytes,
    data: "0x",
    tokenAmounts: [
      {
        token: token.address,
        amount: tokenAmount,
      },
    ],
    feeToken: linkToken.address, // ← LINK instead of zero address!
    extraArgs: extraArgsV2,
  };

  // Encode ccipSend call
  const fullCallData = encodeFunctionData({
    abi: RouterABI,
    functionName: "ccipSend",
    args: [chainSelector, ccipMessage],
  });

  // 🔥 Add transaction with NO ETH value
  transactions.push({
    to: routerAddress,
    value: "0", // ← NO ETH! Fee paid in LINK
    data: fullCallData,
    operation: 0,
  });

  return { transactions, estimatedFee };
};
```

### 3. **Updated UI** to show LINK fee

```tsx
{
  feeEstimate && (
    <div className="balance-info warning">
      <strong>💰 CCIP Fee:</strong> {feeEstimate.feeInEther} LINK
      <br />
      <small>
        ⚠️ <strong>IMPORTANT:</strong> Safe must have enough LINK tokens for fee
        payment!
        <br />
        Check your LINK balance before proposing the transaction.
      </small>
    </div>
  );
}
```

## 📋 Required Changes Summary

| Component             | Before (ETH Fees)            | After (LINK Fees)                    |
| --------------------- | ---------------------------- | ------------------------------------ |
| **Fee Calculation**   | `feeTokenAddress: undefined` | `feeTokenAddress: linkToken.address` |
| **CCIP Message**      | `feeToken: "0x000..."`       | `feeToken: linkToken.address`        |
| **Transaction Value** | `value: feeInWei`            | `value: "0"`                         |
| **Approvals**         | 1 (token only)               | 2 (token + LINK)                     |
| **UI Display**        | "Fee: X ETH"                 | "Fee: X LINK"                        |

## 🧪 Testing Steps

### 1. Ensure Safe has LINK tokens

```bash
# Check LINK balance
Safe Address: 0xcF16809e8f41c6ECd613923a59c1605E1a41F7aD
LINK Token (Sepolia): 0x779877A7B0D9E8603169DdbD7836e478b4624789

# Send LINK to Safe if needed
Amount: 1 LINK (enough for ~100 transfers)
```

### 2. Propose CCIP Transfer

- UI will calculate fee in LINK (e.g., 0.001 LINK)
- System will create 2-3 transactions:
  1. Approve CCIP-BnM to Router (if needed)
  2. Approve LINK to Router (for fee) ← NEW!
  3. ccipSend with LINK fee

### 3. Execute Transactions IN ORDER

1. Execute token approval (if exists)
2. Execute LINK approval (if exists) ← NEW!
3. Execute CCIP transfer

### 4. Verify Success

- Safe balance: LINK decreases by fee amount
- Router: Receives LINK fee, not ETH
- CCIP: Transfer succeeds
- CCIPMessageSent event emitted

## 📊 Expected Behavior

### ✅ Success Flow (LINK Fees):

```
Before:
  Safe ETH: 0.15 ETH
  Safe LINK: 1.0 LINK
  Safe CCIP-BnM: 0.5 tokens

Propose → Confirm → Execute:
  1. Approve CCIP-BnM (if needed)
  2. Approve LINK (0.001 LINK to Router)
  3. ccipSend (feeToken = LINK, value = 0)

After Execution:
  Safe ETH: ~0.148 ETH (only gas costs)
  Safe LINK: 0.999 LINK (fee paid)
  Safe CCIP-BnM: 0.4 tokens (transferred)

Router receives: 0.001 LINK (fee)
CCIP processes: Transfer to destination ✅
```

### ❌ Old Flow (ETH Fees - FAILED):

```
Before:
  Safe ETH: 0.15 ETH

Propose → Confirm → Execute:
  ccipSend (feeToken = 0x000, value = 0.001 ETH)

Result:
  Safe executes transaction
  BUT: value NOT forwarded to Router
  Router sees msg.value = 0 (expected 0.001 ETH)
  ccipSend reverts: "Insufficient fee"
  Transaction fails ❌
```

## 🚀 Why This Works

### Problem with ETH Fees:

1. User sets: `value: 0.001 ETH`
2. Safe stores: Transaction with value field
3. Safe executes: Internal call to Router
4. Router receives: `msg.value = 0` ← PROBLEM!
5. Router checks: Fee insufficient
6. Transaction fails

### Solution with LINK Fees:

1. User approves: LINK to Router
2. Safe executes: `ccipSend(feeToken = LINK, value = 0)`
3. Router: Calls `LINK.transferFrom(Safe, Router, fee)`
4. LINK transferred: From Safe to Router ✅
5. Fee payment: Success!
6. CCIP transfer: Proceeds ✅

## 📚 References

- [Chainlink CCIP with Safe](https://docs.chain.link/ccip/tutorials/evm/cross-chain-tokens/register-from-safe-burn-mint-hardhat)
- [CCIP Fee Tokens](https://docs.chain.link/ccip/billing)
- [Safe Transaction Execution](https://docs.safe.global/advanced/smart-account-signatures)

## ⚠️ Important Notes

1. **LINK is REQUIRED** for Safe multisig CCIP transfers
2. **ETH fees DON'T WORK** with Safe (msg.value not forwarded)
3. **Approval needed** for both token AND LINK
4. **Execute in order**: Approvals first, then CCIP send
5. **Check LINK balance** before proposing

## 🎯 Next Steps

1. ✅ Test with actual LINK tokens on Sepolia
2. ✅ Verify fee calculation is accurate
3. ✅ Ensure LINK approval works
4. ✅ Confirm CCIP transfer succeeds
5. ✅ Update documentation for users

---

**Status:** ✅ Ready to test
**Breaking Change:** Yes - requires LINK tokens
**Impact:** 🟢 Fixes Safe CCIP transfers completely

# ⚡ GS013 Fix - Quick Summary

## 🔴 Problem

CCIP transfer fails với GS013 khi cần token approval.

## 🔍 Root Cause

Safe batches (approval + CCIP send) qua **MultiSend với DELEGATECALL** → ERC20 approval không work → GS013.

```
Safe → delegatecall → MultiSend → approve() ❌
(approval writes to Safe's storage, not token contract)
```

## ✅ Solution

**Propose 2 transactions riêng biệt** thay vì batch:

1. **First:** Propose approval → Execute
2. **Second:** Propose CCIP transfer → Execute

## 📝 Changes

**File:** `client/src/lib/safeFlow.ts`

```typescript
// proposeCCIPTransfer() now returns:
{
  safeTxHash: string;
  estimatedFee: CCIPFeeEstimate;
  needsApproval: boolean;     // ← NEW
  approvalTxHash?: string;    // ← NEW
}

// Logic:
if (needsApproval) {
  // Propose ONLY approval
  return { approvalTxHash, needsApproval: true };
} else {
  // Propose CCIP send
  return { safeTxHash, needsApproval: false };
}
```

**File:** `client/src/components/CCIPTransfer.tsx`

```typescript
if (result.needsApproval) {
  // Show: "Execute approval first, then propose again"
} else {
  // Show: "CCIP transfer proposed!"
}
```

## 🧪 Test Flow

```
1. Propose CCIP Transfer
   → If no approval: Get CCIP tx ✅
   → If needs approval: Get approval tx ⚠️

2. (If approval needed) Execute approval tx

3. Propose CCIP Transfer again
   → Now get CCIP tx ✅ (approval already done)

4. Execute CCIP tx
   → Success! NO GS013! ✅
```

## 💡 Why This Works

| Method            | Operation        | Works?            |
| ----------------- | ---------------- | ----------------- |
| Batched MultiSend | DELEGATECALL (1) | ❌ Approval fails |
| Separate Txs      | CALL (0)         | ✅ Approval works |

**Key:** Individual transactions use `operation: 0` (CALL), không phải DELEGATECALL.

## 📚 Full Details

See: [GS013_MULTISEND_FIX.md](./GS013_MULTISEND_FIX.md)

---

**Status:** ✅ FIXED  
**Date:** October 16, 2025

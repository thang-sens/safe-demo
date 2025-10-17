# 🔧 GS013 Fix - MultiSend DelegateCall Issue

## ❌ Root Cause Found

Lỗi GS013 xảy ra vì **Safe Protocol Kit tự động dùng MultiSend contract với DELEGATECALL** khi batch multiple transactions.

### Vấn Đề Chi Tiết

Khi CCIP transfer cần approval:

```javascript
// Safe tạo 2 transactions:
[
  { to: TOKEN_ADDRESS, data: "approve(...)", value: "0" },  // Approval
  { to: CCIP_ROUTER, data: "ccipSend(...)", value: "fee" }  // CCIP send
]

// Safe Protocol Kit batches chúng qua MultiSend:
Safe.execTransaction(
  to: MULTISEND_CONTRACT,  // 0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B
  data: encodeMultiSend([approval, ccipSend]),
  operation: 1  // ❌ DELEGATECALL
)
```

### Tại Sao DELEGATECALL Fails?

**DELEGATECALL** thực thi code của target contract **trong context của caller** (Safe):

```solidity
// Khi Safe gọi:
Safe.delegatecall(MultiSend.multiSend([
  token.approve(router, amount),  // (1)
  router.ccipSend(...)             // (2)
]))

// (1) token.approve() được execute với:
// - msg.sender = Safe address
// - storage = Safe's storage ❌
//
// ERC20 token storage layout khác Safe's storage
// → approval không được lưu đúng
// → router không có allowance
//
// (2) router.ccipSend() fails vì:
// → token.transferFrom(Safe, router, amount)
// → allowance = 0 ❌
// → REVERT
```

**Kết quả:** GS013 error

---

## ✅ Giải Pháp

### Không Thể Dùng MultiSend + DELEGATECALL

Safe Protocol Kit không hỗ trợ MultiSend với **CALL** (operation = 0) cho multiple transactions. Nó luôn dùng DELEGATECALL.

### Giải Pháp: Propose 2 Transactions Riêng Biệt

**Workflow Mới:**

1. **First Propose**: Propose token approval transaction
2. **Execute Approval**: User confirms và executes approval
3. **Second Propose**: Propose CCIP transfer (token đã được approved)
4. **Execute CCIP**: User confirms và executes CCIP transfer

---

## 📝 Code Changes

### 1. Updated `proposeCCIPTransfer()` Return Type

```typescript
// Before
Promise<{ safeTxHash: string; estimatedFee: CCIPFeeEstimate }>;

// After
Promise<{
  safeTxHash: string;
  estimatedFee: CCIPFeeEstimate;
  needsApproval: boolean; // ← NEW
  approvalTxHash?: string; // ← NEW
}>;
```

### 2. Updated Logic

```typescript
if (transactions.length === 1) {
  // No approval needed - token already approved
  return {
    safeTxHash: await proposeTransaction(...),
    estimatedFee,
    needsApproval: false,
  };
} else {
  // Approval needed
  console.log("⚠️ Proposing approval transaction first");

  // Propose ONLY approval transaction
  const approvalTxHash = await proposeTransaction(
    safeAddress,
    transactions[0],  // Approval only
    provider
  );

  return {
    safeTxHash: approvalTxHash,
    estimatedFee,
    needsApproval: true,
    approvalTxHash,
  };
}
```

### 3. Updated UI (CCIPTransfer.tsx)

```typescript
const result = await proposeCCIPTransfer(...);

if (result.needsApproval) {
  setSuccess(
    `⚠️ Token approval needed!\n` +
    `Approval transaction: ${result.approvalTxHash}\n\n` +
    `Steps:\n` +
    `1. Execute the approval transaction\n` +
    `2. Then propose CCIP transfer again`
  );
} else {
  setSuccess(`✅ CCIP transfer proposed!`);
}
```

---

## 🧪 Testing Guide

### Test Case: CCIP Transfer với Token Chưa Approved

**Setup:**

- Safe has LINK tokens
- LINK not approved for CCIP Router yet
- Amount: 0.0001 LINK

**Expected Flow:**

#### Step 1: First Propose

```
User clicks "Propose CCIP Transfer"

Console logs:
[CCIP Build] Current allowance: 0, needed: 100000
[CCIP Build] Insufficient allowance - adding approval transaction
[CCIP Build] Total transactions to execute: 2
[CCIP] Built 2 transaction(s)
[CCIP] Approval needed - proposing approval transaction first
[CCIP] ✅ Approval transaction proposed: 0xABC...
[CCIP] ⚠️ User must confirm and execute this approval BEFORE proposing CCIP transfer

UI shows:
⚠️ Token approval needed! Approval transaction proposed: 0xABC...

Please:
1. Find the approval transaction in "Pending Transactions"
2. Confirm it with other owners if needed
3. Execute the approval transaction
4. Then come back and propose the CCIP transfer again
```

#### Step 2: Execute Approval

```
User goes to "Pending Transactions"
→ Finds approval transaction
   To: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 (LINK token)
   Data: approve(router, 100000)
   Value: 0
→ Clicks "Confirm" (if needed)
→ Clicks "Execute"
→ ✅ Transaction executes successfully
→ LINK token is now approved for CCIP Router
```

#### Step 3: Propose CCIP Transfer Again

```
User fills CCIP form again (same details)
User clicks "Propose CCIP Transfer"

Console logs:
[CCIP Build] Current allowance: 100000, needed: 100000
[CCIP Build] Total transactions to execute: 1  ← Only CCIP send now!
[CCIP] Built 1 transaction(s)
[CCIP] Single transaction - no approval needed

UI shows:
✅ CCIP transfer proposed successfully! Transaction hash: 0xDEF...
```

#### Step 4: Execute CCIP Transfer

```
User goes to "Pending Transactions"
→ Finds CCIP transfer transaction
   To: 0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59 (CCIP Router)
   Data: ccipSend(...)
   Value: 0.000064 ETH (fee)
→ Clicks "Confirm" (if needed)
→ Clicks "Execute"
→ ✅ Transaction executes successfully! (NO GS013!)
→ CCIP message sent cross-chain
```

---

## 🎯 Key Points

### Why Not Batch?

❌ **Cannot batch approval + CCIP send** because:

- Safe Protocol Kit uses MultiSend with DELEGATECALL
- DELEGATECALL doesn't work with ERC20 token approvals
- Approval storage is written to wrong contract

✅ **Must propose separately** because:

- Each transaction uses CALL (operation = 0)
- Approval writes to correct ERC20 storage
- CCIP send reads correct allowance

### User Experience

**Before (❌ Failed):**

1. Propose "CCIP Transfer"
2. Execute → GS013 error ❌

**After (✅ Works):**

1. Propose "CCIP Transfer" → Get approval transaction
2. Execute approval → Success ✅
3. Propose "CCIP Transfer" again → Get CCIP transaction
4. Execute CCIP → Success ✅

**Trade-off:**

- User must propose twice if approval needed
- But transactions actually execute successfully
- Better UX than mysterious GS013 errors

---

## 📚 Technical Background

### Safe MultiSend Contract

Safe uses MultiSend contract to batch multiple transactions:

```solidity
contract MultiSend {
  function multiSend(bytes memory transactions) public payable {
    // Execute each transaction sequentially
    for (each tx in transactions) {
      // All transactions execute in same call context
      address(tx.to).call{value: tx.value}(tx.data);
    }
  }
}
```

When Safe calls MultiSend with DELEGATECALL:

```solidity
// Safe's execTransaction
this.delegatecall(multiSend.address, multiSend.multiSend(txs));

// All tx.data executes with Safe's storage context
// ERC20.approve() writes to Safe's storage slots
// Router cannot read the approval ❌
```

### Why DELEGATECALL?

Safe uses DELEGATECALL for MultiSend because:

- Preserve msg.sender = Safe (not MultiSend)
- Allow Safe modules to modify Safe's state
- **But breaks ERC20 interactions**

### Alternative (Not Used)

Could use MultiSendCallOnly contract (operation = 0):

- Uses CALL instead of DELEGATECALL
- Works with ERC20 approvals
- But Safe Protocol Kit doesn't support it for multiple txs

---

## ✅ Verification

After fix, check logs:

```javascript
// First propose (approval needed)
[CCIP] Approval needed - proposing approval transaction first

// After approval executed, second propose
[CCIP] Single transaction - no approval needed

// Execute CCIP
✅ Transaction executed successfully!
// NO GS013 error
```

---

**Status:** ✅ FIXED
**Date:** October 16, 2025

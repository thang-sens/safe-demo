# 🧪 Testing Reject Transaction Feature

## Prerequisites

1. ✅ Backend running (`cd server && npm run dev`)
2. ✅ Frontend running (`cd client && npm run dev`)
3. ✅ At least 2 owner accounts with Web3Auth
4. ✅ Safe deployed with threshold ≥ 2

## Test Scenario 1: Basic Rejection Flow

### Setup

- Safe Address: `0x...` (from Company Dashboard)
- Owners: 3 accounts (Owner A, B, C)
- Threshold: 2 of 3

### Steps

#### 1. Create Pending Transaction (Owner A)

```
Login as Owner A
→ Company Dashboard
→ Load Safe
→ Propose Transaction:
   To: 0x1234567890123456789012345678901234567890
   Value: 1000000000000000 (0.001 ETH)
   Data: 0x
   Operation: Call
→ Click "Propose Transaction"
```

**Expected:**

- ✅ Success message with Safe TX Hash
- ✅ Transaction appears in "Pending Transactions"
- ✅ Shows "1/2 confirmations"

#### 2. Reject Transaction (Owner B)

```
Logout Owner A
→ Login as Owner B
→ Company Dashboard
→ Load same Safe
→ See pending transaction
→ Click "Reject" button
→ Confirm dialog appears
→ Click "OK"
```

**Expected:**

- ✅ Confirmation dialog: "Are you sure you want to reject this transaction?"
- ✅ Success message with Rejection TX Hash
- ✅ Rejection transaction appears in Pending Transactions
- ✅ Shows "1/2 confirmations" for rejection tx

#### 3. Confirm Rejection (Owner C)

```
Logout Owner B
→ Login as Owner C
→ Load same Safe
→ Find rejection transaction (look for: To = Safe address, Value = 0)
→ Click "Confirm" on rejection transaction
```

**Expected:**

- ✅ "Transaction confirmed successfully!"
- ✅ Rejection tx shows "2/2 confirmations"
- ✅ "Execute" button appears

#### 4. Execute Rejection (Owner B or C)

```
Click "Execute" on rejection transaction
```

**Expected:**

- ✅ "Transaction executed successfully!"
- ✅ Transaction hash appears
- ✅ Rejection tx moves to "Transaction History"
- ✅ Original transaction still in "Pending" but cannot be executed

#### 5. Try to Execute Original Transaction (Should Fail)

```
Try to confirm original transaction
→ Get threshold (2/2)
→ Try to execute
```

**Expected:**

- ❌ Error: "Nonce already used" or similar
- ✅ Transaction cannot be executed
- ✅ Original transaction is effectively rejected

## Test Scenario 2: Race Condition (Execute vs Reject)

### Steps

#### 1. Create Transaction (Owner A)

```
Propose: Send 0.001 ETH to 0xABC...
→ Transaction gets nonce = 5
```

#### 2. Two Parallel Actions

**Owner B: Confirms Original**

```
Click "Confirm" on original transaction
→ Gets threshold (2/2)
→ Ready to execute
```

**Owner C: Proposes Rejection**

```
Click "Reject" on same transaction
→ Rejection transaction created (nonce = 5)
```

#### 3. Race to Execute

**Scenario A: Original Executes First**

```
Owner B clicks "Execute" on original
→ ✅ Original executes successfully
→ ❌ Rejection transaction cannot execute (nonce used)
```

**Scenario B: Rejection Executes First**

```
Owner C gets confirmation from others
→ Owner C executes rejection
→ ✅ Rejection executes successfully
→ ❌ Original transaction cannot execute (nonce used)
```

**Learning:** First transaction to execute wins!

## Test Scenario 3: Multiple Rejections

### Steps

#### 1. Create 3 Pending Transactions

```
Propose TX 1: Send 0.001 ETH to Address A (nonce: 5)
Propose TX 2: Send 0.002 ETH to Address B (nonce: 6)
Propose TX 3: Send 0.003 ETH to Address C (nonce: 7)
```

#### 2. Reject TX 2

```
Click "Reject" on Transaction 2
→ Rejection TX created (nonce: 6)
→ Get confirmations
→ Execute rejection
```

**Result:**

- ✅ TX 1 (nonce 5) - Still executable
- ❌ TX 2 (nonce 6) - Rejected, cannot execute
- ✅ TX 3 (nonce 7) - Still executable

**Important:** Rejecting TX 2 does NOT affect TX 1 or TX 3!

## Test Scenario 4: Error Handling

### Test 4.1: Try to Reject Already Executed Transaction

```
1. Create and execute a transaction
2. Try to click "Reject" on it
```

**Expected:**

- ❌ Error: Transaction already executed or not found
- ✅ Clear error message to user

### Test 4.2: Execute Rejection Without Threshold

```
1. Create rejection transaction
2. Try to execute without enough confirmations
```

**Expected:**

- ❌ Error: "Threshold not reached for rejection. 1/2 confirmations"
- ✅ Execute button should be disabled or show error

### Test 4.3: Insufficient Gas

```
1. Create rejection transaction
2. Execute with account that has no ETH
```

**Expected:**

- ❌ Error: Insufficient funds for gas
- ✅ Clear error message

## UI Testing Checklist

### Visual Elements

- [ ] "Reject" button displays in red (#dc3545)
- [ ] Hover effect changes to darker red (#c82333)
- [ ] Button is properly aligned with Confirm/Execute buttons
- [ ] Button shows loading state when disabled
- [ ] Title tooltip shows on hover

### Interaction

- [ ] Click "Reject" shows confirmation dialog
- [ ] Cancel dialog does nothing
- [ ] OK creates rejection transaction
- [ ] Success message is clear and informative
- [ ] Error messages display properly
- [ ] Loading spinner during API calls

### Transaction List

- [ ] Rejection transactions appear in Pending list
- [ ] Easy to identify rejection tx (To = Safe address, Value = 0)
- [ ] Confirmations count updates in real-time
- [ ] Execute button appears when threshold reached

## Browser Console Testing

### Check Logs

```javascript
// When clicking "Reject"
🚫 Rejecting transaction: 0x1234...
📋 Original transaction nonce: 5
✍️ Signed rejection transaction
📤 Rejection transaction proposed with hash: 0x5678...
⚠️ Note: Other owners need to confirm this rejection transaction
```

### Check Network Requests

```
POST /api/companies/by-name/{name}
  → Get Safe info

Safe Transaction Service:
GET /safes/{address}/transactions
  → Get pending transactions

POST /safes/{address}/propose
  → Propose rejection transaction
```

## Performance Testing

### Metrics to Check

1. **Transaction Creation Time**

   ```
   Click "Reject" → Success message
   Expected: < 3 seconds
   ```

2. **Confirmation Time**

   ```
   Click "Confirm" → Confirmation recorded
   Expected: < 2 seconds
   ```

3. **Execution Time**

   ```
   Click "Execute" → Transaction mined
   Expected: 15-30 seconds (depends on gas)
   ```

4. **UI Update Time**
   ```
   Transaction executed → UI refreshes
   Expected: < 2 seconds
   ```

## Integration Testing

### Test with Other Features

#### 1. Reject + Owner Management

```
1. Propose add owner transaction
2. Reject it
3. Verify owner list unchanged
```

#### 2. Reject + Threshold Change

```
1. Propose change threshold to 3
2. Reject it
3. Verify threshold remains 2
```

#### 3. Reject + CCIP Transfer

```
1. Propose CCIP cross-chain transfer
2. Reject it
3. Verify no tokens transferred
```

## Edge Cases

### Case 1: Reject Own Transaction

```
Owner A proposes transaction
Owner A clicks "Reject" on same transaction
```

**Expected:** Should work (owner can change mind)

### Case 2: Multiple Owners Click Reject Simultaneously

```
3 owners click "Reject" at same time
```

**Expected:**

- Only 1 rejection transaction created
- Or 3 separate rejection txs created (same nonce)
- First one to execute wins

### Case 3: Reject Transaction Then Original Gets More Confirmations

```
1. Create rejection tx (has 1 confirm)
2. Original tx gets more confirms (2/2)
3. Race to execute
```

**Expected:** Whichever executes first wins

## Regression Testing

After implementing reject feature, verify:

- [ ] Existing propose transaction still works
- [ ] Confirm transaction not affected
- [ ] Execute transaction not affected
- [ ] Add owner still works
- [ ] Remove owner still works
- [ ] Change threshold still works
- [ ] CCIP transfers still work
- [ ] Transaction history displays correctly
- [ ] Safe info loads correctly

## Security Testing

### 1. Authorization

```
Try to reject transaction from non-owner account
```

**Expected:** ❌ Error: Not an owner

### 2. Signature Validation

```
Tamper with rejection transaction signatures
```

**Expected:** ❌ Error: Invalid signature

### 3. Nonce Manipulation

```
Try to create rejection tx with different nonce
```

**Expected:** Won't invalidate original (different nonce)

## Test Results Template

```markdown
## Test Execution Results

**Date:** 2025-10-16
**Tester:** [Your Name]
**Environment:** Sepolia Testnet

### Scenario 1: Basic Rejection Flow

- [ ] Step 1: Create Transaction - PASS
- [ ] Step 2: Reject Transaction - PASS
- [ ] Step 3: Confirm Rejection - PASS
- [ ] Step 4: Execute Rejection - PASS
- [ ] Step 5: Original Cannot Execute - PASS

### Scenario 2: Race Condition

- [ ] Original Executes First - PASS
- [ ] Rejection Executes First - PASS

### Scenario 3: Multiple Rejections

- [ ] Reject Middle Transaction - PASS
- [ ] Others Unaffected - PASS

### Scenario 4: Error Handling

- [ ] Reject Executed Transaction - PASS
- [ ] Execute Without Threshold - PASS
- [ ] Insufficient Gas - PASS

### UI Testing

- [ ] Visual Elements - PASS
- [ ] Interaction - PASS
- [ ] Transaction List - PASS

### Integration Testing

- [ ] Works with Owner Management - PASS
- [ ] Works with Threshold Change - PASS
- [ ] Works with CCIP - PASS

**Overall Result:** ✅ PASS / ❌ FAIL

**Notes:**
[Any issues or observations]
```

## Automated Testing (Future)

```typescript
// Example test case
describe("Reject Transaction", () => {
  it("should create rejection transaction with same nonce", async () => {
    const originalTx = await proposeTransaction(/* ... */);
    const rejectionTx = await rejectTransaction(
      safeAddress,
      originalTx.safeTxHash,
      provider
    );

    expect(rejectionTx.nonce).toBe(originalTx.nonce);
  });

  it("should invalidate original transaction when executed", async () => {
    const originalTx = await proposeTransaction(/* ... */);
    const rejectionTx = await rejectTransaction(
      safeAddress,
      originalTx.safeTxHash,
      provider
    );

    await confirmAndExecute(rejectionTx);

    await expect(executeTransaction(originalTx.safeTxHash)).rejects.toThrow(
      "Nonce already used"
    );
  });
});
```

---

Happy Testing! 🧪✨

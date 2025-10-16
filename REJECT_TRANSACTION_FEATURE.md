# 🚫 Reject Transaction Feature Documentation

## Overview

Tính năng **Reject Transaction** cho phép owners từ chối một transaction đang pending trong Safe multisig wallet bằng cách tạo một rejection transaction với cùng nonce.

## Cách hoạt động

### Safe Transaction Nonce System

Trong Gnosis Safe, mỗi transaction có một **nonce** (số thứ tự) duy nhất:

- Nonce được tăng dần theo từng transaction được execute
- Chỉ transaction với nonce hiện tại của Safe mới có thể được execute
- Nếu một transaction khác với cùng nonce được execute trước, transaction gốc sẽ bị invalidate

### Rejection Transaction Mechanism

Để reject một transaction:

1. **Tạo Rejection Transaction**: Một transaction đặc biệt với:
   - Cùng nonce với transaction cần reject
   - Value = 0 ETH
   - To = Safe address (gửi đến chính nó)
   - Data = "0x" (không có data)
2. **Confirm Rejection**: Owners khác phải confirm rejection transaction

3. **Execute Rejection**: Khi đủ threshold, execute rejection transaction

4. **Transaction gốc bị invalidate**: Vì nonce đã được sử dụng, transaction gốc không thể execute được nữa

## Implementation Details

### Backend Functions (safeFlow.ts)

#### 1. `rejectTransaction()`

```typescript
export const rejectTransaction = async (
  safeAddress: string,
  safeTxHash: string,
  provider: BrowserProvider
): Promise<string>
```

**Chức năng:**

- Lấy nonce từ transaction gốc
- Tạo rejection transaction với cùng nonce
- Sign và propose rejection transaction
- Trả về safeTxHash của rejection transaction

**Parameters:**

- `safeAddress`: Địa chỉ Safe wallet
- `safeTxHash`: Hash của transaction cần reject
- `provider`: Ethers BrowserProvider

**Returns:**

- Hash của rejection transaction

**Example:**

```typescript
const rejectionTxHash = await rejectTransaction(
  "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
  "0x1234...abcd",
  provider
);
```

#### 2. `executeRejectionTransaction()`

```typescript
export const executeRejectionTransaction = async (
  safeAddress: string,
  rejectionTxHash: string,
  provider: BrowserProvider
): Promise<string>
```

**Chức năng:**

- Execute rejection transaction khi đủ threshold
- Sort signatures theo thứ tự owner address
- Submit transaction lên blockchain
- Invalidate transaction gốc

**Parameters:**

- `safeAddress`: Địa chỉ Safe wallet
- `rejectionTxHash`: Hash của rejection transaction
- `provider`: Ethers BrowserProvider

**Returns:**

- Transaction hash trên blockchain

### Frontend Integration (SafeTransactions.tsx)

#### Handler Function

```typescript
const handleRejectTransaction = async (safeTxHash: string) => {
  // Confirm với user
  if (!confirm("Are you sure you want to reject this transaction?")) {
    return;
  }

  // Call rejectTransaction API
  const rejectionTxHash = await rejectTransaction(
    safeAddress,
    safeTxHash,
    provider
  );

  // Show success message
  alert(`Rejection transaction created: ${rejectionTxHash}`);

  // Reload data
  await loadSafeData();
};
```

#### UI Components

**Reject Button** trong Pending Transactions:

```tsx
<button
  onClick={() => handleRejectTransaction(tx.safeTxHash)}
  disabled={loading}
  className="btn-reject"
  title="Reject this transaction"
>
  Reject
</button>
```

**Styling:**

```css
.btn-reject {
  background: #dc3545; /* Red color */
}

.btn-reject:hover:not(:disabled) {
  background: #c82333; /* Darker red on hover */
}
```

## User Flow

### Scenario: Owner muốn reject một transaction

**Step 1: View Pending Transaction**

```
Company Dashboard → Load Safe → Pending Transactions
```

**Step 2: Click "Reject" Button**

- Nhấn nút "Reject" trên transaction cần từ chối
- Confirm dialog xuất hiện

**Step 3: Confirm Rejection**

```
⚠️ Are you sure you want to reject this transaction?
This will create a rejection transaction that needs to be confirmed by other owners.

[Cancel] [OK]
```

**Step 4: Rejection Transaction Created**

```
✅ Rejection transaction created successfully!

Rejection TX Hash: 0x5678...efgh

⚠️ This rejection transaction needs to be confirmed by other owners.
Once threshold is reached, execute it to reject the original transaction.
```

**Step 5: Other Owners Confirm**

- Rejection transaction xuất hiện trong Pending Transactions
- Owners khác click "Confirm" để approve rejection
- Track progress: "2/3 confirmations"

**Step 6: Execute Rejection**

- Khi đủ threshold, click "Execute"
- Rejection transaction được submit lên blockchain
- Transaction gốc bị invalidate

**Step 7: Result**

```
✅ Rejection transaction executed successfully!
TX Hash: 0x9abc...def0

🚫 Original transaction has been invalidated
```

## Technical Details

### Rejection Transaction Structure

```typescript
{
  to: safeAddress,           // Send to Safe itself
  value: "0",                // 0 ETH
  data: "0x",                // No data
  operation: 0,              // Call operation
  nonce: originalTx.nonce    // SAME nonce as original
}
```

### Why This Works

1. **Nonce Collision**: Safe chỉ cho phép MỘT transaction với mỗi nonce được execute

2. **First Come First Served**: Transaction nào được execute trước sẽ consume nonce đó

3. **Harmless Operation**: Rejection transaction chỉ gửi 0 ETH đến chính Safe, không gây hại gì

4. **Multi-sig Required**: Rejection vẫn cần đủ signatures theo threshold, đảm bảo decentralized governance

### Comparison với các phương án khác

| Method                       | Pros                                                           | Cons                                                  |
| ---------------------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| **Rejection Transaction** ✅ | • On-chain proof<br>• Multi-sig required<br>• Cannot be undone | • Requires threshold<br>• Gas cost                    |
| **Off-chain Rejection**      | • No gas cost<br>• Immediate                                   | • No on-chain proof<br>• Can be ignored               |
| **Wait for Timeout**         | • Automatic                                                    | • No timeout mechanism<br>• Transaction stays forever |

## Error Handling

### Common Errors

**1. "Threshold not reached for rejection"**

```
Error: Threshold not reached for rejection. 1/2 confirmations
```

**Solution:** Wait for more owners to confirm rejection transaction

**2. "Transaction already executed"**

```
Error: Cannot reject an already executed transaction
```

**Solution:** Transaction đã được execute, không thể reject nữa

**3. "Invalid nonce"**

```
Error: Nonce mismatch - transaction may have been executed
```

**Solution:** Check nonce của Safe và transaction

## Best Practices

### 1. Communicate với Team

Trước khi reject, nên thông báo cho team:

```
"I'm going to reject transaction 0x1234...
Reason: Wrong recipient address
Please confirm the rejection transaction."
```

### 2. Verify Transaction Details

Kiểm tra kỹ transaction trước khi reject:

- To address
- Value amount
- Data/function call
- Number of confirmations

### 3. Document Reason

Thêm comment khi propose rejection:

```typescript
// In future: Add rejection reason field
const rejectionReason = "Incorrect recipient address - should be 0xABC...";
```

### 4. Monitor Gas Costs

Execute rejection transaction có gas cost:

```
Estimated gas: ~100,000 gas
Cost (at 50 gwei): ~0.005 ETH
```

## Security Considerations

### ✅ Secure

1. **Multi-sig Protection**: Rejection cần đủ threshold signatures
2. **On-chain Verification**: Tất cả được record trên blockchain
3. **Cannot Bypass**: Không thể bypass nonce mechanism

### ⚠️ Considerations

1. **Front-running**: Ai execute transaction trước (original hoặc rejection) sẽ thắng
2. **Gas Race**: Có thể cạnh tranh về gas price để execute trước
3. **Timing**: Cần coordinate với team để avoid conflicts

## Testing Checklist

- [ ] Create rejection transaction cho pending tx
- [ ] Verify rejection transaction có cùng nonce
- [ ] Confirm rejection transaction bởi owners khác
- [ ] Execute rejection transaction khi đủ threshold
- [ ] Verify original transaction không execute được
- [ ] Check UI updates correctly sau rejection
- [ ] Test với different threshold configurations
- [ ] Test error cases (already executed, invalid nonce, etc.)

## Future Enhancements

### 1. Rejection Reason Field

```typescript
interface RejectionData {
  originalTxHash: string;
  reason: string;
  rejectedBy: string;
  timestamp: number;
}
```

### 2. Rejection History

Track all rejected transactions:

```typescript
const getRejectionHistory = async (safeAddress: string) => {
  // Query rejection transactions
  // Display in UI with reasons
};
```

### 3. Auto-detect Rejection Transactions

Hiển thị rejection transactions riêng:

```tsx
<div className="rejection-transactions">
  <h3>🚫 Rejection Transactions</h3>
  {/* List rejection transactions separately */}
</div>
```

### 4. Bulk Rejection

Reject nhiều transactions cùng lúc:

```typescript
const rejectMultipleTransactions = async (
  safeAddress: string,
  safeTxHashes: string[],
  provider: BrowserProvider
) => {
  // Create rejection transactions for all
};
```

## API Reference

### safeFlow.ts

```typescript
// Create rejection transaction
rejectTransaction(safeAddress, safeTxHash, provider): Promise<string>

// Execute rejection transaction
executeRejectionTransaction(safeAddress, rejectionTxHash, provider): Promise<string>
```

### safe.ts

```typescript
// Wrapper functions
rejectTransaction(safeAddress, safeTxHash, provider): Promise<string>
executeRejectionTransaction(safeAddress, rejectionTxHash, provider): Promise<string>
```

### SafeTransactions.tsx

```typescript
// Handler function
handleRejectTransaction(safeTxHash: string): Promise<void>
```

## Troubleshooting

### Problem: Rejection button không xuất hiện

**Check:**

1. Import `rejectTransaction` trong SafeTransactions.tsx
2. Verify `handleRejectTransaction` handler exists
3. Check button rendering trong JSX

### Problem: Rejection transaction không tạo được

**Debug:**

```typescript
console.log("Original transaction nonce:", originalTransaction.nonce);
console.log("Rejection transaction nonce:", rejectionTransaction.nonce);
// Should be the same
```

### Problem: Cannot execute rejection

**Check:**

1. Threshold reached? Check confirmations count
2. Correct signatures? Verify signature sorting
3. Nonce still valid? Original tx might be executed already

## Resources

- [Gnosis Safe Documentation](https://docs.safe.global/)
- [Safe Transaction Service API](https://safe-transaction-mainnet.safe.global/)
- [EIP-712 Typed Data](https://eips.ethereum.org/EIPS/eip-712)

---

## Summary

Tính năng Reject Transaction cung cấp một cách **an toàn và decentralized** để từ chối pending transactions trong Safe multisig wallet bằng cách tận dụng nonce mechanism của Gnosis Safe.

**Key Points:**

- ✅ Multi-sig required (democratic)
- ✅ On-chain proof (transparent)
- ✅ Cannot be undone (permanent)
- ✅ Safe và secure (audited mechanism)
- ✅ Easy to use (one-click button)

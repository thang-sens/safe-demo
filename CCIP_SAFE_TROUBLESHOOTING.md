# 🔧 CCIP Safe Transaction Troubleshooting Guide

## ✅ Vấn đề đã được khắc phục

### 🎯 Root Cause

Transaction CCIP qua Safe multisig thất bại vì:

1. **Safe thiếu ETH** để trả phí CCIP (msg.value)
2. Transaction được propose và execute đúng, nhưng không có đủ ETH để Router chấp nhận

### 🛠️ Giải pháp đã triển khai

#### 1. **Pre-execution Balance Check** ✅

```typescript
// Trước khi propose, check Safe có đủ ETH
const safeBalance = await provider.getBalance(safeAddress);
const requiredFee = BigInt(feeEstimate.feeInWei);

if (safeBalance < requiredFee) {
  throw new Error("Insufficient ETH in Safe!");
}
```

#### 2. **Real-time Balance Display** ✅

- UI hiển thị Safe ETH balance theo thời gian thực
- Warning màu đỏ nếu thiếu ETH
- Cảnh báo màu cam nếu balance gần sát mức tối thiểu

#### 3. **Execute-time Validation** ✅

```typescript
// Trước khi execute, verify lại
if (safeBalance < requiredValue) {
  throw new Error("Safe needs more ETH to execute!");
}
```

#### 4. **Post-execution Verification** ✅

```typescript
// Sau khi execute, check ETH đã được transfer
const balanceChange = safeBalanceBefore - safeBalanceAfter;
if (balanceChange < requiredValue) {
  console.warn("Value may not have been forwarded correctly!");
}
```

## 📋 Checklist trước khi thực hiện CCIP Transfer

### Bước 1: Chuẩn bị Safe

- [ ] Safe có địa chỉ hợp lệ trên Sepolia
- [ ] Safe có ít nhất 2 owners (hoặc threshold đã set)
- [ ] Bạn là 1 trong các owners

### Bước 2: Nạp Funds vào Safe

```bash
# ETH cho phí CCIP (khoảng 0.001-0.003 ETH/transfer)
Send to Safe: [YOUR_SAFE_ADDRESS]
Amount: >= 0.01 ETH (để có buffer)

# Token để transfer (ví dụ: LINK)
1. Mua LINK từ faucet hoặc swap
2. Send LINK vào Safe address
```

### Bước 3: Kiểm tra Balance

UI sẽ tự động hiển thị:

```
✅ Safe ETH Balance: 0.015 ETH
   Required Fee: 0.002 ETH
   Status: Ready ✓
```

Hoặc:

```
⚠️ Safe ETH Balance: 0.0005 ETH
   Required Fee: 0.002 ETH
   WARNING: Safe needs 0.0015 more ETH!
```

### Bước 4: Calculate Fee

1. Chọn destination network
2. Chọn token (LINK)
3. Nhập amount
4. Nhập recipient address
5. Click **"Calculate Fee"**

### Bước 5: Propose Transaction

- Đảm bảo fee đã được calculate
- UI sẽ check balance tự động
- Nếu đủ ETH → Propose thành công
- Nếu thiếu ETH → Hiển thị lỗi rõ ràng

### Bước 6: Execute Transaction

1. Đợi đủ signatures (threshold)
2. UI check balance lại lần nữa
3. Execute → Safe forward ETH đến Router
4. Router nhận ETH và xử lý CCIP transfer
5. Verify transaction trên blockchain

## 🔍 Debug Commands

### Check Safe Balance

```javascript
// In browser console
const provider = new ethers.BrowserProvider(window.ethereum);
const safeAddress = "0x...";
const balance = await provider.getBalance(safeAddress);
console.log("Safe Balance:", ethers.formatEther(balance), "ETH");
```

### Check Token Balance

```javascript
const tokenAddress = "0x..."; // LINK token
const tokenContract = new ethers.Contract(
  tokenAddress,
  ["function balanceOf(address) view returns (uint256)"],
  provider
);
const balance = await tokenContract.balanceOf(safeAddress);
console.log("Token Balance:", balance.toString());
```

### Check Router Approval

```javascript
const routerAddress = "0x..."; // CCIP Router
const allowance = await tokenContract.allowance(safeAddress, routerAddress);
console.log("Router Allowance:", allowance.toString());
```

## 💡 Best Practices

### 1. Luôn có buffer ETH

```
Required Fee: 0.002 ETH
Recommended: 0.005 ETH (2.5x buffer)
Reason: Gas prices fluctuate, execution costs vary
```

### 2. Test với small amount trước

```
First transfer: 0.1 LINK
After success: Scale up to desired amount
```

### 3. Monitor transaction status

```
1. Execute transaction
2. Get transaction hash
3. Click "Verify Transaction"
4. Check on Etherscan
5. Track on CCIP Explorer
```

### 4. Hiểu flow của 2 transactions

```
Transaction 1: Approve LINK → Router
- Must execute FIRST
- No ETH value needed
- Just approval

Transaction 2: CCIP Send
- Must execute AFTER approval
- Requires ETH value (fee)
- Actually sends tokens
```

## 🚨 Common Errors & Solutions

### Error: "Insufficient ETH in Safe"

**Nguyên nhân:** Safe không có đủ ETH để trả phí CCIP

**Giải pháp:**

```bash
# Send ETH to Safe
To: [SAFE_ADDRESS]
Amount: 0.01 ETH

# Wait for confirmation, UI will auto-update
```

### Error: "Transaction failed with ccipSend"

**Nguyên nhân:**

1. ETH không được forward đúng
2. Token chưa approve
3. Router address sai

**Giải pháp:**

1. Check Safe balance >= fee
2. Execute approval transaction FIRST
3. Verify router address đúng
4. Retry execute

### Error: "Value not forwarded correctly"

**Nguyên nhân:** Safe execution có vấn đề

**Giải pháp:**

1. Check console logs
2. Verify transaction on Etherscan
3. Check Router balance increase
4. Contact support nếu vẫn lỗi

## 📊 Expected Flow

### Successful CCIP Transfer

```
1. User: Calculate fee → 0.002 ETH
2. UI: Check Safe balance → 0.015 ETH ✓
3. User: Click "Propose Transfer"
4. Backend: Create 2 transactions (approval + ccipSend)
5. UI: Show success message
6. User: Go to Pending Transactions
7. User: Confirm approval tx (if needed)
8. User: Execute approval tx → Success ✓
9. User: Confirm CCIP tx (if needed)
10. User: Execute CCIP tx → Success ✓
11. Safe: Send 0.002 ETH to Router
12. Router: Process CCIP transfer
13. CCIP: Emit CCIPMessageSent event
14. UI: Show verification success
15. User: Track on CCIP Explorer
16. Destination: Receive tokens! 🎉
```

## 🔗 Useful Links

- **Sepolia Etherscan:** https://sepolia.etherscan.io/
- **CCIP Explorer:** https://ccip.chain.link/
- **Safe Transaction Service:** https://safe-transaction-sepolia.safe.global/
- **Chainlink Faucet:** https://faucets.chain.link/

## 📞 Support

Nếu vẫn gặp vấn đề:

1. Check console logs (F12)
2. Copy full error message
3. Check transaction hash on Etherscan
4. Provide Safe address và transaction details

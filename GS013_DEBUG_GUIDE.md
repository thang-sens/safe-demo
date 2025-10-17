# 🔍 GS013 Error - Debug Guide

## 🎯 Objective

Debug và fix lỗi GS013 khi execute CCIP transfer qua Safe multisig.

---

## 🔎 Vấn Đề Đã Phát Hiện

### ❌ Root Cause #1: Missing Token Approval

Khi CCIP transfer cần gửi ERC20 tokens:

1. **Approval** phải được thực hiện TRƯỚC
2. Safe phải approve token cho CCIP Router
3. Nếu thiếu approval → ccipSend fails → GS013

**Fix Applied:**

- ✅ Check token allowance trước khi propose
- ✅ Tự động thêm approval transaction nếu cần
- ✅ Batch approval + ccipSend thành 1 Safe transaction

### ❌ Root Cause #2: Incorrect Function Encoding

Code cũ encode sai call data cho CCIP Router.

**Fix Applied:**

- ✅ Dùng `encodeFunctionData` từ viem thay vì manual encoding
- ✅ Định nghĩa proper ABI cho ccipSend function

---

## 🧪 Debug Steps

### Step 1: Open Browser Console

1. Open browser DevTools (F12)
2. Go to Console tab
3. Clear console (Ctrl/Cmd + L)

### Step 2: Propose CCIP Transfer

Khi bạn click "Propose CCIP Transfer", bạn sẽ thấy logs:

```
[CCIP Build] Current allowance: 0, needed: 1000000000000000000
[CCIP Build] Insufficient allowance - adding approval transaction
[CCIP Build] CCIP send call data length: XXX bytes
[CCIP Build] Fee (value): 2000000000000000 wei (0.002 ETH)
[CCIP Build] Total transactions to execute: 2
[CCIP] Built 2 transaction(s): [...]
[CCIP] Multiple transactions - batching approval + send
```

### Step 3: Analyze Logs

#### ✅ Good Case (Should Work):

```javascript
// Single transaction (token already approved)
[CCIP] Built 1 transaction(s): [
  {
    to: "0xROUTER_ADDRESS",
    value: "2000000000000000", // Fee
    data: "0x96f4e9f9...", // ccipSend encoded
    operation: 0
  }
]
```

#### ⚠️ Needs Approval:

```javascript
// Multiple transactions (approval + send)
[CCIP] Built 2 transaction(s): [
  {
    to: "0xTOKEN_ADDRESS", // Token contract
    value: "0",
    data: "0x095ea7b3...", // approve(router, amount)
    operation: 0
  },
  {
    to: "0xROUTER_ADDRESS",
    value: "2000000000000000",
    data: "0x96f4e9f9...", // ccipSend
    operation: 0
  }
]
```

### Step 4: Check Transaction on Etherscan

Sau khi execute fails với GS013:

1. Lấy transaction hash từ error hoặc Safe UI
2. Mở trên Etherscan: `https://sepolia.etherscan.io/tx/0x...`
3. Nhấn "Click to see More"
4. Xem "Input Data" - decode nó
5. Xem "State Changes" - có thể thấy revert reason cụ thể hơn

---

## 🔧 Common Issues & Fixes

### Issue 1: Insufficient Token Balance

**Symptom:**

```
Error: execution reverted: ERC20: transfer amount exceeds balance
```

**Fix:**

- Đảm bảo Safe có đủ tokens
- Check balance: `balanceOf(safeAddress)` ≥ `amount`

**Test:**

```javascript
// In browser console
const tokenAddress = "0xTOKEN_ADDRESS";
const abi = ["function balanceOf(address) view returns (uint256)"];
const token = new ethers.Contract(tokenAddress, abi, provider);
const balance = await token.balanceOf(safeAddress);
console.log("Token balance:", ethers.formatUnits(balance, 18));
```

### Issue 2: Insufficient ETH for Fees

**Symptom:**

```
Error: insufficient funds for gas * price + value
```

**Fix:**

- Safe cần đủ ETH để trả fee
- Fee được tính trong `calculateCCIPFee()`

**Test:**

```javascript
const ethBalance = await provider.getBalance(safeAddress);
console.log("ETH balance:", ethers.formatEther(ethBalance));
console.log("Fee needed:", feeEstimate.feeInEther);
```

### Issue 3: Token Not Approved

**Symptom:**

```
Error: ERC20: insufficient allowance
```

**Fix:**

- Đã được fix bằng cách tự động thêm approval transaction
- Verify allowance:

```javascript
const allowance = await token.allowance(safeAddress, routerAddress);
console.log("Current allowance:", ethers.formatUnits(allowance, 18));
```

### Issue 4: Wrong CCIP Router Address

**Symptom:**

```
Error: Transaction reverted without a reason
```

**Fix:**

- Kiểm tra router address trong `ccipConfig.ts`
- Verify trên Chainlink docs: https://docs.chain.link/ccip/supported-networks/v1_2_0/testnet

**Correct Addresses:**

- Sepolia: `0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59`
- Arbitrum Sepolia: `0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165`

### Issue 5: Wrong Chain Selector

**Symptom:**

```
Error: InvalidChainSelector
```

**Fix:**

- Verify chain selectors trong `ccipConfig.ts`

**Correct Selectors:**

- Sepolia → Arbitrum Sepolia: `3478487238524512106`
- Sepolia → Avalanche Fuji: `14767482510784806043`

### Issue 6: Batched Transaction Fails

**Symptom:**

```
GS013 error when executing multi-call transaction
```

**Possible Causes:**

1. MultiSend contract not deployed
2. Batched transactions not properly encoded
3. One of the sub-calls fails

**Debug:**

```javascript
// Check if MultiSend is used
console.log("Transaction to:", transaction.to);
// If to === MultiSend contract address, it's batched

// Decode MultiSend data
// MultiSend encodes: operation + to + value + dataLength + data for each call
```

---

## 🎯 Testing Checklist

### Before Proposing:

- [ ] Safe có đủ token balance
- [ ] Safe có đủ ETH cho gas + CCIP fee
- [ ] Token address đúng (check ccipConfig.ts)
- [ ] Router address đúng (check ccipConfig.ts)
- [ ] Chain selector đúng (check ccipConfig.ts)
- [ ] Recipient address valid (checksum)

### After Proposing:

- [ ] Check console logs - có bao nhiêu transactions?
- [ ] Nếu 2 transactions → approval đang được thêm
- [ ] Safe TX hash xuất hiện
- [ ] Transaction xuất hiện trong Pending list

### After Confirming:

- [ ] Đủ signatures (threshold reached)
- [ ] Execute button xuất hiện

### After Executing:

- [ ] ✅ Success → Transaction hash xuất hiện
- [ ] ❌ GS013 → Tiếp tục debug

---

## 🛠️ Advanced Debugging

### Simulate Transaction Locally

Trước khi execute, có thể simulate:

```javascript
// Get Safe transaction
const apiKit = new SafeApiKit({...});
const tx = await apiKit.getTransaction(safeTxHash);

// Simulate using Tenderly or Hardhat Fork
// This will show exact revert reason
```

### Check CCIP Router Contract

```javascript
const routerABI = [...]; // CCIP Router ABI
const router = new ethers.Contract(routerAddress, routerABI, provider);

// Check if ccipSend exists
const hasFunction = router.interface.fragments.some(
  f => f.name === 'ccipSend'
);
console.log("Router has ccipSend:", hasFunction);

// Try calling getFee to verify router works
try {
  const message = {...};
  const fee = await router.getFee(destinationChainSelector, message);
  console.log("Fee from router:", fee);
} catch (e) {
  console.error("Router error:", e);
}
```

### Decode Transaction Data

```javascript
// Decode Safe transaction
const safeABI = [...]; // Safe ABI
const iface = new ethers.Interface(safeABI);

try {
  const decoded = iface.parseTransaction({ data: tx.data });
  console.log("Decoded Safe call:", decoded);
} catch (e) {
  // Might be MultiSend
  console.log("Not a direct Safe call, possibly MultiSend");
}
```

---

## 📚 Resources

- [Safe Contract Errors](https://github.com/safe-global/safe-contracts/blob/main/docs/error_codes.md)
- [CCIP Supported Networks](https://docs.chain.link/ccip/supported-networks)
- [CCIP Router API](https://docs.chain.link/ccip/api-reference/i-router-client)
- [Etherscan Sepolia](https://sepolia.etherscan.io/)

---

## 🆘 Still Stuck?

Nếu vẫn gặp GS013, cung cấp:

1. **Console logs** đầy đủ
2. **Transaction hash** (từ Etherscan)
3. **Safe address**
4. **Token & amount** đang transfer
5. **Destination network**

---

**Last Updated:** October 16, 2025

# ⚡ GS013 Quick Debug Checklist

## 🔥 Test Ngay

### 1️⃣ Mở Browser Console

```
F12 → Console tab → Clear console
```

### 2️⃣ Propose CCIP Transfer

Click "Propose CCIP Transfer" và xem logs:

**Bạn sẽ thấy:**

```
[CCIP Build] Current allowance: XXX, needed: YYY
[CCIP Build] Total transactions to execute: 1 or 2
[CCIP] Built X transaction(s)
```

### 3️⃣ Check Logs

#### ✅ Nếu thấy "1 transaction":

```
[CCIP] Single transaction - no approval needed
```

→ Token đã được approve rồi

#### ⚠️ Nếu thấy "2 transactions":

```
[CCIP] Insufficient allowance - adding approval transaction
[CCIP] Multiple transactions - batching approval + send
```

→ Đang thêm approval

### 4️⃣ Xác Minh Balance

Paste vào console:

```javascript
// Check ETH balance
const ethBal = await provider.getBalance("YOUR_SAFE_ADDRESS");
console.log("ETH:", ethers.formatEther(ethBal));

// Check token balance
const tokenAddr = "TOKEN_ADDRESS"; // From ccipConfig
const tokenABI = ["function balanceOf(address) view returns (uint256)"];
const token = new ethers.Contract(tokenAddr, tokenABI, provider);
const tokBal = await token.balanceOf("YOUR_SAFE_ADDRESS");
console.log("Token:", ethers.formatUnits(tokBal, 18));
```

### 5️⃣ Execute & Check Etherscan

Khi execute fails:

1. Copy transaction hash
2. Mở: `https://sepolia.etherscan.io/tx/HASH`
3. Xem "State" tab → có error message cụ thể hơn GS013

---

## 🎯 Common Fixes

### Fix #1: Insufficient Token

```bash
# Send tokens to Safe
# From your wallet → Safe address
```

### Fix #2: Insufficient ETH

```bash
# Send ETH to Safe for gas fees
# Ít nhất 0.01 ETH
```

### Fix #3: Wrong Config

Check `client/src/lib/ccipConfig.ts`:

```typescript
// Sepolia config
{
  routerAddress: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59", // ✅ ĐÚNG
  chainSelector: "16015286601757825753", // ✅ ĐÚNG
}
```

Verify với: https://docs.chain.link/ccip/supported-networks/v1_2_0/testnet

---

## 🚨 Vẫn Lỗi?

Post logs từ console:

- `[CCIP Build]` logs
- `[CCIP]` logs
- Etherscan link

Full debug guide: [GS013_DEBUG_GUIDE.md](./GS013_DEBUG_GUIDE.md)

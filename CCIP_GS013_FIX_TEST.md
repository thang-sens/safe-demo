# ⚡ CCIP GS013 Fix - Test Guide

## 🔧 Changes Applied

### 1. Tăng Gas Limit Destination

```typescript
// OLD: 500,000 gas
const gasLimit = 500000;

// NEW: 2,000,000 gas
const gasLimit = 2000000;
```

**Lý do**: Destination chain execution cần nhiều gas hơn, nhất là cho complex token transfers.

### 2. Fix ExtraArgs Encoding

```typescript
// OLD: Dùng parseAbiParameters (có thể sai format)
const extraArgsV2Encoded = encodeAbiParameters(
  parseAbiParameters("uint256, bool"),
  [BigInt(gasLimit), false]
);

// NEW: Dùng array of type objects (đúng format)
const extraArgsV2Encoded = encodeAbiParameters(
  [{ type: "uint256" }, { type: "bool" }],
  [BigInt(gasLimit), false]
);
```

### 3. Fix Receiver Encoding

```typescript
// OLD:
const receiverBytes = encodeAbiParameters(parseAbiParameters("address"), [
  params.recipientAddress,
]);

// NEW:
const receiverBytes = encodeAbiParameters(
  [{ type: "address" }],
  [params.recipientAddress]
);
```

### 4. Enhanced Debug Logging

- Log receiver address và receiver bytes
- Log complete CCIP message structure trước khi encode
- Log token amounts với format rõ ràng

## 🚀 Testing Steps

### 1. Clear Cache & Restart

```bash
# Stop Vite dev server (Ctrl+C)
cd /Users/phinguyen/Documents/self/safe-demo/client

# Clear Vite cache
rm -rf node_modules/.vite

# Restart
npm run dev
```

### 2. Hard Refresh Browser

- Chrome/Edge: `Cmd+Shift+R` (Mac) hoặc `Ctrl+Shift+F5` (Windows)
- Firefox: `Cmd+Shift+R` (Mac) hoặc `Ctrl+F5` (Windows)
- Làm 2-3 lần để chắc chắn

### 3. Test CCIP Transfer

1. Login với Web3Auth
2. Load Safe trong Company Dashboard
3. Go to CCIP tab
4. Fill form:
   - **Destination Network**: Base Sepolia
   - **Token**: CCIP-BnM (hoặc LINK)
   - **Amount**: 0.001
   - **Recipient**: Your address hoặc any valid address
5. Click **"Calculate Fee"**
6. Check console for logs:
   ```
   [CCIP Build] Receiver address: 0x...
   [CCIP Build] Receiver bytes: 0x000000000000000000000000...
   [CCIP Build] ExtraArgs V2 (gasLimit=2000000): 0x97a657c9...
   [CCIP Build] Complete message structure: {...}
   ```
7. Click **"Propose Transfer"**
8. **Confirm** transaction
9. **Execute** transaction

### 4. Expected Console Output

**✅ Success Pattern:**

```javascript
[CCIP Build] Current allowance: 100000, needed: 1000
[CCIP Build] Receiver address: 0x5202487A23D600A199CFD4e7d28Df36006064681
[CCIP Build] Receiver bytes: 0x0000000000000000000000005202487a23d600a199cfd4e7d28df36006064681
[CCIP Build] ExtraArgs V2 (gasLimit=2000000): 0x97a657c900000000000000000000000000000000000000000000000000000000001e84800000000000000000000000000000000000000000000000000000000000000000
[CCIP Build] Complete message structure: {
  destinationChainSelector: "10344971235874465080",
  message: {
    receiver: "0x0000000000000000000000005202487a23d600a199cfd4e7d28df36006064681",
    data: "0x",
    tokenAmounts: [{ token: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", amount: "1000" }],
    feeToken: "0x0000000000000000000000000000000000000000",
    extraArgs: "0x97a657c9..."
  }
}
[CCIP Build] CCIP send call data length: 1098 bytes
[CCIP Build] Fee (value): 65324891045632 wei (0.000065324891045632 ETH)

Proposing transaction to Safe: 0xcF16809e8f41c6ECd613923a59c1605E1a41F7aD
✍️ Signature: 0x...
Transaction proposed successfully: 0x...

Confirming transaction: 0x...
Transaction confirmed successfully

Executing transaction: 0x...
🔐 Adding signature for 0x...: { r, s, v, fullSig }
Transaction executed successfully: 0xabc123def...
```

## 🔍 What Changed?

### Before vs After

| Aspect             | Before                                | After                                     |
| ------------------ | ------------------------------------- | ----------------------------------------- |
| Gas Limit          | 500,000                               | 2,000,000                                 |
| ExtraArgs Encoding | `parseAbiParameters("uint256, bool")` | `[{ type: "uint256" }, { type: "bool" }]` |
| Receiver Encoding  | `parseAbiParameters("address")`       | `[{ type: "address" }]`                   |
| Debug Logging      | Minimal                               | Extensive                                 |

### Why This Should Work?

1. **Gas Limit 2M**: Đủ cho hầu hết destination chain executions
2. **Correct Type Format**: `[{ type: "uint256" }]` là format chuẩn của Viem
3. **Proper Receiver Encoding**: ABI-encoded address đúng chuẩn CCIP
4. **Better Debugging**: Dễ dàng identify vấn đề nếu vẫn lỗi

## 🐛 If Still GS013

Nếu vẫn lỗi GS013 sau fix này, check:

### 1. Chain Selector Format

Mở `client/src/lib/ccipConfig.ts`:

```typescript
"ethereum-sepolia": {
  chainSelector: "16015286601757825753", // ✅ Must be decimal string
  // NOT: "0x..." ❌ Hex format will cause issues
}
```

### 2. Manual Gas Estimation Test

Trong browser console:

```javascript
const provider = new ethers.BrowserProvider(window.ethereum);
const routerAddress = "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59";

// Get transaction data from console logs
const txData = "0x96f4e9f9..."; // From [CCIP Build] logs

// Try estimating gas
try {
  const gasEstimate = await provider.estimateGas({
    from: "0xcF16809e8f41c6ECd613923a59c1605E1a41F7aD", // Safe address
    to: routerAddress,
    value: "65324891045632", // Fee from logs
    data: txData,
  });
  console.log("✅ Gas estimate SUCCESS:", gasEstimate.toString());
} catch (error) {
  console.error("❌ Gas estimate FAILED:", error);
  // If this fails, transaction data is wrong!
}
```

### 3. Compare With Working Transaction

Find a successful CCIP transfer on Sepolia Etherscan:

- Go to: https://sepolia.etherscan.io/address/0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59
- Click "Transactions" tab
- Find transaction with method "ccipSend"
- Click "View Input As" → "Original"
- Compare with your transaction data

## 📊 Success Criteria

Transaction thành công khi:

- ✅ No GS013 error during execution
- ✅ Transaction hash returned
- ✅ Can track CCIP message with message ID
- ✅ Receiver gets tokens on destination chain (sau vài phút)

## 📞 Report Results

Sau khi test, báo cáo:

1. **Console logs** (especially [CCIP Build] section)
2. **Transaction hash** nếu thành công
3. **Error message** nếu vẫn fail
4. **Gas estimation result** nếu đã test manual

---

**Good luck! 🚀**

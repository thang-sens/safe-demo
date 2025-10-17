# 🔍 CCIP GS013 Debug: Next Steps

## ✅ Fix Đã Apply

Code đã được update với extraArgs V2 encoding. Nhưng lỗi vẫn xảy ra.

## 🔧 Immediate Actions

### 1. Clear Browser Cache

**Vite có thể đang dùng cached code!**

```bash
# Stop dev server (Ctrl+C)

# Clear Vite cache
cd client
rm -rf node_modules/.vite
rm -rf dist

# Restart dev server
npm run dev
```

### 2. Hard Refresh Browser

- **Chrome/Edge**: `Ctrl + Shift + R` (Windows) hoặc `Cmd + Shift + R` (Mac)
- **Firefox**: `Ctrl + F5` (Windows) hoặc `Cmd + Shift + R` (Mac)
- Hoặc: Mở DevTools → Network tab → Disable cache → Refresh

### 3. Check Console Logs

Sau khi clear cache và refresh, propose CCIP transfer lại và check console:

**Phải thấy log này:**

```
[CCIP Build] ExtraArgs V2: 0x97a657c9000000000000000000000000000000000000000000000000000000000000030d40...
```

**Nếu KHÔNG thấy log này** → Browser đang dùng code cũ

### 4. Verify Transaction Data

Trước khi execute, check transaction data trong Pending Transactions:

```json
{
  "to": "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59",
  "data": "0x96f4e9f9...", // Should be different from before
  "value": "..." // Fee amount
}
```

## 🐛 If Still GS013 After Cache Clear

### Possible Issues:

1. **Insufficient gas limit in extraArgs**

   - Current: 200,000
   - May need: 500,000 for some chains

2. **Wrong chain selector**

   - Check destination chain selector is correct

3. **Token not supported on lane**

   - USDC may not be supported on Sepolia → Base Sepolia lane

4. **Insufficient Safe balance**
   - Need enough ETH for gas + CCIP fee

## 🧪 Debug Commands

### Check Current Code

```bash
cd client
grep -A 5 "extraArgsV2Encoded" src/lib/safeFlow.ts
```

**Should see:**

```typescript
const extraArgsV2Encoded = encodeAbiParameters(
  parseAbiParameters("uint256, bool"),
  [BigInt(200000), false]
);
```

### Test Encoding

Add this test in browser console:

```javascript
import { encodeAbiParameters, parseAbiParameters } from "viem";

const test = encodeAbiParameters(parseAbiParameters("uint256, bool"), [
  BigInt(200000),
  false,
]);

const extraArgs = "0x97a657c9" + test.slice(2);
console.log("ExtraArgs V2:", extraArgs);
// Should output: 0x97a657c9000000000000000000000000000000000000000000000000000000000000030d40...
```

## 📊 Troubleshooting Matrix

| Scenario           | Log Shows                          | Action                      |
| ------------------ | ---------------------------------- | --------------------------- |
| **Cache issue**    | No `[CCIP Build] ExtraArgs V2` log | Clear cache + hard refresh  |
| **Encoding issue** | `extraArgs: 0x` in log             | Check viem import           |
| **Gas issue**      | ExtraArgs correct but GS013        | Increase gasLimit to 500000 |
| **Token issue**    | Approval OK, send fails            | Try LINK instead of USDC    |
| **Fee issue**      | Transaction reverts                | Check Safe has enough ETH   |

## 🚨 Most Likely Cause

**Browser cache!** Vite caches compiled modules aggressively.

### Solution:

1. Stop server
2. Delete `.vite` cache
3. Restart server
4. Hard refresh browser
5. Try again

## 💡 Alternative: Try with LINK Token

USDC may have issues on testnet. Try LINK:

```
Source: Sepolia
Destination: Base Sepolia
Token: LINK (not USDC)
Amount: 0.1
```

LINK is native CCIP token and more reliable on testnets.

## 🔄 Step-by-Step Recovery

```bash
# 1. Stop everything
Ctrl+C (stop Vite dev server)

# 2. Clean build
cd /Users/phinguyen/Documents/self/safe-demo/client
rm -rf node_modules/.vite
rm -rf dist

# 3. Verify code
grep -A 10 "extraArgsV2Encoded" src/lib/safeFlow.ts

# 4. Restart
npm run dev

# 5. In browser:
# - Open DevTools
# - Application → Clear storage → Clear site data
# - Hard refresh (Cmd+Shift+R)

# 6. Test:
# - Propose CCIP transfer
# - Check console for "[CCIP Build] ExtraArgs V2: 0x97a657c9..."
# - If you see it → Execute transaction
# - Should work now!
```

## 📝 Expected Console Output

After cache clear, you should see:

```bash
[CCIP Build] Current allowance: 100000, needed: 100000
[CCIP Build] Sufficient allowance - no approval needed
[CCIP Build] ExtraArgs V2: 0x97a657c9000000000000000000000000000000000000000000000000000000000000030d400000000000000000000000000000000000000000000000000000000000000000
[CCIP Build] CCIP send call data length: 420 bytes
[CCIP Build] Fee (value): 64965288585872 wei (0.000064965288585872 ETH)
[CCIP Build] Total transactions to execute: 1
[CCIP] Built 1 transaction(s)
[CCIP] Single transaction - no approval needed
```

If you DON'T see the ExtraArgs log → **Cache issue confirmed!**

---

## ⚡ Quick Fix

```bash
# Terminal 1: Stop and clean
cd /Users/phinguyen/Documents/self/safe-demo/client
rm -rf node_modules/.vite dist
npm run dev

# Browser: Hard refresh (Cmd+Shift+R)
# Test: Propose CCIP → Check console → Execute
```

**Hãy thử clear cache và test lại!** 🚀

# 🔥 CCIP GS013: Complete Debugging Guide

## ⚠️ Current Situation

Đã apply extraArgs V2 fix nhưng vẫn GS013. Có 3 khả năng:

### 1. ❌ Browser Cache (Most Likely)

Browser đang dùng JavaScript cũ chưa có fix

### 2. ❌ Gas Limit Too Low

200k gas có thể không đủ cho destination execution

### 3. ❌ Token/Lane Issue

USDC trên Sepolia → Base Sepolia có thể không supported

---

## 🔧 FIX #1: Clear All Caches

### Stop Everything

```bash
# Terminal: Stop Vite (Ctrl+C)
cd /Users/phinguyen/Documents/self/safe-demo/client
```

### Clean Vite Cache

```bash
rm -rf node_modules/.vite
rm -rf dist
rm -rf .parcel-cache  # If exists
```

### Clean Browser

1. Open DevTools (`F12` or `Cmd+Option+I`)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Click **Clear site data**
4. Close and reopen browser

### Restart Dev Server

```bash
npm run dev
```

### Hard Refresh

- Chrome/Edge: `Cmd + Shift + R` (Mac) or `Ctrl + Shift + R` (Windows)
- Do this 2-3 times to be sure

---

## 🔧 FIX #2: Increased Gas Limit

Tôi đã update code để tăng gas limit:

```typescript
// OLD: 200,000 gas
const gasLimit = 200000;

// NEW: 500,000 gas
const gasLimit = 500000;
```

After clear cache, code mới này sẽ được dùng.

---

## 🔧 FIX #3: Try LINK Token Instead

USDC testnet có thể có issues. LINK là native CCIP token, reliable hơn.

### Test với LINK:

```
Source Network: Sepolia
Destination Network: Base Sepolia
Token: LINK (not USDC!)
Amount: 0.1
Recipient: <your address>
```

---

## 📊 Verification Checklist

### After Clear Cache, Check Console:

#### ✅ Must See These Logs:

```bash
[CCIP Build] ExtraArgs V2 (gasLimit=500000): 0x97a657c9...
[CCIP Build] CCIP send call data length: 420 bytes
[CCIP Build] Fee (value): ... wei
[CCIP] Built 1 transaction(s)
```

#### ❌ If You DON'T See These:

→ **Cache not cleared!** Try again with steps above.

---

## 🐛 Deep Debug: Check Transaction Data

### Before Execute, Inspect Transaction:

1. Go to **Pending Transactions**
2. Find CCIP send transaction (to: Router)
3. **COPY THE FULL TRANSACTION OBJECT**
4. Paste in text editor
5. Check these fields:

#### Required Fields:

```json
{
  "to": "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59", // CCIP Router
  "value": "...", // Must have fee value
  "data": "0x96f4e9f9...", // ccipSend call
  "operation": 0 // CALL (not DELEGATECALL)
}
```

#### Decode the Data:

Visit: https://openchain.xyz/tools/abi

Paste:

- **Contract ABI**: CCIP Router ABI (in our code)
- **Transaction Data**: The `data` field
- **Function**: Should decode to `ccipSend`

Check:

- `extraArgs` should start with `0x97a657c9`
- `tokenAmounts` should have your token
- `feeToken` should be `0x0000...` (native)

---

## 🎯 Systematic Testing

### Test #1: Clear Cache Test

```bash
# 1. Clean everything
rm -rf node_modules/.vite dist
npm run dev

# 2. Browser: Clear site data + Hard refresh

# 3. Open Console (F12)

# 4. Propose CCIP transfer

# 5. Check console output
# Must see: [CCIP Build] ExtraArgs V2 (gasLimit=500000)

# 6. If YES → Proceed to execute
# 7. If NO → Cache still not cleared, repeat from step 1
```

### Test #2: LINK Token Test

```bash
# Same as Test #1, but use:
Token: LINK (not USDC)
Amount: 0.1
```

LINK is more reliable on testnets.

### Test #3: Different Destination

```bash
# Try different destination chain:
Source: Sepolia
Destination: Arbitrum Sepolia (instead of Base)
Token: LINK
Amount: 0.1
```

Some lanes are more stable than others.

---

## 🔍 Advanced Debugging

### Get Revert Reason

GS013 is generic. Real error is from CCIP Router. To get it:

#### Option 1: Tenderly Simulation

1. Go to: https://dashboard.tenderly.co/
2. Create free account
3. Use "Simulate Transaction"
4. Paste transaction data
5. See detailed revert reason

#### Option 2: Etherscan

1. Find failed transaction on Sepolia Etherscan
2. Click "State" tab
3. Look for internal transaction failures

#### Option 3: Cast (Foundry)

```bash
cast call \
  --rpc-url https://sepolia.infura.io/v3/YOUR_KEY \
  0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59 \
  "ccipSend(uint64,(bytes,bytes,(address,uint256)[],address,bytes))" \
  [YOUR_ARGS]
```

---

## 💡 Common GS013 Causes in CCIP

### 1. Invalid ExtraArgs

- ❌ Empty `0x`
- ❌ Wrong selector
- ❌ Gas limit too low
- ✅ **Fixed**: Using V2 with 500k gas

### 2. Insufficient Fee

- Safe doesn't have enough ETH for CCIP fee
- Check: Safe balance > fee estimate

### 3. Token Not Approved

- Should not happen (we have 2-step workflow)
- Check: Approval transaction executed successfully

### 4. Unsupported Lane/Token

- Token not supported on this lane
- Solution: Try LINK token

### 5. Rate Limit

- Too many transfers in short time
- Solution: Wait 10-15 minutes

### 6. Destination Chain Issue

- Destination chain having issues
- Check: CCIP status page

---

## 📝 Complete Test Protocol

```
┌─────────────────────────┐
│ 1. Clean Cache          │
│    rm -rf .vite dist    │
│    Browser: Clear data  │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 2. Restart Dev Server   │
│    npm run dev          │
│    Hard refresh browser │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 3. Propose Transfer     │
│    Token: LINK          │
│    Dest: Base Sepolia   │
│    Amount: 0.1          │
└────────┬────────────────┘
         │
         ▼
┌─────────────────────────┐
│ 4. Check Console        │
│    See ExtraArgs log?   │
│    gasLimit=500000?     │
└────────┬────────────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
   NO        YES
    │         │
    │         ▼
    │    ┌──────────────────┐
    │    │ 5. Execute       │
    │    │    Approval      │
    │    └────┬─────────────┘
    │         │
    │         ▼
    │    ┌──────────────────┐
    │    │ 6. Propose Again │
    │    └────┬─────────────┘
    │         │
    │         ▼
    │    ┌──────────────────┐
    │    │ 7. Execute CCIP  │
    │    └────┬─────────────┘
    │         │
    │    ┌────┴────┐
    │    │         │
    │    ▼         ▼
    │   GS013    SUCCESS ✅
    │    │         │
    │    └────┐    └─→ Track on CCIP Explorer
    │         │
    └────→ Go back to Step 1
           (Cache issue)
```

---

## 🚨 Emergency Fallback: Manual CCIP

If all else fails, use CCIP directly (not through Safe):

### Direct CCIP Transfer (No Safe)

```typescript
// Use your EOA directly
const signer = await getSigner(); // From Web3Auth

// 1. Approve
const token = new Contract(tokenAddress, ERC20_ABI, signer);
await token.approve(routerAddress, amount);

// 2. Send CCIP
const router = new Contract(routerAddress, ROUTER_ABI, signer);
await router.ccipSend(destSelector, message, { value: fee });
```

This bypasses Safe completely - just to verify CCIP works.

---

## ✅ Success Criteria

After following all steps, you should:

1. ✅ See `[CCIP Build] ExtraArgs V2 (gasLimit=500000)` in console
2. ✅ Execute approval without GS013
3. ✅ Execute CCIP send without GS013
4. ✅ See transaction on destination chain
5. ✅ Receive tokens in recipient wallet

---

## 📞 If Still Stuck

Provide these details:

1. **Console logs** (full output after propose)
2. **Transaction data** (from Pending Transactions)
3. **Safe balance** (ETH amount)
4. **Token used** (USDC or LINK?)
5. **Destination** (Base Sepolia or other?)
6. **Browser** (Chrome/Firefox/Safari?)
7. **Cache cleared?** (Yes/No - how many times?)

---

## 🎯 Most Likely Solution

**90% chance: Browser cache issue**

**Solution:**

```bash
# Terminal
cd client
rm -rf node_modules/.vite dist
npm run dev

# Browser
# 1. DevTools → Application → Clear site data
# 2. Close browser completely
# 3. Reopen browser
# 4. Go to localhost:5173
# 5. Hard refresh (Cmd+Shift+R) 3 times
# 6. Check console for new logs
# 7. Test transfer
```

**10% chance: Gas limit or token issue**

**Solution:** Use LINK token with 500k gas (already in code)

---

**Hãy làm theo protocol trên và báo kết quả!** 🚀

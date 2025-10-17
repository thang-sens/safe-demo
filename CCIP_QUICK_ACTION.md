# ⚡ CCIP GS013: Quick Action Plan

## 🎯 TL;DR

**Vấn đề**: GS013 vẫn xảy ra sau fix  
**Nguyên nhân khả năng cao nhất**: **Browser cache**  
**Giải pháp**: Clear cache + tăng gas limit + test với LINK

---

## ✅ DO THIS NOW (5 Minutes)

### Step 1: Clean Everything (Terminal)

```bash
cd /Users/phinguyen/Documents/self/safe-demo/client
rm -rf node_modules/.vite
rm -rf dist
npm run dev
```

### Step 2: Clear Browser (Browser)

1. Press `F12` (or `Cmd+Option+I` on Mac)
2. Go to **Application** tab
3. Click **Clear site data**
4. **Close browser completely**
5. Reopen browser
6. Go to `localhost:5173`
7. Press `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows) **3 times**

### Step 3: Test with LINK (UI)

```
1. Open Safe Dashboard
2. CCIP Transfer tab
3. Fill form:
   - Source: Sepolia
   - Destination: Base Sepolia
   - Token: LINK ← NOT USDC!
   - Amount: 0.1
   - Recipient: <your address>
4. Click "Propose Transfer"
```

### Step 4: Check Console (Browser)

**MUST see this:**

```
[CCIP Build] ExtraArgs V2 (gasLimit=500000): 0x97a657c9...
```

**If you DON'T see it** → Cache not cleared! Go back to Step 1.

**If you SEE it** → Proceed to execute!

### Step 5: Execute

1. Execute approval (if needed)
2. Propose again
3. Execute CCIP send
4. ✅ Should work now!

---

## 🔍 What Changed?

### Fix #1: ExtraArgs V2 Encoding ✅

```typescript
// Before: Empty (wrong)
extraArgs: "0x";

// After: Properly encoded
extraArgs: "0x97a657c9000..."; // V2 format
```

### Fix #2: Increased Gas Limit ✅

```typescript
// Before: 200,000 gas
gasLimit: 200000;

// After: 500,000 gas (safer)
gasLimit: 500000;
```

### Fix #3: Better Logging ✅

```
[CCIP Build] ExtraArgs V2 (gasLimit=500000): 0x97a657c9...
```

---

## 🎯 Success Checklist

- [ ] Cleaned `.vite` cache folder
- [ ] Cleared browser site data
- [ ] Hard refreshed 3 times
- [ ] Restarted dev server
- [ ] See new console logs with `gasLimit=500000`
- [ ] Used LINK token (not USDC)
- [ ] Executed approval successfully
- [ ] Executed CCIP send successfully
- [ ] No GS013 error!

---

## 🐛 If Still GS013

### Check These:

1. **Console shows old logs?**

   ```
   [CCIP Build] ExtraArgs V2: 0x97a657c9...  ← OLD (no gasLimit)
   ```

   → Cache still not cleared! Close browser completely and try again.

2. **Console shows new logs?**

   ```
   [CCIP Build] ExtraArgs V2 (gasLimit=500000): 0x97a657c9...  ← NEW
   ```

   → Cache OK! Issue might be:

   - Insufficient Safe balance
   - Token not supported on lane
   - Try different destination (Arbitrum Sepolia)

3. **No console logs at all?**
   → Dev server not running or wrong URL

---

## 💡 Why LINK Instead of USDC?

- LINK is native CCIP token
- More reliable on testnets
- Better supported across lanes
- USDC testnet can have routing issues

---

## 📊 Expected Flow

```
Clear Cache → Restart Server → Hard Refresh → Test with LINK
     ↓              ↓               ↓              ↓
  ✅ Done       ✅ Running      ✅ Loaded      ✅ Proposed
                                                     ↓
                                            See new console logs?
                                                     ↓
                                            ┌────────┴────────┐
                                            ↓                 ↓
                                          YES               NO
                                            ↓                 ↓
                                     Execute CCIP    Go back to start
                                            ↓
                                    Success! 🎉
```

---

## 🚀 Quick Commands

```bash
# One-line clean
cd /Users/phinguyen/Documents/self/safe-demo/client && rm -rf node_modules/.vite dist && npm run dev

# Then in browser:
# F12 → Application → Clear site data → Close browser → Reopen → Cmd+Shift+R x3
```

---

## 📝 What to Report Back

After testing, tell me:

1. ✅ or ❌ Cache cleared (saw new console logs?)
2. ✅ or ❌ Used LINK token
3. ✅ or ❌ Approval executed
4. ✅ or ❌ CCIP executed
5. ✅ or ❌ No GS013!

If still GS013, paste:

- Full console logs
- Transaction data from Pending Transactions

---

## 🎯 Key Points

1. **Cache is enemy #1** - Must be cleared completely
2. **LINK > USDC** - More reliable on testnets
3. **500k gas** - Increased from 200k for safety
4. **Console logs** - Your best friend for debugging
5. **Hard refresh** - Do it multiple times

---

**Hãy làm theo 5 steps trên ngay bây giờ!** ⚡

Token sẽ được gửi thành công lần này! 🚀

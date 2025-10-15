# 🔍 Browser Cache Clearing Instructions

## ⚠️ CRITICAL: Clear Browser Cache

The GS013 fix is in the code, but your browser is loading OLD cached JavaScript.

## 🚀 Step-by-Step Fix

### Step 1: Close ALL browser tabs for `localhost:5173`

### Step 2: Clear Browser Data
1. Open a **NEW** browser window
2. Press `Ctrl + Shift + Delete` (Windows) or `Cmd + Shift + Delete` (Mac)
3. Select:
   - ✅ **Cached images and files**
   - ✅ **Cookies and other site data** (for localhost only)
4. Time range: **Last hour**
5. Click **"Clear data"**

### Step 3: Hard Reload
1. Go to `http://localhost:5173`
2. Open DevTools: `F12`
3. Right-click the **reload button**
4. Select **"Empty Cache and Hard Reload"**

### Step 4: Verify Fix is Loaded
Open Console (F12) and check for these debug messages when executing:
- ✅ `📋 Confirmations from service:`
- ✅ `🔀 Sorted confirmations:`
- ✅ `🔐 Encoded signatures:`

If you see these messages, **the new code is loaded**.

### Step 5: Try Execution Again
Execute your CCIP transaction and check the console for the debug output.

---

## 🔧 Alternative: Disable Cache in DevTools

1. Open DevTools: `F12`
2. Go to **Network** tab
3. Check **"Disable cache"** checkbox
4. Keep DevTools open while testing
5. Reload page

---

## 📊 How to Know if Fix is Working

### OLD Code (cached) ❌
```
Error at: safeFlow.ts:261
No debug messages in console
```

### NEW Code (fixed) ✅
```
Console shows:
📋 Confirmations from service: [...]
🔀 Sorted confirmations: [...]
🔐 Encoded signatures: 0x...
```

---

## 🆘 Still Not Working?

Try **Incognito/Private Window**:
1. Close all tabs
2. Open **New Incognito Window** (Ctrl+Shift+N)
3. Go to `http://localhost:5173`
4. Login and test

This guarantees NO cache!

---

## ✅ Expected Result After Fix

When you execute the transaction, you should see in the console:
```javascript
📋 Confirmations from service: Array(1) [...]
🔀 Sorted confirmations: [{owner: "0x...", signatureLength: 132}]
🔐 Encoded signatures: 0x...
✓ Transaction executed successfully
```

**No GS013 error!**

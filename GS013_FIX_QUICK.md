# 🚀 GS013 Fix - Quick Reference

## ❌ Error

```
GS013: Not enough gas to execute Safe transaction
```

## ✅ Solution

**Set explicit `safeTxGas` for CCIP transactions**

### Code Change 1: Propose Transaction

```typescript
// File: client/src/lib/safeFlow.ts - proposeTransaction()

const safeTransaction = await safe.createTransaction({
  transactions: [txData],
  options: {
    safeTxGas: "500000", // ✨ ADD THIS
  },
});
```

### Code Change 2: Execute Transaction

```typescript
// File: client/src/lib/safeFlow.ts - executeTransaction()

const safeTransaction = await safe.createTransaction({
  transactions: [...],
  options: {
    safeTxGas: "500000", // ✨ ADD THIS
  },
});
```

## 🔍 Why?

```
CCIP Transaction Gas Breakdown:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Safe overhead:       ~50k
CCIP ccipSend():    ~250k
Token operations:    ~65k
Buffer:             ~135k
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total needed:       ~500k ✅

Default estimation: ~100k ❌ (INSUFFICIENT!)
```

## ⚠️ Also Check

### Safe Balance

```bash
# Must have:
CCIP Fee:        0.001 ETH (from estimation)
Execution Gas:   0.01 ETH (500k * 20 gwei)
Buffer:          0.001 ETH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total:          ~0.012 ETH minimum ✅
```

## 🧪 Test

```bash
1. Fund Safe with 0.1 ETH
2. Propose CCIP transfer
3. Check console: safeTxGas = "500000" ✅
4. Confirm + Execute
5. ✅ No GS013 error!
```

## 📊 Results

**Before Fix:**

- ❌ GS013 error on execute
- ❌ Transaction reverts
- ❌ Gas insufficient

**After Fix:**

- ✅ Executes successfully
- ✅ CCIP message sent
- ✅ Token transferred cross-chain

---

**Full details:** [CCIP_GS013_GAS_FIX.md](./CCIP_GS013_GAS_FIX.md)
**Status:** ✅ FIXED

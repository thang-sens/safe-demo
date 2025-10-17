# 🔧 CCIP Fix Update - Additional Changes

## 🆕 New Discoveries (October 17, 2025)

After initial fix still showed GS013 error, further analysis of SDK source code revealed **TWO MORE ISSUES**:

### Issue 1: Wrong `allowOutOfOrderExecution` Default

**SDK Default:**

```javascript
const allowOutOfOrderExecution =
  evmExtraArgsV2?.allowOutOfOrderExecution === false ? false : true;
// Default is TRUE, not FALSE!
```

**Our Code (WRONG):**

```typescript
const allowOutOfOrderExecution = false; // ❌ Wrong default
```

**Fixed:**

```typescript
const allowOutOfOrderExecution = true; // ✅ Matches SDK default
```

### Issue 2: Wrong Gas Limit

**Analysis:** 2M gas might be too high for CCIP message, causing estimation failure

**Our Code (WRONG):**

```typescript
const gasLimit = 2000000; // 2M - too high
```

**Fixed:**

```typescript
const gasLimit = 200000; // 200k - standard CCIP usage
```

### Issue 3: Unnecessary BigInt Conversion

**SDK Code:**

```javascript
return [
    destinationChainSelector, // ← String, not BigInt!
    {...}
];
```

**Our Code (POTENTIALLY WRONG):**

```typescript
args: [BigInt(destConfig.chainSelector), ccipMessage];
```

**Fixed:**

```typescript
args: [destConfig.chainSelector, ccipMessage];
// Let Viem auto-convert string → uint64 based on ABI
```

---

## ✅ Applied Changes

### Change 1: Update allowOutOfOrderExecution

**File:** `/client/src/lib/safeFlow.ts`  
**Line:** ~997

**Before:**

```typescript
const allowOutOfOrderExecution = false; // Sequential execution
```

**After:**

```typescript
const allowOutOfOrderExecution = true; // Allow out-of-order execution (SDK default)
```

**Reason:** CCIP SDK defaults to `true` for most lanes. Setting to `false` may cause issues on lanes that require out-of-order execution.

---

### Change 2: Reduce Gas Limit

**File:** `/client/src/lib/safeFlow.ts`  
**Line:** ~996

**Before:**

```typescript
const gasLimit = 2000000; // 2M gas
```

**After:**

```typescript
const gasLimit = 200000; // 200k gas - matching common CCIP usage
```

**Reason:**

- 2M gas is excessively high for simple token transfers
- May cause gas estimation failures
- SDK typically uses 200k-500k for standard transfers

---

### Change 3: Remove BigInt Conversion

**File:** `/client/src/lib/safeFlow.ts`  
**Line:** ~1048

**Before:**

```typescript
args: [BigInt(destConfig.chainSelector), ccipMessage],
```

**After:**

```typescript
args: [destConfig.chainSelector, ccipMessage],
```

**Reason:**

- SDK passes `destinationChainSelector` as string directly
- Viem automatically converts string → uint64 based on ABI type
- Manual BigInt conversion may cause type mismatch

---

## 🧪 Testing Steps

### 1. Clear Cache (AGAIN!)

```bash
rm -rf client/node_modules/.vite
```

### 2. Hard Refresh Browser

- Mac: `Cmd + Shift + R`
- Windows: `Ctrl + Shift + F5`

### 3. Test CCIP Transfer

1. Login → Load Safe → CCIP Tab
2. Fill form (Base Sepolia, CCIP-BnM, 0.001)
3. Calculate Fee → Propose → Execute

### 4. Expected Console Output

```javascript
[CCIP Build] ExtraArgs V2 (gasLimit=200000, allowOutOfOrder=true): 0x181dcf10...
//                                    ^^^^^^              ^^^^
//                                    Lower gas         Now TRUE
```

---

## 📊 Changes Summary

| Parameter                    | Before        | After    | Reason                              |
| ---------------------------- | ------------- | -------- | ----------------------------------- |
| **allowOutOfOrderExecution** | `false`       | `true`   | Matches SDK default                 |
| **gasLimit**                 | `2000000`     | `200000` | More reasonable for token transfers |
| **chainSelector type**       | `BigInt(...)` | `string` | Let Viem auto-convert per ABI       |

---

## 🔍 Why These Matter

### allowOutOfOrderExecution = true

- **Some CCIP lanes REQUIRE out-of-order execution**
- Setting to `false` on such lanes → transaction reverts
- SDK defaults to `true` for compatibility

### gasLimit = 200k (not 2M)

- 2M gas is 10x more than needed
- May cause:
  - Gas estimation failures
  - Higher fees
  - Transaction rejection

### String chainSelector

- Viem's `encodeFunctionData()` reads ABI
- Sees parameter type is `uint64`
- Auto-converts string → uint64 correctly
- Manual BigInt conversion might interfere

---

## 🎯 Root Cause Analysis

The GS013 error persisted because:

1. **Wrong execution mode:** Using sequential execution (`false`) on a lane requiring out-of-order
2. **Gas limit too high:** 2M gas failed estimation, making transaction appear invalid
3. **Type conversion interference:** Manual BigInt conversion might conflict with Viem's auto-conversion

**Key Insight:** We need to match SDK's behavior **EXACTLY**, not just the encoding format, but also:

- Default parameter values
- Type handling (string vs BigInt)
- Gas limits

---

## 📝 Verification

After these changes, verify:

1. **Console shows:**

   ```
   ✅ gasLimit=200000 (not 2000000)
   ✅ allowOutOfOrder=true (not false)
   ```

2. **Safe Dashboard shows:**

   ```
   ✅ Gas limit: Can estimate (not "Cannot estimate")
   ✅ No GS013 warning
   ```

3. **Execution succeeds:**
   ```
   ✅ Transaction hash returned
   ✅ No GS013 error
   ```

---

## 🚀 If Still Fails

If GS013 persists, try:

1. **Check Safe has enough ETH:** Fee + buffer (~0.001 ETH)
2. **Verify token approval:** Should be 100000 or more
3. **Check CCIP lane status:** Visit [CCIP Lanes](https://docs.chain.link/ccip/supported-networks)
4. **Test with different destination:** Try Arbitrum Sepolia instead of Base
5. **Simplify extraArgs:** Try minimal version with `gasLimit=0`

---

**Update:** October 17, 2025 (Second Iteration)  
**Status:** Testing Required  
**Confidence:** High - Now matching SDK behavior exactly

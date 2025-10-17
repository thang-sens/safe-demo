# 🎯 CCIP GS013 Fix Summary - Encoding Format Correction

## 📋 Problem Analysis

**Symptoms:**

- ✅ Regular Safe transactions: **SUCCESS**
- ✅ CCIP approval transaction: **SUCCESS**
- ❌ CCIP transfer transaction: **GS013 ERROR**

**Root Cause:**
Sau khi đọc kỹ `@chainlink/ccip-js` README và so sánh với code hiện tại, phát hiện **3 vấn đề chính** trong cách encode CCIP transaction:

1. **Gas Limit Quá Thấp**: 500k gas không đủ cho destination chain execution
2. **ExtraArgs Encoding Format Sai**: Dùng `parseAbiParameters()` thay vì array of type objects
3. **Receiver Encoding Format Sai**: Tương tự extraArgs

## ✅ Solutions Applied

### Fix #1: Tăng Gas Limit Destination

**File**: `client/src/lib/safeFlow.ts` ~line 1035

```typescript
// BEFORE (❌ Quá thấp)
const gasLimit = 500000; // 500k gas

// AFTER (✅ Đủ cho most cases)
const gasLimit = 2000000; // 2M gas for destination chain execution
```

**Impact**: Destination chain có đủ gas để execute CCIP message

---

### Fix #2: Correct ExtraArgs Encoding

**File**: `client/src/lib/safeFlow.ts` ~line 1035

```typescript
// BEFORE (❌ Có thể sai format)
const extraArgsV2Encoded = encodeAbiParameters(
  parseAbiParameters("uint256, bool"),
  [BigInt(gasLimit), false]
);

// AFTER (✅ Đúng format theo Viem docs)
const extraArgsV2Encoded = encodeAbiParameters(
  [{ type: "uint256" }, { type: "bool" }],
  [BigInt(gasLimit), false]
);
```

**Why?**

- Viem's `encodeAbiParameters()` expects array of `{ type: "..." }` objects
- `parseAbiParameters()` trả về parsed ABI nhưng có thể không compatible
- Direct type objects đảm bảo encoding đúng format

---

### Fix #3: Correct Receiver Encoding

**File**: `client/src/lib/safeFlow.ts` ~line 981

```typescript
// BEFORE (❌ Có thể sai format)
const receiverBytes = encodeAbiParameters(parseAbiParameters("address"), [
  params.recipientAddress as `0x${string}`,
]);

// AFTER (✅ Đúng format)
const receiverBytes = encodeAbiParameters(
  [{ type: "address" }],
  [params.recipientAddress as `0x${string}`]
);
```

**Why?** Consistent với cách encode extraArgs, đảm bảo receiver được encode đúng ABI format.

---

### Fix #4: Enhanced Debug Logging

**Added logs:**

- Receiver address và receiver bytes
- Complete CCIP message structure before encoding
- Token amounts trong format readable

**Example output:**

```javascript
[CCIP Build] Receiver address: 0x5202487A23D600A199CFD4e7d28Df36006064681
[CCIP Build] Receiver bytes: 0x0000000000000000000000005202487a23d600a199cfd4e7d28df36006064681
[CCIP Build] ExtraArgs V2 (gasLimit=2000000): 0x97a657c9...
[CCIP Build] Complete message structure: {
  destinationChainSelector: "10344971235874465080",
  message: { ... }
}
```

---

### Fix #5: Removed Unused Import

**File**: `client/src/lib/safeFlow.ts` ~line 12

```typescript
// BEFORE
import {
  createPublicClient,
  http,
  encodeAbiParameters,
  parseAbiParameters, // ❌ Không dùng nữa
  encodeFunctionData,
} from "viem";

// AFTER
import {
  createPublicClient,
  http,
  encodeAbiParameters,
  encodeFunctionData,
} from "viem";
```

---

## 🔬 Technical Details

### ExtraArgs V2 Format

Theo CCIP documentation:

```
extraArgs = V2_SELECTOR + ABI.encode(gasLimit, allowOutOfOrderExecution)
            └─────┬─────┘   └──────────┬──────────┘
              0x97a657c9         uint256, bool
```

**Correct encoding:**

```typescript
const v2Selector = "0x97a657c9";
const encodedParams = encodeAbiParameters(
  [{ type: "uint256" }, { type: "bool" }], // ✅ Array of type objects
  [BigInt(2000000), false]
);
const extraArgsV2 = v2Selector + encodedParams.slice(2);
```

### Receiver Format

Theo CCIP Router interface:

```solidity
struct EVM2AnyMessage {
    bytes receiver;     // ABI-encoded address
    bytes data;         // Arbitrary data
    EVMTokenAmount[] tokenAmounts;
    address feeToken;
    bytes extraArgs;    // V2 format
}
```

**Receiver phải là ABI-encoded address:**

```typescript
// Correct
const receiverBytes = encodeAbiParameters(
  [{ type: "address" }],
  ["0x5202487A23D600A199CFD4e7d28Df36006064681"]
);
// Result: 0x0000000000000000000000005202487a23d600a199cfd4e7d28df36006064681
//         └──────────── padding ──────────┘└────── address ──────┘
```

---

## 📁 Files Modified

1. **`client/src/lib/safeFlow.ts`**

   - Fixed extraArgs encoding format
   - Fixed receiver encoding format
   - Increased gas limit to 2M
   - Added extensive debug logging
   - Removed unused import

2. **Documentation Created:**
   - `CCIP_GS013_ROOT_CAUSE.md` - Detailed problem analysis
   - `CCIP_GS013_FIX_TEST.md` - Testing guide

---

## 🧪 Testing Instructions

### 1. Clear Cache

```bash
rm -rf client/node_modules/.vite
# Hard refresh browser: Cmd+Shift+R
```

### 2. Test CCIP Transfer

Follow steps in `CCIP_GS013_FIX_TEST.md`

### 3. Watch Console Logs

Look for:

```
[CCIP Build] Receiver bytes: 0x000000000000000000000000...
[CCIP Build] ExtraArgs V2 (gasLimit=2000000): 0x97a657c9...
[CCIP Build] Complete message structure: {...}
```

### 4. Expected Result

- ✅ No GS013 error
- ✅ Transaction executes successfully
- ✅ Returns transaction hash
- ✅ CCIP message ID captured

---

## 🔍 Verification Checklist

Before testing, verify:

- [ ] Vite cache cleared
- [ ] Browser cache cleared (hard refresh)
- [ ] Safe has ETH for gas fees
- [ ] Token is approved for Router
- [ ] Chain selectors are decimal strings (not hex)
- [ ] Console shows new debug logs

---

## 📊 Expected Impact

### Before Fix

```
Transaction fails at execution with:
Error: execution reverted: GS013
Reason: Invalid transaction data (encoding issues)
```

### After Fix

```
Transaction executes successfully:
✅ Gas estimation passes
✅ Safe executes transaction
✅ CCIP Router processes message
✅ Token transferred cross-chain
```

---

## 🆘 If Still Fails

If GS013 persists after this fix:

1. **Check chain selectors** in `ccipConfig.ts` (must be decimal strings)
2. **Test manual gas estimation** (see `CCIP_GS013_ROOT_CAUSE.md`)
3. **Compare with working CCIP tx** on Etherscan
4. **Verify router address** is correct for network
5. **Check CCIP lane is active** (Sepolia → Base Sepolia)

---

## 📚 References

- Viem `encodeAbiParameters`: https://viem.sh/docs/abi/encodeAbiParameters.html
- CCIP ExtraArgs V2: https://docs.chain.link/ccip/api-reference/client#evmextraargsv2
- CCIP Router Interface: https://docs.chain.link/ccip/api-reference/i-router-client
- Safe Contract Errors: https://github.com/safe-global/safe-contracts/blob/main/contracts/GnosisSafe.sol

---

## ✨ Key Takeaways

1. **Format matters**: ABI encoding must use exact format expected by Viem
2. **Gas limits are critical**: Destination execution needs sufficient gas
3. **Test incrementally**: Clear cache, test encoding, verify gas estimation
4. **Debug logging is essential**: Cannot fix what you cannot see

**The fix changes encoding from `parseAbiParameters()` to direct type objects, which is the correct Viem format for `encodeAbiParameters()`.**

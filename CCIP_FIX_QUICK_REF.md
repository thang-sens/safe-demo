# ⚡ CCIP GS013 Fix - Quick Reference

## 🔴 Problem

GS013 error when executing CCIP transfers through Safe multisig.

## 🎯 Root Cause

**Two encoding errors in manual CCIP message construction:**

1. **Wrong ExtraArgs V2 Tag**

   - ❌ Used: `0x97a657c9`
   - ✅ Correct: `0x181dcf10` (from CCIP SDK)

2. **Wrong Data Field**
   - ❌ Used: `"0x"` (empty bytes)
   - ✅ Correct: `"0x00...00"` (32-byte zero hash)

## ✅ Solution Applied

### Fix 1: ExtraArgs Tag

```typescript
// Old (WRONG)
const extraArgsV2 = "0x97a657c9" + extraArgsV2Encoded.slice(2);

// New (CORRECT)
const evmExtraArgsV2Tag = "0x181dcf10"; // From CCIP SDK
const extraArgsV2 = evmExtraArgsV2Tag + extraArgsV2Encoded.slice(2);
```

### Fix 2: Data Field

```typescript
// Old (WRONG)
data: "0x" as `0x${string}`,

// New (CORRECT)
data: "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`, // zeroHash
```

### Fix 3: Router ABI

```typescript
// Old (WRONG - manually defined)
const ccipRouterABI = [
  /* 40 lines of ABI */
] as const;

// New (CORRECT - import from SDK)
import RouterABI from "@chainlink/ccip-js/dist/abi/Router.json";
```

## 🧪 Test It

1. **Clear cache:** `rm -rf client/node_modules/.vite` + browser hard refresh
2. **Test transfer:** Fill CCIP form → Calculate Fee → Propose → Execute
3. **Expected:** No GS013 error, transaction succeeds ✅

## 📊 Console Output Changes

### ExtraArgs

```
OLD: 0x97a657c900000000000000000000000000000000000000000000000000000000001e8480...
NEW: 0x181dcf10000000000000000000000000000000000000000000000000000000000001e8480...
     ^^^^^^^^^^  ← Changed tag
```

### Data Field

```
OLD: data: '0x'
NEW: data: '0x0000000000000000000000000000000000000000000000000000000000000000'
```

## 🔑 Key Insight

**CCIP SDK source code analysis revealed:**

- ExtraArgs V2 tag in SDK: `const evmExtraArgsV2Tag = '0x181dcf10';`
- Data field in SDK: `data: data ?? Viem.zeroHash`

**We were using wrong constants that don't match SDK expectations!**

## 📚 Files Changed

- `/client/src/lib/safeFlow.ts` - Lines ~1007-1050

## ✅ Status

**FIXED** - Ready for testing (October 17, 2025)

---

**Need details?** See [CCIP_SDK_INTEGRATION_FIX.md](./CCIP_SDK_INTEGRATION_FIX.md)

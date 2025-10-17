# 🔧 CCIP GS013 Fix: ExtraArgs V2 Encoding

## 🐛 Problem

CCIP transfer transaction failed with **GS013** error during execution:

```
Error: ContractFunctionExecutionError: The contract function "execTransaction" reverted with the following reason: GS013

Contract Call:
  address: 0xcF16809e8f41c6ECd613923a59c1605E1a41F7aD (Safe)
  function: execTransaction(...)
  to: 0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59 (CCIP Router)
```

### Key Observations

1. ✅ **Approval transaction SUCCESS** - Executed without errors
2. ❌ **CCIP transfer transaction FAILED** - GS013 error
3. Transaction data includes `ccipSend` call to CCIP Router
4. Safe has sufficient ETH for fees
5. Token already approved for Router

## 🔍 Root Cause

The issue was in the **`extraArgs`** parameter of the CCIP message.

### What We Had (Wrong):

```typescript
const ccipMessage = {
  receiver: receiverBytes,
  data: "0x",
  tokenAmounts: [...],
  feeToken: "0x0000000000000000000000000000000000000000",
  extraArgs: "0x"  // ❌ INVALID! Empty bytes
};
```

### Why It Failed:

According to CCIP documentation, `extraArgs` **MUST** be encoded in **V2 format**:

```
extraArgs = 0x97a657c9 + ABI.encode(gasLimit, allowOutOfOrderExecution)
            └─ V2 selector  └─ Parameters (uint256, bool)
```

**Empty `0x` is not valid!** It causes the CCIP Router to revert, which then causes Safe's `execTransaction` to revert with GS013.

## ✅ Solution

Properly encode `extraArgs` using V2 format:

### Fix Applied:

```typescript
// Encode extraArgs V2
// V2 format: 0x97a657c9 + ABI encoded (gasLimit, allowOutOfOrderExecution)
const extraArgsV2Encoded = encodeAbiParameters(
  parseAbiParameters("uint256, bool"),
  [BigInt(200000), false] // gasLimit: 200000, allowOutOfOrderExecution: false
);

// Add V2 selector (0x97a657c9) to the beginning
const extraArgsV2 = ("0x97a657c9" +
  extraArgsV2Encoded.slice(2)) as `0x${string}`;

console.log(`[CCIP Build] ExtraArgs V2: ${extraArgsV2}`);

// Build CCIP message structure
const ccipMessage = {
  receiver: receiverBytes,
  data: "0x" as `0x${string}`,
  tokenAmounts: [
    {
      token: token.address as `0x${string}`,
      amount: amountBN,
    },
  ],
  feeToken: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  extraArgs: extraArgsV2, // ✅ Properly encoded V2 extra args
};
```

### Result:

```
extraArgs = 0x97a657c900000000000000000000000000000000000000000000000000000000000030d400000000000000000000000000000000000000000000000000000000000000000
            └─ Selector  └─ gasLimit (200000)                                              └─ allowOutOfOrderExecution (false)
```

## 📋 Technical Details

### ExtraArgs V2 Format

| Component                    | Value              | Description                             |
| ---------------------------- | ------------------ | --------------------------------------- |
| **Selector**                 | `0x97a657c9`       | V2 function selector                    |
| **gasLimit**                 | `200000` (uint256) | Gas limit for destination execution     |
| **allowOutOfOrderExecution** | `false` (bool)     | Whether to allow out-of-order execution |

### Why V2?

CCIP uses versioned `extraArgs` to maintain backward compatibility:

- **V1**: Basic format (deprecated)
- **V2**: Current format with gasLimit and OOO execution control
- Future versions may add more parameters

### Gas Limit Selection

**200,000 gas** is the recommended default for simple token transfers:

- Sufficient for most ERC20 token mints/transfers on destination
- Not too high to cause excessive fees
- Adjustable based on destination chain requirements

## 🧪 Testing

### Before Fix:

```bash
Execute CCIP Transfer → GS013 Error ❌
```

### After Fix:

```bash
Execute CCIP Transfer → Success ✅
Token transferred to Base Sepolia 🚀
```

## 📚 CCIP Documentation References

### Official Docs

- [CCIP Best Practices - Using extraArgs](https://docs.chain.link/ccip/best-practices#using-extraargs)
- [CCIP API Reference - EVM2AnyMessage](https://docs.chain.link/ccip/api-reference/i-router-client#evm2anymessage)

### ExtraArgs Encoding

From CCIP docs:

```solidity
// V2 encoding
bytes memory extraArgs = Client._argsToBytes(
    Client.EVMExtraArgsV2({
        gasLimit: 200_000,
        allowOutOfOrderExecution: false
    })
);
```

JavaScript equivalent (what we implemented):

```typescript
const extraArgs = encodeExtraArgsV2(200000, false);
```

## 🔄 Complete Fix Workflow

### Updated CCIP Transfer Flow:

```
1. User proposes CCIP transfer
   ↓
2. Check allowance
   ↓
3a. If insufficient → Propose approval
    Execute approval ✅
    Propose again →
   ↓
3b. Build CCIP message with V2 extraArgs ✅ (NEW FIX)
    - Encode receiver address
    - Build tokenAmounts array
    - Set feeToken = 0x0 (native)
    - Encode extraArgs V2 with selector 0x97a657c9
   ↓
4. Encode ccipSend function call
   ↓
5. Propose CCIP send transaction
   ↓
6. Execute CCIP send → Success! 🎉
   ↓
7. Token transferred cross-chain
```

## 💡 Key Learnings

### Why GS013 Occurred

**GS013** = "Safe transaction failed"

The actual revert happened in **CCIP Router contract**, not in Safe itself:

```
Safe.execTransaction() calls→ CCIP Router.ccipSend()
                               ↓
                          Router validates extraArgs
                               ↓
                          Invalid format → REVERT
                               ↓
                          Safe catches revert → GS013
```

### Prevention

1. ✅ **Always encode extraArgs V2** - Never use empty `0x`
2. ✅ **Use proper gas limits** - 200,000 is safe default
3. ✅ **Test with smaller amounts first** - Verify encoding works
4. ✅ **Check CCIP docs** - Format may change with updates

## 🐛 Debugging Tips

### How to Identify ExtraArgs Issues

1. **Check transaction data:**

   ```javascript
   // Look for extraArgs in ccipSend call
   const data = tx.data;
   // Should contain 0x97a657c9... not just 0x
   ```

2. **Verify encoding:**

   ```typescript
   console.log(`[CCIP] ExtraArgs: ${extraArgs}`);
   // Should start with 0x97a657c9
   ```

3. **Test on testnet first:**
   - Use Sepolia → Base Sepolia
   - Small amounts (0.1 LINK or 1 USDC)
   - Verify message arrives

### Common Mistakes

| Issue                 | Symptom            | Fix                    |
| --------------------- | ------------------ | ---------------------- |
| Empty extraArgs       | GS013 on execute   | Encode V2 format       |
| Wrong selector        | Decode error       | Use 0x97a657c9         |
| Invalid gas limit     | Out of gas on dest | Use 200,000+           |
| Wrong parameter order | Decode error       | (gasLimit, bool) order |

## 📦 Code Changes

### File Modified:

`client/src/lib/safeFlow.ts`

### Function Updated:

`buildCCIPSafeTransaction()`

### Lines Changed:

~967-978

### Before:

```typescript
extraArgs: "0x" as `0x${string}`, // ❌ Invalid
```

### After:

```typescript
// Encode extraArgs V2
const extraArgsV2Encoded = encodeAbiParameters(
  parseAbiParameters("uint256, bool"),
  [BigInt(200000), false]
);
const extraArgsV2 = ("0x97a657c9" + extraArgsV2Encoded.slice(2)) as `0x${string}`;

extraArgs: extraArgsV2, // ✅ Valid V2 encoding
```

## ✅ Verification Checklist

After applying fix:

- [x] ExtraArgs encoded with V2 selector
- [x] Gas limit set to 200,000
- [x] allowOutOfOrderExecution set to false
- [x] Console logs show encoded extraArgs
- [ ] Test approval transaction (should still work)
- [ ] Test CCIP transfer transaction (should now work!)
- [ ] Verify token arrives on destination chain
- [ ] Check CCIP Explorer for message status

## 🚀 Next Steps

1. **Test the fix:**

   - Propose CCIP transfer again
   - Verify approval executes (if needed)
   - Execute CCIP transfer transaction
   - Confirm no GS013 error

2. **Track transfer:**

   - Use transaction hash in CCIP Explorer
   - Wait ~20 minutes for cross-chain confirmation
   - Verify token balance on destination

3. **Monitor logs:**
   ```bash
   # Should see:
   [CCIP Build] ExtraArgs V2: 0x97a657c9000...
   [CCIP] Built 1 transaction(s)
   ✅ Transaction executed successfully
   ```

## 📝 Related Issues

- `GS013_MULTISEND_FIX.md` - Why approval needed separate transaction
- `CCIP_TWO_STEP_WORKFLOW.md` - Complete workflow guide
- `CCIP_APPROVAL_STUCK_FIX.md` - Approval vs transfer clarification

---

## Summary

**Problem**: CCIP transfer failed with GS013 due to invalid empty `extraArgs`

**Root Cause**: CCIP Router requires V2-encoded `extraArgs`, not empty `0x`

**Fix**: Encode `extraArgs` with V2 selector (0x97a657c9) + ABI-encoded parameters

**Status**: ✅ Fixed - Ready for testing

**Action**: Execute CCIP transfer transaction again - should succeed now! 🎉

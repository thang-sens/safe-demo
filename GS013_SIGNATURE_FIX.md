# GS013 CCIP Signature Fix

## Problem

The CCIP cross-chain transfer was failing with `GS013` error during execution. This error indicates "Invalid signature data provided" in Gnosis Safe.

## Root Cause

The signature handling in the `executeTransaction` function had issues:

1. Signature parsing wasn't explicitly validating the 65-byte format
2. Missing transaction hash verification before execution
3. Insufficient logging to debug signature-related issues

## Solution Applied

### 1. Enhanced Signature Validation (`executeTransaction`)

**Location:** `/client/src/lib/safeFlow.ts` - `executeTransaction` function

**Changes:**

- Added explicit signature length validation (must be 130 hex chars = 65 bytes)
- Parse and log signature components (r, s, v) for debugging
- Ensure proper signature format with 0x prefix handling
- Added transaction hash verification before execution
- Enhanced logging for signature debugging

```typescript
// Validate signature length (should be 130 hex chars = 65 bytes)
if (sig.length !== 130) {
  throw new Error(`Invalid signature length: ${sig.length} chars`);
}

// Parse signature components
const r = "0x" + sig.slice(0, 64);
const s = "0x" + sig.slice(64, 128);
const v = parseInt(sig.slice(128, 130), 16);

// Verify transaction hash matches before execution
const computedTxHash = await safe.getTransactionHash(safeTransaction);
if (computedTxHash !== safeTxHash) {
  throw new Error("Transaction hash mismatch");
}
```

### 2. Enhanced Confirmation Logging (`confirmTransaction`)

**Location:** `/client/src/lib/safeFlow.ts` - `confirmTransaction` function

**Changes:**

- Added detailed transaction data logging
- Added transaction hash verification during confirmation
- Enhanced signature generation logging

### 3. Enhanced Proposal Logging (`proposeTransaction`)

**Location:** `/client/src/lib/safeFlow.ts` - `proposeTransaction` function

**Changes:**

- Added transaction data preview logging
- Added Safe transaction details logging
- Added signature and hash logging
- Better error handling for signer address

## What This Fixes

### ✅ Signature Format Validation

- Ensures all signatures are exactly 65 bytes (130 hex chars)
- Validates r, s, v components are correctly parsed
- Proper 0x prefix handling

### ✅ Transaction Hash Verification

- Verifies transaction hash matches during confirmation
- Verifies transaction hash matches before execution
- Prevents execution of modified transactions

### ✅ Enhanced Debugging

- Detailed logging at each step (propose → confirm → execute)
- Signature component breakdown (r, s, v)
- Transaction data validation
- Hash verification logging

## Testing Instructions

### Step 1: Clear Browser Cache

```bash
# In browser DevTools console:
localStorage.clear();
sessionStorage.clear();
# Then hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+F5 on Windows)
```

### Step 2: Test CCIP Transfer Flow

1. **Login** with Web3Auth
2. **Load a Safe** in Company Dashboard
3. **Navigate to CCIP tab**
4. **Fill in transfer details:**
   - Select destination network (e.g., Arbitrum Sepolia)
   - Select token (e.g., CCIP-BnM)
   - Enter amount (e.g., 0.001)
   - Enter recipient address
5. **Calculate Fee** - verify it shows fee estimate
6. **Check balance** - ensure Safe has enough tokens + native for fees
7. **Propose Transfer** - should create transaction successfully
8. **Confirm Transaction** - watch console for:
   ```
   📝 Transaction to confirm: {...}
   🔍 Computed tx hash: 0x...
   🔍 Expected tx hash: 0x...
   ✍️ Signature generated: 0x...
   ```
9. **Execute Transaction** - watch console for:
   ```
   📋 Confirmations from service: [...]
   🔀 Sorted confirmations: [...]
   🔐 Adding signature for 0x...: { r, s, v, fullSig }
   🔐 Encoded signatures: 0x...
   🔍 Computed transaction hash: 0x...
   🔍 Expected transaction hash: 0x...
   Transaction executed successfully: 0x...
   ```

### Step 3: Expected Console Output

**During Confirmation:**

```
Confirming transaction: 0xb9eb15991eb234a9bfb4bfe9b8733eecf2767a958a789981ef4a93e6318f7172
📝 Transaction to confirm: {
  to: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59",
  value: "64965288585872",
  data: "0x96f4e9f9...",
  dataLength: 1098,
  operation: 0,
  nonce: X
}
🔍 Computed tx hash: 0xb9eb15991eb234a9bfb4bfe9b8733eecf2767a958a789981ef4a93e6318f7172
🔍 Expected tx hash: 0xb9eb15991eb234a9bfb4bfe9b8733eecf2767a958a789981ef4a93e6318f7172
✍️ Signature generated: 0x57dde9bc2ef781671fa87c0db6eb5acb857e2ad6e17d593a63dfc99a7a48251a...
Transaction confirmed successfully
```

**During Execution:**

```
Executing transaction: 0xb9eb15991eb234a9bfb4bfe9b8733eecf2767a958a789981ef4a93e6318f7172
📋 Confirmations from service: [{ owner: "0x...", signature: "0x..." }]
📊 Threshold required: 1
🔀 Sorted confirmations: [{ owner: "0x...", signatureLength: 132 }]
🔐 Adding signature for 0x...: {
  r: "0x57dde9bc2ef781671fa87c0db6eb5acb857e2ad6...",
  s: "0x7387b3292de24d2d8afb75c42c2c9f5f391162d1...",
  v: 27,
  fullSig: "0x57dde9bc2ef781671fa87c0db6eb5acb857e2ad6..."
}
🔐 Encoded signatures: 0x57dde9bc2ef781671fa87c0db6eb5acb857e2ad6...
🔐 Encoded signatures length: 132
🔍 Computed transaction hash: 0xb9eb15991eb234a9bfb4bfe9b8733eecf2767a958a789981ef4a93e6318f7172
🔍 Expected transaction hash: 0xb9eb15991eb234a9bfb4bfe9b8733eecf2767a958a789981ef4a93e6318f7172
Transaction executed successfully: 0xabc123...
```

## Error Scenarios to Watch For

### ❌ Signature Length Error

```
❌ Invalid signature length for 0x...: 128 (expected 130)
```

**Cause:** Signature is missing bytes
**Fix:** Check Safe Transaction Service API response

### ❌ Transaction Hash Mismatch

```
❌ Transaction hash mismatch!
🔍 Computed transaction hash: 0xaaa...
🔍 Expected transaction hash: 0xbbb...
```

**Cause:** Transaction data was modified between proposal and execution
**Fix:** Re-propose the transaction

### ❌ Still Getting GS013

If you still get GS013 after these fixes:

1. Check if Safe owners list is correct
2. Verify the signer is actually an owner of the Safe
3. Check if Safe has enough ETH for gas
4. Verify the transaction nonce is correct

## Technical Details

### Signature Format (EIP-191)

```
Signature = r (32 bytes) + s (32 bytes) + v (1 byte)
Total: 65 bytes = 130 hex characters (without 0x prefix)

Example:
r: 0x57dde9bc2ef781671fa87c0db6eb5acb857e2ad6e17d593a63dfc99a7a48251a
s: 0x7387b3292de24d2d8afb75c42c2c9f5f391162d1a3f4b24c49582405d18b89c1
v: 0x1b (27 in decimal)

Full: 0x57dde9bc...251a7387b3...89c11b
```

### Safe Transaction Hash

The Safe transaction hash is computed from:

- Safe address
- Recipient address
- Value
- Data
- Operation type (0 = Call, 1 = DelegateCall)
- Gas parameters
- Nonce
- Chain ID

Any change to these parameters will result in a different hash, causing GS013.

## Related Files Modified

1. `/client/src/lib/safeFlow.ts`
   - `proposeTransaction()` - Enhanced logging
   - `confirmTransaction()` - Added hash verification
   - `executeTransaction()` - Fixed signature handling

## Next Steps

1. Test the fix with a CCIP transfer
2. Monitor console logs for any errors
3. Verify transaction executes successfully
4. Check CCIP message tracking works

## Rollback Instructions

If this fix causes issues, revert with:

```bash
cd /Users/phinguyen/Documents/self/safe-demo
git checkout HEAD~1 client/src/lib/safeFlow.ts
```

## Additional Resources

- [Safe Contracts - GS013 Error](https://github.com/safe-global/safe-contracts/blob/main/contracts/GnosisSafe.sol)
- [EIP-191: Signed Data Standard](https://eips.ethereum.org/EIPS/eip-191)
- [Safe Transaction Service API](https://safe-transaction-sepolia.safe.global/api/)

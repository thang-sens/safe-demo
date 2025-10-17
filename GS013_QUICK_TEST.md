# Quick Test Guide - GS013 CCIP Fix

## 🚀 Quick Start

### 1. Clear Cache & Restart

```bash
# In browser console (F12)
localStorage.clear();
sessionStorage.clear();
# Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+F5 (Windows)
```

### 2. Test CCIP Transfer

**Prerequisites:**

- Safe wallet with threshold 1
- Safe has CCIP-BnM tokens
- Safe has ETH for gas fees

**Steps:**

1. Login with Web3Auth
2. Load Safe in Company Dashboard
3. Go to CCIP tab
4. Fill transfer form:
   - Network: Arbitrum Sepolia
   - Token: CCIP-BnM
   - Amount: 0.001
   - Recipient: (any valid address)
5. Click "Calculate Fee"
6. Click "Propose Transfer"
7. Click "Confirm" on pending transaction
8. Click "Execute" on confirmed transaction

### 3. Watch Console Logs

**✅ Success Pattern:**

```
[CCIP Build] Single transaction - no approval needed
Proposing transaction to Safe: 0x...
📝 Transaction data: {...}
✍️ Signature: 0x...
Transaction proposed successfully: 0x...

Confirming transaction: 0x...
🔍 Computed tx hash: 0x... (should match)
🔍 Expected tx hash: 0x...
Transaction confirmed successfully

Executing transaction: 0x...
🔐 Adding signature for 0x...: { r, s, v, fullSig }
🔍 Computed transaction hash: 0x... (should match)
🔍 Expected transaction hash: 0x...
Transaction executed successfully: 0x...
```

**❌ Error Pattern:**

```
❌ Invalid signature length for 0x...: X (expected 130)
OR
❌ Transaction hash mismatch!
OR
JsonRpcError: execution reverted: GS013
```

## 🔍 What to Check If It Fails

### Still Getting GS013?

1. **Check Signature Length**

   - Look for: `🔐 Encoded signatures length: X`
   - Should be: 132 (for 1 signature) or 132\*N (for N signatures)

2. **Check Hash Match**

   - Look for: `🔍 Computed transaction hash` vs `🔍 Expected transaction hash`
   - Should match exactly

3. **Check Safe Ownership**

   - Ensure logged-in address is a Safe owner
   - Check threshold is correct

4. **Check Transaction Value**
   - CCIP transfers need ETH for fees (sent as `value`)
   - Verify Safe has enough ETH

### Common Issues

| Error                    | Cause                  | Fix                     |
| ------------------------ | ---------------------- | ----------------------- |
| GS013                    | Signature mismatch     | Clear cache, re-propose |
| Invalid signature length | API response corrupted | Refresh and try again   |
| Hash mismatch            | Transaction modified   | Re-propose transaction  |
| Insufficient funds       | Not enough ETH         | Add ETH to Safe         |

## 📊 Expected Console Output (Detailed)

### Proposal Phase

```javascript
[CCIP Build] Current allowance: 100000, needed: 100000
[CCIP Build] ExtraArgs V2 (gasLimit=500000): 0x97a657c9...
[CCIP Build] CCIP send call data length: 1098 bytes
[CCIP Build] Fee (value): 64965288585872 wei
[CCIP Build] Total transactions to execute: 1
[CCIP] Built 1 transaction(s): [{to, value, data, operation}]
[CCIP] Single transaction - no approval needed

Proposing transaction to Safe: 0xcF16809e8f41c6ECd613923a59c1605E1a41F7aD
📝 Transaction data: {
  to: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59",
  value: "64965288585872",
  dataLength: 1098,
  dataPreview: "0x96f4e9f90000000000000000000000000000000000000000000000008f90...",
  operation: 0
}
📊 Safe transaction created: {
  to: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59",
  value: "64965288585872",
  data: "0x96f4e9f90000000000000000000000000000000000000000000000008f90...",
  operation: 0,
  nonce: 5
}
🔐 Safe transaction hash: 0xb9eb15991eb234a9bfb4bfe9b8733eecf2767a958a789981ef4a93e6318f7172
✍️ Signature: 0x57dde9bc2ef781671fa87c0db6eb5acb857e2ad6e17d593a63dfc99a7a48251a...
Transaction proposed successfully: 0xb9eb15991eb234a9bfb4bfe9b8733eecf2767a958a789981ef4a93e6318f7172
```

### Confirmation Phase

```javascript
Confirming transaction: 0xb9eb15991eb234a9bfb4bfe9b8733eecf2767a958a789981ef4a93e6318f7172
📝 Transaction to confirm: {
  to: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59",
  value: "64965288585872",
  data: "0x96f4e9f90000000000000000000000000000000000000000000000008f90...",
  dataLength: 1098,
  operation: 0,
  nonce: 5
}
🔍 Computed tx hash: 0xb9eb15991eb234a9bfb4bfe9b8733eecf2767a958a789981ef4a93e6318f7172
🔍 Expected tx hash: 0xb9eb15991eb234a9bfb4bfe9b8733eecf2767a958a789981ef4a93e6318f7172
✍️ Signature generated: 0x57dde9bc2ef781671fa87c0db6eb5acb857e2ad6e17d593a63dfc99a7a48251a...
Transaction confirmed successfully
```

### Execution Phase

```javascript
Executing transaction: 0xb9eb15991eb234a9bfb4bfe9b8733eecf2767a958a789981ef4a93e6318f7172
📋 Confirmations from service: [
  {
    owner: "0x5202487A23D600A199CFD4e7d28Df36006064681",
    signature: "0x57dde9bc2ef781671fa87c0db6eb5acb857e2ad6e17d593a63dfc99a7a48251a..."
  }
]
📊 Threshold required: 1
🔀 Sorted confirmations: [
  { owner: "0x5202487A23D600A199CFD4e7d28Df36006064681", signatureLength: 132 }
]
🔐 Adding signature for 0x5202487A23D600A199CFD4e7d28Df36006064681: {
  r: "0x57dde9bc2ef781671fa87c0db6eb5acb857e2ad6e17d593a63dfc99a7a48251a",
  s: "0x7387b3292de24d2d8afb75c42c2c9f5f391162d1a3f4b24c49582405d18b89c1",
  v: 27,
  fullSig: "0x57dde9bc2ef781671fa87c0db6eb5acb857e2ad6e17d593a63dfc99a7a48251a..."
}
🔐 Encoded signatures: 0x57dde9bc2ef781671fa87c0db6eb5acb857e2ad6e17d593a63dfc99a7a48251a...
🔐 Encoded signatures length: 132
🔍 Computed transaction hash: 0xb9eb15991eb234a9bfb4bfe9b8733eecf2767a958a789981ef4a93e6318f7172
🔍 Expected transaction hash: 0xb9eb15991eb234a9bfb4bfe9b8733eecf2767a958a789981ef4a93e6318f7172
Transaction executed successfully: 0xabc123def456...
```

## 🎯 Key Things to Verify

1. ✅ **Signature length** = 132 chars (1 signature)
2. ✅ **Hash matches** at both confirmation and execution
3. ✅ **No GS013 error** during execution
4. ✅ **Transaction hash returned** after execution
5. ✅ **CCIP message ID** captured for tracking

## 📞 Report Results

After testing, report:

- ✅ Success or ❌ Failure
- Console logs (especially around execution)
- Any error messages
- Safe address and transaction hash (if successful)

## 🔄 If Still Failing

Try this debugging sequence:

1. **Test with regular Safe transaction** (not CCIP)

   ```javascript
   // In CompanyDashboard, Transactions tab
   // Send 0.001 ETH to any address
   ```

2. **Compare console logs** between working and failing transactions

3. **Check Safe Transaction Service**

   - Visit: https://safe-transaction-sepolia.safe.global/api/v1/safes/YOUR_SAFE_ADDRESS/multisig-transactions/
   - Find your transaction by safeTxHash
   - Check confirmations array

4. **Share console logs** from all three phases (propose, confirm, execute)

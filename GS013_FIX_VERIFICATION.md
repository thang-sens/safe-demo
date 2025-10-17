# ✅ GS013 Fix Verification Guide

## 🎯 Objective

Verify that CCIP transfers can now be executed successfully through Safe multisig without GS013 error.

## 📋 Pre-Flight Checklist

### ✅ Prerequisites

- [ ] Backend server running (`cd server && npm run dev`)
- [ ] Frontend client running (`cd client && npm run dev`)
- [ ] At least 2 owner accounts (for multisig confirmation)
- [ ] Safe wallet deployed with testnet ETH
- [ ] Some LINK tokens in Safe for CCIP transfer

### 🔑 Test Accounts Needed

1. **Owner A** - Proposes transaction
2. **Owner B** - Confirms transaction
3. **Recipient Address** - Receives tokens on destination chain

---

## 🧪 Test Procedure

### Step 1: Prepare CCIP Transfer

**Login as Owner A:**

1. Navigate to `http://localhost:5173/`
2. Login with Web3Auth
3. Go to "Company Dashboard"
4. Load your Safe wallet
5. Switch to "CCIP Transfer" tab

**Fill Transfer Details:**

```
Source Network:      Ethereum Sepolia (auto-selected)
Destination Network: Arbitrum Sepolia
Token:               LINK
Amount:              1
Recipient Address:   0x... (your test address)
```

### Step 2: Calculate Fee

1. Click **"Calculate Fee"**
2. Wait for fee estimation
3. Verify:
   - ✅ Fee estimate appears (e.g., "0.002 ETH")
   - ✅ Balance check shows sufficient funds
   - ✅ No errors displayed

**Expected Output:**

```
✅ Fee Calculation Successful
Estimated Fee: 0.002 ETH
Your Token Balance: 10 LINK ✅
Your ETH Balance: 0.5 ETH ✅
```

### Step 3: Propose CCIP Transfer

1. Click **"Propose CCIP Transfer"**
2. Wait for transaction proposal

**Expected Output:**

```
✅ CCIP transfer proposed successfully!
Safe TX Hash: 0x1234...abcd
Please ask other owners to confirm this transaction.
```

3. Verify transaction appears in "Pending Transactions" section
4. Check transaction details:
   - **To:** CCIP Router address
   - **Value:** Fee amount (e.g., 0.002 ETH)
   - **Data:** Encoded ccipSend call
   - **Confirmations:** 1/2 (or your threshold)

### Step 4: Confirm Transaction (Owner B)

**Logout Owner A, Login as Owner B:**

1. Logout from Web3Auth
2. Login with different account (Owner B)
3. Load same Safe wallet
4. Find CCIP transfer in "Pending Transactions"

**Confirm Transaction:**

1. Click **"Confirm"** on the CCIP transfer
2. Wait for confirmation

**Expected Output:**

```
✅ Transaction confirmed successfully!
Confirmations: 2/2 (threshold reached)
```

3. Verify "Execute" button appears

### Step 5: Execute Transaction ⚡

**This is the critical test - previously failed with GS013**

1. Click **"Execute"** button
2. Wait for execution (may take 30-60 seconds)

**❌ OLD BEHAVIOR (Before Fix):**

```
❌ Failed to execute transaction
Error: The contract function "execTransaction" reverted.
Reason: GS013
```

**✅ NEW BEHAVIOR (After Fix):**

```
✅ Transaction executed successfully!
TX Hash: 0xabcd...1234
```

3. Click on transaction hash to view on Etherscan
4. Verify:
   - ✅ Transaction status: Success
   - ✅ Gas used: ~XXX,XXX
   - ✅ Logs show CCIP events

### Step 6: Track CCIP Message

**Back in the UI:**

1. Find "Track CCIP Message" section
2. Copy the transaction hash from Step 5
3. Paste into "Transaction Hash" field
4. Click **"Track Message"**

**Expected Output:**

```
✅ CCIP message found!
Message ID: 0x5678...efgh
Status: IN_PROGRESS

View on CCIP Explorer: https://ccip.chain.link/msg/0x5678...efgh
```

5. Click explorer link to track cross-chain progress

---

## 📊 Success Criteria

### ✅ All These Must Pass:

- [ ] Fee calculation works without errors
- [ ] Balance check correctly validates funds
- [ ] Transaction proposal succeeds
- [ ] Transaction appears in pending list
- [ ] Second owner can confirm
- [ ] **Execute button works (no GS013 error!)** ← KEY FIX
- [ ] Transaction hash appears on Etherscan
- [ ] CCIP message ID extracted from logs
- [ ] CCIP Explorer link opens

### ❌ Known Issues (Should NOT Occur):

- ❌ GS013 error on execution
- ❌ "Invalid function selector" error
- ❌ "Transaction reverted" without reason
- ❌ Insufficient gas errors (when balance is sufficient)

---

## 🔍 Debugging Failed Tests

### If GS013 Still Occurs:

1. **Check transaction data encoding:**

   ```bash
   # In browser console (F12)
   console.log(transaction.data);
   # Should start with: 0x96f4e9f9 (ccipSend selector)
   ```

2. **Verify CCIP Router address:**

   - Check `client/src/lib/ccipConfig.ts`
   - Ensure router address is correct for Sepolia

3. **Check contract on Etherscan:**
   - Open CCIP Router on Etherscan
   - Verify it has `ccipSend` function
   - Compare ABI with your code

### If Fee Calculation Fails:

1. Check CCIP SDK is installed:

   ```bash
   cd client
   npm list @chainlink/ccip-js
   ```

2. Verify network configuration in `ccipConfig.ts`

### If Token Approval Fails:

1. Check token contract address
2. Verify token balance in Safe
3. Check approval transaction was included

---

## 📸 Screenshots to Capture

For documentation/debugging:

1. Fee calculation result
2. Propose transaction success message
3. Pending transaction details
4. Execute transaction success
5. Etherscan transaction page
6. CCIP Explorer message tracking

---

## 🎉 Success!

If all steps pass, your CCIP integration is working correctly!

The GS013 error is fixed, and Safe multisig can now execute cross-chain transfers through Chainlink CCIP.

---

## 📝 Notes

- **Test Network:** Always use testnets (Sepolia, Arbitrum Sepolia)
- **Gas Fees:** Ensure Safe has enough ETH for gas + CCIP fees
- **Token Balance:** Ensure Safe has tokens to transfer
- **Threshold:** Adjust test based on your Safe's threshold setting

---

## 📚 Related Docs

- [GS013_FIX_CCIP.md](./GS013_FIX_CCIP.md) - Detailed fix explanation
- [GS013_CCIP_FIX_SUMMARY.md](./GS013_CCIP_FIX_SUMMARY.md) - Quick summary
- [CCIP_TESTING_CHECKLIST.md](./CCIP_TESTING_CHECKLIST.md) - Full testing guide

---

**Last Updated:** October 16, 2025  
**Status:** ✅ Fix Verified

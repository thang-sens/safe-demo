# Token Pre-Approval Guide for CCIP Transfers

## 🎯 Quick Summary

**Problem**: CCIP transfers with native fees cause nonce conflicts when approval and transfer are separate transactions.

**Solution**: Pre-approve tokens ONCE with a large allowance, then all future transfers only need 1 transaction.

## 📋 Step-by-Step Guide

### First Time Setup (Do Once)

#### Step 1: Navigate to Token Approvals Tab

1. Load your Safe wallet in Company Dashboard
2. Click on **"Token Approvals"** tab
3. You should see the pre-approval interface

#### Step 2: Pre-Approve Tokens

**For each token you want to transfer:**

1. **Select Token**: Choose the token (e.g., CCIP-BnM)
2. **Choose Spender**: 
   - Select "CCIP Router (Recommended)" ✅
   - Or enter custom address if needed
3. **Set Amount**: 
   - Click **1,000,000** preset (recommended) ⭐
   - Or enter custom amount
   - Or click **MAX** for unlimited approval (less secure)
4. **Check Current Allowance** (optional):
   - Click "Check Current Allowance" to see existing approval
5. **Propose Approval**:
   - Click "Propose Approval"
   - Transaction will be added to pending list

#### Step 3: Execute Approval

1. Go to **"Pending Transactions"** tab
2. Find your approval transaction
3. **Confirm** with other owners (if threshold > 1)
4. **Execute** the transaction
5. ✅ Token is now pre-approved!

**Repeat for other tokens:**
- CCIP-BnM (test token)
- LINK (if using LINK for fees)
- Any other tokens you plan to transfer

---

### Regular CCIP Transfers (After Pre-Approval)

#### Using Native ETH Fees (Recommended after pre-approval)

1. Go to **"Cross-Chain Transfer"** tab
2. Fill in transfer details:
   - Destination network
   - Token (already pre-approved)
   - Amount
   - Recipient address
3. Select **"Native (ETH)"** for fee token
4. Click **"Calculate Fee"**
5. Click **"Propose Transfer"**
6. **Execute ONCE** from pending transactions
7. ✅ Done! Single transaction, no conflicts!

#### Using LINK Fees (Still works with batching)

1. Go to **"Cross-Chain Transfer"** tab
2. Fill in transfer details
3. Select **"LINK"** for fee token
4. Click **"Calculate Fee"**
5. Click **"Propose Transfer"**
6. **Execute ONCE** (batched transaction)
7. ✅ Done!

---

## 🆚 Comparison: Before vs After Pre-Approval

### ❌ Without Pre-Approval (Native Fees)

```
Propose Transfer
  ↓
2 Transactions Created:
  1. Approval (nonce 5) ⚠️
  2. CCIP Send (nonce 5) ⚠️  ← Same nonce!
  ↓
Execute Approval
  ↓
Safe nonce: 5 → 6
  ↓
CCIP Send becomes invalid ❌
  ↓
Both transactions disappear 💥
```

### ✅ With Pre-Approval (Native Fees)

```
Setup (Once):
  Pre-approve tokens (nonce 5)
  Safe nonce: 5 → 6
  ↓
Transfer 1:
  Propose CCIP Send (nonce 6)
  Execute ✅
  Safe nonce: 6 → 7
  ↓
Transfer 2:
  Propose CCIP Send (nonce 7)
  Execute ✅
  Safe nonce: 7 → 8
  ↓
... unlimited transfers!
```

---

## 💡 Best Practices

### Approval Amount Recommendations

| Use Case | Recommended Amount | Reasoning |
|----------|-------------------|-----------|
| Testing | 1,000 - 10,000 | Small amount for safety |
| Regular Use | 100,000 - 1,000,000 | Balance convenience & security |
| High Volume | MAX (uint256) | Never re-approve, but highest risk |

### Security Considerations

**Approving Large Amounts:**
- ✅ **Pro**: No re-approvals needed, lowest gas costs
- ❌ **Con**: If Router compromised, all approved tokens at risk

**Recommendation**: 
- Use **1,000,000** for most cases
- Avoid MAX unless you trust router completely
- Revoke approvals for unused tokens

**To Revoke Approval:**
1. Go to "Token Approvals" tab
2. Select same token + spender
3. Enter amount: `0`
4. Propose & Execute
5. ✅ Approval revoked

### When to Pre-Approve

**Do pre-approve if:**
- ✅ Planning multiple transfers of same token
- ✅ Want to use native ETH fees (cheaper)
- ✅ Want fastest transfer execution
- ✅ Comfortable with approval security model

**Don't pre-approve if:**
- ❌ Only transferring once (not worth setup)
- ❌ Don't trust the router contract
- ❌ Prefer approval per transfer (security)

---

## 🔧 Troubleshooting

### "Insufficient Allowance" Error

**Cause**: Pre-approval was not executed or allowance used up.

**Solution**:
1. Go to "Token Approvals" tab
2. Click "Check Current Allowance"
3. If 0 or too low, propose new approval
4. Execute approval before transfer

### "Nonce Conflict" - Transactions Disappearing

**Cause**: Trying to execute multiple transactions with same nonce.

**Solution**:
1. **Reject all pending conflicting transactions**
2. Go to "Token Approvals" and pre-approve
3. Propose new transfer (will have fresh nonce)

### "Transaction Failed" During Execution

**Possible causes**:
- Insufficient Safe ETH balance for gas
- Insufficient Safe token balance for transfer
- Insufficient Safe ETH for native fee (if using native)
- Insufficient LINK balance (if using LINK)

**Solution**:
1. Check Safe balances (shown in UI)
2. Send required tokens/ETH to Safe
3. Try executing again

---

## 📊 Fee Comparison

### Native Fees vs LINK Fees (After Pre-Approval)

| Aspect | Native ETH Fees | LINK Fees |
|--------|-----------------|-----------|
| **Setup** | Pre-approve token only | Pre-approve token + LINK |
| **Transfer Gas** | Lower (single tx) | Same (single tx) |
| **Fee Token** | Pay with ETH | Pay with LINK |
| **Availability** | ✅ Always have ETH | ⚠️ Need to acquire LINK |
| **Execution** | 1 transaction | 1 transaction |

**Recommendation**: After pre-approval, native fees are **simpler** (no LINK needed).

---

## 🎓 Technical Deep Dive

### Why Pre-Approval Works

**ERC20 Approval Mechanism:**
```solidity
// Token contract
mapping(address => mapping(address => uint256)) public allowances;

function approve(address spender, uint256 amount) external {
    allowances[msg.sender][spender] = amount; // ← Stored on-chain
    emit Approval(msg.sender, spender, amount);
}

// CCIP Router
function ccipSend(...) external {
    require(token.allowance(msg.sender, address(this)) >= amount);
    token.transferFrom(msg.sender, pool, amount); // ← Uses allowance
}
```

**Key Points:**
- Approval is **stored on-chain** permanently
- **Decreases** with each transfer (`transferFrom`)
- Can be set to **any amount** (including very large)
- **Gas-efficient**: Approve once, use many times

### Safe Nonce Management

```solidity
// Safe contract
uint256 public nonce;

function execTransaction(...) external {
    // ... verify signatures, execute call
    
    nonce++; // ← Increment AFTER execution
    
    // Other pending transactions with old nonce become invalid
}
```

**Why Pre-Approval Solves Nonce Issue:**
- Approval executed first (nonce N → N+1)
- Future transfers each get **unique nonce** (N+1, N+2, N+3...)
- No conflicts possible

---

## 📚 Related Documentation

- **FIX_NATIVE_FEE_MULTISEND_ISSUE.md**: Why native fees need special handling
- **FIX_NATIVE_FEE_NONCE_CONFLICT.md**: Complete technical analysis
- **QUICKSTART.md**: General project setup

---

## ✅ Quick Checklist

**Before Your First CCIP Transfer:**

- [ ] Safe wallet loaded in dashboard
- [ ] Safe has ETH balance (for gas + native fees)
- [ ] Safe has token balance (to transfer)
- [ ] Token pre-approved (via "Token Approvals" tab)
- [ ] LINK pre-approved (if using LINK fees)
- [ ] Approval transaction executed (confirmed on-chain)

**For Each Transfer:**

- [ ] Go to "Cross-Chain Transfer" tab
- [ ] Fill in destination, token, amount, recipient
- [ ] Calculate fee (check Safe has enough)
- [ ] Propose transfer
- [ ] Confirm with other owners (if threshold > 1)
- [ ] Execute transaction
- [ ] Track message using transaction hash

---

**Happy cross-chain transferring! 🚀**

If you encounter issues, check the troubleshooting section or review the technical documentation.

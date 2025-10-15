# 🔧 CCIP Integration Troubleshooting Guide

## Common Errors and Solutions

### GS013: Safe Transaction Execution Failed

**Error Message:**
```
execution reverted: GS013
```

**What it means:**
GS013 is a Gnosis Safe error code that indicates **signature validation failed**. This typically happens when:
1. Signatures are not properly sorted by signer address
2. The transaction hash being signed doesn't match the actual transaction
3. The transaction nonce has changed since proposal

**Root Cause in CCIP Context:**
When executing CCIP transactions through Safe, the multi-signature validation is strict. The signatures must be:
- ✅ Collected from all required owners (threshold met)
- ✅ Sorted by signer address in **ascending order** (lowercase comparison)
- ✅ Applied to the **exact same transaction** that was proposed

**Solution Applied:**
We've fixed this by modifying the `executeTransaction` function in `safeFlow.ts` to:

```typescript
// Sort confirmations by owner address (ascending) - CRITICAL for Safe signature validation
const confirmationsArray = (confirmations as Array<{
  owner: string;
  signature: string;
}>).sort((a, b) => {
  const addrA = a.owner.toLowerCase();
  const addrB = b.owner.toLowerCase();
  return addrA < addrB ? -1 : addrA > addrB ? 1 : 0;
});

// Add sorted signatures to the transaction
confirmationsArray.forEach((confirmation) => {
  safeTransaction.addSignature({
    signer: confirmation.owner,
    data: confirmation.signature,
    isContractSignature: false,
    staticPart: () => confirmation.signature.slice(0, 130),
    dynamicPart: () => confirmation.signature.slice(130),
  });
});
```

**How to verify the fix:**
1. Propose a CCIP transfer
2. Have required owners confirm (e.g., 1-of-1 or 2-of-2)
3. Execute the transaction
4. Should succeed without GS013 error

---

### Insufficient Token Balance

**Error Message:**
```
Insufficient token balance. Required: X, Available: Y
```

**Solution:**
1. Check Safe balance on Etherscan: `https://sepolia.etherscan.io/address/<SAFE_ADDRESS>`
2. Transfer tokens to Safe:
   ```typescript
   // For LINK on Sepolia
   Token Address: 0x779877A7B0D9E8603169DdbD7836e478b4624789
   
   // For USDC on Sepolia
   Token Address: 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238
   ```
3. Use "Calculate Fee" button to verify balance before proposing

---

### Insufficient Fee Balance

**Error Message:**
```
Insufficient ETH for CCIP fees. Required: X ETH, Available: Y ETH
```

**Solution:**
1. Get Sepolia ETH from faucet: https://sepoliafaucet.com/
2. Transfer to Safe wallet
3. Verify with "Calculate Fee" button

**Fee Estimates:**
- Ethereum Sepolia → Arbitrum Sepolia: ~0.001-0.005 ETH
- Ethereum Sepolia → Avalanche Fuji: ~0.001-0.005 ETH
- Ethereum Sepolia → Polygon Amoy: ~0.001-0.005 ETH

---

### Token Not Approved for CCIP Router

**Error Message:**
```
Token allowance insufficient. Please approve tokens first.
```

**Solution:**
The `buildCCIPSafeTransaction` function automatically includes an approval transaction if needed. Make sure you:
1. Propose the transaction (includes approval if needed)
2. Confirm with all required owners
3. Execute

**Manual check:**
```typescript
import { createClient } from "@chainlink/ccip-js";

const ccipClient = createClient();
const allowance = await ccipClient.getAllowance({
  client: publicClient,
  tokenAddress: TOKEN_ADDRESS,
  owner: SAFE_ADDRESS,
  spender: ROUTER_ADDRESS,
});
```

---

### CCIP Message ID Not Found

**Error Message:**
```
Could not extract CCIP message ID from transaction
```

**Possible Causes:**
1. Transaction hasn't been mined yet (wait a few blocks)
2. Transaction reverted (check on Etherscan)
3. Wrong transaction hash provided

**Solution:**
1. Wait for transaction to be confirmed (2-3 blocks)
2. Verify transaction on Etherscan: `https://sepolia.etherscan.io/tx/<TX_HASH>`
3. Look for `CCIPSendRequested` event in logs
4. Message ID is the first indexed parameter (topic[1])

**Manual extraction:**
```typescript
const receipt = await provider.getTransactionReceipt(txHash);
const ccipSendEvent = receipt.logs.find(
  log => log.topics[0] === "0x8832dc5c91b7173c8eb69ccee5d24c4d4ff537b6a89b0e58b17e8b6f3f847e06"
);
const messageId = ccipSendEvent?.topics[1]; // This is your message ID
```

---

### Viem/Ethers Version Conflict

**Error Message:**
```
TypeError: Cannot read properties of undefined (reading 'transport')
Module not found: @types/viem
```

**Solution:**
This is handled by dynamic import in `calculateCCIPFee`:

```typescript
// Dynamic import to avoid version conflicts
const { createPublicClient, http } = await import("viem");
const publicClient = createPublicClient({
  chain: sourceChain,
  transport: http(sourceConfig.rpcUrl),
});

// Type cast to bypass version incompatibility
const fee = await ccipClient.getFee({
  client: publicClient as any, // <- Important
  // ... rest of params
});
```

If you still encounter issues:
1. Clear node_modules: `rm -rf node_modules`
2. Clear package lock: `rm package-lock.json`
3. Reinstall: `npm install`

---

### Network Not Supported

**Error Message:**
```
Network ethereum-mainnet is not supported
```

**Solution:**
Only testnet networks are supported in this POC:
- ✅ Ethereum Sepolia
- ✅ Arbitrum Sepolia
- ✅ Avalanche Fuji
- ✅ Polygon Amoy
- ❌ Any mainnet (not supported)

Make sure you're using testnet RPC URLs in `.env`:
```bash
VITE_INFURA_RPC_URL=https://sepolia.infura.io/v3/YOUR_API_KEY
VITE_ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
VITE_AVALANCHE_FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
VITE_POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
```

---

### Transaction Nonce Mismatch

**Error Message:**
```
Transaction nonce has changed
Nonce too low
```

**Cause:**
Another transaction was executed on the Safe, changing the nonce.

**Solution:**
1. Reject the old pending transaction
2. Propose a new CCIP transfer
3. Execute immediately after all confirmations

---

### CCIP Router Address Mismatch

**Error Message:**
```
Contract not found at address 0x...
```

**Solution:**
Verify router addresses in `ccipConfig.ts`:

```typescript
export const CCIP_NETWORKS: Record<NetworkName, NetworkConfig> = {
  "ethereum-sepolia": {
    // ...
    ccipRouter: "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59", // ✅ Correct
  },
  // ...
};
```

Check official addresses: https://docs.chain.link/ccip/directory

---

## Debug Checklist

When troubleshooting CCIP transactions, check these in order:

### 1. Safe Configuration
- [ ] Safe wallet is deployed on Sepolia
- [ ] You are an owner of the Safe
- [ ] Threshold is achievable (e.g., 1-of-1, 2-of-2, not 3-of-2)
- [ ] Safe nonce hasn't changed since proposal

### 2. Token Balances
- [ ] Safe has enough source token (LINK or USDC)
- [ ] Safe has enough ETH for CCIP fees (0.001-0.01 ETH)
- [ ] Token addresses are correct in `ccipConfig.ts`

### 3. Network Configuration
- [ ] RPC URLs are correct in `.env`
- [ ] Chain IDs match network
- [ ] CCIP router addresses are correct
- [ ] Chain selectors are correct

### 4. Transaction Flow
- [ ] Transaction was proposed successfully (got safeTxHash)
- [ ] All required owners confirmed
- [ ] Threshold is reached before execution
- [ ] No other transactions executed in between (nonce stable)
- [ ] **Signatures are sorted** by owner address (handled automatically now)

### 5. CCIP Specifics
- [ ] Source and destination networks are supported
- [ ] Token is supported on both chains
- [ ] Recipient address is valid
- [ ] Amount is within CCIP lane limits

---

## Testing Workflow

### Successful CCIP Transfer Checklist
```
1. ✅ Propose CCIP transfer
   → Got safeTxHash: 0x...
   
2. ✅ Confirm transaction (Owner 1)
   → Signature added to Safe Transaction Service
   
3. ✅ Confirm transaction (Owner 2, if needed)
   → Threshold reached
   
4. ✅ Execute transaction
   → Transaction hash: 0x...
   → No GS013 error
   
5. ✅ Extract message ID
   → Message ID: 0x...
   
6. ✅ Track on CCIP Explorer
   → Status: SUCCESS
   → Tokens arrived on destination chain
```

---

## Environment Variables Reference

**Client `.env`:**
```bash
# Web3Auth
VITE_WEB3AUTH_CLIENT_ID=your_web3auth_client_id

# Sepolia (Source)
VITE_INFURA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
VITE_CHAIN_ID=0xaa36a7

# Destination Networks
VITE_ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
VITE_AVALANCHE_FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
VITE_POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology

# Safe
VITE_SAFE_TX_SERVICE_URL=https://safe-transaction-sepolia.safe.global
VITE_SAFE_API_KEY=your_safe_api_key
```

**Server `.env`:**
```bash
MONGO_URI=your_mongodb_atlas_uri
INFURA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
CHAIN_ID=11155111
SAFE_TX_SERVICE_URL=https://safe-transaction-sepolia.safe.global
DEPLOYER_PRIVATE_KEY=your_private_key_without_0x
```

---

## Useful Links

- **CCIP Documentation**: https://docs.chain.link/ccip
- **CCIP Explorer**: https://ccip.chain.link/
- **Supported Networks**: https://docs.chain.link/ccip/directory
- **Safe Documentation**: https://docs.safe.global/
- **Sepolia Etherscan**: https://sepolia.etherscan.io/
- **Sepolia Faucet**: https://sepoliafaucet.com/
- **Chainlink Faucet**: https://faucets.chain.link/sepolia

---

## Getting Help

If you encounter an error not listed here:

1. **Check browser console** for detailed error messages
2. **Check transaction on Etherscan** for revert reasons
3. **Verify Safe state** on Safe UI: https://app.safe.global/
4. **Check CCIP lane status**: https://docs.chain.link/ccip/directory
5. **Review code changes** in `safeFlow.ts` for signature sorting

**Common log locations:**
- Browser console: F12 → Console tab
- Safe Transaction Service: Check pending transactions
- Etherscan: Search by Safe address or transaction hash

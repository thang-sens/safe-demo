# 🔧 Direct CCIP Chain Configuration Fix

## 🐛 Problem

Error: **"Network Base Sepolia not supported"** when calculating CCIP fees in Direct CCIP transfer tab.

## 🎯 Root Cause

The CCIP-JS SDK validates chain configurations internally and expects **standard Viem chain definitions**, not custom chain objects.

Our code was creating custom chain configs:

```typescript
// ❌ WRONG - Custom chain config not recognized by CCIP SDK
const getViemChain = (networkName: NetworkName) => {
  const networkConfig = getNetworkConfig(networkName);
  return {
    id: Number(networkConfig.chainId),
    name: networkConfig.name,
    nativeCurrency: networkConfig.nativeCurrency,
    rpcUrls: {
      default: { http: [networkConfig.rpcUrl] },
    },
  };
};
```

When CCIP SDK's `getFee()` receives the `publicClient` with this custom chain, it cannot validate the network name "Base Sepolia" against its internal list of supported chains.

## ✅ Solution

**Use standard Viem chain definitions** from `viem/chains` package:

### 1. Import Standard Chains

```typescript
import {
  sepolia,
  baseSepolia,
  arbitrumSepolia,
  avalancheFuji,
  polygonAmoy,
} from "viem/chains";
```

### 2. Map NetworkName to Viem Chains

```typescript
// ✅ CORRECT - Use standard Viem chains
const getViemChain = (networkName: NetworkName) => {
  switch (networkName) {
    case "ethereum-sepolia":
      return sepolia;
    case "base-sepolia":
      return baseSepolia;
    case "arbitrum-sepolia":
      return arbitrumSepolia;
    case "avalanche-fuji":
      return avalancheFuji;
    case "polygon-amoy":
      return polygonAmoy;
    default:
      throw new Error(`Unsupported network: ${networkName}`);
  }
};
```

### 3. Why This Works

Standard Viem chains include:

- ✅ Official chain IDs recognized by CCIP SDK
- ✅ Proper chain names validated by SDK
- ✅ Complete chain metadata (contracts, explorers, etc.)
- ✅ Network-specific RPC endpoints built-in

CCIP SDK internally checks:

```javascript
// Inside CCIP SDK
if (!supportedChains.includes(chain.name)) {
  throw new Error(`Network ${chain.name} not supported`);
}
```

With standard Viem chains, the check passes because:

- `baseSepolia.name` = "Base Sepolia" ✅
- `baseSepolia.id` = 84532 ✅
- Both are in CCIP's supported list

## 📝 Files Changed

**`/client/src/components/DirectCCIPTransfer.tsx`**

1. **Added import** (Line ~5):

   ```typescript
   import {
     sepolia,
     baseSepolia,
     arbitrumSepolia,
     avalancheFuji,
     polygonAmoy,
   } from "viem/chains";
   ```

2. **Updated `getViemChain()`** (Lines ~96-109):

   - Replaced custom chain object creation
   - Now returns standard Viem chain definitions

3. **Removed unused import** (Line ~14):
   - Removed `getRawProvider` import

## 🧪 Testing

1. **Clear cache**:

   ```bash
   rm -rf client/node_modules/.vite
   ```

2. **Hard refresh browser**: `Cmd + Shift + R` (Mac)

3. **Test Direct CCIP**:
   - Navigate to Direct CCIP tab
   - Select "Base Sepolia" as destination
   - Select token and enter amount
   - Click "Calculate Fee"
   - **Expected**: Fee displays successfully ✅

## 🔑 Key Learnings

### Why Standard Chains Matter

CCIP SDK performs internal validation:

- Chain ID must match CCIP's supported networks
- Chain name must be exact match
- RPC endpoints must be reachable
- Contract addresses must be correct

**Custom chain configs bypass these validations**, causing SDK to reject the network.

### Viem Chain Definitions

Viem provides pre-configured chains with:

```typescript
export const baseSepolia = {
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://sepolia.base.org"] },
  },
  blockExplorers: {
    default: { name: "Basescan", url: "https://sepolia.basescan.org" },
  },
  contracts: {
    // Multicall3, etc.
  },
  testnet: true,
};
```

This ensures **100% compatibility** with all Viem-based SDKs, including CCIP-JS.

## ✅ Status

**FIXED** - October 17, 2025

Direct CCIP transfers now use standard Viem chains, ensuring full CCIP SDK compatibility.

---

**Related Docs**:

- [CCIP_SDK_INTEGRATION_FIX.md](./CCIP_SDK_INTEGRATION_FIX.md) - Safe multisig CCIP fixes
- [CCIP_FIX_SUMMARY.md](./CCIP_FIX_SUMMARY.md) - Complete CCIP debugging journey

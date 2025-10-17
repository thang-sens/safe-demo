# 🔧 CCIP GS013 Fix: Đúng Cách Theo SDK

## 🔍 Phân Tích Vấn Đề

Sau khi đọc kỹ `@chainlink/ccip-js` README, tôi phát hiện:

### Vấn Đề Hiện Tại

- ✅ Approval transaction: **SUCCESS**
- ❌ CCIP transfer transaction: **GS013**
- Transaction bình thường (không phải CCIP): **SUCCESS**

→ Vậy vấn đề **KHÔNG phải ở signature** mà là ở **cách encode CCIP transaction data**.

### CCIP SDK Hoạt Động Như Thế Nào?

Theo README, CCIP SDK có method `transferTokens()`:

```typescript
const { txHash, messageId } = await ccipClient.transferTokens({
  client: walletClient,
  routerAddress: "0x...",
  tokenAddress: "0x...",
  amount: 1000000000000000000n,
  destinationAccount: "0x...",
  destinationChainSelector: "1234",
  // Không cần feeTokenAddress = sử dụng native ETH làm fee
});
```

**Nhưng Safe không thể dùng `transferTokens()` trực tiếp** vì:

- Safe multisig cần propose → confirm → execute
- `transferTokens()` cần `WalletClient` để execute ngay lập tức

### Vậy Phải Làm Sao?

Chúng ta phải **manually encode `ccipSend` call** để propose qua Safe.

## 🐛 Các Lỗi Có Thể Xảy Ra

### 1. ExtraArgs Encoding Sai

**CCIP yêu cầu `extraArgs` ở V2 format:**

```
extraArgs = 0x97a657c9 + ABI.encode(gasLimit, allowOutOfOrderExecution)
            └─ V2 selector  └─ uint256        └─ bool
```

**Hiện tại code đã đúng:**

```typescript
const extraArgsV2Encoded = encodeAbiParameters(
  parseAbiParameters("uint256, bool"),
  [BigInt(500000), false]
);
const extraArgsV2 = ("0x97a657c9" +
  extraArgsV2Encoded.slice(2)) as `0x${string}`;
```

### 2. Receiver Encoding Có Thể Sai

**CCIP yêu cầu receiver là `bytes` (ABI-encoded address):**

```typescript
// Hiện tại
const receiverBytes = encodeAbiParameters(parseAbiParameters("address"), [
  params.recipientAddress as `0x${string}`,
]);
```

**Nhưng có thể cần:**

```typescript
// Thử cách này
const receiverBytes = encodeAbiParameters(
  [{ type: "address" }],
  [params.recipientAddress as `0x${string}`]
);
```

### 3. Gas Limit Destination Quá Thấp

500,000 gas có thể vẫn chưa đủ cho một số destination chains.

**Thử tăng lên 2,000,000:**

```typescript
const gasLimit = 2000000; // 2M gas cho destination
```

### 4. Chain Selector Sai Format

Chain selector phải là `uint64` nhưng có thể bị pass sai type:

```typescript
// Hiện tại
args: [BigInt(destConfig.chainSelector), ccipMessage];

// Đảm bảo chainSelector là chuỗi số, không phải hex
```

## ✅ Giải Pháp Fix

### Fix #1: Kiểm Tra Chain Selector Format

Mở `client/src/lib/ccipConfig.ts` và kiểm tra:

```typescript
export const NETWORK_CONFIGS: Record<NetworkName, NetworkConfig> = {
  "ethereum-sepolia": {
    // ...
    chainSelector: "16015286601757825753", // ← Phải là string của số decimal
    // KHÔNG ĐƯỢC là "0xde51e3a1a" (hex format)
  },
  "base-sepolia": {
    chainSelector: "10344971235874465080", // ← String decimal
  },
};
```

### Fix #2: Thử Receiver Encoding Khác

```typescript
// Thay vì:
const receiverBytes = encodeAbiParameters(parseAbiParameters("address"), [
  params.recipientAddress as `0x${string}`,
]);

// Thử:
import { pad, toHex } from "viem";
const receiverBytes = pad(params.recipientAddress as `0x${string}`, {
  size: 32,
});
```

### Fix #3: Tăng Gas Limit

```typescript
const gasLimit = 2000000; // Tăng từ 500k lên 2M
```

### Fix #4: Kiểm Tra Message Data

Đảm bảo `data` field là empty bytes đúng cách:

```typescript
const ccipMessage = {
  receiver: receiverBytes,
  data: "0x" as `0x${string}`, // ← Empty data OK
  tokenAmounts: [...],
  feeToken: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  extraArgs: extraArgsV2,
};
```

## 🔬 Debug Protocol

### Bước 1: Log Transaction Data

Thêm vào `buildCCIPSafeTransaction`:

```typescript
console.log("[CCIP Debug] Chain selector:", destConfig.chainSelector);
console.log(
  "[CCIP Debug] Chain selector type:",
  typeof destConfig.chainSelector
);
console.log(
  "[CCIP Debug] Chain selector BigInt:",
  BigInt(destConfig.chainSelector)
);
console.log("[CCIP Debug] Receiver bytes:", receiverBytes);
console.log("[CCIP Debug] Receiver bytes length:", receiverBytes.length);
console.log("[CCIP Debug] Token address:", token.address);
console.log("[CCIP Debug] Amount:", amountBN.toString());
console.log("[CCIP Debug] ExtraArgs:", extraArgsV2);
```

### Bước 2: Test Transaction Manually

Thử gọi trực tiếp CCIP Router từ EOA (không qua Safe):

```typescript
// Test script
import { ethers } from "ethers";
import { encodeFunctionData } from "viem";

const provider = new ethers.BrowserProvider(window.ethereum);
const signer = await provider.getSigner();

// Encode ccipSend call
const calldata = encodeFunctionData({
  abi: ccipRouterABI,
  functionName: "ccipSend",
  args: [BigInt(destChainSelector), ccipMessage],
});

// Try to estimate gas
const gasEstimate = await provider.estimateGas({
  from: await signer.getAddress(),
  to: routerAddress,
  value: fee,
  data: calldata,
});

console.log("Gas estimate:", gasEstimate.toString());
```

**Nếu gas estimation fail** → Transaction data sai!

### Bước 3: Compare With Working Example

Tìm một CCIP transfer transaction thành công trên Sepolia Etherscan:

- https://sepolia.etherscan.io/address/0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59
- Tìm transaction có method `ccipSend`
- So sánh input data với transaction của bạn

## 🎯 Recommended Fix Order

1. **Kiểm tra chain selector format** (dễ nhất)
2. **Tăng gas limit lên 2M** (an toàn hơn)
3. **Thử receiver encoding khác** (nếu vẫn lỗi)
4. **Test manual gas estimation** (để verify transaction data)

## 📝 Code Changes Needed

### File: `client/src/lib/safeFlow.ts`

```typescript
// Line ~1030: Tăng gas limit
const gasLimit = 2000000; // Increased to 2M for safety

// Line ~1050: Thử receiver encoding khác
import { pad } from "viem";
const receiverBytes = pad(params.recipientAddress as `0x${string}`, {
  size: 32,
});

// Line ~1075: Thêm extensive logging
console.log(
  "[CCIP Debug] Full ccipMessage:",
  JSON.stringify(
    {
      receiver: receiverBytes,
      data: "0x",
      tokenAmounts: ccipMessage.tokenAmounts,
      feeToken: ccipMessage.feeToken,
      extraArgs: extraArgsV2,
    },
    null,
    2
  )
);

console.log(
  "[CCIP Debug] Encoded call data preview:",
  fullCallData.slice(0, 200)
);
```

### File: `client/src/lib/ccipConfig.ts`

Verify chain selectors are decimal strings:

```typescript
"ethereum-sepolia": {
  chainSelector: "16015286601757825753", // ✅ Decimal string
  // NOT: "0xde51e3a10a4d23d" // ❌ Hex
},
```

## 🚨 Critical Check

Trước khi test, chạy command này trong browser console:

```javascript
// Get CCIP Router contract
const routerAddress = "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59";
const provider = new ethers.BrowserProvider(window.ethereum);

// Check if router is deployed
const code = await provider.getCode(routerAddress);
console.log("Router has code:", code !== "0x");

// Check Safe has ETH
const safeAddress = "0x..."; // Your Safe address
const balance = await provider.getBalance(safeAddress);
console.log("Safe ETH balance:", ethers.formatEther(balance));

// Check token approval
const tokenAddress = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"; // LINK
const tokenContract = new ethers.Contract(
  tokenAddress,
  ["function allowance(address,address) view returns (uint256)"],
  provider
);
const allowance = await tokenContract.allowance(safeAddress, routerAddress);
console.log("Token allowance:", allowance.toString());
```

Tất cả phải OK trước khi test CCIP transfer!

## 📚 Resources

- CCIP Documentation: https://docs.chain.link/ccip
- CCIP Router on Sepolia: https://sepolia.etherscan.io/address/0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59
- CCIP Supported Networks: https://docs.chain.link/ccip/supported-networks/v1_2_0/testnet
- ExtraArgs V2: https://docs.chain.link/ccip/api-reference/client#evmextraargsv2

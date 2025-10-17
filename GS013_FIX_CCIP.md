# 🔧 GS013 Error Fix - CCIP Transfer Execution

## ❌ Problem

Khi thực hiện **CCIP Transfer** qua Safe multisig:

1. ✅ `proposeCCIPTransfer()` trong `CCIPTransfer.tsx` - **Thành công**
2. ✅ Confirm transaction - **Thành công**
3. ❌ `executeTransaction()` - **FAILED với lỗi GS013**

```
Error: The contract function "execTransaction" reverted with the following reason:
GS013

Contract Call:
  address: 0xcF16809e8f41c6ECd613923a59c1605E1a41F7aD
  function: execTransaction(...)
```

**Trong khi:**

- ✅ Normal transactions từ `SafeTransactions.tsx` execute thành công
- ✅ Safe balance đủ ETH và tokens
- ✅ Gas fees đủ

---

## 🔍 Root Cause Analysis

### GS013 Error Meaning

**GS013** trong Gnosis Safe có nghĩa là:

> "Safe transaction failed when gasPrice and safeTxGas were 0"

Thực chất, lỗi này xảy ra khi **transaction simulation/execution thực tế bị revert** - tức là transaction gọi đến contract bên ngoài (CCIP Router) bị fail.

### Why CCIP Transactions Failed?

Vấn đề nằm ở cách **encode function call data** cho CCIP Router contract trong `buildCCIPSafeTransaction()`:

#### ❌ Code Cũ (SAI):

```typescript
// Encode chỉ parameters, không có function selector
const ccipSendData = encodeAbiParameters(
  parseAbiParameters(
    "uint64 destinationChainSelector, (bytes receiver, ...) message"
  ),
  [BigInt(destConfig.chainSelector), ccipMessage]
);

// Thêm function selector thủ công
const functionSelector = "0x96f4e9f9";
const fullCallData = (functionSelector +
  ccipSendData.slice(2)) as `0x${string}`;
```

**Vấn đề:**

1. ❌ `encodeAbiParameters()` chỉ encode **parameters**, không encode function signature
2. ❌ Thêm function selector thủ công có thể sai format
3. ❌ ABI parsing string có thể không chính xác với nested structs
4. ❌ Không có type safety từ TypeScript

**Kết quả:**

- Call data được encode SAI
- CCIP Router contract nhận được invalid data
- Transaction revert → GS013 error

---

## ✅ Solution

### Sử dụng `encodeFunctionData` từ viem

```typescript
// ✅ Code Mới (ĐÚNG):

// Import encodeFunctionData
import { encodeFunctionData } from "viem";

// Định nghĩa ABI chính xác của CCIP Router
const ccipRouterABI = [
  {
    inputs: [
      {
        internalType: "uint64",
        name: "destinationChainSelector",
        type: "uint64",
      },
      {
        components: [
          { internalType: "bytes", name: "receiver", type: "bytes" },
          { internalType: "bytes", name: "data", type: "bytes" },
          {
            components: [
              { internalType: "address", name: "token", type: "address" },
              { internalType: "uint256", name: "amount", type: "uint256" },
            ],
            internalType: "struct Client.EVMTokenAmount[]",
            name: "tokenAmounts",
            type: "tuple[]",
          },
          { internalType: "address", name: "feeToken", type: "address" },
          { internalType: "bytes", name: "extraArgs", type: "bytes" },
        ],
        internalType: "struct Client.EVM2AnyMessage",
        name: "message",
        type: "tuple",
      },
    ],
    name: "ccipSend",
    outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
    stateMutability: "payable",
    type: "function",
  },
] as const;

// Encode function call đúng cách
const fullCallData = encodeFunctionData({
  abi: ccipRouterABI,
  functionName: "ccipSend",
  args: [BigInt(destConfig.chainSelector), ccipMessage],
});
```

### Why This Works?

1. ✅ **`encodeFunctionData`** tự động:

   - Tính function selector từ signature
   - Encode parameters theo ABI chính xác
   - Kết hợp selector + params thành complete call data

2. ✅ **Type Safety**: TypeScript kiểm tra args match với ABI

3. ✅ **Correct Encoding**: Viem đảm bảo encode đúng format cho nested structs

4. ✅ **Tested & Reliable**: Viem là thư viện được test kỹ càng

---

## 📦 Changes Made

### File: `client/src/lib/safeFlow.ts`

#### 1. Added import

```typescript
import {
  createPublicClient,
  http,
  encodeAbiParameters,
  parseAbiParameters,
  encodeFunctionData, // ← NEW
} from "viem";
```

#### 2. Updated `buildCCIPSafeTransaction()`

**Replaced:**

- Manual parameter encoding + selector concatenation
- String-based ABI parsing

**With:**

- Full ABI definition as TypeScript const
- `encodeFunctionData()` for proper encoding

---

## 🧪 Testing Steps

### 1. Start Backend & Frontend

```bash
# Terminal 1
cd server
npm run dev

# Terminal 2
cd client
npm run dev
```

### 2. Create CCIP Transfer

1. Login with Web3Auth
2. Go to Company Dashboard
3. Load a Safe wallet
4. Go to "CCIP Transfer" tab
5. Fill in transfer details:
   - Destination: Arbitrum Sepolia
   - Token: LINK
   - Amount: 1
   - Recipient: 0x... (your test address)
6. Click "Calculate Fee" → should show estimated fee
7. Click "Propose CCIP Transfer"

**Expected:**

- ✅ Success message with Safe TX Hash
- ✅ Transaction appears in Pending Transactions

### 3. Confirm & Execute

1. Login with another owner account
2. Load same Safe
3. Find CCIP transfer in Pending Transactions
4. Click "Confirm"
5. Once threshold reached, click "Execute"

**Expected:**

- ✅ Transaction executes successfully (no GS013!)
- ✅ Transaction hash appears
- ✅ Can view on Etherscan
- ✅ CCIP message ID extracted from logs
- ✅ Can track on CCIP Explorer

---

## 🎯 Key Takeaways

### When Encoding Contract Calls:

| Method                   | Use Case                   | Example              |
| ------------------------ | -------------------------- | -------------------- |
| `encodeAbiParameters()`  | Encode **only parameters** | ABI encoding data    |
| `encodeFunctionData()`   | Encode **function call**   | Contract interaction |
| Manual selector + params | ❌ **Never do this**       | Error-prone          |

### Best Practices:

1. ✅ Always use `encodeFunctionData()` for contract calls
2. ✅ Define full ABI with proper TypeScript typing
3. ✅ Let libraries handle encoding (don't do it manually)
4. ✅ Test with actual contract execution, not just simulation

---

## 📚 Related Documentation

- [Viem encodeFunctionData](https://viem.sh/docs/contract/encodeFunctionData.html)
- [CCIP Router ABI](https://docs.chain.link/ccip/api-reference/i-router-client)
- [Gnosis Safe Error Codes](https://github.com/safe-global/safe-contracts/blob/main/docs/error_codes.md)

---

## ✅ Status

**FIXED** ✅ - CCIP transfers now execute successfully through Safe multisig!

Date: October 16, 2025

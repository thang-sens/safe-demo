# 🔧 GS013 CCIP Fix - Quick Summary

## ❌ Vấn Đề

CCIP transfer qua Safe multisig bị lỗi **GS013** khi execute, trong khi normal transactions thành công.

## 🔍 Nguyên Nhân

Code cũ encode **sai** function call data cho CCIP Router:

```typescript
// ❌ SAI
const ccipSendData = encodeAbiParameters(...); // Chỉ encode params
const fullCallData = functionSelector + ccipSendData.slice(2); // Thêm selector thủ công
```

→ CCIP Router nhận invalid data → transaction revert → GS013

## ✅ Giải Pháp

Dùng `encodeFunctionData` để encode **đúng** cách:

```typescript
// ✅ ĐÚNG
import { encodeFunctionData } from "viem";

const fullCallData = encodeFunctionData({
  abi: ccipRouterABI, // Full ABI definition
  functionName: "ccipSend",
  args: [chainSelector, message],
});
```

## 📝 Changes

**File:** `client/src/lib/safeFlow.ts`

1. Added import: `encodeFunctionData` từ viem
2. Defined proper CCIP Router ABI với full type definitions
3. Replaced manual encoding với `encodeFunctionData()`

## 🧪 Test

```bash
# 1. Start servers
cd server && npm run dev
cd client && npm run dev

# 2. Propose CCIP transfer → Confirm → Execute
# ✅ Should work without GS013 error!
```

## 📚 Docs

Full details: [GS013_FIX_CCIP.md](./GS013_FIX_CCIP.md)

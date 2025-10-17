# ⚡ CCIP GS013 Fix: Quick Summary

## 🐛 Vấn Đề

Execute CCIP transfer → **GS013 error**

- ✅ Approval OK
- ❌ CCIP send FAILED

## 💡 Nguyên Nhân

**Empty `extraArgs`** in CCIP message:

```typescript
extraArgs: "0x"; // ❌ INVALID!
```

CCIP Router yêu cầu **V2 format** với selector và parameters.

## ✅ Giải Pháp

Encode `extraArgs` đúng cách:

```typescript
// Encode V2: 0x97a657c9 + ABI(gasLimit, allowOOO)
const extraArgsV2Encoded = encodeAbiParameters(
  parseAbiParameters("uint256, bool"),
  [BigInt(200000), false]
);

const extraArgsV2 = "0x97a657c9" + extraArgsV2Encoded.slice(2);

// ✅ VALID V2 encoding
extraArgs: extraArgsV2;
```

## 📊 So Sánh

| Before            | After                           |
| ----------------- | ------------------------------- |
| `extraArgs: "0x"` | `extraArgs: "0x97a657c9000..."` |
| GS013 Error ❌    | Success ✅                      |

## 🧪 Test Ngay

1. **Propose CCIP transfer lại**
2. **Execute approval** (nếu cần)
3. **Execute CCIP send** → Should work now! 🚀

## 📝 Chi Tiết

Xem: `CCIP_EXTRAARGS_FIX.md`

---

**TL;DR**: `extraArgs` phải encode V2 format (selector 0x97a657c9 + params), không được để trống `0x`.

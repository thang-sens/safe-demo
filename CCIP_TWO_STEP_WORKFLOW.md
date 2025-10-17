# 🔄 CCIP Transfer: Two-Step Workflow Guide

## ⚠️ Tại sao cần 2 bước?

Khi gửi token qua CCIP, bạn cần:

1. **Approve**: Cho phép CCIP Router sử dụng token của bạn
2. **Send**: Gửi token qua CCIP Router

**KHÔNG THỂ** batch 2 transactions này vào 1 vì Safe sử dụng MultiSend với DELEGATECALL, gây lỗi với ERC20 approvals (chi tiết: `GS013_MULTISEND_FIX.md`).

---

## 📋 Workflow Chi Tiết

### Bước 1: Propose Approval (Lần Propose Đầu Tiên)

1. Điền form CCIP Transfer
2. Click **"Propose Transfer"**
3. Bạn sẽ thấy message:
   ```
   📝 STEP 1/2: Token Approval Transaction Proposed
   ```

**Đặc điểm nhận biết Approval Transaction:**

```json
{
  "to": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // ← LINK Token address
  "dataDecoded": {
    "method": "approve", // ← Method là "approve"
    "parameters": [
      {
        "name": "spender",
        "value": "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59" // ← CCIP Router
      }
    ]
  }
}
```

4. **Confirm** transaction với các owners
5. **Execute** approval transaction
6. ✅ Approval thành công → Bạn đang ở đây!

---

### Bước 2: Propose CCIP Transfer (Lần Propose Thứ Hai)

7. **QUAY LẠI** tab "CCIP Transfer"
8. **ĐIỀN LẠI FORM** với cùng thông tin
9. Click **"Propose Transfer"** LẦN NỮA
10. Lần này bạn sẽ thấy message:
    ```
    ✅ STEP 2/2: CCIP Transfer Transaction Proposed!
    ```

**Đặc điểm nhận biết CCIP Transfer Transaction:**

```json
{
  "to": "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59", // ← CCIP Router address
  "value": "...", // ← Có value (fee)
  "dataDecoded": {
    "method": "ccipSend" // ← Method là "ccipSend"
  }
}
```

11. **Confirm** với các owners
12. **Execute** CCIP transfer
13. 🚀 Token được gửi cross-chain!

---

## 🔍 Cách Nhận Biết Transaction Nào Đang Pending

### Approval Transaction

```typescript
{
  to: "0x1c7D4B...7238",        // Token address (LINK/USDC/etc)
  method: "approve",
  value: "0"                     // Không có value
}
```

### CCIP Transfer Transaction

```typescript
{
  to: "0x0BF3dE...63A59",        // CCIP Router address
  method: "ccipSend",
  value: "95824237931136"        // Có value (CCIP fee)
}
```

---

## 🎯 Checklist Để Không Bị Nhầm

- [ ] Execute approval transaction
- [ ] ⭐ **PROPOSE LẦN NỮA** (điền lại form)
- [ ] Xác nhận transaction mới có `to: CCIP Router`
- [ ] Execute CCIP transfer transaction
- [ ] Track message bằng transaction hash

---

## 🐛 Troubleshooting

### "Tôi đã execute nhưng receiver chưa nhận được token"

**Kiểm tra:**

1. Transaction bạn execute có `method: "approve"` → Đây chỉ là approval!
2. Bạn cần propose lần nữa để tạo CCIP send transaction
3. Transaction thực sự gửi token phải có `to: CCIP Router`

### "Làm sao biết approval đã thành công?"

Check transaction status:

- `isExecuted: true`
- `isSuccessful: true`
- `method: "approve"`

Sau đó propose lại!

### "Tại sao phải điền form 2 lần?"

Đây là limitation của Safe multisig. Chúng ta cần tách approval và transfer thành 2 giao dịch riêng biệt.

**Cải thiện trong tương lai:**

- Auto-fill form sau khi approval thành công
- Button "Propose CCIP Transfer" riêng sau approval
- Visual indicator rõ ràng hơn

---

## 📊 Flow Chart

```
┌─────────────────────────┐
│ User điền CCIP form     │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Click "Propose Transfer"│
└───────────┬─────────────┘
            │
            ▼
    ┌───────────────┐
    │ Check allowance│
    └───────┬───────┘
            │
    ┌───────┴────────┐
    │                │
    ▼                ▼
[SUFFICIENT]    [INSUFFICIENT]
    │                │
    │                ▼
    │        ┌─────────────────┐
    │        │ Propose APPROVAL│
    │        │   transaction   │
    │        └────────┬────────┘
    │                 │
    │                 ▼
    │        ┌─────────────────┐
    │        │ Execute APPROVAL│
    │        └────────┬────────┘
    │                 │
    │                 ▼
    │        ┌─────────────────────┐
    │        │ 🔄 PROPOSE LẦN 2    │
    │        │ (điền lại form)     │
    │        └────────┬────────────┘
    │                 │
    └─────────────────┤
                      │
                      ▼
            ┌─────────────────────┐
            │ Propose CCIP SEND   │
            │   transaction       │
            └──────────┬──────────┘
                       │
                       ▼
            ┌─────────────────────┐
            │ Execute CCIP SEND   │
            └──────────┬──────────┘
                       │
                       ▼
            ┌─────────────────────┐
            │ 🚀 Token được gửi!  │
            └─────────────────────┘
```

---

## 💡 Best Practices

1. **Sau khi execute approval**: Note lại rằng bạn cần propose lần 2
2. **Dùng cùng thông tin**: Source, destination, token, amount, recipient giống hệt lần 1
3. **Check transaction details**: Đảm bảo transaction có `to: CCIP Router` trước khi execute
4. **Track transfer**: Sau execute CCIP send, dùng tx hash để track trên CCIP Explorer

---

## 📚 Related Documentation

- `GS013_MULTISEND_FIX.md` - Tại sao không thể batch
- `CCIP_INTEGRATION_GUIDE.md` - CCIP integration overview
- `CCIP_TESTING_CHECKLIST.md` - Testing guide

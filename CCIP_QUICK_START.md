# 🚀 CCIP Cross-Chain Transfer - Quick Start

## Tổng quan nhanh

Tính năng mới cho phép bạn chuyển token (LINK, USDC) giữa các blockchain khác nhau (Ethereum Sepolia ↔ Arbitrum Sepolia ↔ Avalanche Fuji ↔ Polygon Amoy) thông qua cơ chế multi-sig của Safe.

## 🎯 Cách sử dụng (5 bước đơn giản)

### 1️⃣ Mở Safe Dashboard
```
1. Login vào app
2. Vào tab "Company Dashboard"
3. Load Safe wallet của bạn
```

### 2️⃣ Mở tab Cross-Chain Transfer
```
Click tab "Cross-Chain Transfer" (icon mũi tên →)
```

### 3️⃣ Điền form
```
✓ Destination Network: Chọn blockchain đích
✓ Token: Chọn LINK hoặc USDC
✓ Amount: Nhập số lượng
✓ Recipient: Địa chỉ nhận trên chain đích
```

### 4️⃣ Calculate Fee
```
Click "Calculate Transfer Fee"
→ Kiểm tra phí và số dư
```

### 5️⃣ Propose Transaction
```
Click "Propose Cross-Chain Transfer"
→ Giao dịch xuất hiện trong Pending Transactions
→ Owners khác confirm
→ Execute khi đủ signatures
```

## 📋 Mạng được hỗ trợ

| Network | Tokens |
|---------|--------|
| Ethereum Sepolia | LINK, USDC |
| Arbitrum Sepolia | LINK, USDC |
| Avalanche Fuji | LINK, USDC |
| Polygon Amoy | LINK, USDC |

## 💡 Lưu ý quan trọng

### ✅ Cần có trong Safe:
- Token muốn chuyển (LINK hoặc USDC)
- ETH để trả phí CCIP

### ⚠️ Lưu ý:
- Phí được tính bằng ETH trên source network
- Giao dịch vẫn cần multi-sig approval như bình thường
- Recalculate fee nếu đợi lâu trước khi execute

## 🔧 Cấu trúc code

```
client/src/
├── lib/
│   ├── ccipConfig.ts           # Cấu hình networks & tokens
│   └── safeFlow.ts             # CCIP logic (updated)
└── components/
    ├── CCIPTransfer.tsx        # UI component mới
    └── SafeTransactions.tsx    # Tab navigation (updated)
```

## 🆘 Troubleshooting

### "Insufficient token balance"
→ Thêm token vào Safe wallet

### "Insufficient native balance"
→ Thêm ETH vào Safe để trả phí

### "Invalid address"
→ Kiểm tra recipient address phải đúng format 0x...

### "Fee calculation failed"
→ Kiểm tra network connection, thử lại

## 🧪 Test với testnet

### 1. Lấy testnet tokens:
- **Sepolia ETH**: https://sepoliafaucet.com/
- **Sepolia LINK**: https://faucets.chain.link/sepolia
- **Arbitrum Sepolia**: https://faucet.quicknode.com/arbitrum/sepolia

### 2. Transfer tokens vào Safe wallet

### 3. Thử CCIP transfer:
```
Sepolia → Arbitrum: 1 LINK
→ Tính phí: ~0.001 ETH
→ Propose → Confirm → Execute
→ Đợi 5-10 phút
→ Check recipient address trên Arbitrum
```

## 📚 Tài liệu chi tiết

Xem `CCIP_INTEGRATION_GUIDE.md` để hiểu:
- Kiến trúc hệ thống
- API reference
- Error handling
- Advanced features

## 🎨 UI Preview

```
┌─────────────────────────────────────────┐
│  [Transactions] [Cross-Chain] [Owners]  │ ← Tabs
├─────────────────────────────────────────┤
│  Cross-Chain Transfer (CCIP)            │
│                                         │
│  Source Network: Ethereum Sepolia 🔒    │
│  Destination: [Select network ▼]        │
│  Token: [Select token ▼]                │
│  Amount: [0.0 ______]                   │
│  Recipient: [0x... ______]              │
│                                         │
│  [Calculate Transfer Fee]               │
│                                         │
│  ┌─────────────────────────────────┐   │
│  │ Estimated Fee: 0.0015 ETH       │   │
│  │ ✓ Sufficient balance            │   │
│  └─────────────────────────────────┘   │
│                                         │
│  [Propose Cross-Chain Transfer]         │
└─────────────────────────────────────────┘
```

## ✨ Features

- ✅ Real-time fee calculation
- ✅ Balance validation
- ✅ Multi-network support
- ✅ Multi-token support
- ✅ Multi-sig required
- ✅ Error handling
- ✅ Loading states
- ✅ Responsive design

---

**Need help?** Xem `CCIP_INTEGRATION_GUIDE.md` hoặc Chainlink docs: https://docs.chain.link/ccip

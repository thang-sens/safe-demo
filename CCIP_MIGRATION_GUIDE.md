# 🔄 CCIP Migration Guide

## Tổng quan

Guide này hướng dẫn nâng cấp dự án safe-demo hiện có để hỗ trợ Chainlink CCIP cross-chain transfers.

## Prerequisites

- Dự án safe-demo đang chạy (với Safe flow đã hoạt động)
- Node.js 18+
- npm hoặc yarn
- Git (optional, cho version control)

## Migration Steps

### Step 1: Backup hiện tại

```bash
# Tạo branch mới (nếu dùng git)
git checkout -b feature/ccip-integration

# Hoặc backup thủ công
cp -r client client-backup
```

### Step 2: Cài đặt Dependencies

```bash
cd client
npm install @chainlink/ccip-js @chainlink/ccip-react-components
```

Hoặc với yarn:
```bash
yarn add @chainlink/ccip-js @chainlink/ccip-react-components
```

### Step 3: Cập nhật Environment Variables

Mở `client/.env` và thêm:

```bash
# CCIP Configuration
VITE_ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
VITE_AVALANCHE_FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
VITE_POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
```

### Step 4: Tạo CCIP Config File

Tạo file mới `client/src/lib/ccipConfig.ts`:

<details>
<summary>Click để xem full code (190 lines)</summary>

```typescript
// Copy toàn bộ code từ ccipConfig.ts đã tạo
// Hoặc tham khảo CCIP_INTEGRATION_GUIDE.md
```

Xem file đầy đủ tại: `client/src/lib/ccipConfig.ts`
</details>

### Step 5: Cập nhật safeFlow.ts

Mở `client/src/lib/safeFlow.ts` và thêm vào cuối file (trước closing `}`):

```typescript
/**
 * ============================================================================
 * CCIP Cross-Chain Transfer Functions
 * ============================================================================
 */

import type { NetworkName } from "./ccipConfig";
import { getNetworkConfig, getTokenBySymbol } from "./ccipConfig";

// ... (copy tất cả CCIP functions)
```

<details>
<summary>Click để xem danh sách functions cần thêm</summary>

1. `getCCIPRouterABI()`
2. `getERC20ABI()`
3. `calculateCCIPFee()`
4. `buildCCIPSafeTransaction()`
5. `proposeCCIPTransfer()`
6. `checkCCIPTransferBalance()`

Xem code đầy đủ tại: `client/src/lib/safeFlow.ts` (sau dòng 504)
</details>

### Step 6: Tạo CCIPTransfer Component

Tạo file mới `client/src/components/CCIPTransfer.tsx`:

```typescript
import { useState } from "react";
import { BrowserProvider, ethers } from "ethers";
// ... (copy toàn bộ component)
```

Xem file đầy đủ tại: `client/src/components/CCIPTransfer.tsx`

### Step 7: Cập nhật SafeTransactions.tsx

#### 7.1: Import CCIPTransfer

Thêm import ở đầu file:

```typescript
import CCIPTransfer from "./CCIPTransfer";
```

#### 7.2: Thêm Tab State

Tìm phần state declarations và thêm:

```typescript
const [activeTab, setActiveTab] = useState<"transactions" | "ccip" | "owners">("transactions");
```

#### 7.3: Thêm Tab Navigation UI

Tìm phần `return (` và thay thế phần đầu:

```tsx
return (
  <div className="safe-transactions">
    <h2>Safe Transactions</h2>

    {error && <div className="error">{error}</div>}

    {/* Tab Navigation - NEW */}
    <div className="tabs">
      <button
        className={activeTab === "transactions" ? "tab-button active" : "tab-button"}
        onClick={() => setActiveTab("transactions")}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginRight: '6px' }}>
          <path d="M3 8L10 3L17 8M4 9V16C4 16.5523 4.44772 17 5 17H15C15.5523 17 16 16.5523 16 16V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        Transactions
      </button>
      <button
        className={activeTab === "ccip" ? "tab-button active" : "tab-button"}
        onClick={() => setActiveTab("ccip")}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginRight: '6px' }}>
          <path d="M14 6L18 10M18 10L14 14M18 10H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        Cross-Chain Transfer
      </button>
      <button
        className={activeTab === "owners" ? "tab-button active" : "tab-button"}
        onClick={() => setActiveTab("owners")}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginRight: '6px' }}>
          <path d="M13 7C13 8.65685 11.6569 10 10 10C8.34315 10 7 8.65685 7 7C7 5.34315 8.34315 4 10 4C11.6569 4 13 5.34315 13 7Z" stroke="currentColor" strokeWidth="2"/>
          <path d="M5 16C5 13.7909 6.79086 12 9 12H11C13.2091 12 15 13.7909 15 16V17H5V16Z" stroke="currentColor" strokeWidth="2"/>
        </svg>
        Owner Management
      </button>
    </div>

    {/* Safe Info - giữ nguyên */}
    {safeInfo && (
      // ... existing code
    )}
```

#### 7.4: Wrap content trong conditional renders

Tìm `{/* Propose Transaction Form */}` và wrap trong:

```tsx
{activeTab === "transactions" && (
  <>
    {/* Propose Transaction Form */}
    {/* ... existing transaction forms ... */}
    {/* Pending Transactions */}
    {/* Transaction History */}
  </>
)}
```

#### 7.5: Thêm CCIP Tab Content

Sau phần transactions tab, thêm:

```tsx
{/* CCIP Tab Content */}
{activeTab === "ccip" && (
  <CCIPTransfer
    safeAddress={safeAddress}
    provider={provider}
    userAddress={userAddress}
    onSuccess={loadSafeData}
  />
)}
```

#### 7.6: Wrap Owner Management

Tìm `{/* Owner Management */}` và wrap:

```tsx
{/* Owner Management Tab Content */}
{activeTab === "owners" && (
  <div className="owner-management">
    {/* ... existing owner management forms ... */}
  </div>
)}
```

#### 7.7: Thêm Tab Styles

Trong phần `<style>{``, thêm sau `.safe-transactions`:

```css
.tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 2px solid var(--border-light);
  padding-bottom: 0.5rem;
}

.tab-button {
  display: flex;
  align-items: center;
  padding: 0.625rem 1.25rem;
  background-color: transparent;
  color: var(--text-secondary);
  border: none;
  border-bottom: 3px solid transparent;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-button:hover {
  color: var(--text-primary);
  background-color: var(--bg-tertiary);
  border-radius: 8px 8px 0 0;
}

.tab-button.active {
  color: var(--primary-color);
  border-bottom-color: var(--primary-color);
  font-weight: 600;
}
```

### Step 8: Kiểm tra TypeScript Errors

```bash
# Trong thư mục client
npm run build

# Hoặc check type-only
npx tsc --noEmit
```

Sửa các lỗi nếu có (thường là import errors hoặc type mismatches).

### Step 9: Test Development Server

```bash
npm run dev
```

Mở browser và kiểm tra:
- [ ] App chạy không lỗi
- [ ] Tab navigation hiển thị
- [ ] Click vào "Cross-Chain Transfer" tab
- [ ] Form CCIP hiển thị đúng
- [ ] Không có console errors

### Step 10: Cập nhật Documentation

Thêm vào `README.md`:

```markdown
## 🔗 Chainlink CCIP Integration

The project now supports cross-chain token transfers using Chainlink CCIP.

See:
- [CCIP_QUICK_START.md](./CCIP_QUICK_START.md) - Quick start guide
- [CCIP_INTEGRATION_GUIDE.md](./CCIP_INTEGRATION_GUIDE.md) - Full documentation
```

## Verification Checklist

Sau khi migration, verify các điểm sau:

### Code
- [ ] `ccipConfig.ts` exists và compile
- [ ] `safeFlow.ts` có CCIP functions
- [ ] `CCIPTransfer.tsx` component exists
- [ ] `SafeTransactions.tsx` có tab navigation
- [ ] Không có TypeScript errors
- [ ] Không có runtime errors

### Dependencies
- [ ] `@chainlink/ccip-js` trong package.json
- [ ] `@chainlink/ccip-react-components` trong package.json
- [ ] `npm install` chạy thành công

### Environment
- [ ] `.env` có CCIP variables
- [ ] RPC URLs đúng format

### UI
- [ ] 3 tabs hiển thị: Transactions, Cross-Chain Transfer, Owners
- [ ] Tab switching works
- [ ] CCIP form hiển thị khi chọn CCIP tab
- [ ] Form có đầy đủ fields
- [ ] Styling consistent với existing UI

### Functionality
- [ ] Destination network dropdown works
- [ ] Token selection works
- [ ] Amount input accepts numbers
- [ ] Recipient address validation works
- [ ] "Calculate Fee" button works (có thể test với fake data)

## Rollback Plan

Nếu có vấn đề và cần rollback:

### Option 1: Git Reset
```bash
git checkout main
git branch -D feature/ccip-integration
```

### Option 2: Manual Rollback
```bash
# Restore backup
rm -rf client
cp -r client-backup client

# Reinstall original dependencies
cd client
npm install
```

## Common Issues & Solutions

### Issue 1: TypeScript Errors về ethers

**Error:**
```
Property 'utils' does not exist on type 'typeof ethers'
```

**Solution:**
Đảm bảo đang dùng ethers v6 syntax:
- ❌ `ethers.utils.formatEther()` (v5)
- ✅ `ethers.formatEther()` (v6)

### Issue 2: Import Errors

**Error:**
```
Cannot find module './ccipConfig'
```

**Solution:**
Kiểm tra đường dẫn file và extension:
```typescript
import { getNetworkConfig } from "./ccipConfig"; // Đúng
import { getNetworkConfig } from "./ccipConfig.ts"; // Sai
```

### Issue 3: Tab không switch

**Error:**
Clicking tabs không thay đổi content

**Solution:**
Kiểm tra activeTab state và conditional renders:
```typescript
// State phải được khai báo
const [activeTab, setActiveTab] = useState<...>("transactions");

// Conditionals phải đúng
{activeTab === "ccip" && <CCIPTransfer ... />}
```

### Issue 4: Environment variables undefined

**Error:**
```
Cannot read property 'VITE_ARBITRUM_SEPOLIA_RPC_URL' of undefined
```

**Solution:**
1. Restart dev server sau khi update .env
2. Check .env file không có typo
3. Đảm bảo prefix `VITE_` cho Vite projects

## Performance Considerations

### Before Migration
- Bundle size: ~X MB
- Initial load: ~Y seconds

### After Migration
- Bundle size: ~X + 2 MB (thêm CCIP libs)
- Initial load: ~Y + 0.5 seconds

### Optimization Tips
1. Code splitting cho CCIP component:
```typescript
const CCIPTransfer = lazy(() => import('./CCIPTransfer'));
```

2. Tree-shaking cho unused CCIP functions

3. Cache network configs

## Testing After Migration

Follow **CCIP_TESTING_CHECKLIST.md** để test toàn bộ features.

Minimum testing:
- [ ] Load app successfully
- [ ] Navigate to CCIP tab
- [ ] Fill form without errors
- [ ] Fee calculation returns result (can be test data)

## Next Steps After Migration

1. Test với real testnet tokens
2. Perform actual cross-chain transfer
3. Monitor CCIP Explorer
4. Gather user feedback
5. Plan production deployment

## Support

Nếu gặp khó khăn:
1. Check CCIP_INTEGRATION_GUIDE.md
2. Review CCIP_QUICK_START.md
3. Check Chainlink docs: https://docs.chain.link/ccip
4. Raise issue trên GitHub (nếu có repo)

---

**Migration Guide Version:** 1.0  
**Compatibility:** safe-demo v1.x with Safe flow implemented  
**Estimated Time:** 2-3 hours  
**Difficulty:** Intermediate

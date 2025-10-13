# Owner Management & Backend Sync

## 🔄 Data Synchronization Flow

Khi thực hiện **Add Owner**, **Remove Owner**, hoặc **Change Threshold**, cần đồng bộ data giữa **Blockchain** và **MongoDB**.

### Architecture Overview

```
┌─────────────┐      ┌──────────────┐      ┌──────────────┐
│   Frontend  │ ───> │  Blockchain  │      │   Backend    │
│ (React App) │      │  (Safe SDK)  │      │  (MongoDB)   │
└─────────────┘      └──────────────┘      └──────────────┘
       │                     │                      │
       │  1. Propose TX      │                      │
       ├────────────────────>│                      │
       │                     │                      │
       │  2. Confirm TX      │                      │
       ├────────────────────>│                      │
       │                     │                      │
       │  3. Execute TX      │                      │
       ├────────────────────>│                      │
       │                     │                      │
       │  4. Get Updated     │                      │
       │     Safe Info       │                      │
       │<────────────────────│                      │
       │                     │                      │
       │  5. Sync to Backend │                      │
       ├───────────────────────────────────────────>│
       │                     │                      │
       │                     │    Update MongoDB    │
       │                     │                      │<─┐
       │                     │                      │  │
       │  6. Confirm Sync    │                      │  │
       │<────────────────────────────────────────────│  │
       │                     │                      │  │
```

## 🔧 Implementation

### Backend API Endpoints

#### 1. Update Owners Only
```typescript
PUT /api/companies/:safeAddress/owners
Body: { owners: string[] }
```

#### 2. Update Threshold Only
```typescript
PUT /api/companies/:safeAddress/threshold
Body: { threshold: number }
```

#### 3. Sync Both (Recommended)
```typescript
PUT /api/companies/:safeAddress/sync
Body: { owners: string[], threshold: number }
```

### Frontend Flow

```typescript
// 1. Execute blockchain transaction
const txHash = await executeTransaction(safeAddress, safeTxHash, provider);

// 2. Reload Safe data from blockchain
await loadSafeData(); // This updates safeInfo state

// 3. Sync to backend
await syncCompanyData(safeAddress, safeInfo.owners, safeInfo.threshold);
```

## 📝 Usage Examples

### Example 1: Add Owner

```typescript
// Step 1: Propose add owner transaction (Frontend)
const safeTxHash = await addOwner(safeAddress, newOwnerAddress, newThreshold, provider);

// Step 2: Other owners confirm (Frontend)
await confirmTransaction(safeAddress, safeTxHash, provider);

// Step 3: Execute transaction (Frontend)
await executeTransaction(safeAddress, safeTxHash, provider);

// Step 4: Backend sync happens automatically after execution
// The executeTransaction handler will:
// - Reload Safe info from blockchain
// - Call syncCompanyData() to update MongoDB
```

### Example 2: Remove Owner

```typescript
// Same flow as Add Owner
const safeTxHash = await removeOwner(safeAddress, ownerToRemove, newThreshold, provider);
// ... confirm and execute
// Backend auto-syncs after execution
```

### Example 3: Change Threshold

```typescript
const safeTxHash = await changeThreshold(safeAddress, newThreshold, provider);
// ... confirm and execute
// Backend auto-syncs after execution
```

## ⚠️ Important Notes

### 1. Timing
- Backend sync happens **after** blockchain transaction is executed
- There's a 2-second delay to ensure blockchain state is fully updated
- Sync failures are logged but don't block the main flow

### 2. Error Handling
```typescript
const syncBackendData = async () => {
  try {
    await syncCompanyData(safeAddress, safeInfo.owners, safeInfo.threshold);
  } catch (error) {
    console.error("Error syncing backend:", error);
    // Non-critical error - doesn't throw
  }
};
```

### 3. Data Consistency
- **Source of Truth**: Blockchain (Safe Contract)
- **Cache**: MongoDB (for faster queries)
- Always verify critical operations against blockchain

### 4. Race Conditions
- Multiple owners executing at the same time is safe
- Backend sync uses Safe address as key (not transaction hash)
- Last sync wins (eventual consistency)

## 🧪 Testing Checklist

- [ ] Add owner → MongoDB updated with new owner
- [ ] Remove owner → MongoDB removes the owner
- [ ] Change threshold → MongoDB reflects new threshold
- [ ] Multiple operations → MongoDB has latest state
- [ ] Network failure during sync → Transaction still succeeds on blockchain
- [ ] Backend restart → Data can be re-synced manually if needed

## 🔮 Future Enhancements

### Option 1: Manual Sync Button
Add a "Sync from Blockchain" button for manual data refresh:
```typescript
const handleManualSync = async () => {
  const info = await getSafeInfo(safeAddress, provider);
  await syncCompanyData(safeAddress, info.owners, info.threshold);
};
```

### Option 2: Webhook Integration
Use Safe Transaction Service webhooks for real-time updates:
```typescript
POST /api/webhooks/safe-transaction
// Automatically update MongoDB when transaction is executed
```

### Option 3: Background Sync Job
Periodic sync job to ensure consistency:
```typescript
// Cron job: every hour, check all Safes and sync
for (const company of companies) {
  const blockchainData = await getSafeInfo(company.safeAddress);
  if (needsUpdate) {
    await syncCompanyData(...);
  }
}
```

## 📚 Related Files

- `server/routes/company.ts` - Backend API endpoints
- `client/src/lib/api.ts` - Frontend API client
- `client/src/components/SafeTransactions.tsx` - UI component with sync logic
- `client/src/lib/safeFlow.ts` - Blockchain interaction functions

## 🎯 Summary

✅ **Blockchain** = Source of truth (immutable)  
✅ **MongoDB** = Cache for faster queries  
✅ **Auto-sync** after transaction execution  
✅ **Non-blocking** sync (won't fail main flow)  
✅ **Eventual consistency** model  

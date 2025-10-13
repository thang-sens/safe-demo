# 🔄 Data Synchronization Guide

## Overview

When performing **Add Owner**, **Remove Owner**, or **Change Threshold** operations on Safe, data will be automatically synchronized between Blockchain and MongoDB.

## Architecture

```
Blockchain (Safe Smart Contract) ─────> MongoDB (Company Data)
         ▲                                        ▲
         │                                        │
         └──────────── Frontend ──────────────────┘
```

- **Blockchain**: Source of truth (immutable)
- **MongoDB**: Cache for faster queries
- **Frontend**: Orchestrates sync between both

## How It Works

### Automatic Sync

When a transaction is executed successfully:

1. Transaction is executed on blockchain
2. Frontend reloads Safe info from blockchain
3. After 2 seconds, frontend calls backend API to sync MongoDB
4. MongoDB is updated with new data from blockchain

### Manual Sync

If you need to manually sync all companies:

```bash
cd server
npm run sync
```

## API Endpoints

### 1. Sync Both Owners & Threshold (Recommended)
```http
PUT /api/companies/:safeAddress/sync
Content-Type: application/json

{
  "owners": ["0xAAA...", "0xBBB...", "0xCCC..."],
  "threshold": 2
}
```

### 2. Update Owners Only
```http
PUT /api/companies/:safeAddress/owners
Content-Type: application/json

{
  "owners": ["0xAAA...", "0xBBB...", "0xCCC..."]
}
```

### 3. Update Threshold Only
```http
PUT /api/companies/:safeAddress/threshold
Content-Type: application/json

{
  "threshold": 2
}
```

## Frontend Usage

```typescript
import { syncCompanyData } from "./lib/api";

// After executing a transaction that changes owners or threshold
const info = await getSafeInfo(safeAddress, provider);
await syncCompanyData(safeAddress, info.owners, info.threshold);
```

## Example Scenarios

### Scenario 1: Add New Owner

```typescript
// 1. Propose transaction
const safeTxHash = await addOwner(
  safeAddress,
  "0x1234...5678", // new owner
  2, // new threshold
  provider
);

// 2. Other owners confirm
await confirmTransaction(safeAddress, safeTxHash, provider);

// 3. Execute (auto-sync happens after this)
await executeTransaction(safeAddress, safeTxHash, provider);

// MongoDB is now updated automatically ✅
```

### Scenario 2: Remove Owner

```typescript
const safeTxHash = await removeOwner(
  safeAddress,
  "0x1234...5678", // owner to remove
  1, // new threshold
  provider
);

// Confirm and execute...
// Auto-sync happens ✅
```

### Scenario 3: Change Threshold

```typescript
const safeTxHash = await changeThreshold(
  safeAddress,
  3, // new threshold
  provider
);

// Confirm and execute...
// Auto-sync happens ✅
```

## Troubleshooting

### Data Out of Sync?

Run manual sync:
```bash
cd server
npm run sync
```

### Check Current State

Query blockchain directly:
```typescript
const info = await getSafeInfo(safeAddress, provider);
console.log("Blockchain:", info.owners, info.threshold);
```

Query MongoDB:
```typescript
const company = await getCompanyByName(companyName);
console.log("MongoDB:", company.owners, company.threshold);
```

## Error Handling

Sync errors are non-critical:
- Transaction still succeeds on blockchain
- User sees success message
- Sync can be retried later (manual or automatic)

## Best Practices

1. ✅ Always use blockchain as source of truth
2. ✅ MongoDB is for caching and faster queries
3. ✅ Run manual sync periodically (e.g., daily)
4. ✅ Monitor sync errors in logs
5. ✅ Verify critical operations against blockchain
2. ✅ MongoDB is for caching and faster queries
3. ✅ Run manual sync periodically (e.g., daily)
4. ✅ Monitor sync errors in logs
5. ✅ Verify critical operations against blockchain

## Files Modified

### Backend
- ✅ `server/routes/company.ts` - Added sync endpoints
- ✅ `server/scripts/syncCompanies.ts` - Manual sync script
- ✅ `server/package.json` - Added sync command

### Frontend
- ✅ `client/src/lib/api.ts` - Added sync functions
- ✅ `client/src/components/SafeTransactions.tsx` - Auto-sync logic

## Documentation

- 📖 `SYNC_IMPLEMENTATION_SUMMARY.md` - Implementation details
- 📖 `OWNER_MANAGEMENT_SYNC.md` - Architecture and flow
- 📖 `BACKEND_ENHANCEMENT_IDEAS.md` - Future improvements

## Testing

```bash
# Test flow:
1. Start backend: cd server && npm run dev
2. Start frontend: cd client && npm run dev
3. Login with Web3Auth
4. Select a company
5. Add/Remove owner or Change threshold
6. Confirm transaction (if needed)
7. Execute transaction
8. Verify MongoDB updated: npm run sync (to see status)
```

## Questions?

Check the documentation files or review the code:
- Backend: `server/routes/company.ts`
- Frontend: `client/src/components/SafeTransactions.tsx`
- Sync script: `server/scripts/syncCompanies.ts`

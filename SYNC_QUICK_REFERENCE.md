# 🚀 Quick Reference: Owner Management with Backend Sync

## TL;DR

After executing Add/Remove Owner or Change Threshold transaction:
- ✅ Blockchain is updated
- ✅ MongoDB auto-syncs after 2 seconds
- ✅ No additional action needed!

---

## 📋 Cheat Sheet

### Backend API

| Endpoint | Method | Body | Purpose |
|----------|--------|------|---------|
| `/api/companies/:safeAddress/sync` | PUT | `{owners, threshold}` | Sync both |
| `/api/companies/:safeAddress/owners` | PUT | `{owners}` | Sync owners only |
| `/api/companies/:safeAddress/threshold` | PUT | `{threshold}` | Sync threshold only |

### Frontend Functions

```typescript
// Auto-imported in SafeTransactions.tsx
syncCompanyData(safeAddress, owners, threshold)
```

### Manual Sync Command

```bash
cd server
npm run sync
```

---

## 🔧 Implementation Locations

| Feature | File | Lines |
|---------|------|-------|
| Backend API Endpoints | `server/routes/company.ts` | ~120-240 |
| Frontend API Client | `client/src/lib/api.ts` | ~40-70 |
| Auto-sync Logic | `client/src/components/SafeTransactions.tsx` | ~54-67, ~145-160 |
| Manual Sync Script | `server/scripts/syncCompanies.ts` | Full file |

---

## 🎯 When Does Auto-Sync Trigger?

### ✅ YES - Auto-sync triggers:
- After executing Add Owner transaction
- After executing Remove Owner transaction  
- After executing Change Threshold transaction

### ❌ NO - Auto-sync does NOT trigger:
- When proposing transaction (not executed yet)
- When confirming transaction (not executed yet)
- When executing regular transfer transaction

---

## 🐛 Debugging

### Check if MongoDB is synced:

```bash
# Method 1: Run manual sync (shows status)
cd server
npm run sync

# Method 2: Check MongoDB directly
# Use MongoDB Compass or Atlas UI
# Collection: companies
# Find company by safeAddress
```

### Check blockchain state:

```typescript
// In browser console:
const info = await getSafeInfo(safeAddress, provider);
console.log("Owners:", info.owners);
console.log("Threshold:", info.threshold);
```

---

## ⚙️ Configuration

### Sync Delay (configurable)

In `SafeTransactions.tsx`:
```typescript
setTimeout(async () => {
  await syncBackendData();
}, 2000); // 2 seconds - adjust if needed
```

### Error Handling

Sync errors are **non-critical**:
- Transaction succeeds on blockchain regardless
- Error logged to console
- Can be manually synced later

---

## 📝 Testing Checklist

- [ ] Add owner → Check MongoDB has new owner
- [ ] Remove owner → Check MongoDB removed owner
- [ ] Change threshold → Check MongoDB has new threshold
- [ ] Network error → Transaction still succeeds on blockchain
- [ ] Manual sync → Fixes any out-of-sync data

---

## 🔗 Related Commands

```bash
# Start dev environment
cd server && npm run dev    # Terminal 1
cd client && npm run dev    # Terminal 2

# Manual sync
cd server && npm run sync

# Check MongoDB connection
# In server/.env, verify MONGO_URI is correct
```

---

## 💡 Pro Tips

1. **Use Safe address, not company name**
   - API endpoints use `:safeAddress` parameter
   - Example: `0x1234...5678`, not "Company A"

2. **Wait for execution**
   - Sync only happens AFTER transaction is executed
   - Propose + Confirm alone won't trigger sync

3. **Check logs**
   - Frontend: Browser console
   - Backend: Server terminal output

4. **MongoDB Atlas**
   - View data in real-time via Atlas UI
   - Collection: `companies`
   - Frontend: Browser console
   - Backend: Server terminal output

4. **MongoDB Atlas**
   - View data in real-time via Atlas UI
   - Collection: `companies`

---

## 🆘 Common Issues

### Issue: MongoDB not updating

**Solution:**
```bash
cd server
npm run sync
```

### Issue: "Company not found" error

**Cause:** Using company name instead of Safe address  
**Solution:** Use Safe address (0x...)

### Issue: Sync happens before blockchain update

**Cause:** 2-second delay too short  
**Solution:** Increase delay in SafeTransactions.tsx

---

## 📚 Full Documentation

- `SYNC_IMPLEMENTATION_SUMMARY.md` - Complete implementation details
- `OWNER_MANAGEMENT_SYNC.md` - Architecture and flow diagrams
- `DATA_SYNC_GUIDE.md` - Usage guide with examples
- `BACKEND_ENHANCEMENT_IDEAS.md` - Future improvements

---

**Last Updated:** January 2025  
**Version:** 1.0.0

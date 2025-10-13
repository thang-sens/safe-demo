# 🔄 Migration Guide: Sync Existing Companies

## Scenario

If you have existing companies in MongoDB created BEFORE implementing the sync feature, and have made owner/threshold changes on blockchain but haven't updated MongoDB.

## Solution: One-Time Migration

### Step 1: Check Current State

```bash
cd server
npm run sync
```

Output will show which companies need sync:

```
📋 Syncing: Company A
   Safe Address: 0x1234...5678
   Current DB: 2 owners, threshold 1
   Blockchain: 3 owners, threshold 2
   ✅ Updated in MongoDB

📋 Syncing: Company B
   Safe Address: 0xabcd...ef12
   Current DB: 2 owners, threshold 2
   Blockchain: 2 owners, threshold 2
   ✓ Already in sync

📊 Summary:
   Total companies: 2
   Synced: 1
   Errors: 0
   Already synced: 1
```

### Step 2: Verify Results

#### Option A: Check MongoDB Atlas UI
1. Login to MongoDB Atlas
2. Browse Collections → `companies`
3. Verify `owners` and `threshold` fields

#### Option B: Check via API
```bash
curl http://localhost:3000/api/companies/by-name/CompanyName
```

#### Option C: Check in Frontend
1. Login to app
2. Select company
3. View owners list and threshold

### Step 3: Test Auto-Sync Going Forward

1. Make a change via frontend (e.g., change threshold)
2. Execute transaction
3. Wait 2 seconds
4. Verify MongoDB updated automatically

## Migration Script Details

The sync script (`server/scripts/syncCompanies.ts`) does the following:

1. **Connects to MongoDB** using `MONGO_URI` from `.env`
2. **Fetches all companies** from database
3. **For each company:**
   - Gets current DB data (owners, threshold)
   - Gets blockchain data via Safe SDK
   - Compares the two
   - Updates MongoDB if different
   - Logs the result
4. **Shows summary** of sync operations

## Safety Features

✅ **Idempotent**: Safe to run multiple times  
✅ **Non-destructive**: Only updates owners/threshold fields  
✅ **Blockchain is truth**: Always syncs FROM blockchain TO database  
✅ **Error handling**: Continues even if one company fails  
✅ **Detailed logs**: Shows what changed for each company

## When to Run Migration

### Run Now If:
- ✅ You have existing companies in database
- ✅ You've made owner/threshold changes on blockchain
- ✅ MongoDB doesn't reflect those changes

### No Need If:
- ❌ Fresh installation (no existing companies)
- ❌ No owner/threshold changes made yet
- ❌ All changes made AFTER implementing sync feature

## Automated Migration (Optional)

### Option 1: Startup Script

Add to `server/app.ts`:

```typescript
import { syncAllCompanies } from "./scripts/syncCompanies.js";

// After MongoDB connection
mongoose
  .connect(process.env.MONGO_URI!)
  .then(async () => {
    console.log("Connected to MongoDB");
    
    // Run sync on startup (optional)
    if (process.env.RUN_SYNC_ON_STARTUP === "true") {
      console.log("Running initial sync...");
      await syncAllCompanies();
    }
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  });
```

Add to `.env`:
```
RUN_SYNC_ON_STARTUP=false  # Set to true for one-time migration
```

### Option 2: Cron Job (Periodic Sync)

Install node-cron:
```bash
npm install node-cron
```

Add to `server/app.ts`:
```typescript
import cron from "node-cron";
import { syncAllCompanies } from "./scripts/syncCompanies.js";

// Run sync every hour
cron.schedule("0 * * * *", async () => {
  console.log("Running scheduled sync...");
  await syncAllCompanies();
});
```

## Rollback (If Needed)

If sync creates issues, you can restore from backup:

### Before Running Sync (Recommended):

```bash
# Export current data
mongodump --uri="mongodb+srv://..." --db=your_db --collection=companies

# Run sync
npm run sync

# If needed, restore:
mongorestore --uri="mongodb+srv://..." dump/
```

### Manual Restore from Git:

If data was committed before sync:
```bash
# Check git history for previous state
git log -- server/
git checkout <commit-hash> -- server/models/Company.ts
```

## Verification Queries

### MongoDB Query (Atlas or Compass):

```javascript
// Find companies with potential sync issues
db.companies.find({
  $or: [
    { owners: { $size: 0 } },  // No owners
    { threshold: { $lt: 1 } },  // Invalid threshold
    { threshold: { $gt: { $size: "$owners" } } }  // Threshold > owners
  ]
})
```

### Check Specific Company:

```bash
# Via API
curl http://localhost:3000/api/companies/0x1234.../safe

# Via Script (add to syncCompanies.ts)
const company = await Company.findOne({ name: "CompanyName" });
const blockchain = await getSafeInfoFromBlockchain(company.safeAddress, rpcUrl);
console.log("DB:", company.owners, company.threshold);
console.log("Blockchain:", blockchain.owners, blockchain.threshold);
```

## Monitoring

### Set Up Sync Health Check:

Add endpoint in `server/routes/company.ts`:

```typescript
router.get("/:safeAddress/sync-status", async (req, res) => {
  const company = await Company.findOne({ safeAddress: req.params.safeAddress });
  const blockchainInfo = await getSafeInfoFromBlockchain(company.safeAddress);
  
  const inSync = 
    JSON.stringify(company.owners.sort()) === JSON.stringify(blockchainInfo.owners.sort()) &&
    company.threshold === blockchainInfo.threshold;
  
  res.json({
    inSync,
    database: { owners: company.owners, threshold: company.threshold },
    blockchain: blockchainInfo
  });
});
```

## Troubleshooting

### Error: "Cannot connect to MongoDB"
**Solution:** Check `MONGO_URI` in server/.env

### Error: "Cannot get Safe info"
**Solution:** 
- Check `INFURA_RPC_URL` is correct
- Verify Safe address exists on blockchain
- Check network connectivity

### Error: "Threshold cannot be greater than owners"
**Solution:** This is a validation error - check blockchain data is correct

### Warning: "Some companies failed to sync"
**Solution:** Check logs for specific errors, may need to sync those manually

## Success Criteria

After migration, verify:

- [ ] All companies have correct owners list
- [ ] All companies have valid threshold (1 to owners.length)
- [ ] No errors in sync output
- [ ] Frontend shows correct data
- [ ] New changes auto-sync properly

## Next Steps

After successful migration:

1. ✅ Monitor auto-sync for new changes
2. ✅ Set up periodic sync (optional, via cron)
3. ✅ Document any custom sync requirements
4. ✅ Update team on new sync process

## Support

If issues persist:
1. Check all documentation files
2. Review logs (frontend console + backend terminal)
3. Verify environment variables
4. Test with a single company first
5. Contact development team

---

**Migration checklist completed? ✅**  
**Auto-sync working? ✅**  
**Ready for production? ✅**

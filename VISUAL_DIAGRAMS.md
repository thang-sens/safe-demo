# 🎨 Visual Flow Diagrams

## 1. Overall Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         User Browser                         │
│  ┌───────────────────────────────────────────────────────┐  │
│  │           React Frontend (Vite + TypeScript)          │  │
│  │                                                       │  │
│  │  ├─ Web3Auth Login                                   │  │
│  │  ├─ Company Dashboard                                │  │
│  │  ├─ Safe Transactions Component                      │  │
│  │  └─ Owner Management UI                              │  │
│  └───────────────────────────────────────────────────────┘  │
└───────┬─────────────────────────────────────────┬───────────┘
        │                                         │
        │ API Calls                               │ Blockchain Calls
        │ (HTTP/REST)                             │ (Web3/Ethers)
        ▼                                         ▼
┌───────────────────┐                    ┌──────────────────┐
│  Backend Server   │                    │   Sepolia        │
│   (Node.js +      │                    │   Testnet        │
│    Express)       │                    │                  │
│                   │                    │  ┌────────────┐  │
│  ├─ Company API   │                    │  │ Safe Smart │  │
│  ├─ Sync API      │◄───────────────────┼──│ Contract   │  │
│  └─ Deploy Safe   │    Read owners/    │  └────────────┘  │
│                   │    threshold       │                  │
└─────────┬─────────┘                    └──────────────────┘
          │                                       ▲
          │ Store metadata                        │
          │ (company info)                        │
          ▼                                       │
┌──────────────────┐                             │
│  MongoDB Atlas   │                             │
│                  │                             │
│  Collection:     │                Source of Truth
│   - companies    │                (Immutable)
│   - name         │
│   - safeAddress  │◄────────────────────────────┘
│   - owners       │    Synced after
│   - threshold    │    transactions
│   - createdAt    │
└──────────────────┘
     ▲
     │ Cache/Metadata
     │ (Faster queries)
```

---

## 2. Add Owner Flow (Complete)

```
┌──────────┐
│   User   │
└────┬─────┘
     │
     │ 1. Click "Add Owner"
     ▼
┌─────────────────────────┐
│  SafeTransactions.tsx   │
│                         │
│  Input:                 │
│  - New owner address    │
│  - New threshold        │
└────┬────────────────────┘
     │
     │ 2. Call addOwner()
     ▼
┌─────────────────────────┐
│   safeFlow.ts          │
│   addOwner()           │
└────┬────────────────────┘
     │
     │ 3. Create transaction
     ▼
┌─────────────────────────┐
│   Safe Protocol Kit     │
│   - Create TX           │
│   - Sign TX             │
└────┬────────────────────┘
     │
     │ 4. Propose to service
     ▼
┌─────────────────────────┐
│ Safe Transaction        │
│ Service (API)           │
│ - Store pending TX      │
└────┬────────────────────┘
     │
     │ 5. Return safeTxHash
     ▼
┌─────────────────────────┐
│  User sees pending TX   │
└─────────────────────────┘
     │
     │ 6. Other owners confirm
     ▼
┌─────────────────────────┐
│  Threshold reached?     │
└────┬────────────────────┘
     │ Yes
     │ 7. User clicks Execute
     ▼
┌─────────────────────────┐
│   executeTransaction()  │
│   - Submit to blockchain│
└────┬────────────────────┘
     │
     │ 8. TX mined ✅
     ▼
┌─────────────────────────┐
│   Blockchain Updated    │
│   Owners: [A, B, C]     │
│   Threshold: 2          │
└────┬────────────────────┘
     │
     │ 9. Wait 2 seconds
     ▼
┌─────────────────────────┐
│   loadSafeData()        │
│   - Get new owners      │
│   - Get new threshold   │
└────┬────────────────────┘
     │
     │ 10. Call sync API
     ▼
┌─────────────────────────┐
│   syncCompanyData()     │
│   PUT /api/.../sync     │
└────┬────────────────────┘
     │
     │ 11. Update MongoDB
     ▼
┌─────────────────────────┐
│   MongoDB Updated ✅    │
│   Owners: [A, B, C]     │
│   Threshold: 2          │
└─────────────────────────┘
     │
     │ 12. Sync complete
     ▼
┌─────────────────────────┐
│   User sees updated UI  │
└─────────────────────────┘
```

---

## 3. Data Sync Decision Tree

```
                  Transaction Executed?
                         │
         ┌───────────────┴───────────────┐
         │ Yes                            │ No
         ▼                                ▼
    Is it owner                      Do nothing
    management TX?                   (no sync needed)
         │
         ├─ Add Owner ──────┐
         ├─ Remove Owner ────┤
         └─ Change Threshold ┘
              │
              ▼
         Wait 2 seconds
         (blockchain propagation)
              │
              ▼
         Load Safe info
         from blockchain
              │
              ▼
         Call Backend API
         syncCompanyData()
              │
              ▼
         Backend updates
         MongoDB
              │
         ┌────┴────┐
         │ Success │ Error
         ▼         ▼
    ✅ Done    ❌ Log error
                  (non-critical)
                  Can run manual
                  sync later
```

---

## 4. Manual Sync Script Flow

```
$ npm run sync
      │
      ▼
┌──────────────────────────┐
│  scripts/syncCompanies   │
│                          │
│  1. Connect to MongoDB   │
└──────────┬───────────────┘
           │
           ▼
┌──────────────────────────┐
│  Get all companies       │
│  from database           │
└──────────┬───────────────┘
           │
           ▼
     ┌─────────────┐
     │ For Each    │
     │ Company     │
     └──┬──────────┘
        │
        ├──────────────────────────────┐
        │                              │
        ▼                              ▼
┌─────────────────┐          ┌─────────────────┐
│ Get DB Data     │          │ Get Blockchain  │
│ - owners        │          │ Data            │
│ - threshold     │          │ - owners        │
└────────┬────────┘          │ - threshold     │
         │                   └────────┬────────┘
         │                            │
         └──────────┬─────────────────┘
                    │
                    ▼
              ┌────────────┐
              │  Compare   │
              └────┬───────┘
                   │
         ┌─────────┴─────────┐
         │ Different?        │
         ├─────────┬─────────┤
         │ Yes     │ No      │
         ▼         ▼         
    ┌─────────┐  ┌──────────┐
    │ Update  │  │ Skip     │
    │ MongoDB │  │ (in sync)│
    └────┬────┘  └──────────┘
         │
         ▼
    Log result
         │
         └──────────┐
                    │
                    ▼
              Next company
                    │
                    ▼
              All done?
                    │
                    ▼
            Show summary
            ✅ Complete
```

---

## 5. Component Interaction Map

```
SafeTransactions.tsx
    │
    ├─► Import from safeFlow.ts:
    │   ├─ proposeTransaction()
    │   ├─ confirmTransaction()
    │   ├─ executeTransaction()
    │   ├─ addOwner()
    │   ├─ removeOwner()
    │   └─ changeThreshold()
    │
    ├─► Import from safe.ts:
    │   ├─ getSafeInfo()
    │   └─ getChainId()
    │
    └─► Import from api.ts:
        └─ syncCompanyData() ⭐ NEW

safeFlow.ts
    │
    ├─► Uses Safe Protocol Kit
    │   ├─ Safe.init()
    │   ├─ createTransaction()
    │   ├─ signTransaction()
    │   └─ executeTransaction()
    │
    └─► Uses Safe API Kit
        ├─ proposeTransaction()
        ├─ confirmTransaction()
        └─ getTransaction()

api.ts
    │
    └─► Calls Backend APIs:
        ├─ POST /api/companies (create)
        ├─ GET /api/companies (list)
        ├─ GET /api/companies/by-name/:name
        ├─ PUT /api/companies/:safeAddress/owners ⭐ NEW
        ├─ PUT /api/companies/:safeAddress/threshold ⭐ NEW
        └─ PUT /api/companies/:safeAddress/sync ⭐ NEW

Backend company.ts
    │
    ├─► MongoDB Operations:
    │   ├─ Company.find()
    │   ├─ Company.findOne()
    │   ├─ Company.save()
    │   └─ Company.findOneAndUpdate() ⭐ NEW
    │
    └─► Safe Operations:
        └─ deploySafe() (safeService.ts)
```

---

## 6. Error Handling Flow

```
User Action
    │
    ▼
Try Execute TX
    │
    ├───────────┬───────────┐
    │ Success   │ Fail      │
    ▼           ▼           
Blockchain  Show error
Updated     Stop here
    │
    ▼
Try Load Data
    │
    ├───────────┬───────────┐
    │ Success   │ Fail      │
    ▼           ▼           
Got new     Log warning
data        Continue
    │           │
    └─────┬─────┘
          ▼
    Try Sync Backend
          │
    ├───────────┬───────────┐
    │ Success   │ Fail      │
    ▼           ▼           
✅ All OK   ⚠️ Log error
            (non-critical)
            Can run manual
            sync later
            
            User still sees
            success message
            for blockchain TX
```

---

## 7. Time Sequence Diagram

```
Time    User          Frontend       Backend        Blockchain
0s      │             │              │              │
        │ Click       │              │              │
        │ "Add Owner" │              │              │
        ├────────────►│              │              │
        │             │              │              │
1s      │             │ Propose TX   │              │
        │             ├──────────────┼─────────────►│
        │             │              │              │
        │             │◄─────────────┼──────────────┤
        │             │ safeTxHash   │              │
        │◄────────────┤              │              │
        │ See pending │              │              │
        │             │              │              │
5s      │ Other owners│              │              │
        │ confirm...  │              │              │
        │             │              │              │
10s     │ Click       │              │              │
        │ "Execute"   │              │              │
        ├────────────►│              │              │
        │             │ Execute TX   │              │
        │             ├──────────────┼─────────────►│
        │             │              │              │
15s     │             │              │   Mining...  │
        │             │              │              │
20s     │             │              │   ✅ Mined   │
        │             │◄─────────────┼──────────────┤
        │             │              │              │
        │             │ Wait 2s...   │              │
        │             │              │              │
22s     │             │ Load data    │              │
        │             ├──────────────┼─────────────►│
        │             │◄─────────────┼──────────────┤
        │             │ New data     │              │
        │             │              │              │
        │             │ Sync API     │              │
        │             ├─────────────►│              │
        │             │              │ Update DB    │
        │             │              │ ✅           │
        │             │◄─────────────┤              │
        │             │ Sync OK      │              │
        │◄────────────┤              │              │
        │ See updated │              │              │
        │ UI          │              │              │
```

---

## 8. State Consistency Map

```
Blockchain State (Source of Truth)
    │
    │ Always correct
    │ Immutable once mined
    │
    ▼
┌────────────────────────┐
│ Safe Smart Contract    │
│ - owners: [A, B, C]    │
│ - threshold: 2         │
└───────────┬────────────┘
            │
            │ Sync after TX execution
            ▼
MongoDB State (Cache)
    │
    │ Updated within 2-5 seconds
    │ May be temporarily stale
    │
    ▼
┌────────────────────────┐
│ Company Document       │
│ - owners: [A, B, C]    │
│ - threshold: 2         │
└───────────┬────────────┘
            │
            │ Fast reads
            ▼
Frontend State (UI)
    │
    │ Updated immediately from MongoDB
    │ Or directly from blockchain
    │
    ▼
┌────────────────────────┐
│ React Component State  │
│ - safeInfo.owners      │
│ - safeInfo.threshold   │
└────────────────────────┘

Consistency Rules:
✅ Blockchain = Always truth
✅ MongoDB = Eventually consistent
✅ Frontend = Reads from both
⚠️  For critical ops, verify against blockchain
```

---

**Legend:**
- `│` `├` `└` `┌` `┐` `─` `▼` `►` `◄` = Flow connectors
- ✅ = Success state
- ❌ = Error state
- ⚠️ = Warning state
- ⭐ = New feature

# 📊 Company Dashboard - User Guide

## Overview

The Company Dashboard is a comprehensive interface for managing Gnosis Safe multisig wallets. It allows you to:

- 🔍 Search and load company Safe wallets
- 💰 View Safe balance and information
- 📝 Propose, confirm, and execute transactions
- 👥 Manage Safe owners (add/remove)
- 🔐 Change signature threshold
- 📜 View transaction history

## Features Implemented

### ✅ 1. Safe Wallet Search & Loading

**How to use:**

1. Navigate to "Company Dashboard" tab
2. Enter either:
   - Company **MongoDB ID** (e.g., `507f1f77bcf86cd799439011`)
   - Company **Name** (e.g., `Acme Corp`)
3. Click "Get Safe Info" or press Enter

**What you get:**

- Safe wallet address with Etherscan link
- Number of owners and threshold
- Full transaction management interface

### ✅ 2. Transaction Management

Once a Safe is loaded, you can:

#### **Propose Transaction**

- Send ETH to any address
- Execute contract calls
- Specify operation type (Call/DelegateCall)
- Transaction is submitted to Safe Transaction Service
- Other owners will see it in "Pending Transactions"

#### **Confirm Transaction**

- View all pending transactions
- See who has confirmed each transaction
- Add your signature to pending transactions
- Track confirmation progress (e.g., "2/3 confirmations")

#### **Execute Transaction**

- Once threshold is reached, execute the transaction
- Transaction is submitted to blockchain
- View transaction hash on Etherscan

### ✅ 3. Owner Management

#### **Add Owner**

- Propose adding a new owner
- Set new threshold (must be between 1 and total owners)
- Requires confirmation from existing owners
- Execute once threshold is reached

#### **Remove Owner**

- Propose removing an existing owner
- Adjust threshold accordingly
- Must maintain at least 1 owner
- Requires multi-sig confirmation

#### **Change Threshold**

- Update the number of required signatures
- Must be between 1 and number of owners
- Requires existing owners' approval

### ✅ 4. Transaction History

- View all executed transactions
- See transaction details (to, value, status)
- Track transaction confirmations
- Monitor Safe activity

## How It Works

### Architecture

```
CompanyDashboard
├── Search & Load Safe
│   ├── Query MongoDB by ID or Name
│   └── Fetch Safe info from backend
│
├── Initialize Web3Provider
│   ├── Get provider from Web3Auth
│   └── Get user's address
│
└── SafeTransactions Component
    ├── Load Safe data (balance, owners, threshold)
    ├── Fetch pending transactions (Safe Transaction Service)
    ├── Fetch transaction history
    ├── Propose new transactions
    ├── Confirm pending transactions
    ├── Execute ready transactions
    └── Manage owners & threshold
```

### State Management

```typescript
// Main states
const [safeInfo, setSafeInfo] = useState<SafeInfo | null>(null);
const [provider, setProvider] = useState<BrowserProvider | null>(null);
const [userAddress, setUserAddress] = useState<string>("");

// UI states
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string>("");
```

### Integration with SafeTransactions

The dashboard passes three essential props to `SafeTransactions`:

```typescript
<SafeTransactions
  safeAddress={safeInfo.safeAddress} // Safe wallet address
  provider={provider} // Ethers BrowserProvider
  userAddress={userAddress} // Current user's address
/>
```

## Usage Flow

### 1. Initial Setup

```typescript
// On component mount
useEffect(() => {
  initializeProvider();
}, []);

// Initialize Web3 provider
const initializeProvider = async () => {
  const ethersProvider = await getProvider();
  const address = await getAddress();
  setProvider(ethersProvider);
  setUserAddress(address);
};
```

### 2. Search for Safe

```typescript
// Search by ID or Name
const handleGetSafe = async () => {
  const info = await getCompanySafe(companyId);
  setSafeInfo(info);
};
```

### 3. Transaction Operations

Once Safe is loaded, `SafeTransactions` component handles:

- ✅ Proposing transactions via `proposeTransaction()`
- ✅ Confirming transactions via `confirmTransaction()`
- ✅ Executing transactions via `executeTransaction()`
- ✅ Managing owners via `addOwner()`, `removeOwner()`
- ✅ Changing threshold via `changeThreshold()`

## API Integration

### Backend Endpoints Used

```typescript
// Get Safe info by ID or Name
GET /api/companies/:id/safe
GET /api/companies/by-name/:name/safe

// Response
{
  safeAddress: string;
  owners: string[];
  threshold: number;
}
```

### Safe Transaction Service

The `SafeTransactions` component uses:

```typescript
// Via @safe-global/api-kit
- getPendingTransactions(safeAddress)
- getMultisigTransactions(safeAddress)
- proposeTransaction(...)
- confirmTransaction(...)
```

### Blockchain Interaction

The `SafeTransactions` component uses:

```typescript
// Via @safe-global/protocol-kit
- Safe.init({ provider, signer, safeAddress })
- safe.createTransaction(...)
- safe.signTransaction(...)
- safe.executeTransaction(...)
```

## Error Handling

### Provider Initialization Errors

```typescript
try {
  const ethersProvider = await getProvider();
  setProvider(ethersProvider);
} catch (err) {
  setError("Failed to initialize provider");
  // User can retry with "Retry" button
}
```

### Safe Loading Errors

```typescript
try {
  const info = await getCompanySafe(companyId);
  setSafeInfo(info);
} catch (err) {
  setError("Failed to get Safe info");
  // Error message displayed to user
}
```

### Transaction Errors

All transaction operations in `SafeTransactions` have proper error handling:

```typescript
catch (err) {
  const errorMessage = err instanceof Error
    ? err.message
    : 'Failed to perform operation';
  setError(errorMessage);
}
```

## Styling

The dashboard includes comprehensive CSS-in-JS styling:

- 📱 Responsive layout
- 🎨 Clean, modern UI
- ✨ Smooth transitions
- 🔗 Etherscan integration
- 📋 Code snippets for addresses
- ⚡ Loading states
- ❌ Error states

## Security Considerations

### ✅ Type Safety

- All TypeScript types are properly defined
- No `any` types used
- Proper error handling

### ✅ User Verification

- Only Safe owners can propose/confirm transactions
- UI shows if user has already confirmed
- Transaction execution requires threshold signatures

### ✅ Data Validation

- Company ID/Name validation
- Safe address validation
- Transaction data validation
- Owner address validation

## Testing the Dashboard

### 1. Create a Company

```bash
# First, create a company with multiple owners
# Via Create Company tab or API
```

### 2. Load the Safe

```bash
# In Company Dashboard
Enter: "Acme Corp" or MongoDB ID
Click: "Get Safe Info"
```

### 3. Test Transaction Flow

```bash
# Propose a transaction
1. Fill in To Address, Value, Data
2. Click "Propose Transaction"
3. Check pending transactions

# Confirm as other owners
1. Login with different owner accounts
2. Click "Confirm" on pending transaction
3. Track confirmation progress

# Execute when ready
1. Once threshold reached
2. Click "Execute"
3. View on Etherscan
```

### 4. Test Owner Management

```bash
# Add owner
1. Enter new owner address
2. Set new threshold
3. Click "Propose Add Owner"
4. Other owners confirm
5. Execute

# Remove owner
1. Select owner to remove
2. Adjust threshold
3. Click "Propose Remove Owner"
4. Multi-sig approval
5. Execute
```

## Troubleshooting

### Provider Not Initialized

**Problem:** "Initializing Web3 Provider..." stuck

**Solution:**

```typescript
// Click "Retry" button
// Or refresh page and login again
```

### Safe Not Found

**Problem:** "Failed to get Safe info"

**Solution:**

```typescript
// Check Company ID/Name is correct
// Verify company exists in database
// Try using MongoDB ID instead of name
```

### Transaction Fails

**Problem:** Transaction execution fails

**Solution:**

```typescript
// Check threshold is reached
// Verify Safe has enough ETH for gas
// Ensure all owners have confirmed
// Check transaction data is valid
```

### Not an Owner

**Problem:** "You are not an owner of this Safe"

**Solution:**

```typescript
// Login with correct owner account
// Verify address in Safe owners list
// Check Web3Auth connection
```

## Future Enhancements

### Planned Features

- [ ] Search companies by Safe address
- [ ] Batch transaction proposals
- [ ] Transaction templates
- [ ] Gas estimation display
- [ ] Token transfers (ERC20)
- [ ] NFT management
- [ ] Advanced transaction builder
- [ ] Email/Discord notifications
- [ ] Transaction scheduling

### UI Improvements

- [ ] Dark mode support
- [ ] Mobile responsiveness
- [ ] Transaction filters
- [ ] Export transaction history
- [ ] QR code for Safe address
- [ ] Owner avatars (ENS)

## Conclusion

The Company Dashboard provides a complete interface for Safe multisig management with:

✅ **Full transaction lifecycle** (propose → confirm → execute)  
✅ **Owner management** (add/remove/threshold)  
✅ **Transaction history** and monitoring  
✅ **Type-safe** TypeScript implementation  
✅ **Error handling** at every step  
✅ **Clean, modern UI** with proper loading/error states

This completes the TODO items and provides a production-ready dashboard for Safe wallet management! 🚀

# Create Company Feature Documentation

## Overview

The Create Company feature allows authenticated users to create a new company with a Gnosis Safe multisig wallet deployed on the Sepolia testnet.

## Features Implemented

### Frontend (Client)

#### 1. **CreateCompany Component** (`client/src/components/CreateCompany.tsx`)

A comprehensive form component with the following features:

- **Company Name Input**: Text field for the company name
- **Dynamic Owner Management**:
  - Add/remove owner addresses
  - "Add Me as Owner" button to automatically add the logged-in user's address
  - Ethereum address validation
  - Duplicate owner detection
- **Signature Threshold**: Set the number of required signatures (1 to N owners)
- **Real-time Validation**:
  - Valid Ethereum addresses (0x + 40 hex characters)
  - Unique owner addresses
  - Valid threshold range
- **Error & Success Handling**:
  - Display validation errors
  - Show loading state during deployment
  - Success message with Safe address

#### 2. **Updated App Component** (`client/src/App.tsx`)

- Navigation between "Create Company" and "Company Dashboard" views
- Tab-based interface after login

#### 3. **API Client** (`client/src/lib/api.ts`)

TypeScript-typed API functions:

- `createCompany()` - Create company with Safe deployment
- `getAllCompanies()` - Fetch all companies
- `getCompanyByName()` - Get company by name
- `getCompanySafe()` - Get Safe info for a company

### Backend (Server)

#### 1. **Enhanced Company Routes** (`server/routes/company.ts`)

**POST /api/companies**

- Validates request data (name, owners array, threshold)
- Checks for duplicate company names (409 Conflict)
- Deploys Safe to Sepolia testnet
- Saves company to MongoDB
- Returns created company with Safe address

**GET /api/companies**

- Returns all companies sorted by creation date

**GET /api/companies/by-name/:name**

- Get company by exact name match

**GET /api/companies/:id/safe**

- Flexible lookup by MongoDB ID or company name
- Returns Safe address, owners, and threshold

#### 2. **Updated Company Model** (`server/models/Company.ts`)

- Made `name` field unique
- Added index on `name` for faster lookups

#### 3. **CORS Support** (`server/app.ts`)

- Added CORS middleware for cross-origin requests from frontend

## Usage Flow

### 1. User Login

```typescript
// User logs in with Web3Auth
await login();
const address = await getAddress();
```

### 2. Create Company

```typescript
const companyData = {
  name: "Acme Corp",
  owners: [
    "0x1234567890123456789012345678901234567890",
    "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
  ],
  threshold: 2,
};

const result = await createCompany(companyData);
// Returns: { _id, name, safeAddress, owners, threshold, createdAt }
```

### 3. Safe Deployment

The backend automatically:

1. Validates the request
2. Deploys a Gnosis Safe with specified owners and threshold
3. Waits for blockchain confirmation
4. Saves company data to MongoDB
5. Returns the Safe address

## API Endpoints

### Create Company

```http
POST /api/companies
Content-Type: application/json

{
  "name": "Acme Corp",
  "owners": ["0x...", "0x..."],
  "threshold": 2
}

Response: 201 Created
{
  "_id": "507f1f77bcf86cd799439011",
  "name": "Acme Corp",
  "safeAddress": "0x...",
  "owners": ["0x...", "0x..."],
  "threshold": 2,
  "createdAt": "2025-10-09T..."
}
```

### Get All Companies

```http
GET /api/companies

Response: 200 OK
[
  {
    "_id": "...",
    "name": "Acme Corp",
    "safeAddress": "0x...",
    "owners": ["0x..."],
    "threshold": 2,
    "createdAt": "..."
  }
]
```

### Get Company by Name

```http
GET /api/companies/by-name/Acme%20Corp

Response: 200 OK
{
  "_id": "...",
  "name": "Acme Corp",
  ...
}
```

### Get Safe Info

```http
GET /api/companies/507f1f77bcf86cd799439011/safe
OR
GET /api/companies/Acme%20Corp/safe

Response: 200 OK
{
  "safeAddress": "0x...",
  "owners": ["0x...", "0x..."],
  "threshold": 2
}
```

## Error Handling

### Client-Side Errors

- Empty company name
- No owners specified
- Invalid Ethereum addresses
- Duplicate owner addresses
- Invalid threshold (< 1 or > number of owners)

### Server-Side Errors

- 400 Bad Request: Missing/invalid fields
- 409 Conflict: Company name already exists
- 500 Internal Server Error: Deployment or database errors

## Environment Variables

### Client (.env)

```bash
VITE_WEB3AUTH_CLIENT_ID=your_web3auth_client_id
VITE_INFURA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
VITE_CHAIN_ID=0xaa36a7
VITE_API_URL=http://localhost:3000/api
```

### Server (.env)

```bash
MONGO_URI=mongodb+srv://...
INFURA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
CHAIN_ID=11155111
DEPLOYER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY
```

⚠️ **IMPORTANT**: Set a valid `DEPLOYER_PRIVATE_KEY` with Sepolia testnet ETH to deploy Safes.

## Testing

### Manual Testing Steps

1. Start the server: `cd server && npm run dev`
2. Start the client: `cd client && npm run dev`
3. Open http://localhost:5173
4. Login with Web3Auth
5. Click "Create Company" tab
6. Fill in:
   - Company name: "Test Company"
   - Click "Add Me as Owner"
   - Set threshold to 1
7. Click "Create Company"
8. Wait for deployment (may take 30-60 seconds)
9. Verify success message shows Safe address
10. Check MongoDB for the saved company

### Example Test Data

```javascript
{
  name: "Test Corp",
  owners: [
    "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"
  ],
  threshold: 1
}
```

## Next Steps

Potential enhancements:

- [ ] Company list view with search/filter
- [ ] Edit company details
- [ ] Delete company (with Safe address validation)
- [ ] Transaction history per company
- [ ] Multi-signature transaction workflow
- [ ] Safe balance display
- [ ] Owner management (add/remove owners)
- [ ] Threshold modification

## Technical Notes

- Safe deployment uses `@safe-global/protocol-kit` v6.x
- Compatible with Gnosis Safe v1.3.0+
- Deployed on Sepolia testnet
- MongoDB indexes on company name for performance
- React 19 with TypeScript
- Express with CORS enabled

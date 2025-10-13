# 🚀 Quick Start Guide - Create Company Feature

## Prerequisites

Before you start, make sure you have:

- ✅ Node.js installed (v18+)
- ✅ A Sepolia testnet account with some ETH ([Get from faucet](https://sepoliafaucet.com/))
- ✅ MongoDB Atlas account or local MongoDB running
- ✅ Web3Auth Client ID ([Get from dashboard](https://dashboard.web3auth.io/))
- ✅ Infura API key ([Get from Infura](https://infura.io/))

## Setup Steps

### 1. Configure Environment Variables

#### Server `.env` file

```bash
cd server
cp .env.example .env  # If you have one, otherwise create .env
```

Update `/server/.env`:

```bash
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net
INFURA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
CHAIN_ID=11155111
DEPLOYER_PRIVATE_KEY=0xYOUR_SEPOLIA_PRIVATE_KEY  # ⚠️ Must have Sepolia ETH!
SAFE_TX_SERVICE_URL=https://safe-transaction-sepolia.safe.global
```

#### Client `.env` file

```bash
cd client
```

Update `/client/.env`:

```bash
VITE_WEB3AUTH_CLIENT_ID=YOUR_WEB3AUTH_CLIENT_ID
VITE_INFURA_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
VITE_CHAIN_ID=0xaa36a7
VITE_SAFE_TX_SERVICE_URL=https://safe-transaction-sepolia.safe.global
VITE_API_URL=http://localhost:3000/api
```

### 2. Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 3. Start the Application

Open **two terminal windows**:

**Terminal 1 - Backend Server:**

```bash
cd server
npm run dev
```

You should see:

```
Connected to MongoDB
Server running on port 3000
```

**Terminal 2 - Frontend Client:**

```bash
cd client
npm run dev
```

You should see:

```
VITE v7.1.9  ready in XXX ms
➜  Local:   http://localhost:5173/
```

### 4. Use the Application

1. **Open Browser**: Navigate to `http://localhost:5173/`

2. **Login**:

   - Click "Login with Web3Auth"
   - Choose login method (Google, GitHub, etc.)
   - Authenticate

3. **Create Company**:

   - You should see the "Create Company" tab active
   - Fill in company name (e.g., "Acme Corp")
   - Click "Add Me as Owner" to add your address
   - Add more owners by clicking "+ Add Another Owner"
   - Set threshold (number of required signatures)
   - Click "Create Company"

4. **Wait for Deployment**:

   - The process takes 30-60 seconds
   - Safe is being deployed to Sepolia
   - Watch the console for progress

5. **Success**:
   - You'll see the Safe address
   - Company is saved to MongoDB
   - Switch to "Company Dashboard" to view

## Troubleshooting

### Server Issues

**Error: "DEPLOYER_PRIVATE_KEY not set"**

```bash
# Make sure you set a valid private key in server/.env
DEPLOYER_PRIVATE_KEY=0xYOUR_ACTUAL_PRIVATE_KEY
```

**Error: "Insufficient funds"**

```bash
# Your deployer account needs Sepolia ETH
# Get free testnet ETH from: https://sepoliafaucet.com/
```

**Error: "Cannot connect to MongoDB"**

```bash
# Check your MONGO_URI in server/.env
# Make sure your IP is whitelisted in MongoDB Atlas
```

### Client Issues

**Error: "Invalid network, net_version is: 11155111"**

```bash
# Chain ID must be in hex format in client/.env
VITE_CHAIN_ID=0xaa36a7  # NOT 11155111
```

**Error: "Invalid hook call"**

```bash
# React version conflict - already fixed with overrides
# If persists, try:
cd client
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

**Error: "CORS policy" or "Network Error"**

```bash
# Make sure server is running on port 3000
# Check VITE_API_URL in client/.env
VITE_API_URL=http://localhost:3000/api
```

## Testing the API Directly

### Using cURL

**Create a company:**

```bash
curl -X POST http://localhost:3000/api/companies \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Company",
    "owners": [
      "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"
    ],
    "threshold": 1
  }'
```

**Get all companies:**

```bash
curl http://localhost:3000/api/companies
```

**Get company by name:**

```bash
curl http://localhost:3000/api/companies/by-name/Test%20Company
```

### Using Postman or Insomnia

Import this collection:

```json
{
  "name": "Safe Demo API",
  "requests": [
    {
      "name": "Create Company",
      "method": "POST",
      "url": "http://localhost:3000/api/companies",
      "headers": { "Content-Type": "application/json" },
      "body": {
        "name": "My Company",
        "owners": ["0x..."],
        "threshold": 1
      }
    }
  ]
}
```

## Verify Deployment on Blockchain

After creating a company, verify the Safe on Sepolia:

1. Copy the Safe address from the success message
2. Visit: `https://sepolia.etherscan.io/address/YOUR_SAFE_ADDRESS`
3. You should see the Safe contract deployed

Or use the Safe UI:

1. Visit: `https://app.safe.global/sep:YOUR_SAFE_ADDRESS`
2. View your Safe with all owners

## Next Steps

Now that you have the Create Company feature working:

1. ✅ Try creating multiple companies
2. ✅ View them in the Company Dashboard
3. ✅ Check MongoDB to see saved data
4. 🚀 Implement transaction proposals
5. 🚀 Add confirmation workflow
6. 🚀 Implement transaction execution

## Need Help?

Check the logs:

- **Server logs**: Terminal 1 (server console)
- **Client logs**: Browser DevTools Console (F12)
- **MongoDB**: MongoDB Atlas dashboard or Compass

Common log locations:

- Server: `console.log()` output in terminal
- Client: Browser Console (F12 → Console tab)
- Network: Browser DevTools → Network tab

## File Structure Created

```
safe-demo/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── CreateCompany.tsx  ✨ NEW
│   │   │   ├── Login.tsx
│   │   │   └── CompanyDashboard.tsx
│   │   ├── lib/
│   │   │   ├── api.ts  📝 UPDATED
│   │   │   └── web3auth.ts
│   │   └── App.tsx  📝 UPDATED
│   └── .env
└── server/
    ├── routes/
    │   └── company.ts  📝 UPDATED
    ├── models/
    │   └── Company.ts  📝 UPDATED
    ├── services/
    │   └── safeService.ts
    ├── app.ts  📝 UPDATED
    └── .env
```

Happy coding! 🎉

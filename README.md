# Safe Multi-Company Multisig POC

A Proof-of-Concept demonstrating how multiple companies can manage on-chain assets using **Safe (Gnosis Safe)** multisig wallets, with authentication handled by **Web3Auth** and full-stack integration through **Node.js + MongoDB Atlas + React (Vite)**.

---

## 🧭 Architecture Overview

Frontend (React + Vite + Web3Auth)
↓
Backend API (Node.js + Express + MongoDB Atlas)
↓
Blockchain (Ethereum / Sepolia + Safe Smart Contracts)

Each **company** in the platform owns its own **Safe Smart Account** with multiple owners and a configurable threshold (k-of-n).  
Members authenticate via Web3Auth to sign transactions through Safe SDK (Protocol Kit + API Kit).

---

## 🚀 Features

- ✅ Company registration and Safe creation
- ✅ Store company ↔ Safe address ↔ owners ↔ threshold in MongoDB
- ✅ Social/passwordless login via Web3Auth
- ✅ **Complete multisig transaction flow**:
  - Propose → Confirm → Execute
  - Pending transactions management
  - Transaction history
  - Owner management (add/remove)
  - Threshold management
- ✅ **Cross-Chain Token Transfers with Chainlink CCIP** (NEW):
  - Transfer tokens between multiple blockchains
  - Multi-sig approval for cross-chain transactions
  - Real-time fee calculation
  - Support for LINK and USDC tokens
  - Networks: Ethereum Sepolia, Arbitrum Sepolia, Avalanche Fuji, Polygon Amoy
- ✅ Uses Safe Transaction Service API for off-chain signatures
- ✅ Fully written in TypeScript (Node + React)
- ✅ **Full Safe Global SDK integration** with all features

---

## 🧩 Tech Stack

| Layer          | Stack                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| **Frontend**   | React 18, TypeScript, Vite, ethers v6, @safe-global/protocol-kit, @safe-global/api-kit, Web3Auth Web SDK, Chainlink CCIP |
| **Backend**    | Node.js, Express, Mongoose, dotenv                                                                       |
| **Database**   | MongoDB Atlas                                                                                            |
| **Blockchain** | Ethereum Sepolia (testnet), @safe-global/protocol-kit, @safe-global/api-kit, Chainlink CCIP, ethers v6   |

---

## ⚙️ Environment Variables

Copy the example environment files and configure them:

### Server Setup

```bash
cd server
cp .env.example .env
# Edit .env with your actual values
```

### Client Setup

```bash
cd client
cp .env.example .env
# Edit .env with your actual values
```

### Required Services

#### MongoDB Atlas

1. Create account at [MongoDB Atlas](https://cloud.mongodb.com/)
2. Create a cluster and database
3. Get connection string and update `MONGO_URI`

#### Infura

1. Create account at [Infura](https://infura.io/)
2. Create Ethereum project
3. Copy Project ID and update `INFURA_RPC_URL`

#### Web3Auth

1. Create account at [Web3Auth Dashboard](https://dashboard.web3auth.io/)
2. Create a project
3. Copy Client ID and update `VITE_WEB3AUTH_CLIENT_ID`

#### Deployer Private Key

1. Generate a new Ethereum wallet for testing
2. Fund it with Sepolia ETH from [Sepolia Faucet](https://sepoliafaucet.com/)
3. Add private key to `DEPLOYER_PRIVATE_KEY`

### Server (.env)

```bash
PORT=4000
MONGO_URI=<your_mongodb_atlas_uri>
INFURA_RPC_URL=https://sepolia.infura.io/v3/<your_key>
CHAIN_ID=11155111
SAFE_TX_SERVICE_URL=https://safe-transaction-sepolia.safe.global
DEPLOYER_PRIVATE_KEY=<your_test_private_key>
```

### Client (.env)

```bash
VITE_WEB3AUTH_CLIENT_ID=<your_web3auth_client_id>
VITE_INFURA_RPC_URL=https://sepolia.infura.io/v3/<your_key>
VITE_CHAIN_ID=11155111
VITE_SAFE_TX_SERVICE_URL=https://safe-transaction-sepolia.safe.global
VITE_API_URL=http://localhost:3000/api

# CCIP Configuration (NEW)
VITE_ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc
VITE_AVALANCHE_FUJI_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
VITE_POLYGON_AMOY_RPC_URL=https://rpc-amoy.polygon.technology
```

## 🏗️ Project Structure

```bash
/server
  ├── app.ts
  ├── routes/company.ts
  ├── models/Company.ts
  ├── services/safeService.ts
  └── ...
/client
  ├── src/
  │   ├── main.tsx
  │   ├── App.tsx
  │   ├── components/
  │   │   ├── Login.tsx
  │   │   ├── CompanyDashboard.tsx
  │   │   ├── CreateCompany.tsx
  │   │   ├── SafeTransactions.tsx (Complete UI with tabs)
  │   │   └── CCIPTransfer.tsx (NEW - Cross-chain transfer UI)
  │   └── lib/
  │       ├── web3auth.ts
  │       ├── safe.ts
  │       ├── safeFlow.ts (Complete implementation + CCIP)
  │       ├── ccipConfig.ts (NEW - CCIP network configs)
  │       └── api.ts
/docs
  ├── CCIP_INTEGRATION_GUIDE.md (NEW - CCIP detailed guide)
  ├── CCIP_QUICK_START.md (NEW - CCIP quick start)
  ├── SAFE_FLOW_DOCUMENTATION.md (API docs)
  ├── SAFE_FLOW_README.md (Quick start)
  └── IMPLEMENTATION_SUMMARY.md (Overview)
```

## 📖 Safe Flow Documentation

The project now includes a **complete implementation** of Safe Global transaction flow with **all issues fixed** and updated to the latest SDK versions (Protocol Kit v6, API Kit v4).

### Documentation Files:
- **[SAFE_FLOW_README.md](./SAFE_FLOW_README.md)** - Quick start guide and features overview
- **[SAFE_FLOW_DOCUMENTATION.md](./SAFE_FLOW_DOCUMENTATION.md)** - Comprehensive API documentation
- **[SAFE_FLOW_QUICK_REFERENCE.md](./SAFE_FLOW_QUICK_REFERENCE.md)** - Quick reference card with code snippets
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** - Implementation details and summary
- **[FIXES_APPLIED.md](./FIXES_APPLIED.md)** - Migration guide and fixes documentation
- **[COMPLETION_SUMMARY.md](./COMPLETION_SUMMARY.md)** - Project completion status

### ✅ All Issues Fixed:
- ✅ Deprecated `@safe-global/safe-core-sdk-types` replaced with `@safe-global/types-kit`
- ✅ `EthersAdapter` import error fixed (updated to SDK v6 API)
- ✅ All TypeScript errors resolved
- ✅ Zero compilation errors
- ✅ Production-ready code

### Key Features Implemented

✅ **Transaction Management**
- Propose, confirm, and execute transactions
- Query pending transactions
- View transaction history

✅ **Safe Information**
- Get Safe details (owners, threshold, balance)
- Check ownership status

✅ **Owner Management**
- Add new owners
- Remove existing owners
- Change confirmation threshold

✅ **Multi-Network Support**
- Ethereum Mainnet, Sepolia, Goerli, Polygon, Gnosis Chain

## � Chainlink CCIP Integration

The project now supports **cross-chain token transfers** using Chainlink's Cross-Chain Interoperability Protocol (CCIP), secured by Safe's multi-sig mechanism.

### Documentation Files:
- **[CCIP_QUICK_START.md](./CCIP_QUICK_START.md)** - Quick start guide for CCIP transfers
- **[CCIP_INTEGRATION_GUIDE.md](./CCIP_INTEGRATION_GUIDE.md)** - Comprehensive integration documentation

### ✨ CCIP Features:
- ✅ Cross-chain token transfers (LINK, USDC)
- ✅ Multi-sig approval required for CCIP transactions
- ✅ Real-time fee calculation
- ✅ Balance validation
- ✅ Support for 4 testnets:
  - Ethereum Sepolia
  - Arbitrum Sepolia
  - Avalanche Fuji
  - Polygon Amoy

### How to Use CCIP:
1. Navigate to "Cross-Chain Transfer" tab
2. Select destination network
3. Choose token and enter amount
4. Calculate transfer fee
5. Propose transaction
6. Get multi-sig approvals
7. Execute cross-chain transfer

See **[CCIP_QUICK_START.md](./CCIP_QUICK_START.md)** for detailed instructions.

## �🔧 Running Locally

### 1. Install Dependencies
```bash
# Backend
cd server
npm install

# Client
cd client
npm install
```

### 2. Configure Environment Variables

Follow the setup instructions in the Environment Variables section above.

### 3. Start the Backend

```bash
cd server
npm run dev
```

Backend will run on `http://localhost:4000`

### 4. Start the Frontend

```bash
cd client
npm run dev
```

Frontend will run on `http://localhost:5173`

The React app will connect to the Express API and the blockchain testnet defined in your .env.

### 5. Using Safe Transactions

Import and use the `SafeTransactions` component:

```typescript
import SafeTransactions from "./components/SafeTransactions";
import { BrowserProvider } from "ethers";

function App() {
  const provider = new BrowserProvider(window.ethereum);
  
  return (
    <SafeTransactions
      safeAddress="0x123..."
      provider={provider}
      userAddress="0xUser..."
    />
  );
}
```

🔐 Authentication Flow

User logs in via Web3Auth → gets EOA signer.

The app queries backend for the company’s Safe address and owners.

The signer interacts with Safe SDK to propose, confirm, or execute transactions.

Transactions are coordinated through Safe Transaction Service until the threshold is met.

🧠 Key Concepts
Concept Description
Safe Address Smart-contract wallet representing a company’s collective account
Owners EOA addresses (from Web3Auth signers) who control the Safe
Threshold Minimum number of owner signatures required for execution
Transaction Service Off-chain coordination server for collecting multisig confirmations

🧪 Development Notes

Default chain: Sepolia testnet

Deploy Safe contracts via SDK (SafeFactory.deploySafe)

Make sure each owner logs in at least once to generate their Web3Auth EOA address

Confirm ownership by comparing signer.getAddress() with safeSdk.getOwners()

Never store private keys or secrets in the repository

## 📚 References

### Safe Global
- [Safe {Core} SDK Documentation](https://docs.safe.global/safe-core-aa-sdk)
- [Safe Transaction Service API](https://docs.safe.global/learn/safe-core/safe-core-api-kit)
- [Protocol Kit](https://docs.safe.global/sdk/protocol-kit)
- [API Kit](https://docs.safe.global/sdk/api-kit)

### Web3 & Authentication
- [Web3Auth Docs](https://web3auth.io/docs/sdk/web)
- [ethers.js v6](https://docs.ethers.org/v6/)

### Database
- [MongoDB Atlas Docs](https://www.mongodb.com/docs/atlas/)

### Project Documentation
- [Safe Flow Quick Start](./SAFE_FLOW_README.md)
- [Safe Flow API Documentation](./SAFE_FLOW_DOCUMENTATION.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)
- [Create Company Feature](./CREATE_COMPANY_FEATURE.md)
- [Quick Start Guide](./QUICKSTART.md)

🧾 License

MIT – for educational / PoC use only

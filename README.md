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

- Company registration and Safe creation
- Store company ↔ Safe address ↔ owners ↔ threshold in MongoDB
- Social/passwordless login via Web3Auth
- Multisig transaction flow:
  - Propose → Confirm → Execute
- Uses Safe Transaction Service API for off-chain signatures
- Fully written in TypeScript (Node + React)

---

## 🧩 Tech Stack

| Layer          | Stack                                                                                                    |
| -------------- | -------------------------------------------------------------------------------------------------------- |
| **Frontend**   | React 18, TypeScript, Vite, ethers v5, @safe-global/protocol-kit, @safe-global/api-kit, Web3Auth Web SDK |
| **Backend**    | Node.js, Express, Mongoose, dotenv                                                                       |
| **Database**   | MongoDB Atlas                                                                                            |
| **Blockchain** | Ethereum Sepolia (testnet), @safe-global/protocol-kit, @safe-global/api-kit, ethers v5                   |

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
```

🏗️ Project Structure

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
  │   │   └── CompanyDashboard.tsx
  │   └── lib/
  │       ├── web3auth.ts
  │       ├── safe.ts
  │       ├── safeFlow.ts
  │       └── api.ts

```

🔧 Running Locally

1. Backend
   cd server
   npm install
   npm run dev

2. Frontend
   cd client
   npm install
   npm run dev

The React app will connect to the Express API and the blockchain testnet defined in your .env.

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

📚 References

Safe {Core} SDK Documentation https://docs.safe.global/safe-core-aa-sdk

Safe Transaction Service API https://docs.safe.global/learn/safe-core/safe-core-api-kit

Web3Auth Docs https://web3auth.io/docs/sdk/web

ethers.js v5 https://docs.ethers.io/v5/

MongoDB Atlas Docs https://www.mongodb.com/docs/atlas/

🧾 License

MIT – for educational / PoC use only

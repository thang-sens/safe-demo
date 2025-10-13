🎯 Project Context

You are assisting in building a POC platform for multi-company Safe multisig management.
Each company has its own Safe Smart Account (Gnosis Safe) deployed on-chain with multiple owners.
The tech stack is Node.js + Mongo Atlas + React (Vite).

🧠 Copilot Behavior Guidelines

Always separate backend (/server) and frontend (/client) code.

All code must be in TypeScript (both Node and React).

Use modern syntax (ESM imports, async/await).

Avoid unnecessary complexity: only implement essential APIs, models, and UI.

Prefer readable, commented code over compact code.

Use @safe-global/protocol-kit and @safe-global/api-kit for blockchain interaction.

Use ethers v5 for provider/signer handling.

Integrate Web3Auth Web SDK to issue EOA signers.

Connect to Mongo Atlas with Mongoose.

Do not write private keys or secrets into code; always use .env variables.

When generating components or routes, include brief documentation comments explaining purpose and usage.

📦 Project Structure Expectations
/server
├─ models/Company.ts # Mongoose schema for companies
├─ services/safeService.ts # Safe creation + blockchain logic
├─ routes/company.ts # Express router
└─ app.ts # Main entry
/client
├─ src/lib/web3auth.ts # Web3Auth integration
├─ src/lib/safe.ts # Safe SDK setup
├─ src/lib/safeFlow.ts # Propose/Confirm/Execute logic
├─ src/components/Login.tsx
├─ src/components/CompanyDashboard.tsx
└─ src/App.tsx

🧩 Response Preferences

Prefer TypeScript code blocks.

Use concise explanations before code if needed.

When generating new files, include relative paths and filenames in headings.

Avoid generating environment-specific secrets.

When Copilot is unsure, default to minimal functional implementation rather than pseudocode.

# 🔐 How to Get a Deployer Private Key for Testing

## ⚠️ CRITICAL SECURITY NOTES

1. **NEVER use a private key that holds real funds!**
2. **NEVER commit your private key to Git!**
3. **ONLY use this for Sepolia testnet!**
4. The `.env` file is in `.gitignore` - keep it that way!

## What is a Private Key?

A private key is a **64-character hexadecimal string** (with `0x` prefix = 66 chars total) that controls an Ethereum account.

**Format:** `0x` + 64 hex characters

**Example:** `0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`

❌ **NOT an address:** `0x5202487a23D600a199cFD4e7D28df36006064681` (only 40 chars - this is an address!)

## Option 1: Create New Account with MetaMask (Recommended)

1. **Install MetaMask** browser extension: https://metamask.io/

2. **Create a new account** in MetaMask:

   - Click the account icon (top right)
   - Select "Create Account"
   - Name it "Sepolia Test Deployer"

3. **Export Private Key**:

   - Click the 3 dots next to the account name
   - Select "Account Details"
   - Click "Show Private Key"
   - Enter your MetaMask password
   - Copy the private key (should be 64 hex chars)

4. **Switch to Sepolia Network**:

   - Click network dropdown (top left)
   - Enable "Show test networks" in settings if needed
   - Select "Sepolia test network"

5. **Get Test ETH**:

   - Visit: https://sepoliafaucet.com/
   - Or: https://www.infura.io/faucet/sepolia
   - Paste your account address
   - Request testnet ETH (you'll need ~0.1 ETH for deployments)

6. **Add to .env**:
   ```bash
   DEPLOYER_PRIVATE_KEY=0xYOUR_64_CHARACTER_PRIVATE_KEY_HERE
   ```

## Option 2: Use Hardhat/Ethers to Generate

If you have Node.js installed:

```bash
# Install ethers
npm install -g ethers

# Run in terminal
node -e "const ethers = require('ethers'); const wallet = ethers.Wallet.createRandom(); console.log('Address:', wallet.address); console.log('Private Key:', wallet.privateKey);"
```

This will output:

```
Address: 0x1234567890123456789012345678901234567890
Private Key: 0xabcdef...  (64 chars)
```

Copy the **Private Key** to your `.env` file, then send testnet ETH to the **Address**.

## Option 3: Use an Existing Test Account

If you already have a Sepolia test account with ETH:

1. Export the private key from your wallet (MetaMask, etc.)
2. Make sure it's on Sepolia network
3. Verify it has some testnet ETH (check on https://sepolia.etherscan.io)

## Verify Your Setup

After adding the private key to `.env`:

1. **Check the format**:

   ```bash
   # Should be exactly 66 characters (0x + 64 hex)
   DEPLOYER_PRIVATE_KEY=0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
   ```

2. **Verify the address** has Sepolia ETH:

   ```bash
   # In your server directory
   cd server
   node -e "const ethers = require('ethers'); const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY || ''); console.log('Deployer Address:', wallet.address);"
   ```

3. **Check balance** on Sepolia:
   - Go to https://sepolia.etherscan.io
   - Search for the address
   - Should show ETH balance

## How Much ETH Do I Need?

- **Safe Deployment**: ~0.01-0.05 ETH per Safe
- **Recommended**: Start with 0.1 ETH for testing

## Get Free Sepolia ETH

### Faucets:

1. **Alchemy Faucet**: https://sepoliafaucet.com/
2. **Infura Faucet**: https://www.infura.io/faucet/sepolia
3. **QuickNode Faucet**: https://faucet.quicknode.com/ethereum/sepolia

### Requirements:

- Most faucets require:
  - Twitter/GitHub account (for verification)
  - Mainnet account with minimal ETH (0.001 ETH)
- You can request ETH once per 24 hours

## Troubleshooting

### Error: "invalid private key"

- ❌ You're using an address instead of a private key
- ✅ Private key should be 66 chars (0x + 64 hex)

### Error: "insufficient funds"

- ❌ Your deployer account has no Sepolia ETH
- ✅ Get testnet ETH from a faucet

### Error: "DEPLOYER_PRIVATE_KEY is not set"

- ❌ `.env` file doesn't have the variable
- ✅ Make sure variable name matches exactly

### Private Key Format Examples

✅ **VALID Private Keys:**

```bash
0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
0xABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890
0xa1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
```

❌ **INVALID (These are addresses, not private keys):**

```bash
0x5202487a23D600a199cFD4e7D28df36006064681
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

## Security Checklist

- [ ] Created a new account specifically for testing
- [ ] Account only has Sepolia testnet ETH (no mainnet funds)
- [ ] Private key is in `.env` file (not in code)
- [ ] `.env` is in `.gitignore`
- [ ] Never shared private key publicly
- [ ] Using different account than personal wallet

## Quick Start Command

After setting up your private key:

```bash
# 1. Update .env with your private key
DEPLOYER_PRIVATE_KEY=0xYOUR_PRIVATE_KEY

# 2. Restart server
cd server
npm run dev

# 3. Try creating a company
# The server will validate your private key format automatically
```

## Need Help?

Check server logs for detailed error messages:

- Invalid format errors will show expected vs actual length
- The server validates the key before attempting deployment
- Look for error messages in the server console

---

Remember: **Test accounts only!** 🔒

# 🎯 CCIP Dual Fee Payment Solution (ETH + LINK)

## ✅ Confirmation from Chainlink Official Documentation

From: https://docs.chain.link/ccip/tutorials/evm/cross-chain-tokens/register-from-safe-burn-mint-hardhat

> **"Transferring Tokens: Finally, you will transfer tokens from Ethereum Sepolia to BASE Sepolia using CCIP. You can pay CCIP fees using either LINK tokens or native gas tokens."**

**Proof:** The tutorial has TWO separate sections:

- ✅ "Pay fees in LINK"
- ✅ "Pay fees in native gas tokens"

**Both work with Safe multisig!** ��

---

## 🔍 Why Our ETH Fee Failed Earlier

The issue was NOT Safe's limitation, but our **implementation approach**:

### ❌ What We Did Wrong:

```typescript
// We set value in Safe transaction metadata
const transaction = {
  to: router,
  value: feeInWei, // ← Stored but may not forward properly
  data: ccipSendCallData,
};
```

### ✅ What Chainlink Does (from their example):

```typescript
// They use Router's ccipSend with native token properly
// The key: Transaction structure and gas settings

const message = {
  receiver: receiverBytes,
  data: "0x",
  tokenAmounts: [{ token, amount }],
  feeToken: "0x0000000000000000000000000000000000000000", // ← Zero address = native ETH
  extraArgs: extraArgsV2,
};

// Call ccipSend with value
await router.ccipSend(destinationSelector, message, {
  value: fee, // ← THIS is how native fee works
});
```

---

## 🛠️ Implementation Plan

### 1. Update `calculateCCIPFee` to support both modes

```typescript
export const calculateCCIPFee = async (
  params: CCIPTransferParams,
  provider: BrowserProvider,
  feeToken: "LINK" | "native" = "LINK" // ← Add choice parameter
): Promise<CCIPFeeEstimate> => {
  const ccipClient = createClient();

  // For native fees: feeTokenAddress = undefined (or zero address)
  // For LINK fees: feeTokenAddress = LINK token address
  const linkToken =
    feeToken === "LINK" ? getTokenBySymbol(params.sourceNetwork, "LINK") : null;

  const feeEstimate = await ccipClient.getFee({
    client: publicClient,
    routerAddress,
    destinationChainSelector: destChainSelector,
    tokenAmounts: [{ token: token.address, amount: amountBN }],
    destinationAccount: params.recipientAddress,
    feeTokenAddress: linkToken?.address, // undefined for native
    extraArgs: extraArgsV2,
  });

  return {
    feeInWei: feeEstimate.toString(),
    feeFormatted: ethers.formatEther(feeEstimate),
    feeToken: feeToken, // Track which token is used
  };
};
```

### 2. Update `buildCCIPSafeTransaction` to handle both fee types

```typescript
export const buildCCIPSafeTransaction = async (
  params: CCIPTransferParams,
  safeAddress: string,
  provider: BrowserProvider,
  feeToken: "LINK" | "native" = "LINK" // ← Add parameter
): Promise<{
  transactions: MetaTransactionData[];
  estimatedFee: CCIPFeeEstimate;
}> => {
  const estimatedFee = await calculateCCIPFee(params, provider, feeToken);

  const transactions: MetaTransactionData[] = [];

  // 1. Token approval (always needed)
  const tokenApprovalData = tokenContract.interface.encodeFunctionData(
    "approve",
    [routerAddress, amountBN]
  );

  transactions.push({
    to: token.address,
    value: "0",
    data: tokenApprovalData,
    operation: 0,
  });

  // 2. LINK approval (only if using LINK fees)
  if (feeToken === "LINK") {
    const linkToken = getTokenBySymbol(params.sourceNetwork, "LINK");
    if (!linkToken) {
      throw new Error("LINK token not found");
    }

    const linkContract = new ethers.Contract(
      linkToken.address,
      IERC20ABI,
      provider
    );
    const linkAllowance = await linkContract.allowance(
      safeAddress,
      routerAddress
    );
    const linkFeeAmount = BigInt(estimatedFee.feeInWei);

    if (linkAllowance < linkFeeAmount) {
      const linkApprovalData = linkContract.interface.encodeFunctionData(
        "approve",
        [routerAddress, linkFeeAmount]
      );

      transactions.push({
        to: linkToken.address,
        value: "0",
        data: linkApprovalData,
        operation: 0,
      });
    }
  }

  // 3. Build CCIP message
  const ccipMessage = {
    receiver: receiverBytes,
    data: "0x",
    tokenAmounts: [{ token: token.address, amount: amountBN }],
    feeToken:
      feeToken === "LINK"
        ? linkToken.address
        : "0x0000000000000000000000000000000000000000", // ← Zero address for native
    extraArgs: extraArgsV2,
  };

  // 4. Encode ccipSend call
  const ccipSendData = routerContract.interface.encodeFunctionData("ccipSend", [
    destChainSelector,
    ccipMessage,
  ]);

  // 5. Add ccipSend transaction
  transactions.push({
    to: routerAddress,
    value: feeToken === "native" ? estimatedFee.feeInWei : "0", // ← ETH value for native fees!
    data: ccipSendData,
    operation: 0,
  });

  console.log(`[CCIP Build] Fee payment method: ${feeToken}`);
  console.log(
    `[CCIP Build] Transaction value: ${
      feeToken === "native" ? estimatedFee.feeInWei : "0"
    }`
  );
  console.log(`[CCIP Build] Total transactions: ${transactions.length}`);

  return { transactions, estimatedFee };
};
```

### 3. Update UI to let user choose

```typescript
// CCIPTransfer.tsx
const [feeToken, setFeeToken] = useState<"LINK" | "native">("LINK");

// Fee calculation
const handleCalculateFee = async () => {
  try {
    const fee = await calculateCCIPFee(
      {
        sourceNetwork,
        destinationNetwork: formData.destinationNetwork,
        tokenSymbol: formData.tokenSymbol,
        amount: formData.amount,
        recipientAddress: formData.recipientAddress,
      },
      provider,
      feeToken // ← Use selected fee token
    );
    setFeeEstimate(fee);
  } catch (err) {
    setError(err.message);
  }
};

// Propose transaction
const handleProposeTransfer = async (e: React.FormEvent) => {
  e.preventDefault();

  const { transactions, estimatedFee } = await buildCCIPSafeTransaction(
    params,
    safeAddress,
    provider,
    feeToken // ← Use selected fee token
  );

  // ... rest of propose logic
};
```

### 4. UI Component for Fee Token Selection

```tsx
{
  /* Fee Token Selection */
}
<div className="fee-token-selection">
  <label>Pay CCIP Fee With:</label>
  <div className="radio-group">
    <label>
      <input
        type="radio"
        value="LINK"
        checked={feeToken === "LINK"}
        onChange={() => setFeeToken("LINK")}
      />
      <span>LINK Token</span>
      <span className="info">✅ Recommended - More reliable</span>
    </label>

    <label>
      <input
        type="radio"
        value="native"
        checked={feeToken === "native"}
        onChange={() => setFeeToken("native")}
      />
      <span>Native ETH</span>
      <span className="info">⚠️ Requires Safe to have ETH</span>
    </label>
  </div>
</div>;

{
  /* Fee Display */
}
{
  feeEstimate && (
    <div className="fee-display">
      <p>
        CCIP Fee: {feeEstimate.feeFormatted}{" "}
        {feeToken === "LINK" ? "LINK" : "ETH"}
      </p>

      {feeToken === "native" && (
        <div className="warning">
          ⚠️ Make sure Safe has at least {feeEstimate.feeFormatted} ETH!
        </div>
      )}

      {feeToken === "LINK" && (
        <div className="info">
          ✅ Safe needs {feeEstimate.feeFormatted} LINK tokens
        </div>
      )}
    </div>
  );
}
```

---

## 🧪 Testing Strategy

### Test Case 1: LINK Fee Payment

```bash
# 1. Ensure Safe has LINK tokens
# 2. Select "LINK Token" in UI
# 3. Calculate Fee → Shows "X LINK"
# 4. Propose Transfer → Creates 2-3 transactions:
#    - Token approval
#    - LINK approval (if needed)
#    - ccipSend with value="0"
# 5. Execute → ✅ Should succeed
```

### Test Case 2: Native ETH Fee Payment

```bash
# 1. Ensure Safe has enough ETH (fee + gas)
# 2. Select "Native ETH" in UI
# 3. Calculate Fee → Shows "X ETH"
# 4. Propose Transfer → Creates 2 transactions:
#    - Token approval
#    - ccipSend with value=feeAmount
# 5. Execute → ✅ Should succeed (if implemented correctly)
```

---

## 📋 Key Differences Between LINK and Native Fees

| Aspect                     | LINK Fees                          | Native ETH Fees                    |
| -------------------------- | ---------------------------------- | ---------------------------------- |
| **Transaction Value**      | `value: "0"`                       | `value: feeInWei`                  |
| **feeToken in Message**    | `LINK.address`                     | `"0x000..."` (zero address)        |
| **Number of Transactions** | 2-3 (token + LINK approval + send) | 2 (token approval + send)          |
| **Safe Requirement**       | Must have LINK tokens              | Must have ETH balance              |
| **Reliability**            | ✅ More reliable (ERC20 standard)  | ⚠️ Depends on msg.value forwarding |
| **Gas Cost**               | Slightly higher (extra approval)   | Slightly lower                     |

---

## 🎯 Recommended Approach

### Default to LINK (Current Implementation) ✅

**Why:**

1. Already tested and working
2. No msg.value forwarding issues
3. Consistent across all Safe versions
4. Official recommendation from Chainlink for production

### Add Native ETH as Optional Feature ⚡

**Use case:**

- Users who prefer to use ETH
- Cost optimization (fewer transactions)
- Testing different fee payment methods

### Implementation Order:

1. ✅ Keep current LINK implementation as default
2. ⏳ Add native ETH as experimental/beta feature
3. ⏳ Test thoroughly on testnet
4. ⏳ Add clear warnings about requirements
5. ⏳ Enable in production after validation

---

## 🚀 Next Steps

1. **Update TypeScript interfaces** to support `feeToken` parameter
2. **Modify `calculateCCIPFee`** with conditional logic
3. **Update `buildCCIPSafeTransaction`** to handle both modes
4. **Add UI toggle** for fee token selection
5. **Create balance checks** for both LINK and ETH
6. **Test both modes** extensively on Sepolia
7. **Document** the differences and requirements

---

## 💡 Pro Tips

### For Native ETH Fees:

- ⚠️ Safe balance MUST decrease by fee amount (verify in logs)
- ⚠️ Gas limit might need adjustment for value forwarding
- ⚠️ Monitor Safe's ETH balance before execution
- ⚠️ Consider adding auto-fallback to LINK if ETH fails

### For LINK Fees:

- ✅ More predictable behavior
- ✅ Works consistently across all Safe versions
- ✅ Easier to debug (standard ERC20 flow)
- ✅ Recommended for production use

---

## 📚 References

1. **Chainlink Official Tutorial:**  
   https://docs.chain.link/ccip/tutorials/evm/cross-chain-tokens/register-from-safe-burn-mint-hardhat

2. **Safe Protocol Kit:**  
   https://docs.safe.global/sdk/protocol-kit

3. **CCIP Router Interface:**  
   Check `routerAbi` in ccip-javascript-sdk artifacts

4. **Safe Transaction Structure:**  
   https://docs.safe.global/core-api/transaction-service-overview

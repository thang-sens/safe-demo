# 📡 CCIP Message Tracking Guide

## 🎯 Tổng quan

Sau khi thực hiện CCIP cross-chain transfer thông qua Safe, bạn có thể track trạng thái của message để biết:
- ✅ Message đã được gửi thành công chưa
- ⏳ Message đang ở giai đoạn nào
- 🎉 Token đã đến destination chain chưa

## 🔍 Cách sử dụng

### Step 1: Execute CCIP Transfer
1. Propose cross-chain transfer
2. Các owners confirm transaction
3. Execute transaction khi đủ threshold
4. **Lưu lại transaction hash** từ executed transaction

### Step 2: Track Message
1. Vào tab **"Cross-Chain Transfer"** trong Safe Dashboard
2. Scroll xuống section **"Track CCIP Transfer"**
3. Paste **transaction hash** từ step 1
4. Click **"Track Message"**

### Step 3: View Status
- **Message ID** sẽ được extract từ transaction
- **Status** hiển thị trạng thái hiện tại
- **CCIP Explorer link** để xem chi tiết on-chain

## 📊 Message Status

| Status | Ý nghĩa | Action |
|--------|---------|--------|
| `IN_PROGRESS` | Message đang được xử lý | Đợi vài phút |
| `SUCCESS` | Transfer thành công | Check token trên destination chain |
| `FAILED` | Transfer thất bại | Check logs trên explorer |
| `NOT_FOUND` | Không tìm thấy message | Check lại transaction hash |

## 🔧 Technical Implementation

### 1. Extract Message ID từ Transaction

```typescript
export const getCCIPMessageId = async (
  txHash: string,
  provider: BrowserProvider
): Promise<string | null> => {
  const receipt = await provider.getTransactionReceipt(txHash);
  
  // CCIP Router emits CCIPSendRequested event
  const ccipEventTopic = "0x8832dc5c91b7173c8eb69ccee5d24c4d4ff537b6a89b0e58b17e8b6f3f847e06";
  
  const ccipLog = receipt.logs.find(log => log.topics[0] === ccipEventTopic);
  
  if (ccipLog && ccipLog.topics[1]) {
    return ccipLog.topics[1]; // messageId
  }

  return null;
};
```

**Cách hoạt động:**
1. Lấy transaction receipt từ blockchain
2. Tìm log với topic = `CCIPSendRequested` event
3. Extract `messageId` từ indexed parameter đầu tiên

**Event Signature:**
```solidity
event CCIPSendRequested(
    bytes32 indexed messageId,
    // ... other parameters
);
```

### 2. Check Message Status

```typescript
export const checkCCIPTransferStatus = async (
  messageId: string
): Promise<{
  status: "SUCCESS" | "IN_PROGRESS" | "FAILED" | "NOT_FOUND";
  explorerUrl?: string;
}> => {
  // CCIP Explorer URL
  const explorerUrl = `https://ccip.chain.link/msg/${messageId}`;
  
  return {
    status: "IN_PROGRESS",
    explorerUrl,
  };
};
```

**Current Implementation:**
- Trả về CCIP Explorer URL để manual checking
- Status mặc định là `IN_PROGRESS`

**Future Enhancement:**
- Call CCIP Explorer API để get real-time status
- Query on-chain state từ OffRamp contract
- Use CCIP SDK's tracking methods

### 3. UI Component

```tsx
// State management
const [trackingTxHash, setTrackingTxHash] = useState<string>("");
const [ccipMessageId, setCcipMessageId] = useState<string>("");
const [messageStatus, setMessageStatus] = useState<{...} | null>(null);

// Track message handler
const handleTrackMessage = async (e: React.FormEvent) => {
  e.preventDefault();
  
  // Get message ID from transaction
  const messageId = await getCCIPMessageId(trackingTxHash, provider);
  setCcipMessageId(messageId);

  // Check message status
  const status = await checkCCIPTransferStatus(messageId);
  setMessageStatus(status);
};
```

## 🌐 CCIP Explorer

### URL Format
```
https://ccip.chain.link/msg/{messageId}
```

### Thông tin hiển thị
- ✅ Message ID
- ✅ Source chain và destination chain
- ✅ Sender và receiver addresses
- ✅ Token amount và type
- ✅ Fee paid
- ✅ Timestamp
- ✅ Current status
- ✅ Transaction hashes (source và destination)

### Example
```
https://ccip.chain.link/msg/0x1234...5678
```

## 🔄 CCIP Message Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Transaction Execution                                        │
│     - Safe executes ccipSend() transaction                       │
│     - CCIP Router emits CCIPSendRequested event                  │
│     - messageId is generated                                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. Cross-Chain Messaging                                        │
│     - DON (Decentralized Oracle Network) picks up message        │
│     - Message is validated and signed                            │
│     - Merkle proof is created                                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. Destination Chain Execution                                  │
│     - OffRamp contract receives message                          │
│     - Tokens are released to recipient                           │
│     - ExecutionStateChanged event is emitted                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. Completion                                                   │
│     - Recipient receives tokens                                  │
│     - Status = SUCCESS                                           │
│     - Viewable on CCIP Explorer                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 🎯 Example Usage Flow

### Scenario: Transfer 10 LINK từ Sepolia → Arbitrum Sepolia

**Step 1: Propose Transfer**
```
- Source: Ethereum Sepolia
- Destination: Arbitrum Sepolia
- Token: LINK
- Amount: 10
- Recipient: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
- Fee: ~0.002 ETH
```

**Step 2: Confirm & Execute**
```
Owner 1: ✅ Signed
Owner 2: ✅ Signed
Threshold: 2/3
Execute: ✅ Success

Transaction Hash: 0xabc123...def456
```

**Step 3: Track Message**
```
Input Transaction Hash: 0xabc123...def456

Output:
  Message ID: 0x789012...345678
  Status: IN_PROGRESS
  Explorer: https://ccip.chain.link/msg/0x789012...345678
```

**Step 4: Check on Explorer**
```
CCIP Explorer shows:
  ✅ Source: Ethereum Sepolia
  ✅ Destination: Arbitrum Sepolia
  ✅ Amount: 10 LINK
  ✅ Status: SUCCESS (after ~10-20 minutes)
  ✅ Dest Tx: 0x987654...321098
```

**Step 5: Verify on Destination**
```
Check Arbitrum Sepolia:
  Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
  LINK Balance: +10 LINK ✅
```

## 🚀 Advanced Features (Future)

### 1. Real-time Status Updates

```typescript
// Poll for status changes
const pollMessageStatus = async (messageId: string) => {
  const interval = setInterval(async () => {
    const status = await checkCCIPTransferStatus(messageId);
    
    if (status.status === "SUCCESS" || status.status === "FAILED") {
      clearInterval(interval);
      // Notify user
    }
  }, 30000); // Check every 30 seconds
};
```

### 2. On-chain Status Check

```typescript
// Query OffRamp contract directly
const checkOnChainStatus = async (messageId: string) => {
  const offRampContract = new ethers.Contract(
    offRampAddress,
    offRampABI,
    destProvider
  );
  
  const executionState = await offRampContract.getExecutionState(messageId);
  
  return executionState; // 0: UNTOUCHED, 1: IN_PROGRESS, 2: SUCCESS, 3: FAILURE
};
```

### 3. Notification System

```typescript
// Send notification when status changes
const notifyStatusChange = (messageId: string, newStatus: string) => {
  if (newStatus === "SUCCESS") {
    showNotification("Transfer complete! 🎉");
  } else if (newStatus === "FAILED") {
    showNotification("Transfer failed ❌");
  }
};
```

### 4. Batch Tracking

```typescript
// Track multiple transfers at once
const trackMultipleTransfers = async (txHashes: string[]) => {
  const results = await Promise.all(
    txHashes.map(hash => getCCIPMessageId(hash, provider))
  );
  
  return results.filter(id => id !== null);
};
```

## 📚 References

### Documentation
- [CCIP Explorer](https://ccip.chain.link/)
- [CCIP Documentation](https://docs.chain.link/ccip)
- [Message Tracking Guide](https://docs.chain.link/ccip/tutorials/track-your-cross-chain-transaction)

### Smart Contracts
- **Router Contract**: Emits `CCIPSendRequested` event
- **OffRamp Contract**: Handles message execution on destination
- **Event Signature**: `0x8832dc5c91b7173c8eb69ccee5d24c4d4ff537b6a89b0e58b17e8b6f3f847e06`

### APIs
- CCIP Explorer: `https://ccip.chain.link/msg/{messageId}`
- Testnet Explorers:
  - Sepolia: `https://sepolia.etherscan.io/tx/{txHash}`
  - Arbitrum Sepolia: `https://sepolia.arbiscan.io/tx/{txHash}`
  - Avalanche Fuji: `https://testnet.snowtrace.io/tx/{txHash}`
  - Polygon Amoy: `https://amoy.polygonscan.com/tx/{txHash}`

## ✅ Summary

| Feature | Status | Notes |
|---------|--------|-------|
| Extract Message ID | ✅ Working | From transaction logs |
| CCIP Explorer Link | ✅ Working | Auto-generated |
| Status Display | ✅ Basic | Shows IN_PROGRESS by default |
| Real-time Updates | 🔜 Planned | Future enhancement |
| On-chain Queries | 🔜 Planned | Direct OffRamp check |
| Notifications | 🔜 Planned | Push notifications |

**Ready to track CCIP messages! 🚀**

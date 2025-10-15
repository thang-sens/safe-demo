# 🧪 CCIP Testing Checklist

## Pre-requisites

### 1. Testnet Setup
- [ ] Có ít nhất 1 Safe wallet đã deploy trên Sepolia
- [ ] Safe có ít nhất 2 owners (để test multi-sig)
- [ ] Threshold được set phù hợp (ví dụ: 1-of-2 hoặc 2-of-3)

### 2. Testnet Tokens
Lấy testnet tokens từ faucets:

#### Sepolia ETH
- [ ] Faucet: https://sepoliafaucet.com/
- [ ] Lượng cần: ~0.5 ETH (cho fees)

#### Sepolia LINK
- [ ] Faucet: https://faucets.chain.link/sepolia
- [ ] Address: `0x779877A7B0D9E8603169DdbD7836e478b4624789`
- [ ] Lượng cần: ~10 LINK

#### Sepolia USDC
- [ ] Contract: `0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238`
- [ ] Lấy từ: https://faucet.circle.com/ (nếu có)
- [ ] Hoặc swap từ LINK

#### Transfer vào Safe
```bash
# Ví dụ với LINK
1. Vào https://sepolia.etherscan.io/address/0x779877A7B0D9E8603169DdbD7836e478b4624789#writeContract
2. Connect wallet (owner wallet, không phải Safe)
3. Gọi transfer(safeAddress, amount)
4. Confirm transaction
5. Check balance: https://sepolia.etherscan.io/address/<SAFE_ADDRESS>
```

## Testing Workflow

### Phase 1: UI & Navigation
- [ ] Login thành công với Web3Auth
- [ ] Vào Company Dashboard
- [ ] Load Safe wallet của bạn
- [ ] Thấy tab "Cross-Chain Transfer"
- [ ] Click vào tab → Form hiển thị đúng
- [ ] Source Network hiển thị "Ethereum Sepolia"
- [ ] Destination dropdown có 3 options (Arbitrum, Avalanche, Polygon)

### Phase 2: Form Validation
- [ ] Chọn destination mà không chọn token → Error
- [ ] Nhập amount âm → Error
- [ ] Nhập recipient address không hợp lệ → Error
- [ ] Click "Calculate Fee" mà chưa điền đủ → Error
- [ ] Tất cả validation messages hiển thị rõ ràng

### Phase 3: Fee Calculation
- [ ] Điền đầy đủ form:
  - Destination: Arbitrum Sepolia
  - Token: LINK
  - Amount: 1
  - Recipient: (address hợp lệ)
- [ ] Click "Calculate Transfer Fee"
- [ ] Loading state hiển thị
- [ ] Fee được tính và hiển thị (ví dụ: ~0.001-0.003 ETH)
- [ ] Balance check hiển thị:
  - Token balance: X LINK (màu xanh nếu đủ)
  - Native balance: Y ETH (màu xanh nếu đủ)
- [ ] Nút "Propose Transfer" được enable

### Phase 4: Insufficient Balance Test
- [ ] Test với amount > balance
- [ ] Balance check hiển thị màu đỏ
- [ ] Nút "Propose Transfer" bị disable
- [ ] Error message rõ ràng

### Phase 5: Transaction Proposal
- [ ] Với form hợp lệ và balance đủ
- [ ] Click "Propose Cross-Chain Transfer"
- [ ] Loading state hiển thị
- [ ] Success message xuất hiện
- [ ] Form được reset
- [ ] Tự động chuyển về tab Transactions sau 2s

### Phase 6: Multi-Sig Approval
- [ ] Vào tab "Transactions"
- [ ] Thấy pending transaction mới
- [ ] Transaction details hiển thị:
  - To: CCIP Router address
  - Value: Fee amount
  - Data: ccipSend encoded
- [ ] Current owner có thể confirm
- [ ] Click "Confirm" → Success
- [ ] Confirmations tăng lên
- [ ] Khi đủ threshold → "Execute" button xuất hiện

### Phase 7: Transaction Execution
- [ ] Click "Execute"
- [ ] **IMPORTANT**: Signatures are automatically sorted by owner address (GS013 fix applied)
- [ ] Transaction được submit lên blockchain
- [ ] Loading state trong khi chờ confirmation
- [ ] Success message khi execute thành công
- [ ] **No GS013 error** (signature validation passes)
- [ ] Transaction chuyển sang "Executed" status
- [ ] Transaction xuất hiện trong History
- [ ] Transaction hash: 0x...

**Common Execution Errors:**
- ❌ **GS013** → FIXED: Signatures now auto-sorted by address
- ❌ Insufficient gas → Add more ETH to Safe
- ❌ Nonce mismatch → Reject old txs and re-propose

### Phase 8: Cross-Chain Verification
- [ ] Copy transaction hash
- [ ] Mở CCIP Explorer: https://ccip.chain.link/
- [ ] Paste transaction hash
- [ ] Xem CCIP message status
- [ ] Đợi ~5-10 phút cho cross-chain transfer
- [ ] Check recipient address trên destination chain
- [ ] Verify tokens đã nhận được

## Test Cases

### Test Case 1: Happy Path - LINK Transfer
```
Source: Ethereum Sepolia
Destination: Arbitrum Sepolia
Token: LINK
Amount: 1 LINK
Recipient: 0x...

Expected:
- Fee: ~0.001-0.003 ETH
- Transaction successful
- LINK arrives on Arbitrum in ~10 minutes
```

### Test Case 2: USDC Transfer
```
Source: Ethereum Sepolia
Destination: Avalanche Fuji
Token: USDC
Amount: 10 USDC
Recipient: 0x...

Expected:
- Fee: ~0.001-0.003 ETH
- Transaction successful
- USDC arrives on Fuji in ~10 minutes
```

### Test Case 3: Insufficient Token Balance
```
Amount: 1000000 LINK (more than balance)

Expected:
- Balance check shows red
- Button disabled
- Clear error message
```

### Test Case 4: Insufficient Fee Balance
```
Safe has: 0.0001 ETH
Fee required: 0.002 ETH

Expected:
- Native balance check shows red
- Button disabled
- "Insufficient balance for fees" message
```

### Test Case 5: Multi-Sig with 2-of-3
```
Setup: Safe với 3 owners, threshold 2

Steps:
1. Owner 1 propose CCIP transfer
2. Owner 2 confirm
3. Transaction ready to execute
4. Owner 2 execute

Expected:
- All steps successful
- Transaction executes with 2 signatures
```

## Performance Testing

### Loading Times
- [ ] Tab switch < 200ms
- [ ] Fee calculation < 5s
- [ ] Transaction proposal < 10s
- [ ] Page doesn't freeze during operations

### Error Recovery
- [ ] Network error → Retry works
- [ ] Transaction rejected → Can retry
- [ ] Fee changes → Recalculate works

## Browser Compatibility
- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

## Mobile Testing (Optional)
- [ ] Responsive design on mobile
- [ ] Form usable on small screens
- [ ] Tab navigation works

## Edge Cases

### Edge Case 1: Same Network
```
Source: Sepolia
Destination: Sepolia

Expected:
- Not allowed (destination dropdown excludes source)
```

### Edge Case 2: Very Small Amount
```
Amount: 0.000001 LINK

Expected:
- Fee calculation works
- Warning if fee > amount
```

### Edge Case 3: Very Large Amount
```
Amount: 999999999 LINK

Expected:
- Balance check catches it
- Clear error message
```

### Edge Case 4: Invalid Address Format
```
Recipient: "0xINVALID"

Expected:
- Validation error
- Cannot proceed
```

## Bug Reporting Template

Nếu tìm thấy bug, report theo format:

```markdown
**Bug Title:** [Brief description]

**Steps to Reproduce:**
1. 
2. 
3. 

**Expected Behavior:**


**Actual Behavior:**


**Screenshots:**
[If applicable]

**Environment:**
- Browser: 
- OS: 
- Safe Address: 
- Network: 

**Console Errors:**
[Copy any errors from browser console]
```

## Success Criteria

Tất cả items sau phải pass:

- [ ] ✅ Tất cả 8 phases trong Testing Workflow pass
- [ ] ✅ Ít nhất 2 test cases thành công (LINK + USDC)
- [ ] ✅ Multi-sig flow hoạt động đúng
- [ ] ✅ Tokens cross-chain thành công
- [ ] ✅ UI responsive và không có bugs
- [ ] ✅ Error handling hoạt động tốt
- [ ] ✅ Performance chấp nhận được

## Notes

### Important
- Testnet có thể chậm, hãy kiên nhẫn
- CCIP transfer có thể mất 5-20 phút
- Lưu transaction hashes để tracking
- Test với amounts nhỏ trước

### Useful Links
- Sepolia Etherscan: https://sepolia.etherscan.io/
- Arbitrum Sepolia Explorer: https://sepolia.arbiscan.io/
- CCIP Explorer: https://ccip.chain.link/
- Chainlink Faucets: https://faucets.chain.link/

---

**Checklist Version:** 1.0  
**Last Updated:** October 15, 2025  
**Status:** Ready for Testing

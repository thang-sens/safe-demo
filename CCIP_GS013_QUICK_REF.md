# ⚡ CCIP GS013 Fix - Quick Reference

## 🔧 What Was Fixed?

### 3 Main Changes:

| #   | Issue                    | Fix                                                       | Impact                           |
| --- | ------------------------ | --------------------------------------------------------- | -------------------------------- |
| 1   | Gas limit too low (500k) | Increased to 2M                                           | Destination execution won't fail |
| 2   | Wrong encoding format    | `[{ type: "uint256" }]` instead of `parseAbiParameters()` | Proper ABI encoding              |
| 3   | Missing debug logs       | Added extensive logging                                   | Easy debugging                   |

## 🚀 Quick Test

```bash
# 1. Clear cache
rm -rf client/node_modules/.vite

# 2. Hard refresh browser
# Mac: Cmd+Shift+R
# Windows: Ctrl+Shift+F5

# 3. Test CCIP transfer
# - Login → Load Safe → CCIP tab
# - Fill form → Calculate fee → Propose → Confirm → Execute
```

## 📊 Success Indicators

**Console logs you MUST see:**

```javascript
[CCIP Build] Receiver bytes: 0x000000000000000000000000...
[CCIP Build] ExtraArgs V2 (gasLimit=2000000): 0x97a657c9...
[CCIP Build] Complete message structure: {...}
```

**Không thấy logs này?** → Cache chưa clear, refresh lại!

## ❌ Old Code vs ✅ New Code

### ExtraArgs Encoding

```typescript
// ❌ OLD (Wrong format)
encodeAbiParameters(parseAbiParameters("uint256, bool"), [
  BigInt(500000),
  false,
]);

// ✅ NEW (Correct format)
encodeAbiParameters(
  [{ type: "uint256" }, { type: "bool" }],
  [BigInt(2000000), false]
);
```

### Gas Limit

```typescript
// ❌ OLD: 500,000 gas (not enough)
const gasLimit = 500000;

// ✅ NEW: 2,000,000 gas (sufficient)
const gasLimit = 2000000;
```

## 🐛 Still GS013?

Check in order:

1. **Cache cleared?** → Clear again
2. **Chain selector format?** → Must be decimal string like `"16015286601757825753"`
3. **Safe has ETH?** → Check balance >= fee
4. **Token approved?** → Should already be approved

## 📞 Quick Debug

Paste in browser console:

```javascript
// Check Safe balance
const provider = new ethers.BrowserProvider(window.ethereum);
const balance = await provider.getBalance("YOUR_SAFE_ADDRESS");
console.log("Safe ETH:", ethers.formatEther(balance));

// Check if router exists
const routerCode = await provider.getCode(
  "0x0BF3dE8c5D3e8A2B34D2BEeB17ABfCeBaf363A59"
);
console.log("Router deployed:", routerCode !== "0x");
```

## 📚 Full Docs

- **Root Cause Analysis**: `CCIP_GS013_ROOT_CAUSE.md`
- **Testing Guide**: `CCIP_GS013_FIX_TEST.md`
- **Complete Summary**: `CCIP_GS013_FINAL_FIX.md`

## ✅ Expected Result

```
[CCIP Build] logs... ✅
Transaction proposed... ✅
Transaction confirmed... ✅
Transaction executed... ✅
Transaction hash: 0x... ✅
```

**No GS013 error! 🎉**

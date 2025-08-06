# 🚀 NedaPay Protocol Mainnet Deployment Guide

## ✅ Pre-Deployment Checklist

### 1. **Environment Setup**
- [ ] `PRIVATE_KEY` - Deployer wallet private key (with ETH for gas)
- [ ] `BASE_RPC_URL` - Base mainnet RPC (default: https://mainnet.base.org)
- [ ] `BASESCAN_API_KEY` - For contract verification

### 2. **Wallet Preparation**
- [ ] Deployer wallet has sufficient ETH (~0.01 ETH for deployment)
- [ ] Deployer wallet will be the initial owner of the contract
- [ ] Consider using a multisig wallet for production

### 3. **Contract Review**
- [ ] Fee tiers are correct (0.5%, 0.3%, 0.2%, 0.1%)
- [ ] Supported tokens list is accurate
- [ ] Emergency functions work (pause/unpause)
- [ ] Upgrade mechanism tested on testnet

## 🚀 Deployment Steps

### Step 1: Deploy to Base Mainnet
```bash
cd contracts-workspace
npm run deploy:mainnet
```

### Step 2: Verify Contract
```bash
npm run verify:mainnet -- <PROXY_ADDRESS>
```

### Step 3: Update Frontend Config
1. Update `.env`:
   ```
   NEXT_PUBLIC_NEDAPAY_PROTOCOL_ADDRESS=<NEW_MAINNET_PROXY_ADDRESS>
   NEXT_PUBLIC_ENABLE_PROTOCOL=true
   ```

2. Update `app/config/contracts.ts`:
   ```typescript
   mainnet: {
     proxyAddress: '<NEW_MAINNET_PROXY_ADDRESS>',
     implementationAddress: '<NEW_MAINNET_IMPLEMENTATION_ADDRESS>',
     chainId: 8453,
     network: 'base'
   }
   ```

### Step 4: Test on Mainnet
- [ ] Small test swap (0.1 USDC)
- [ ] Verify fee collection
- [ ] Check contract on Basescan
- [ ] Test upgrade functionality

## 📊 Post-Deployment

### Monitoring
- [ ] Set up fee revenue tracking
- [ ] Monitor contract events
- [ ] Track tier distribution

### Security
- [ ] Transfer ownership to multisig (recommended)
- [ ] Set up timelock for upgrades (optional)
- [ ] Conduct security audit (recommended)

## 🔧 Useful Commands

```bash
# Deploy to mainnet
npm run deploy:mainnet

# Verify contract
npm run verify:mainnet -- <PROXY_ADDRESS>

# Update fee tiers (if needed)
npm run update-fees:mainnet

# Check deployment info
cat deployments/base-mainnet.json
```

## 🚨 Emergency Procedures

### Pause Protocol
```bash
npx hardhat run scripts/pauseProtocol.js --network base
```

### Upgrade Contract
```bash
npx hardhat run scripts/upgradeProtocol.js --network base
```

---

**Ready for Mainnet Deployment!** ✅
- Contract tested on Base Sepolia
- Frontend integration complete
- Fee structure validated
- Upgrade mechanism working

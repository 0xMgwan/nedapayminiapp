# NedaPay Protocol Smart Contract

## Overview

The NedaPay Protocol smart contract collects **dynamic fees** on all transactions processed through the NedaPay platform, including:

- Payment links
- Invoice payments  
- Token swaps

**Dynamic Fee Structure:**
- 💰 **$0–$100** → **1.0%** fee
- 💰 **$101–$500** → **0.75%** fee  
- 💰 **$501–$2,000** → **0.5%** fee
- 💰 **$2,001–$5,000** → **0.3%** fee
- 💰 **$5,001+** → **0.2%** fee

All fees are automatically sent to the protocol treasury: `0x037Eb04AD9DDFf984F44Ce5941D14b8Ea3781459`

## Features

- **0.5% Protocol Fee**: Automatic fee collection on all transactions
- **Multi-Token Support**: Supports USDC, DAI, USDbC and other stablecoins
- **Secure**: Built with OpenZeppelin contracts (ReentrancyGuard, Ownable, Pausable)
- **Transparent**: All fees tracked on-chain with events
- **Emergency Controls**: Owner can pause/unpause and emergency withdraw

## Deployment Instructions

### Prerequisites

1. **Install Dependencies**
```bash
cd contracts
npm install
```

2. **Set Environment Variables**
Create a `.env` file in the project root:
```bash
PRIVATE_KEY=your_private_key_here
BASESCAN_API_KEY=your_basescan_api_key_here
```

### Deploy to Base Mainnet

1. **Compile Contract**
```bash
npm run compile
```

2. **Deploy to Base**
```bash
npm run deploy:base
```

3. **Verify Contract** (Optional)
```bash
npx hardhat verify --network base CONTRACT_ADDRESS
```

### Deploy to Base Sepolia (Testnet)

```bash
npm run deploy:testnet
```

## Contract Integration

After deployment, update the contract address in:
- `app/utils/nedaPayProtocol.ts` - Update `NEDAPAY_PROTOCOL_ADDRESS`

## Usage Examples

### Calculate Fee
```typescript
import { calculateProtocolFee, getFeeInfo } from './utils/nedaPayProtocol';

const amount = ethers.utils.parseUnits('100', 6); // 100 USDC
const fee = calculateProtocolFee(amount.toString());
const feeInfo = getFeeInfo(amount.toString(), 6);

console.log('Fee:', feeInfo.feeAmount, 'USDC'); // 0.5 USDC
console.log('Net Amount:', feeInfo.netAmount, 'USDC'); // 99.5 USDC
```

### Process Payment with Fee
```typescript
import { processPaymentWithFeeWagmi } from './utils/nedaPayProtocol';

const hash = await processPaymentWithFeeWagmi(
  config,
  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
  '0xRecipientAddress',
  ethers.utils.parseUnits('100', 6).toString(),
  'payment'
);
```

## Contract Functions

### Core Functions
- `processPayment()` - Process payment with fee collection
- `calculateFee()` - Calculate fee for given amount
- `getNetAmount()` - Get net amount after fee deduction
- `isTokenSupported()` - Check if token is supported

### Admin Functions (Owner Only)
- `addSupportedToken()` - Add new supported token
- `removeSupportedToken()` - Remove supported token
- `pause()/unpause()` - Emergency pause functionality
- `emergencyWithdraw()` - Emergency withdrawal

### View Functions
- `getTotalFeesCollected()` - Total fees collected per token
- `getUserFeeContribution()` - User's fee contribution per token

## Dynamic Fee Structure

- **Fee Recipient**: `0x037Eb04AD9DDFf984F44Ce5941D14b8Ea3781459`
- **Fee Calculation**: Based on USD transaction amount

### Fee Tiers

| Transaction Amount | Fee Rate | Fee (Basis Points) | Example Fee |
|-------------------|----------|-------------------|-------------|
| $0 - $100         | 1.0%     | 100 BP           | $50 → $0.50 |
| $101 - $500       | 0.75%    | 75 BP            | $300 → $2.25 |
| $501 - $2,000     | 0.5%     | 50 BP            | $1000 → $5.00 |
| $2,001 - $5,000   | 0.3%     | 30 BP            | $3000 → $9.00 |
| $5,001+           | 0.2%     | 20 BP            | $10000 → $20.00 |

### Benefits
- **Lower fees for large transactions** encourage high-value usage
- **Competitive rates** for institutional users
- **Fair pricing** across all transaction sizes

## Supported Tokens (All 11 Stablecoins)

- **USDC** (USD Coin): `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
- **cNGN** (Nigerian Naira Coin): `0x46C85152bFe9f96829aA94755D9f915F9B10EF5F`
- **NGNC** (Nigerian Naira Coin): `0xe743f13623e000261b634f0e5676f294475ec24d`
- **ZARP** (South African Rand Coin): `0xb755506531786C8aC63B756BaB1ac387bACB0C04`
- **IDRX** (Indonesian Rupiah Coin): `0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22`
- **EURC** (Euro Coin): `0x60a3e35cc302bfa44cb288bc5a4f316fdb1adb42`
- **CADC** (Canadian Dollar Coin): `0x043eB4B75d0805c43D7C834902E335621983Cf03`
- **BRL** (Brazilian Real Coin): `0xE9185Ee218cae427aF7B9764A011bb89FeA761B4`
- **TRYB** (Turkish Lira Coin): `0xFb8718a69aed7726AFb3f04D2Bd4bfDE1BdCb294`
- **NZDD** (New Zealand Dollar Coin): `0x2dD087589ce9C5b2D1b42e20d2519B3c8cF022b7`
- **MXNe** (Mexican Peso Coin): `0x269caE7Dc59803e5C596c95756faEeBb6030E0aF`

## Security Features

- **ReentrancyGuard**: Prevents reentrancy attacks
- **Pausable**: Can be paused in emergencies
- **Ownable**: Admin functions restricted to owner
- **Input Validation**: Comprehensive input validation
- **Safe Transfers**: Uses OpenZeppelin's safe transfer patterns

## Events

```solidity
event PaymentProcessed(
    address indexed user,
    address indexed token,
    uint256 amount,
    uint256 fee,
    string paymentType
);
```

## Gas Optimization

- Optimized for minimal gas usage
- Batch operations where possible
- Efficient storage patterns

## Audit Recommendations

Before mainnet deployment, consider:
1. Professional smart contract audit
2. Testnet deployment and testing
3. Bug bounty program
4. Gradual rollout with monitoring

## Support

For technical support or questions about the contract deployment, please contact the NedaPay development team.

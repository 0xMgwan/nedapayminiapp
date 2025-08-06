// NedaPay Protocol Contract Configuration

export const NEDAPAY_PROTOCOL_CONFIG = {
  // Base Sepolia Testnet
  testnet: {
    proxyAddress: '0xfBc307eabd9F50cc903f9569A3B92C9491eBaB3C',
    implementationAddress: '0x18E0773B47b5Cb70c4179f4510f2b8Cd722BccA0',
    chainId: 84532,
    network: 'base-sepolia'
  },
  // Base Mainnet (to be deployed)
  mainnet: {
    proxyAddress: '0x19d89D92e35a635441C3daB394F6FE289B015430', // DEPLOYED TO BASE MAINNET
    implementationAddress: '0x10dE41927cdD093dA160E562630e0efC19423869',
    chainId: 8453,
    network: 'base'
  }
};

// Get the appropriate contract address based on environment
export const getNedaPayProtocolAddress = (isTestnet: boolean = false): string => {
  // First check environment variable
  const envAddress = process.env.NEXT_PUBLIC_NEDAPAY_PROTOCOL_ADDRESS;
  if (envAddress) {
    return envAddress;
  }
  
  // Fallback to config
  if (isTestnet) {
    return NEDAPAY_PROTOCOL_CONFIG.testnet.proxyAddress;
  }
  
  // For production, use mainnet address when available
  return NEDAPAY_PROTOCOL_CONFIG.mainnet.proxyAddress || NEDAPAY_PROTOCOL_CONFIG.testnet.proxyAddress;
};

// Contract ABI for the upgradeable protocol
export const NEDAPAY_PROTOCOL_ABI = [
  // Initialize function
  {
    "inputs": [],
    "name": "initialize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Calculate fee function
  {
    "inputs": [
      {"internalType": "address", "name": "token", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "calculateFee",
    "outputs": [
      {"internalType": "uint256", "name": "fee", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Process payment function
  {
    "inputs": [
      {"internalType": "address", "name": "token", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"},
      {"internalType": "string", "name": "paymentType", "type": "string"}
    ],
    "name": "processPayment",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Process swap function
  {
    "inputs": [
      {"internalType": "address", "name": "tokenIn", "type": "address"},
      {"internalType": "address", "name": "tokenOut", "type": "address"},
      {"internalType": "uint256", "name": "amountIn", "type": "uint256"},
      {"internalType": "uint256", "name": "amountOutMin", "type": "uint256"},
      {"internalType": "bytes", "name": "swapData", "type": "bytes"}
    ],
    "name": "processSwap",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Get net amount function
  {
    "inputs": [
      {"internalType": "address", "name": "token", "type": "address"},
      {"internalType": "uint256", "name": "amount", "type": "uint256"}
    ],
    "name": "getNetAmount",
    "outputs": [
      {"internalType": "uint256", "name": "netAmount", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Check if token is supported
  {
    "inputs": [
      {"internalType": "address", "name": "token", "type": "address"}
    ],
    "name": "isTokenSupported",
    "outputs": [
      {"internalType": "bool", "name": "supported", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Get fee tiers length
  {
    "inputs": [],
    "name": "getFeeTiersLength",
    "outputs": [
      {"internalType": "uint256", "name": "", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Get fee tier
  {
    "inputs": [
      {"internalType": "uint256", "name": "", "type": "uint256"}
    ],
    "name": "feeTiers",
    "outputs": [
      {"internalType": "uint256", "name": "minAmount", "type": "uint256"},
      {"internalType": "uint256", "name": "maxAmount", "type": "uint256"},
      {"internalType": "uint256", "name": "feeRate", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  // Events
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "token", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "fee", "type": "uint256"},
      {"indexed": false, "internalType": "string", "name": "paymentType", "type": "string"}
    ],
    "name": "PaymentProcessed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "internalType": "address", "name": "user", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "tokenIn", "type": "address"},
      {"indexed": true, "internalType": "address", "name": "tokenOut", "type": "address"},
      {"indexed": false, "internalType": "uint256", "name": "amountIn", "type": "uint256"},
      {"indexed": false, "internalType": "uint256", "name": "fee", "type": "uint256"}
    ],
    "name": "SwapProcessed",
    "type": "event"
  }
];

// Fee tier information for display
export const FEE_TIERS = [
  { min: 0, max: 100, rate: 1.0, description: '$0 - $100' },
  { min: 101, max: 500, rate: 0.75, description: '$101 - $500' },
  { min: 501, max: 2000, rate: 0.5, description: '$501 - $2,000' },
  { min: 2001, max: 5000, rate: 0.3, description: '$2,001 - $5,000' },
  { min: 5001, max: Infinity, rate: 0.2, description: '$5,001+' }
];

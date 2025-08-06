import { ethers } from 'ethers';

// Contract ABI (essential functions only)
export const NEDAPAY_PROTOCOL_ABI = [
  'function processPayment(address token, address recipient, uint256 amount, string memory paymentType) external',
  'function calculateFee(address token, uint256 amount) external view returns (uint256)',
  'function calculateDynamicFeeRate(uint256 usdAmount) external view returns (uint256)',
  'function getNetAmount(address token, uint256 amount) external view returns (uint256)',
  'function isTokenSupported(address token) external view returns (bool)',
  'function getTotalFeesCollected(address token) external view returns (uint256)',
  'function getUserFeeContribution(address user, address token) external view returns (uint256)',
  'event PaymentProcessed(address indexed user, address indexed token, uint256 amount, uint256 fee, string paymentType)'
];

// Contract addresses (will be updated after deployment)
export const NEDAPAY_PROTOCOL_ADDRESS = '0x0000000000000000000000000000000000000000'; // TODO: Update after deployment

// Dynamic fee configuration
export const BASIS_POINTS = 10000;
export const FEE_RECIPIENT = '0x037Eb04AD9DDFf984F44Ce5941D14b8Ea3781459';

// Fee tiers (same as contract)
export const FEE_TIERS = [
  { min: 0, max: 100, rate: 100 }, // $0-$100: 1.0%
  { min: 100.01, max: 500, rate: 75 }, // $101-$500: 0.75%
  { min: 500.01, max: 2000, rate: 50 }, // $501-$2000: 0.5%
  { min: 2000.01, max: 5000, rate: 30 }, // $2001-$5000: 0.3%
  { min: 5000.01, max: Infinity, rate: 20 } // $5001+: 0.2%
];

/**
 * Calculate dynamic fee rate based on USD amount
 * @param usdAmount The amount in USD
 * @returns The fee rate in basis points
 */
export function calculateDynamicFeeRate(usdAmount: number): number {
  for (const tier of FEE_TIERS) {
    if (usdAmount >= tier.min && usdAmount <= tier.max) {
      return tier.rate;
    }
  }
  return 20; // Default to lowest rate
}

/**
 * Calculate the protocol fee for a given amount (client-side estimation)
 * @param amount The payment amount in wei
 * @param decimals Token decimals
 * @returns The fee amount in wei
 */
export function calculateProtocolFee(amount: string, decimals: number = 6): string {
  const amountBN = ethers.BigNumber.from(amount);
  const usdAmount = parseFloat(ethers.utils.formatUnits(amount, decimals));
  const feeRate = calculateDynamicFeeRate(usdAmount);
  const fee = amountBN.mul(feeRate).div(BASIS_POINTS);
  return fee.toString();
}

/**
 * Calculate the net amount after fee deduction (client-side estimation)
 * @param amount The gross amount in wei
 * @param decimals Token decimals
 * @returns The net amount in wei
 */
export function calculateNetAmount(amount: string, decimals: number = 6): string {
  const amountBN = ethers.BigNumber.from(amount);
  const fee = calculateProtocolFee(amount, decimals);
  const feeBN = ethers.BigNumber.from(fee);
  const netAmount = amountBN.sub(feeBN);
  return netAmount.toString();
}

/**
 * Process payment through NedaPay Protocol with fee collection
 * @param signer Ethereum signer
 * @param tokenAddress Token contract address
 * @param recipientAddress Recipient address
 * @param amount Amount in wei (including fee)
 * @param paymentType Type of payment: "payment", "invoice", or "swap"
 * @returns Transaction hash
 */
export async function processPaymentWithFee(
  signer: ethers.Signer,
  tokenAddress: string,
  recipientAddress: string,
  amount: string,
  paymentType: 'payment' | 'invoice' | 'swap'
): Promise<string> {
  
  if (NEDAPAY_PROTOCOL_ADDRESS === '0x0000000000000000000000000000000000000000') {
    throw new Error('NedaPay Protocol contract not deployed yet. Please deploy the contract first.');
  }

  const contract = new ethers.Contract(
    NEDAPAY_PROTOCOL_ADDRESS,
    NEDAPAY_PROTOCOL_ABI,
    signer
  );

  // First approve the protocol contract to spend tokens
  const tokenContract = new ethers.Contract(
    tokenAddress,
    ['function approve(address spender, uint256 amount) external returns (bool)'],
    signer
  );

  console.log('🔐 Approving NedaPay Protocol to spend tokens...');
  const approveTx = await tokenContract.approve(NEDAPAY_PROTOCOL_ADDRESS, amount);
  await approveTx.wait();
  console.log('✅ Approval successful');

  // Process payment through protocol
  console.log('💰 Processing payment with fee collection...');
  const tx = await contract.processPayment(
    tokenAddress,
    recipientAddress,
    amount,
    paymentType
  );

  const receipt = await tx.wait();
  console.log('✅ Payment processed with fee collection');
  
  return receipt.transactionHash;
}

/**
 * Process payment using wagmi/actions for Farcaster compatibility
 * @param config Wagmi config
 * @param tokenAddress Token contract address
 * @param recipientAddress Recipient address
 * @param amount Amount in wei (including fee)
 * @param paymentType Type of payment
 * @returns Transaction hash
 */
export async function processPaymentWithFeeWagmi(
  config: any,
  tokenAddress: string,
  recipientAddress: string,
  amount: string,
  paymentType: 'payment' | 'invoice' | 'swap'
): Promise<string> {
  
  if (NEDAPAY_PROTOCOL_ADDRESS === '0x0000000000000000000000000000000000000000') {
    throw new Error('NedaPay Protocol contract not deployed yet. Please deploy the contract first.');
  }

  const { writeContract } = await import('wagmi/actions');

  // First approve the protocol contract
  console.log('🔐 Approving NedaPay Protocol to spend tokens...');
  const approveHash = await writeContract(config, {
    address: tokenAddress as `0x${string}`,
    abi: [
      {
        name: 'approve',
        type: 'function',
        inputs: [
          { name: 'spender', type: 'address' },
          { name: 'amount', type: 'uint256' }
        ],
        outputs: [{ name: '', type: 'bool' }],
        stateMutability: 'nonpayable'
      }
    ],
    functionName: 'approve',
    args: [NEDAPAY_PROTOCOL_ADDRESS as `0x${string}`, BigInt(amount)]
  });
  
  console.log('✅ Approval transaction:', approveHash);

  // Wait a bit for approval confirmation
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Process payment through protocol
  console.log('💰 Processing payment with fee collection...');
  const paymentHash = await writeContract(config, {
    address: NEDAPAY_PROTOCOL_ADDRESS as `0x${string}`,
    abi: [
      {
        name: 'processPayment',
        type: 'function',
        inputs: [
          { name: 'token', type: 'address' },
          { name: 'recipient', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'paymentType', type: 'string' }
        ],
        outputs: [],
        stateMutability: 'nonpayable'
      }
    ],
    functionName: 'processPayment',
    args: [
      tokenAddress as `0x${string}`,
      recipientAddress as `0x${string}`,
      BigInt(amount),
      paymentType
    ]
  });

  console.log('✅ Payment processed with fee collection:', paymentHash);
  return paymentHash;
}

/**
 * Get fee information for display
 * @param amount Amount in wei
 * @param decimals Token decimals
 * @returns Fee information
 */
export function getFeeInfo(amount: string, decimals: number) {
  const fee = calculateProtocolFee(amount);
  const netAmount = calculateNetAmount(amount);
  
  return {
    grossAmount: ethers.utils.formatUnits(amount, decimals),
    feeAmount: ethers.utils.formatUnits(fee, decimals),
    netAmount: ethers.utils.formatUnits(netAmount, decimals),
    feePercentage: '0.5%'
  };
}

/**
 * Check if a token is supported by the protocol
 * @param provider Ethereum provider
 * @param tokenAddress Token address
 * @returns Whether token is supported
 */
export async function isTokenSupported(
  provider: ethers.providers.Provider,
  tokenAddress: string
): Promise<boolean> {
  
  if (NEDAPAY_PROTOCOL_ADDRESS === '0x0000000000000000000000000000000000000000') {
    return false;
  }

  const contract = new ethers.Contract(
    NEDAPAY_PROTOCOL_ADDRESS,
    NEDAPAY_PROTOCOL_ABI,
    provider
  );

  return await contract.isTokenSupported(tokenAddress);
}

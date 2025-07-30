import { ethers } from 'ethers';

// USDC contract address on Base
const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

// USDC ABI (simplified for transfer function)
const USDC_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

export async function executeUSDCTransaction(
  toAddress: string, 
  amount: number, 
  description?: string
): Promise<boolean> {
  try {
    // Get the provider and signer from the connected wallet
    if (typeof window === 'undefined' || !window.ethereum) {
      throw new Error('No wallet provider found');
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    
    // Create contract instance
    const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, USDC_ABI, signer);
    
    // Convert amount to USDC decimals (6 decimals)
    const amountInWei = ethers.parseUnits(amount.toString(), 6);
    
    // Execute the transfer
    const tx = await usdcContract.transfer(toAddress, amountInWei);
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    
    console.log('USDC transfer successful:', {
      hash: receipt.hash,
      to: toAddress,
      amount: amount,
      description: description
    });
    
    return receipt.status === 1;
  } catch (error) {
    console.error('USDC transaction failed:', error);
    return false;
  }
}

export async function getUSDCBalance(walletAddress: string): Promise<string> {
  try {
    if (typeof window === 'undefined' || !window.ethereum) {
      return '0';
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, USDC_ABI, provider);
    
    const balance = await usdcContract.balanceOf(walletAddress);
    const formattedBalance = ethers.formatUnits(balance, 6);
    
    return formattedBalance;
  } catch (error) {
    console.error('Failed to fetch USDC balance:', error);
    return '0';
  }
}

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
  walletProvider?: any,
  description?: string
): Promise<{ success: boolean; hash: string }> {
  try {
    // Get the provider from Privy wallet or fallback to window.ethereum
    let provider;
    
    if (walletProvider) {
      // Use Privy wallet provider
      provider = new ethers.providers.Web3Provider(walletProvider);
    } else if (typeof window !== 'undefined' && window.ethereum) {
      // Fallback to window.ethereum for MetaMask
      await (window.ethereum as any).request({ method: 'eth_requestAccounts' });
      provider = new ethers.providers.Web3Provider(window.ethereum);
    } else {
      throw new Error('No wallet provider found');
    }

    const signer = provider.getSigner();
    
    // Get the connected address
    const signerAddress = await signer.getAddress();
    console.log('Connected wallet address:', signerAddress);
    
    // Create contract instance
    const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, USDC_ABI, signer);
    
    // Convert amount to USDC decimals (6 decimals) - ethers v5 syntax
    const amountInWei = ethers.utils.parseUnits(amount.toString(), 6);
    
    console.log('Executing USDC transfer:', {
      to: toAddress,
      amount: amount,
      amountInWei: amountInWei.toString(),
      from: signerAddress
    });
    
    // Execute the transfer
    const tx = await usdcContract.transfer(toAddress, amountInWei);
    
    console.log('Transaction submitted:', tx.hash);
    
    // Wait for transaction confirmation
    const receipt = await tx.wait();
    
    console.log('USDC transfer successful:', {
      hash: receipt.hash,
      to: toAddress,
      amount: amount,
      description: description,
      status: receipt.status
    });
    
    return {
      success: receipt.status === 1,
      hash: receipt.hash
    };
  } catch (error: any) {
    console.error('USDC transaction failed:', error);
    
    // Provide more specific error messages
    if (error?.message?.includes('user rejected')) {
      throw new Error('Transaction was rejected by user');
    } else if (error?.message?.includes('insufficient funds')) {
      throw new Error('Insufficient USDC balance');
    } else if (error?.message?.includes('gas')) {
      throw new Error('Transaction failed due to gas issues');
    } else {
      throw new Error(`Blockchain transaction failed: ${error?.message || 'Unknown error'}`);
    }
  }
}

export async function getUSDCBalance(walletAddress: string, walletProvider?: any): Promise<string> {
  try {
    // Validate wallet address format
    if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return '0';
    }

    // Use a simple, reliable provider
    const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
    const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, USDC_ABI, provider);
    
    const balance = await usdcContract.balanceOf(walletAddress);
    const formattedBalance = ethers.utils.formatUnits(balance, 6);
    
    return formattedBalance;
  } catch (error) {
    // Return 0 instead of throwing to prevent UI crashes
    return '0';
  }
}

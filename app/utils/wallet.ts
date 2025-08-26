import { ethers } from 'ethers';

// Token contract addresses
const USDC_CONTRACT_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'; // Base
const USDT_CONTRACT_ADDRESS = '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e'; // Celo

// Token ABI (simplified for transfer function)
const TOKEN_ABI = [
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
    const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, TOKEN_ABI, signer);
    
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
      throw error;
    }
  }
}

// Generic function to execute token transactions (USDC on Base, USDT on Celo)
export async function executeTokenTransaction(
  toAddress: string, 
  amount: number, 
  walletProvider?: any,
  tokenData?: any,
  description?: string
): Promise<{ success: boolean; hash: string }> {
  try {
    // Determine token contract address and network
    const isUSDT = tokenData?.baseToken === 'USDT';
    const contractAddress = isUSDT ? USDT_CONTRACT_ADDRESS : USDC_CONTRACT_ADDRESS;
    const decimals = tokenData?.decimals || 6;
    
    // Get the provider from Privy wallet or fallback to window.ethereum
    let provider;
    
    if (walletProvider) {
      provider = new ethers.providers.Web3Provider(walletProvider);
    } else if (typeof window !== 'undefined' && window.ethereum) {
      await (window.ethereum as any).request({ method: 'eth_requestAccounts' });
      provider = new ethers.providers.Web3Provider(window.ethereum);
    } else {
      throw new Error('No wallet provider found');
    }

    const signer = provider.getSigner();
    const signerAddress = await signer.getAddress();
    console.log('Connected wallet address:', signerAddress);
    
    // Create contract instance
    const tokenContract = new ethers.Contract(contractAddress, TOKEN_ABI, signer);
    
    // Convert amount to token decimals
    const amountInWei = ethers.utils.parseUnits(amount.toString(), decimals);
    
    console.log('Executing token transfer:', {
      token: tokenData?.baseToken || 'USDC',
      to: toAddress,
      amount: amount,
      amountInWei: amountInWei.toString(),
      from: signerAddress,
      contractAddress
    });
    
    // Execute the transfer
    const tx = await tokenContract.transfer(toAddress, amountInWei);
    console.log('Transaction sent:', tx.hash);
    
    // Wait for confirmation
    const receipt = await tx.wait();
    console.log('Transaction confirmed:', receipt.transactionHash);
    
    return {
      success: true,
      hash: receipt.transactionHash
    };
  } catch (error: any) {
    console.error('Token transaction failed:', error);
    return {
      success: false,
      hash: ''
    };
  }
}

// Generic function to get token balance (USDC on Base, USDT on Celo)
export async function getTokenBalance(walletAddress: string, tokenData: any, walletProvider?: any): Promise<string> {
  console.log('🔍 getTokenBalance called with:', walletAddress, tokenData?.baseToken);
  
  try {
    // Validate wallet address format
    if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      console.log('⚠️ Invalid address format');
      return '0';
    }

    // Determine network and contract based on token
    const isUSDT = tokenData?.baseToken === 'USDT';
    const contractAddress = isUSDT ? USDT_CONTRACT_ADDRESS : USDC_CONTRACT_ADDRESS;
    const rpcUrl = isUSDT ? 'https://forno.celo.org' : 'https://mainnet.base.org';
    const decimals = tokenData?.decimals || 6;

    console.log('🌐 Creating provider for network:', isUSDT ? 'Celo' : 'Base');
    console.log('🔗 RPC URL:', rpcUrl);
    console.log('📄 Contract Address:', contractAddress);
    console.log('👛 Wallet Address:', walletAddress);
    
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const tokenContract = new ethers.Contract(contractAddress, TOKEN_ABI, provider);
    
    console.log('💰 Calling balanceOf...');
    const balance = await tokenContract.balanceOf(walletAddress);
    console.log('💰 Raw balance:', balance.toString());
    
    const formattedBalance = ethers.utils.formatUnits(balance, decimals);
    console.log('✅ Formatted balance:', formattedBalance);
    
    return formattedBalance;
  } catch (error) {
    console.error('❌ Error getting token balance:', error);
    return '0';
  }
}

export async function getUSDCBalance(walletAddress: string, walletProvider?: any): Promise<string> {
  console.log('🔍 getUSDCBalance called with:', walletAddress);
  
  try {
    // Validate wallet address format
    if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      console.log('⚠️ Invalid address format');
      return '0';
    }

    console.log('🌐 Creating provider for Base network...');
    // Use the official Base mainnet RPC URL
    const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
    const usdcContract = new ethers.Contract(USDC_CONTRACT_ADDRESS, TOKEN_ABI, provider);
    
    console.log('💰 Calling balanceOf...');
    const balance = await usdcContract.balanceOf(walletAddress);
    console.log('💰 Raw balance:', balance.toString());
    
    const formattedBalance = ethers.utils.formatUnits(balance, 6);
    console.log('✅ Formatted balance:', formattedBalance);
    
    return formattedBalance;
  } catch (error) {
    console.error('❌ Error getting USDC balance:', error);
    return '0';
  }
}

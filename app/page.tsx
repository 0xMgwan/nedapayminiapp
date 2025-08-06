'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMiniKit } from '@coinbase/onchainkit/minikit';
import { ConnectWallet, Wallet } from '@coinbase/onchainkit/wallet';
import { Avatar, Name, Address, EthBalance, Identity } from '@coinbase/onchainkit/identity';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useConnectorClient } from 'wagmi';
import { ChevronDownIcon, LinkIcon, CurrencyDollarIcon, ArrowUpIcon, ArrowDownIcon, ArrowPathIcon, ArrowRightIcon, WalletIcon, DocumentTextIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { ethers } from 'ethers';
import { stablecoins } from './data/stablecoins';
import { initiatePaymentOrder } from './utils/paycrest';
import { executeUSDCTransaction, getUSDCBalance } from './utils/wallet';
import { fetchTokenRate, fetchSupportedCurrencies, fetchSupportedInstitutions } from './utils/paycrest';
import { getAerodromeQuote, swapAerodrome, AERODROME_FACTORY_ADDRESS } from './utils/aerodrome';
import Image from 'next/image';

type Tab = 'send' | 'pay' | 'deposit' | 'link' | 'swap' | 'invoice';

interface Country {
  name: string;
  code: string;
  flag: string;
  currency: string;
  countryCode?: string;
  comingSoon?: boolean;
}

const countries: Country[] = [
  { name: 'Nigeria', code: 'NG', flag: '🇳🇬', currency: 'NGN', countryCode: '+234' },
  { name: 'Kenya', code: 'KE', flag: '🇰🇪', currency: 'KES', countryCode: '+254' },
  { name: 'Ghana', code: 'GH', flag: '🇬🇭', currency: 'GHS', countryCode: '+233' },
  { name: 'Tanzania', code: 'TZ', flag: '🇹🇿', currency: 'TZS', countryCode: '+255' },
  { name: 'Uganda', code: 'UG', flag: '🇺🇬', currency: 'UGX', countryCode: '+256' },
  { name: 'Rwanda', code: 'RW', flag: '🇷🇼', currency: 'RWF', countryCode: '+250' },
  { name: 'China', code: 'CN', flag: '🇨🇳', currency: 'CNY', countryCode: '+86', comingSoon: true },
  { name: 'Indonesia', code: 'ID', flag: '🇮🇩', currency: 'IDR', countryCode: '+62', comingSoon: true },
  { name: 'UAE', code: 'AE', flag: '🇦🇪', currency: 'AED', countryCode: '+971', comingSoon: true },
];

interface Currency {
  code: string;
  name: string;
  shortName: string;
  decimals: number;
  symbol: string;
  marketRate: string;
}

interface RateData {
  rate: string;
  timestamp: number;
}

export default function FarcasterMiniApp() {
  console.log('🚀 NedaPay MiniApp Loading...');
  const [activeTab, setActiveTab] = useState<Tab>('send');
  const [selectedToken, setSelectedToken] = useState(stablecoins[0]);
  const [selectedCountry, setSelectedCountry] = useState(countries[3]);
  const [amount, setAmount] = useState('');

  // MiniKit and Wagmi hooks for smart wallet (Farcaster/Coinbase) - moved up
  const { address, isConnected } = useAccount();
  const { connect, connectors, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: walletClient } = useConnectorClient();
  
  // Detect if we're in a smart wallet environment (Farcaster MiniApp) - enhanced mobile detection
  const isSmartWalletEnvironment = typeof window !== 'undefined' && (
    // Direct URL indicators
    window.location.href.includes('farcaster') ||
    window.location.href.includes('warpcast') ||
    window.location.href.includes('base.org') ||
    // Referrer indicators
    document.referrer.includes('farcaster') ||
    document.referrer.includes('warpcast') ||
    // MiniKit SDK presence
    (typeof (window as any).MiniKit !== 'undefined') ||
    // Mobile Farcaster specific detection
    (/Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) && (
      window.location.href.includes('farcaster') ||
      document.referrer.includes('farcaster') ||
      window.location.hostname.includes('farcaster') ||
      // Check for Farcaster mobile app user agent patterns
      navigator.userAgent.includes('Farcaster') ||
      // Check if we're in a webview (common for mobile apps)
      (navigator.userAgent.includes('wv') && !window.ethereum)
    ))
  );

  // Debug component initialization
  useEffect(() => {
    console.log('FarcasterMiniApp component initializing:', {
      url: window.location.href,
      userAgent: navigator.userAgent,
      referrer: document.referrer,
      isSmartWalletEnvironment,
      hasMiniKit: typeof (window as any).MiniKit !== 'undefined',
      hasWindowEthereum: typeof (window as any).ethereum !== 'undefined',
      timestamp: new Date().toISOString()
    });
  }, [isSmartWalletEnvironment]);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [tillNumber, setTillNumber] = useState('');
  const [businessNumber, setBusinessNumber] = useState('');
  // Removed duplicate walletAddress state - using connectedWallet?.address directly
  const [description, setDescription] = useState('');
  const [linkAmount, setLinkAmount] = useState('6');
  const [linkDescription, setLinkDescription] = useState('');
  const [selectedStablecoin, setSelectedStablecoin] = useState(stablecoins[0]);
  const [generatedLink, setGeneratedLink] = useState('');
  const [paymentType, setPaymentType] = useState<'goods' | 'bill'>('goods');

  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [currentRate, setCurrentRate] = useState('2547');
  const [currencies, setCurrencies] = useState<Array<{ code: string; name: string; symbol: string }>>([]);
  const [floatingRates, setFloatingRates] = useState<{ [key: string]: RateData }>({});
  const [institutions, setInstitutions] = useState<Array<{ name: string; code: string; type: string }>>([]);
  const [sendCurrency, setSendCurrency] = useState<'local' | 'usdc'>('local');
  const [payCurrency, setPayCurrency] = useState<'local' | 'usdc'>('local');
  const [selectedSendToken, setSelectedSendToken] = useState('USDC');
  const [selectedPayToken, setSelectedPayToken] = useState('USDC');
  const [showSendTokenDropdown, setShowSendTokenDropdown] = useState(false);
  const [isSwipeComplete, setIsSwipeComplete] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [walletBalance, setWalletBalance] = useState('0.00');
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState('');
  const [orderedCountries, setOrderedCountries] = useState<Country[]>(countries);
  const [userLocation, setUserLocation] = useState<string | null>(null);
  const [invoiceView, setInvoiceView] = useState<'main' | 'create' | 'list'>('main');
  const [invoiceRecipient, setInvoiceRecipient] = useState('');
  const [invoiceEmail, setInvoiceEmail] = useState('');
  const [invoiceSender, setInvoiceSender] = useState('');
  const [invoiceCurrency, setInvoiceCurrency] = useState('USDC');
  const [invoiceLineItems, setInvoiceLineItems] = useState([{ description: '', amount: '' }]);
  const [invoicePaymentLink, setInvoicePaymentLink] = useState('');
  const [invoiceDueDate, setInvoiceDueDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() + 7); // Default to 7 days from now
    return today.toISOString().split('T')[0];
  });
  const [invoiceStatus, setInvoiceStatus] = useState<string | null>(null);
  
  // Swap state variables
  const [swapFromToken, setSwapFromToken] = useState('USDC');
  const [swapToToken, setSwapToToken] = useState('');
  const [swapAmount, setSwapAmount] = useState('');
  const [swapQuote, setSwapQuote] = useState<string | null>(null);
  const [swapIsLoading, setSwapIsLoading] = useState(false);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapSuccess, setSwapSuccess] = useState<string | null>(null);
  const [showSwapFromDropdown, setShowSwapFromDropdown] = useState(false);
  const [showSwapToDropdown, setShowSwapToDropdown] = useState(false);

  
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<{
    orderId: string;
    hash?: string;
    amount: string;
    recipient: string;
    type: 'send' | 'pay';
  } | null>(null);
  
  // Track user's preferred wallet selection
  const [preferredWalletType, setPreferredWalletType] = useState<string | null>(null);
  const [addressCopied, setAddressCopied] = useState(false);

  // Removed duplicate declarations - moved up before useEffect
  const minikit = useMiniKit();
  const { setFrameReady, isFrameReady } = minikit;

  // MiniKit Auto-Connection: Farcaster smart wallet integration
  const connectedWallet = (() => {
    if (!isConnected || !address) return null;
    
    // MiniKit automatically connects to Farcaster smart wallet when available
    // Return a simplified wallet object for compatibility with existing code
    return {
      address: address,
      connectorType: 'farcaster_minikit',
      walletClientType: 'farcaster',
      getEthereumProvider: () => walletClient
    };
  })();
  
  const walletAddress = connectedWallet?.address;
  
  // Debug MiniKit wallet info
  useEffect(() => {
    console.log('=== MINIKIT WALLET DEBUG ===');
    console.log('Is Connected:', isConnected);
    console.log('Address:', address);
    console.log('Connectors Available:', connectors.length);
    console.log('Wallet Client:', !!walletClient);
    
    if (connectedWallet) {
      console.log('🔍 CONNECTED WALLET:', {
        address: connectedWallet.address,
        shortAddress: connectedWallet.address?.substring(0, 6) + '...' + connectedWallet.address?.substring(-4),
        connectorType: connectedWallet.connectorType,
        walletClientType: connectedWallet.walletClientType
      });
      console.log('🎆 USER SHOULD SEE: Farcaster Smart Wallet (MiniKit auto-connected)');
    } else {
      console.log('No wallet connected');
      setWalletBalance('0.00');
    }
    console.log('===================');
  }, [connectedWallet, isConnected, address, connectors.length, walletClient]);
  
  // MiniKit initialization - signal when app is ready
  useEffect(() => {
    if (isSmartWalletEnvironment && setFrameReady) {
      console.log('Setting MiniKit frame ready...');
      // Add a small delay to ensure everything is loaded
      const timer = setTimeout(() => {
        setFrameReady();
        console.log('MiniKit frame ready signal sent!');
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isSmartWalletEnvironment, setFrameReady]);
  
  // MiniKit handles wallet connections automatically - no manual tracking needed
  
  // Removed duplicate handleGeneratePaymentLink function - using the one defined later
  
  // Fetch real USDC wallet balance
  const fetchWalletBalance = useCallback(async (tokenSymbol?: string) => {
    if (!walletAddress || !isConnected) {
      console.log('⚠️ No wallet address or not connected');
      setWalletBalance('0.00');
      return;
    }
    
    // Determine which token to fetch balance for
    const currentTab = activeTab;
    let selectedToken = tokenSymbol;
    
    if (!selectedToken) {
      if (currentTab === 'send') {
        selectedToken = sendCurrency === 'usdc' ? selectedSendToken : 'USDC';
      } else if (currentTab === 'pay') {
        selectedToken = payCurrency === 'usdc' ? selectedPayToken : 'USDC';
      } else {
        selectedToken = 'USDC'; // Default for other tabs
      }
    }
    
    console.log('💰 Fetching balance for:', walletAddress, 'Token:', selectedToken);
    
    try {
      // Find token data
      const tokenData = stablecoins.find(token => token.baseToken === selectedToken);
      if (!tokenData) {
        console.error('❌ Token not found:', selectedToken);
        setWalletBalance('0.00');
        return;
      }
      
      // Create provider and contract
      const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
      const tokenContract = new ethers.Contract(
        tokenData.address,
        ['function balanceOf(address owner) view returns (uint256)'],
        provider
      );
      
      const balance = await tokenContract.balanceOf(walletAddress);
      const formattedBalance = ethers.utils.formatUnits(balance, tokenData.decimals || 6);
      const displayBalance = parseFloat(formattedBalance).toFixed(tokenData.decimals === 2 ? 2 : 2);
      
      console.log('✅ Balance fetched:', displayBalance, selectedToken);
      setWalletBalance(displayBalance);
    } catch (error) {
      console.error('❌ Balance fetch failed:', error);
      setWalletBalance('0.00');
    }
  }, [walletAddress, isConnected, activeTab, sendCurrency, selectedSendToken, payCurrency, selectedPayToken, stablecoins]);
  
  // Fetch balance when wallet connects or address changes
  useEffect(() => {
    console.log('🔄 Balance useEffect triggered:', { isConnected, walletAddress });
    if (isConnected && walletAddress) {
      console.log('🔄 Conditions met, fetching balance for:', walletAddress);
      fetchWalletBalance();
    } else {
      console.log('⚠️ Balance fetch skipped - not connected or no address');
    }
  }, [fetchWalletBalance, isConnected, walletAddress]);
  
  // Manual balance refresh function
  const refreshBalance = useCallback(() => {
    console.log('🔄 Manual balance refresh triggered');
    fetchWalletBalance();
  }, [fetchWalletBalance]);
  
  // Monitor wallet balance state changes
  useEffect(() => {
    console.log('💰 Wallet balance state changed to:', walletBalance);
  }, [walletBalance]);

  // Fetch real-time rate from Paycrest
  const fetchRate = useCallback(async (currency: string) => {
    if (!currency || currency === 'USDC') return;
    
    // Define fallback rates for common currencies
    const fallbackRates: { [key: string]: string } = {
      'NGN': '1650.0',  // Nigeria Naira
      'KES': '155.0',   // Kenya Shilling
      'GHS': '15.8',    // Ghana Cedi
      'TZS': '2585.5',  // Tanzania Shilling
      'UGX': '3700.0',  // Uganda Shilling
      'RWF': '1350.0'   // Rwanda Franc
    };
    
    try {
      setIsLoadingRate(true);
      console.log(`💱 Fetching rate for ${currency}...`);
      
      const rate = await fetchTokenRate('USDC', 1, currency);
      setCurrentRate(rate);
      
      console.log(`✅ Rate fetched successfully for ${currency}: ${rate}`);
      
      // Update floating rates
      setFloatingRates(prev => ({
        ...prev,
        [currency]: {
          rate,
          timestamp: Date.now()
        }
      }));
    } catch (error: any) {
      console.warn(`⚠️ Failed to fetch rate for ${currency}:`, error?.message || error);
      
      // Use fallback rate if available
      const fallbackRate = fallbackRates[currency] || '1000.0';
      console.log(`🔄 Using fallback rate for ${currency}: ${fallbackRate}`);
      
      setCurrentRate(fallbackRate);
      
      // Update floating rates with fallback
      setFloatingRates(prev => ({
        ...prev,
        [currency]: {
          rate: fallbackRate,
          timestamp: Date.now()
        }
      }));
    } finally {
      setIsLoadingRate(false);
    }
  }, []);

  // Calculate fees and totals with proper currency handling
  const calculatePaymentDetails = useCallback(() => {
    const amountNum = parseFloat(amount) || 0;
    const rate = parseFloat(currentRate) || 1;
    
    // Determine if we're working with local currency or USDC
    const isLocalCurrency = sendCurrency === 'local' || payCurrency === 'local';
    
    if (isLocalCurrency) {
      // Amount is in local currency (TZS, KES, etc.)
      const percentageFee = amountNum * 0.005; // 0.5%
      const fixedFee = 0.36; // Fixed fee in local currency
      const totalFee = percentageFee + fixedFee;
      const totalLocal = amountNum + totalFee;
      const usdcAmount = totalLocal / rate;
      
      return {
        totalLocal: totalLocal.toFixed(2),
        fee: totalFee.toFixed(2),
        usdcAmount: usdcAmount.toFixed(6)
      };
    } else {
      // Amount is in USDC
      const usdcAmount = amountNum;
      const localEquivalent = usdcAmount * rate;
      const percentageFee = localEquivalent * 0.005;
      const fixedFee = 0.36;
      const totalFee = percentageFee + fixedFee;
      const totalLocal = localEquivalent + totalFee;
      
      return {
        totalLocal: totalLocal.toFixed(2),
        fee: totalFee.toFixed(2),
        usdcAmount: usdcAmount.toFixed(6)
      };
    }
  }, [amount, currentRate, sendCurrency, payCurrency]);

  // Load supported currencies and institutions
  useEffect(() => {
    const loadData = async () => {
      try {
        const [supportedCurrencies, supportedInstitutions] = await Promise.all([
          fetchSupportedCurrencies(),
          fetchSupportedInstitutions(selectedCountry.currency)
        ]);
        
        setCurrencies(supportedCurrencies);
        setInstitutions(supportedInstitutions);
        
        // Set default institution if none selected
        if (supportedInstitutions.length > 0 && !selectedInstitution) {
          setSelectedInstitution(supportedInstitutions[0].code);
        }
        
        // Load initial floating rates for supported currencies (limit to prevent API spam)
        const priorityCurrencies = ['NGN', 'KES', 'TZS', 'UGX']; // Focus on main supported currencies
        const currenciesToLoad = supportedCurrencies
          .filter(currency => priorityCurrencies.includes(currency.code))
          .slice(0, 4); // Limit to 4 to avoid API rate limits
        
        console.log(`💱 Loading rates for ${currenciesToLoad.length} priority currencies...`);
        
        for (const currency of currenciesToLoad) {
          try {
            // Add small delay between requests to avoid rate limiting
            if (currenciesToLoad.indexOf(currency) > 0) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            const rate = await fetchTokenRate('USDC', 1, currency.code);
            setFloatingRates(prev => ({
              ...prev,
              [currency.code]: {
                rate,
                timestamp: Date.now()
              }
            }));
            console.log(`✅ Loaded rate for ${currency.code}: ${rate}`);
          } catch (error: any) {
            console.warn(`⚠️ Failed to load rate for ${currency.code}:`, error?.message || 'API Error');
            // Don't spam the console with full error objects
          }
        }
      } catch (error) {
        console.error('Failed to load currencies and institutions:', error);
      }
    };
    
    loadData();
  }, [selectedCountry, selectedInstitution]);

  // Fetch rate when country changes
  useEffect(() => {
    fetchRate(selectedCountry.currency);
  }, [selectedCountry, fetchRate]);

  // MiniKit initialization (already declared above)
  
  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  // Smart wallet auto-connection for Farcaster/Coinbase environments
  useEffect(() => {
    console.log('🔍 Smart Wallet Environment Check:', {
      isSmartWalletEnvironment,
      isFrameReady,
      isConnected,
      hasAddress: !!address,
      connectorsCount: connectors.length,
      connectError: connectError?.message
    });
    
    // In smart wallet environments, don't force connection attempts
    if (isSmartWalletEnvironment) {
      if (isConnected && address) {
        console.log('✅ Smart wallet already connected:', address);
        return;
      }
      
      // Only attempt auto-connection if MiniKit is ready and no connection errors
      if (isFrameReady && !isConnected && !connectError && connectors.length > 0) {
        console.log('🔗 Attempting smart wallet auto-connection...');
        // Use a timeout to prevent immediate popup blocking
        setTimeout(() => {
          if (!isConnected) {
            try {
              connect({ connector: connectors[0] });
            } catch (error) {
              console.log('🚫 Smart wallet connection attempt failed (this is normal):', error);
            }
          }
        }, 1000);
      }
    } else {
      console.log('💻 Desktop environment - wallet connection handled normally');
    }
  }, [isFrameReady, isConnected, connectors, connect, address, isSmartWalletEnvironment, connectError]);

  // Geolocation detection to reorder countries based on user location
  useEffect(() => {
    const detectUserLocation = async () => {
      try {
        // First try to get location from IP geolocation API
        const response = await fetch('https://ipapi.co/json/');
        const data = await response.json();
        
        if (data.country_code) {
          const detectedCountry = countries.find(c => c.code === data.country_code);
          if (detectedCountry) {
            console.log('🌍 Detected user location:', detectedCountry.name);
            setUserLocation(data.country_code);
            
            // Reorder countries to put user's country first
            const reorderedCountries = [
              detectedCountry,
              ...countries.filter(c => c.code !== data.country_code)
            ];
            setOrderedCountries(reorderedCountries);
            
            // Set as default selected country if not already set
            if (selectedCountry.code === countries[0].code) {
              setSelectedCountry(detectedCountry);
            }
          }
        }
      } catch (error) {
        console.log('🚫 Could not detect user location:', error);
        // Fallback to default country order
        setOrderedCountries(countries);
      }
    };

    detectUserLocation();
  }, []); // Run once on component mount

  const paymentDetails = calculatePaymentDetails();

  // Using imported executeUSDCTransaction from utils/wallet.ts

  // Proper Farcaster MiniApp transaction using wagmi hooks (per official docs)
  const executeFarcasterTransaction = useCallback(async (
    toAddress: string,
    amount: number
  ): Promise<{ success: boolean; hash: string }> => {
    try {
      console.log('🎆 Executing Farcaster MiniApp transaction:', {
        to: toAddress,
        amount,
        isConnected,
        address
      });

      if (!isConnected || !address) {
        throw new Error('Wallet not connected in Farcaster');
      }

      // USDC contract on Base
      const USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
      
      // Convert amount to USDC decimals (6 decimals)
      const amountInUnits = BigInt(Math.floor(amount * 1000000));
      
      // Encode USDC transfer function call
      const transferData = `0xa9059cbb${toAddress.slice(2).padStart(64, '0')}${amountInUnits.toString(16).padStart(64, '0')}`;
      
      // Use wagmi's writeContract approach for Farcaster MiniApps
      const { writeContract } = await import('wagmi/actions');
      const { config } = await import('../providers/MiniKitProvider');
      
      const hash = await writeContract(config, {
        address: USDC_CONTRACT as `0x${string}`,
        abi: [
          {
            name: 'transfer',
            type: 'function',
            inputs: [
              { name: 'to', type: 'address' },
              { name: 'amount', type: 'uint256' }
            ],
            outputs: [{ name: '', type: 'bool' }],
            stateMutability: 'nonpayable'
          }
        ],
        functionName: 'transfer',
        args: [toAddress as `0x${string}`, amountInUnits]
      });
      
      console.log('✅ Farcaster transaction sent:', hash);
      
      return {
        success: true,
        hash: hash
      };
    } catch (error: any) {
      console.error('❌ Farcaster transaction failed:', error);
      
      if (error?.message?.includes('user rejected') || error?.message?.includes('denied')) {
        throw new Error('Transaction was rejected by user');
      } else if (error?.message?.includes('insufficient funds')) {
        throw new Error('Insufficient USDC balance');
      } else {
        throw new Error(`Farcaster transaction failed: ${error?.message || 'Unknown error'}`);
      }
    }
  }, [isConnected, address]);

  const executePaycrestTransaction = useCallback(async (currency: 'local' | 'usdc', amount: string, recipient: any) => {
    if (!walletAddress || !isConnected) {
      throw new Error('Wallet not connected');
    }

    try {
      // Calculate the correct amount and rate
      const rate = parseFloat(currentRate);
      const amountNum = parseFloat(amount);
      
      // For local currency, amount is in local currency; for USDC, amount is in USDC
      const paymentAmount = currency === 'local' ? amountNum : amountNum;
      
      // Prepare Paycrest API payload (same as main app)
      const paymentOrderPayload = {
        amount: paymentAmount,
        rate: rate,
        network: 'base' as const,
        token: 'USDC' as const,
        recipient: recipient,
        returnAddress: walletAddress,
        reference: `miniapp-${Date.now()}`
      };

      console.log('Initiating Paycrest payment order:', paymentOrderPayload);

      // Call Paycrest API (same as main app)
      const response = await fetch('/api/paycrest/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentOrderPayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Paycrest API error: ${errorData.message || 'Unknown error'}`);
      }

      const paymentOrder = await response.json();
      console.log('Paycrest payment order created:', paymentOrder);
      
      // Now execute the actual blockchain transaction
      if (!paymentOrder.data?.receiveAddress) {
        throw new Error('No receive address received from Paycrest');
      }
      
      console.log('Executing blockchain transaction to:', paymentOrder.data.receiveAddress);
      
      // Calculate USDC amount (always in USDC for blockchain)
      const usdcAmount = currency === 'local' ? (paymentAmount / rate).toFixed(6) : paymentAmount.toFixed(6);
      
      // Execute the blockchain transaction - handle walletClient being null
      console.log('🔍 Wallet state debug:', {
        isConnected,
        address,
        walletClient: !!walletClient,
        walletClientAccount: walletClient?.account?.address,
        walletClientChain: walletClient?.chain?.name,
        connectors: connectors?.map(c => c.name),
        hasWindowEthereum: !!(window as any).ethereum
      });
      
      if (!isConnected) {
        throw new Error('Wallet not connected');
      }
      
      if (!address) {
        throw new Error('No wallet address found');
      }
      
      // Simple wallet provider detection: use smart wallet if no window.ethereum but wallet is connected
      console.log('🔍 Wallet detection:', {
        hasWindowEthereum: !!(window as any).ethereum,
        isConnected,
        address,
        userAgent: navigator.userAgent.substring(0, 100)
      });
      
      if ((window as any).ethereum) {
        // Use window.ethereum (MetaMask, Coinbase Wallet, etc.)
        const walletProvider = (window as any).ethereum;
        console.log('✅ Using window.ethereum provider');
        
        const blockchainResult = await executeUSDCTransaction(
          paymentOrder.data.receiveAddress, 
          parseFloat(usdcAmount), 
          walletProvider
        );
        
        if (!blockchainResult.success) {
          throw new Error('Blockchain transaction failed');
        }
        
        return {
          success: true,
          orderId: paymentOrder.data?.id || 'unknown',
          paymentOrder: paymentOrder,
          amount: usdcAmount,
          hash: blockchainResult.hash
        };
      } else if (isConnected && address) {
        // No window.ethereum but wallet is connected - use smart wallet approach
        console.log('✅ Using smart wallet transaction (no window.ethereum)');
        const farcasterResult = await executeFarcasterTransaction(
          paymentOrder.data.receiveAddress,
          parseFloat(usdcAmount)
        );
        
        return {
          success: true,
          orderId: paymentOrder.data?.id || 'unknown',
          paymentOrder: paymentOrder,
          amount: usdcAmount,
          hash: farcasterResult.hash
        };
      } else {
        console.error('❌ No wallet available');
        throw new Error('Please connect your wallet first');
      }
    } catch (error: any) {
      console.error('Paycrest transaction failed:', error);
      throw error;
    }
  }, [walletAddress, isConnected, currentRate]);

  // Swap functionality
  const fetchSwapQuote = useCallback(async () => {
    if (!swapAmount || !swapFromToken || !swapToToken) {
      console.log('❌ Missing required params:', { swapAmount, swapFromToken, swapToToken });
      return;
    }
    
    if (!isConnected) {
      console.log('❌ Wallet not connected, skipping quote fetch');
      return;
    }

    setSwapIsLoading(true);
    setSwapError(null);
    setSwapQuote(null);

    try {
      console.log('🔄 Fetching quote for:', swapAmount, swapFromToken, '->', swapToToken);
      
      // Get token addresses from stablecoins data
      const fromTokenData = stablecoins.find(token => token.baseToken === swapFromToken);
      const toTokenData = stablecoins.find(token => token.baseToken === swapToToken);

      if (!fromTokenData || !toTokenData) {
        throw new Error('Token not supported');
      }

      console.log('📊 Token data:', {
        from: { symbol: fromTokenData.baseToken, address: fromTokenData.address, decimals: fromTokenData.decimals },
        to: { symbol: toTokenData.baseToken, address: toTokenData.address, decimals: toTokenData.decimals }
      });

      try {
        // Try Aerodrome first
        const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
        
        // Convert amount to token units (use token decimals or default to 6)
        const fromDecimals = fromTokenData.decimals || 6;
        const toDecimals = toTokenData.decimals || 6;
        const amountInUnits = ethers.utils.parseUnits(swapAmount, fromDecimals);

        console.log('💱 Calling Aerodrome with:', {
          amountIn: amountInUnits.toString(),
          fromToken: fromTokenData.address,
          toToken: toTokenData.address
        });

        // Get quote from Aerodrome (using volatile pools)
        const quote = await getAerodromeQuote({
          provider,
          amountIn: amountInUnits.toString(),
          fromToken: fromTokenData.address,
          toToken: toTokenData.address,
          stable: false, // Use volatile pools
          factory: AERODROME_FACTORY_ADDRESS
        });

        console.log('✅ Aerodrome quote received:', quote);

        // Convert quote back to readable format
        // Handle decimal precision properly to avoid "fractional component exceeds decimals" error
        const rawQuoteAmount = ethers.utils.formatUnits(quote[1], toDecimals);
        const quoteAmount = parseFloat(rawQuoteAmount).toFixed(toDecimals);
        console.log('💰 Formatted quote amount:', quoteAmount);
        setSwapQuote(quoteAmount);
      } catch (aerodromeError) {
        console.error('❌ Aerodrome quote failed:', aerodromeError);
        throw aerodromeError; // Re-throw to show the actual error
      }
    } catch (error: any) {
      console.error('❌ Quote fetch failed:', error);
      setSwapError(error.message || 'Failed to fetch quote');
    } finally {
      setSwapIsLoading(false);
    }
  }, [swapAmount, swapFromToken, swapToToken, isConnected]);

  const executeSwap = useCallback(async () => {
    if (!swapAmount || !swapFromToken || !swapToToken || !swapQuote || !isConnected || !address) {
      throw new Error('Missing swap parameters');
    }

    setSwapIsLoading(true);
    setSwapError(null);
    setSwapSuccess(null);

    try {
      console.log('🔄 Starting swap execution:', { swapFromToken, swapToToken, swapAmount, swapQuote });
      
      // Get token data
      const fromTokenData = stablecoins.find(token => token.baseToken === swapFromToken);
      const toTokenData = stablecoins.find(token => token.baseToken === swapToToken);

      if (!fromTokenData || !toTokenData) {
        throw new Error('Token not supported');
      }
      
      console.log('📊 Token addresses:', {
        from: { token: fromTokenData.baseToken, address: fromTokenData.address },
        to: { token: toTokenData.baseToken, address: toTokenData.address }
      });

      // Create provider and signer with enhanced Farcaster compatibility
      let provider;
      let signer;
      
      try {
        if (walletClient) {
          // Use wallet client if available (preferred for transactions)
          console.log('🔍 Attempting to use wallet client provider...');
          provider = new ethers.providers.Web3Provider(walletClient as any, {
            name: 'base-mainnet',
            chainId: 8453
          });
          signer = provider.getSigner();
          
          // Test the signer to ensure it works
          await signer.getAddress();
          console.log('✅ Wallet client provider working');
        } else if (typeof window !== 'undefined' && window.ethereum) {
          // Fallback to window.ethereum
          console.log('🔍 Attempting to use window.ethereum provider...');
          provider = new ethers.providers.Web3Provider(window.ethereum, {
            name: 'base-mainnet',
            chainId: 8453
          });
          signer = provider.getSigner();
          
          // Test the signer
          await signer.getAddress();
          console.log('✅ Window.ethereum provider working');
        } else {
          throw new Error('No wallet provider available');
        }
      } catch (providerError) {
        console.error('❌ Provider setup failed:', providerError);
        
        // Try a more basic provider setup for Farcaster
        if (walletClient) {
          console.log('🔄 Trying basic wallet client setup...');
          try {
            provider = new ethers.providers.Web3Provider(walletClient as any);
            signer = provider.getSigner();
            console.log('✅ Basic wallet client setup successful');
          } catch (basicError) {
            console.error('❌ Basic wallet client failed:', basicError);
            throw new Error(`Wallet provider error: ${providerError.message}. Please try refreshing or reconnecting your wallet.`);
          }
        } else {
          throw new Error('No compatible wallet provider found. Please ensure your wallet is connected and supports Base network.');
        }
      }

      // Convert amounts using proper decimals
      const fromDecimals = fromTokenData.decimals || 6;
      const toDecimals = toTokenData.decimals || 6;
      const amountInUnits = ethers.utils.parseUnits(swapAmount, fromDecimals);
      // Calculate minimum amount out with proper decimal handling (increased slippage for production)
      const slippageAmount = Number(swapQuote) * 0.98; // 2% slippage tolerance
      const minAmountOutFormatted = slippageAmount.toFixed(toDecimals);
      const minAmountOut = ethers.utils.parseUnits(minAmountOutFormatted, toDecimals);
      
      // Verify pool exists before attempting swap
      try {
        console.log('🔍 Verifying pool exists...');
        // Use JsonRpcProvider for pool verification to avoid wallet issues
        const readOnlyProvider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
        const testQuote = await getAerodromeQuote({
          provider: readOnlyProvider,
          amountIn: amountInUnits.toString(),
          fromToken: fromTokenData.address,
          toToken: toTokenData.address,
          stable: false,
          factory: AERODROME_FACTORY_ADDRESS
        });
        console.log('✅ Pool exists, quote verified:', ethers.utils.formatUnits(testQuote[1], toDecimals));
      } catch (poolError) {
        console.error('❌ Pool verification failed:', poolError);
        throw new Error(`No liquidity pool exists for ${swapFromToken}/${swapToToken} pair on Aerodrome DEX`);
      }

      // Set deadline (20 minutes from now)
      const deadline = Math.floor(Date.now() / 1000) + 1200;

      // First, approve the router to spend the from token
      const fromTokenContract = new ethers.Contract(
        fromTokenData.address,
        [
          'function approve(address spender, uint256 amount) external returns (bool)',
          'function allowance(address owner, address spender) external view returns (uint256)'
        ],
        signer
      );

      // Check current allowance with error handling
      console.log('🔍 Checking token allowance...');
      let currentAllowance;
      try {
        currentAllowance = await fromTokenContract.allowance(address, '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43');
        console.log('💰 Current allowance:', ethers.utils.formatUnits(currentAllowance, fromDecimals));
        console.log('💰 Required amount:', ethers.utils.formatUnits(amountInUnits, fromDecimals));
      } catch (allowanceError) {
        console.error('❌ Allowance check failed:', allowanceError);
        // Assume zero allowance if check fails
        currentAllowance = ethers.BigNumber.from(0);
        console.log('⚠️ Assuming zero allowance due to check failure');
      }
      
      if (currentAllowance.lt(amountInUnits)) {
        console.log('⚙️ Approving token spend...');
        try {
          const approveTx = await fromTokenContract.approve(
            '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43', // Aerodrome router
            amountInUnits,
            {
              gasLimit: ethers.utils.hexlify(100000), // 100k gas for approval
            }
          );
          console.log('⏳ Waiting for approval transaction...');
          await approveTx.wait();
          console.log('✅ Approval successful!');
        } catch (approvalError) {
          console.error('❌ Approval failed:', approvalError);
          throw new Error(`Token approval failed: ${approvalError.message}. Please try again or check your wallet connection.`);
        }
      } else {
        console.log('✅ Sufficient allowance already exists');
      }

      // Execute the swap
      console.log('🔄 Executing swap with parameters:', {
        amountIn: ethers.utils.formatUnits(amountInUnits, fromDecimals),
        amountOutMin: ethers.utils.formatUnits(minAmountOut, toDecimals),
        fromToken: fromTokenData.address,
        toToken: toTokenData.address,
        stable: false,
        factory: AERODROME_FACTORY_ADDRESS,
        userAddress: address,
        deadline: new Date(deadline * 1000).toISOString()
      });
      
      const swapTx = await swapAerodrome({
        signer,
        amountIn: amountInUnits.toString(),
        amountOutMin: minAmountOut.toString(),
        fromToken: fromTokenData.address,
        toToken: toTokenData.address,
        stable: false, // Use volatile pools
        factory: AERODROME_FACTORY_ADDRESS,
        userAddress: address,
        deadline
      });

      const receipt = await swapTx.wait();
      
      setSwapSuccess(`Swap successful! Transaction: ${receipt.transactionHash}`);
      setSwapAmount('');
      setSwapQuote(null);
      
      // Refresh balance
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error: any) {
      console.error('Swap failed:', error);
      setSwapError(error.message || 'Swap failed');
    } finally {
      setSwapIsLoading(false);
    }
  }, [swapAmount, swapFromToken, swapToToken, swapQuote, isConnected, address, walletClient]);

  // Fetch token balance for swap
  const [swapFromBalance, setSwapFromBalance] = useState<string>('0.00');
  const [swapToBalance, setSwapToBalance] = useState<string>('0.00');

  const fetchTokenBalance = useCallback(async (tokenSymbol: string, walletAddress: string) => {
    try {
      const tokenData = stablecoins.find(token => token.baseToken === tokenSymbol);
      if (!tokenData || !walletAddress) return '0.00';

      // For USDC, use the existing balance
      if (tokenSymbol === 'USDC') {
        return walletBalance || '0.00';
      }

      // For other tokens, fetch balance using ethers
      const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
      const tokenContract = new ethers.Contract(
        tokenData.address,
        ['function balanceOf(address owner) external view returns (uint256)'],
        provider
      );

      const tokenBalance = await tokenContract.balanceOf(walletAddress);
      const decimals = tokenData.decimals || 6;
      return ethers.utils.formatUnits(tokenBalance, decimals);
    } catch (error) {
      console.error('Error fetching token balance:', error);
      return '0.00';
    }
  }, [walletBalance]);

  // Update balances when tokens change
  useEffect(() => {
    if (isConnected && address) {
      fetchTokenBalance(swapFromToken, address).then(setSwapFromBalance);
      if (swapToToken) {
        fetchTokenBalance(swapToToken, address).then(setSwapToBalance);
      } else {
        setSwapToBalance('0.00');
      }
    } else {
      setSwapFromBalance('0.00');
      setSwapToBalance('0.00');
    }
  }, [swapFromToken, swapToToken, isConnected, address, fetchTokenBalance]);

  // Auto-fetch quote when swap parameters change
  useEffect(() => {
    if (swapAmount && swapFromToken && swapToToken && Number(swapAmount) > 0) {
      const timeoutId = setTimeout(() => {
        fetchSwapQuote();
      }, 500); // Debounce for 500ms
      
      return () => clearTimeout(timeoutId);
    } else {
      setSwapQuote(null);
    }
  }, [swapAmount, swapFromToken, swapToToken, fetchSwapQuote]);

  const handleGeneratePaymentLink = useCallback(async () => {
    if (!linkAmount || !isConnected || !walletAddress) {
      alert('Please connect wallet and enter amount');
      return;
    }

    try {
      // Generate a unique payment link
      const linkId = `payment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const baseUrl = window.location.origin;
      
      // Create payment request URL that will show the payment modal
      const paymentLink = `${baseUrl}/payment-request?id=${linkId}&amount=${linkAmount}&token=${selectedStablecoin.baseToken}&description=${encodeURIComponent(linkDescription)}&merchant=${walletAddress}`;
      
      setGeneratedLink(paymentLink);
      
      // Store payment request data
      const paymentData = {
        id: linkId,
        amount: linkAmount,
        token: selectedStablecoin.baseToken,
        description: linkDescription,
        merchant: walletAddress,
        createdAt: new Date().toISOString(),
        status: 'pending'
      };
      
      // Store in localStorage for now (in production, this would be stored in a database)
      localStorage.setItem(`payment-${linkId}`, JSON.stringify(paymentData));
      
      // Copy to clipboard
      await navigator.clipboard.writeText(paymentLink);
      alert('✅ Payment link generated and copied to clipboard!');
      
    } catch (error) {
      console.error('Failed to generate payment link:', error);
      alert('❌ Failed to generate payment link');
    }
  }, [linkAmount, isConnected, walletAddress, selectedStablecoin, linkDescription]);

  const handleSendTransaction = useCallback(async () => {
    if (!amount || !phoneNumber) {
      alert('Please enter amount and phone number');
      return;
    }

    if (!walletAddress || !isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      // Show loading state
      setIsSwipeComplete(true);
      
      // Validate that institution is selected
      if (!selectedInstitution) {
        alert('Please select a mobile money provider');
        return;
      }
      
      // Prepare recipient data for Paycrest API (correct format)
      const recipient = {
        institution: selectedInstitution,
        accountIdentifier: phoneNumber,
        accountName: 'Mobile Money Account',
        memo: `Send ${sendCurrency === 'local' ? amount + ' ' + selectedCountry.currency : amount + ' ' + selectedSendToken} to ${phoneNumber}`
      };
      
      // Execute Paycrest API transaction
      const result = await executePaycrestTransaction(sendCurrency, amount, recipient);
      
      if (!result) {
        throw new Error('Transaction failed - no result returned');
      }
      
      // Transaction successful - show animated modal
      setSuccessData({
        orderId: result.orderId,
        hash: result.hash,
        amount: sendCurrency === 'local' ? `${amount} ${selectedCountry.currency}` : `${amount} ${selectedSendToken}`,
        recipient: phoneNumber,
        type: 'send'
      });
      setShowSuccessModal(true);
      
      // Refresh balance
      await fetchWalletBalance();
      
    } catch (error: any) {
      console.error('Send transaction failed:', error);
      let errorMessage = 'Send failed: ';
      
      if (error.message.includes('Paycrest API error')) {
        errorMessage += error.message.replace('Paycrest API error: ', '');
      } else {
        errorMessage += error.message || 'Unknown error occurred';
      }
      
      alert(`❌ ${errorMessage}`);
    } finally {
      setIsSwipeComplete(false);
      setSwipeProgress(0);
    }
  }, [amount, phoneNumber, walletAddress, isConnected, sendCurrency, selectedSendToken, selectedCountry.currency, selectedCountry.code, selectedInstitution, executePaycrestTransaction, fetchWalletBalance]);

  const handlePayTransaction = useCallback(async () => {
    if (!amount || !tillNumber) {
      alert('Please enter amount and till number');
      return;
    }

    // Additional validation for paybill
    if (paymentType === 'bill' && !businessNumber) {
      alert('Please enter business number for paybill');
      return;
    }

    if (!walletAddress || !isConnected) {
      alert('Please connect your wallet first');
      return;
    }

    try {
      // Show loading state
      setIsSwipeComplete(true);
      
      // Prepare recipient data for Paycrest API (correct format)
      const recipient = {
        institution: paymentType === 'bill' ? 'paybill' : 'till', // Different institution based on payment type
        accountIdentifier: paymentType === 'bill' ? businessNumber : tillNumber,
        accountName: paymentType === 'bill' ? 'Paybill Payment' : 'Till Payment',
        memo: `Pay ${payCurrency === 'local' ? amount + ' ' + selectedCountry.currency : amount + ' ' + selectedPayToken} to ${paymentType === 'bill' ? 'paybill ' + tillNumber + ' account ' + businessNumber : 'till ' + tillNumber}`
      };
      
      // Execute Paycrest API transaction
      const result = await executePaycrestTransaction(payCurrency, amount, recipient);
      
      if (!result) {
        throw new Error('Transaction failed - no result returned');
      }
      
      // Transaction successful - show animated modal
      setSuccessData({
        orderId: result.orderId,
        hash: result.hash,
        amount: payCurrency === 'local' ? `${amount} ${selectedCountry.currency}` : `${amount} ${selectedPayToken}`,
        recipient: tillNumber,
        type: 'pay'
      });
      setShowSuccessModal(true);
      
      // Refresh balance
      await fetchWalletBalance();
      
    } catch (error: any) {
      console.error('Pay transaction failed:', error);
      let errorMessage = 'Payment failed: ';
      
      if (error.message.includes('Paycrest API error')) {
        errorMessage += error.message.replace('Paycrest API error: ', '');
      } else {
        errorMessage += error.message || 'Unknown error occurred';
      }
      
      alert(`❌ ${errorMessage}`);
    } finally {
      setIsSwipeComplete(false);
      setSwipeProgress(0);
    }
  }, [amount, tillNumber, businessNumber, paymentType, walletAddress, isConnected, payCurrency, selectedPayToken, selectedCountry.currency, selectedCountry.code, executePaycrestTransaction, fetchWalletBalance]);

  const renderSendTab = () => (
    <div className="space-y-2">
      {/* Country Selector */}
      <div className="relative">
        <select 
          value={selectedCountry.code}
          onChange={(e) => {
            const country = orderedCountries.find(c => c.code === e.target.value);
            if (country && !country.comingSoon) {
              setSelectedCountry(country);
            }
          }}
          className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {orderedCountries.map((country) => (
            <option key={country.code} value={country.code} disabled={country.comingSoon}>
              {country.flag} {country.name} {country.comingSoon ? '(Coming soon)' : ''}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
      </div>

      {/* Send Money Button */}
      <button className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg text-sm transition-colors">
        Send Money
      </button>

      {/* Mobile Money Provider */}
      <div>
        <label className="block text-xs text-gray-300 font-medium mb-1">Select Mobile Money Provider</label>
        <div className="relative">
          <select 
            value={selectedInstitution}
            onChange={(e) => setSelectedInstitution(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700/50 text-white rounded-lg px-3 py-2 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-slate-700/50 transition-colors"
          >
            <option value="">Choose provider...</option>
            {institutions.map((institution) => (
              <option key={institution.code} value={institution.code}>
                {institution.name}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
      </div>

      {/* Recipient Name */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Recipient Name</label>
        <input
          type="text"
          value={recipientName}
          onChange={(e) => setRecipientName(e.target.value)}
          placeholder="John Doe"
          className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Phone Number */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Enter Mobile or Account Number (Start with country code)</label>
        <input
          type="text"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder={`${selectedCountry.countryCode || '+255'}789123456`}
          className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Amount Input with Currency Switching */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="text-xs text-gray-400">Enter Amount</label>
          <div className="flex gap-1">
            <button 
              onClick={() => setSendCurrency('local')}
              className={`relative px-3 py-1 text-xs rounded-lg font-bold transition-all duration-300 ease-out overflow-hidden group ${
                sendCurrency === 'local' 
                  ? 'bg-gradient-to-br from-amber-500 via-orange-600 to-red-600 text-white shadow-xl shadow-orange-500/30 transform scale-110 border-2 border-orange-400/50' 
                  : 'bg-slate-700/80 text-white hover:bg-slate-600/90 hover:scale-105 hover:shadow-lg border-2 border-transparent hover:border-orange-400/30 active:scale-95'
              }`}
            >
              {/* Animated background */}
              {sendCurrency === 'local' && (
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-orange-400/20 animate-pulse" />
              )}
              
              {/* Hover glow */}
              <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                sendCurrency === 'local' 
                  ? 'opacity-100 bg-orange-400/10' 
                  : 'opacity-0 group-hover:opacity-100 bg-orange-400/5'
              }`} />
              
              <span className={`relative z-10 transition-all duration-300 ${
                sendCurrency === 'local' ? 'drop-shadow-lg' : 'group-hover:tracking-wider'
              }`}>
                🏛️ {selectedCountry.currency}
              </span>
              
              {/* Active indicator */}
              {sendCurrency === 'local' && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-400 rounded-full animate-bounce" />
              )}
            </button>
            
            <div className="relative">
              <div className="relative">
                <button
                  onClick={() => {
                    setSendCurrency('usdc');
                    setShowSendTokenDropdown(!showSendTokenDropdown);
                  }}
                  className={`relative px-3 py-1 text-xs rounded-lg font-bold transition-all duration-300 ease-out overflow-hidden group w-full text-left flex items-center justify-between ${
                    sendCurrency === 'usdc' 
                      ? 'bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 text-white shadow-xl shadow-blue-500/30 transform scale-110 border-2 border-blue-400/50' 
                      : 'bg-slate-700/80 text-white hover:bg-slate-600/90 hover:scale-105 hover:shadow-lg border-2 border-transparent hover:border-blue-400/30'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {selectedSendToken === 'USDC' ? (
                      <img src="/assets/logos/usdc-logo.png" alt="USDC" className="w-3 h-3" />
                    ) : (
                      <span className="text-xs">
                        {stablecoins.find(token => token.baseToken === selectedSendToken)?.flag || '🌍'}
                      </span>
                    )}
                    <span>{selectedSendToken}</span>
                  </div>
                  <ChevronDownIcon className="w-3 h-3 text-white" />
                </button>
                
                {showSendTokenDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 rounded-lg border border-slate-600 shadow-xl z-50 max-h-48 overflow-y-auto">
                    {stablecoins.map((token) => (
                      <button
                        key={token.baseToken}
                        onClick={() => {
                          setSelectedSendToken(token.baseToken);
                          setShowSendTokenDropdown(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-slate-700 flex items-center gap-2 text-xs transition-colors"
                      >
                        {token.baseToken === 'USDC' ? (
                          <img src="/assets/logos/usdc-logo.png" alt="USDC" className="w-3 h-3" />
                        ) : (
                          <span className="text-xs">{token.flag || '🌍'}</span>
                        )}
                        <span className="text-white">{token.baseToken}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {/* Active indicator */}
              {sendCurrency === 'usdc' && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-bounce" />
              )}
            </div>
          </div>
        </div>
        <div className="bg-slate-700 rounded-lg px-3 py-2">
          <div className="flex items-center">
            <span className="text-sm text-gray-400 mr-2">
              {sendCurrency === 'local' ? selectedCountry.currency : selectedSendToken}
            </span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={sendCurrency === 'local' ? '1000' : '1.5'}
              step={sendCurrency === 'local' ? '1' : '0.01'}
              className="bg-transparent text-white text-base font-light flex-1 focus:outline-none"
            />
          </div>
        </div>
        
        {/* Currency Conversion Display */}
        {amount && (
          <div className="mt-1 text-center text-xs text-gray-400 font-medium">
            {sendCurrency === 'local' ? (
              <span>≈ {(parseFloat(amount) / parseFloat(currentRate)).toFixed(4)} {selectedSendToken}</span>
            ) : (
              <span>≈ {(parseFloat(amount) * parseFloat(currentRate)).toFixed(2)} {selectedCountry.currency}</span>
            )}
          </div>
        )}
      </div>

      {/* Payment Details */}
      <div className="space-y-1">
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-xs">You'll pay</span>
          <div className="flex items-center gap-1">
            <img src="/assets/logos/base-logo.jpg" alt="Base" className="w-3 h-3 rounded-full" />
            <span className="text-white text-xs">Base</span>
          </div>
        </div>
        
        <div className="text-right mb-3">
          <div className="text-xs text-gray-400 flex items-center gap-2">
            <span>Balance:</span>
            <button 
              onClick={() => setAmount(walletBalance)}
              className="text-blue-400 font-medium hover:text-blue-300 transition-colors cursor-pointer inline-flex items-center gap-1"
            >
              {selectedSendToken === 'USDC' ? (
                <img src="/assets/logos/usdc-logo.png" alt="USDC" className="w-3 h-3" />
              ) : (
                <span className="text-sm">
                  {stablecoins.find(token => token.baseToken === selectedSendToken)?.flag || '🌍'}
                </span>
              )}
              {selectedSendToken} {walletBalance}
            </button>
            <button
              onClick={refreshBalance}
              className="text-gray-400 hover:text-blue-400 transition-colors p-1 rounded hover:bg-slate-700/50"
              title="Refresh balance"
            >
              🔄
            </button>
          </div>
        </div>

        <div className="text-center text-xs text-gray-300 mb-4 font-semibold">
          1 USDC = {isLoadingRate ? '...' : currentRate} {selectedCountry.currency} • Payment usually completes in 30s
        </div>

        <div className="space-y-1 text-xs mb-4">
          <div className="flex justify-between">
            <span className="text-gray-400">Total {selectedCountry.currency}</span>
            <span className="text-white">{paymentDetails.totalLocal} {selectedCountry.currency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Fees</span>
            <span className="text-white">{paymentDetails.fee} {selectedCountry.currency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Amount in {selectedSendToken}</span>
            <span className="text-white">{paymentDetails.usdcAmount} {selectedSendToken}</span>
          </div>
        </div>
      </div>
      
      {/* Swipe to Send */}
      <div className="mt-6">
        <div className="relative bg-gradient-to-r from-green-600 to-emerald-600 rounded-full p-1 overflow-hidden">
          {/* Progress Background */}
          <div 
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-green-400 to-emerald-400 rounded-full transition-all duration-150 ease-in-out"
            style={{ width: `${swipeProgress}%` }}
          />
          
          {/* Swipe Button */}
          <div className="relative flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                <ArrowRightIcon className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-white font-medium text-sm">
                {isSwipeComplete ? '✅ Sending...' : 'Swipe to Send'}
              </span>
            </div>
            
            <div className="text-white text-sm font-medium">
              {sendCurrency === 'local' 
                ? `${amount || '0'} ${selectedCountry.currency}`
                : `${amount || '0'} ${selectedSendToken}`
              }
            </div>
          </div>
          
          {/* Touch/Click Handler */}
          <div 
            className="absolute inset-0 cursor-pointer"
            onMouseDown={(e) => {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const startX = e.clientX - rect.left;
              
              const handleMouseMove = (moveEvent: MouseEvent) => {
                const currentX = moveEvent.clientX - rect.left;
                const progress = Math.min(Math.max(((currentX - startX) / rect.width) * 100, 0), 100);
                setSwipeProgress(progress);
                
                if (progress >= 80) {
                  setIsSwipeComplete(true);
                  setTimeout(() => {
                    handleSendTransaction();
                    setIsSwipeComplete(false);
                    setSwipeProgress(0);
                  }, 500);
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                }
              };
              
              const handleMouseUp = () => {
                if (swipeProgress < 80) {
                  setSwipeProgress(0);
                }
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };
              
              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const startX = e.touches[0].clientX - rect.left;
              
              const handleTouchMove = (moveEvent: TouchEvent) => {
                moveEvent.preventDefault();
                const currentX = moveEvent.touches[0].clientX - rect.left;
                const progress = Math.min(Math.max(((currentX - startX) / rect.width) * 100, 0), 100);
                setSwipeProgress(progress);
                
                if (progress >= 80) {
                  setIsSwipeComplete(true);
                  setTimeout(() => {
                    handleSendTransaction();
                    setIsSwipeComplete(false);
                    setSwipeProgress(0);
                  }, 500);
                  document.removeEventListener('touchmove', handleTouchMove);
                  document.removeEventListener('touchend', handleTouchEnd);
                }
              };
              
              const handleTouchEnd = () => {
                if (swipeProgress < 80) {
                  setSwipeProgress(0);
                }
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);
              };
              
              document.addEventListener('touchmove', handleTouchMove, { passive: false });
              document.addEventListener('touchend', handleTouchEnd);
            }}
          />
        </div>
        
        {/* Helper Text */}
        <div className="text-center mt-2 text-xs text-gray-400">
          Funds will be refunded to your wallet if the transaction fails
        </div>
      </div>
    </div>
  );

  // Success Modal Component
  const SuccessModal = () => {
    if (!showSuccessModal || !successData) return null;

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 max-w-sm w-full border border-slate-700/50 shadow-2xl animate-in zoom-in-95 duration-300">
          {/* Success Icon with Animation */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center animate-bounce">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          {/* Success Title */}
          <h2 className="text-xl font-bold text-white text-center mb-2">
            {successData.type === 'send' ? '💸 Money Sent!' : '💳 Payment Complete!'}
          </h2>
          <p className="text-gray-300 text-center text-sm mb-6">
            Your transaction was successful
          </p>

          {/* Transaction Details */}
          <div className="space-y-3 mb-6">
            <div className="bg-slate-700/50 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400 text-xs">Amount</span>
                <div className="flex items-center gap-2">
                  <img src="/assets/logos/usdc-logo.png" alt="USDC" className="w-4 h-4" />
                  <span className="text-white font-semibold">{successData.amount}</span>
                </div>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400 text-xs">{successData.type === 'send' ? 'Recipient' : 'Till Number'}</span>
                <div className="flex flex-col items-end">
                  <span className="text-white font-mono text-sm">{successData.recipient}</span>
                  <span className="text-gray-500 text-xs">{recipientName || 'Mobile Money'}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-xs">Order ID</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(successData.orderId);
                    // Show brief feedback
                    const btn = event?.target as HTMLElement;
                    const originalText = btn.textContent;
                    btn.textContent = 'Copied!';
                    setTimeout(() => {
                      btn.textContent = originalText;
                    }, 1000);
                  }}
                  className="text-blue-400 font-mono text-xs hover:text-blue-300 transition-colors cursor-pointer flex items-center gap-1"
                >
                  {successData.orderId.slice(0, 8)}...
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Blockchain Hash */}
            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg p-3 border border-blue-500/20">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                  <span className="text-blue-400 text-xs font-medium">Blockchain Transaction</span>
                </div>
                {successData.hash && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(successData.hash!);
                      // Show brief feedback
                      const btn = event?.target as HTMLElement;
                      const originalText = btn.textContent;
                      btn.textContent = 'Copied!';
                      setTimeout(() => {
                        btn.textContent = originalText;
                      }, 1000);
                    }}
                    className="text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                    title="Copy transaction hash"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="text-gray-300 font-mono text-xs break-all">
                {successData.hash ? `${successData.hash.slice(0, 20)}...${successData.hash.slice(-10)}` : 'Transaction completed'}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowSuccessModal(false);
                setSuccessData(null);
                // Reset form
                setAmount('');
                setPhoneNumber('');
                setTillNumber('');
                setBusinessNumber('');
              }}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold py-3 px-4 rounded-xl transition-all duration-200 transform hover:scale-105"
            >
              ✨ Done
            </button>
            <button
              onClick={() => {
                if (successData.hash) {
                  navigator.clipboard.writeText(successData.hash);
                }
                // Could add a toast here
              }}
              className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-3 px-4 rounded-xl transition-colors"
            >
              📋
            </button>
          </div>

          {/* Celebration Animation */}
          <div className="absolute -top-2 -right-2 text-2xl animate-bounce delay-300">
            🎉
          </div>
          <div className="absolute -top-1 -left-2 text-xl animate-bounce delay-500">
            ✨
          </div>
        </div>
      </div>
    );
  };

  const renderPayTab = () => (
    <div className="space-y-4">
      {/* Header with Currency Toggle */}
      <div className="flex items-center justify-between">
        <h2 className="text-white text-lg font-medium">Pay</h2>
        <div className="flex items-center gap-2">
          <img src="/assets/logos/base-logo.jpg" alt="Base" className="w-4 h-4 rounded-full" />
          <div className="flex items-center gap-1">
            {selectedPayToken === 'USDC' ? (
              <img src="/assets/logos/usdc-logo.png" alt="USDC" className="w-4 h-4" />
            ) : (
              <span className="text-base">
                {stablecoins.find(token => token.baseToken === selectedPayToken)?.flag || '🌍'}
              </span>
            )}
            <span className="text-white text-sm font-medium">{selectedPayToken}</span>
          </div>
        </div>
      </div>

      {/* Country Selector */}
      <div className="relative">
        <button
          onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
          className="w-full bg-slate-800/50 border border-slate-700/50 text-white rounded-lg px-3 py-3 text-left flex items-center justify-between hover:bg-slate-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">{selectedCountry.flag}</span>
            <span className="text-white font-medium text-sm">{selectedCountry.name}</span>
          </div>
          <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${
            isCountryDropdownOpen ? 'rotate-180' : ''
          }`} />
        </button>
        
        {/* Dropdown Menu */}
        {isCountryDropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
            {orderedCountries.map((country) => (
              <button
                key={country.code}
                onClick={() => {
                  if (!country.comingSoon) {
                    setSelectedCountry(country);
                    setIsCountryDropdownOpen(false);
                  }
                }}
                disabled={country.comingSoon}
                className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-colors ${
                  country.comingSoon 
                    ? 'opacity-50 cursor-not-allowed' 
                    : 'hover:bg-slate-700'
                } ${
                  selectedCountry.code === country.code ? 'bg-blue-600/20' : ''
                }`}
              >
                <span className="text-2xl">{country.flag}</span>
                <div className="flex flex-col">
                  <span className="text-white font-medium">{country.name}</span>
                  {country.comingSoon && (
                    <span className="text-gray-400 text-xs">Coming soon</span>
                  )}
                </div>
                {selectedCountry.code === country.code && (
                  <div className="ml-auto w-2 h-2 bg-blue-500 rounded-full"></div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Payment Type Buttons */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setPaymentType('goods')}
          className={`relative py-3 px-2 rounded-xl text-xs font-bold transition-all duration-300 ease-out border-2 overflow-hidden group ${
            paymentType === 'goods' 
              ? 'bg-gradient-to-br from-emerald-500 via-green-600 to-teal-700 text-white border-emerald-400/60 shadow-2xl shadow-emerald-500/40 transform scale-105' 
              : 'bg-slate-800/80 text-white hover:bg-slate-700/90 border-slate-600/50 hover:border-emerald-500/30 hover:scale-102 hover:shadow-xl hover:shadow-emerald-500/10 active:scale-95'
          }`}
        >
          {/* Animated background */}
          {paymentType === 'goods' && (
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/20 to-green-400/20 animate-pulse" />
          )}
          
          {/* Hover glow */}
          <div className={`absolute inset-0 rounded-2xl transition-all duration-300 ${
            paymentType === 'goods' 
              ? 'opacity-100 bg-emerald-400/10' 
              : 'opacity-0 group-hover:opacity-100 bg-emerald-400/5'
          }`} />
          
          <span className={`relative z-10 transition-all duration-300 ${
            paymentType === 'goods' ? 'drop-shadow-lg' : 'group-hover:tracking-wide'
          }`}>
            🛍️ Buy Goods
          </span>
          
          {/* Active pulse indicator */}
          {paymentType === 'goods' && (
            <div className="absolute top-2 right-2 w-2 h-2 bg-emerald-300 rounded-full animate-ping" />
          )}
        </button>
        
        <button
          onClick={() => setPaymentType('bill')}
          className={`relative py-3 px-2 rounded-xl text-xs font-bold transition-all duration-300 ease-out border-2 overflow-hidden group ${
            paymentType === 'bill' 
              ? 'bg-gradient-to-br from-blue-500 via-cyan-600 to-sky-700 text-white border-blue-400/60 shadow-2xl shadow-blue-500/40 transform scale-105' 
              : 'bg-slate-800/80 text-white hover:bg-slate-700/90 border-slate-600/50 hover:border-blue-500/30 hover:scale-102 hover:shadow-xl hover:shadow-blue-500/10 active:scale-95'
          }`}
        >
          {/* Animated background */}
          {paymentType === 'bill' && (
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-cyan-400/20 animate-pulse" />
          )}
          
          {/* Hover glow */}
          <div className={`absolute inset-0 rounded-2xl transition-all duration-300 ${
            paymentType === 'bill' 
              ? 'opacity-100 bg-blue-400/10' 
              : 'opacity-0 group-hover:opacity-100 bg-blue-400/5'
          }`} />
          
          <span className={`relative z-10 transition-all duration-300 ${
            paymentType === 'bill' ? 'drop-shadow-lg' : 'group-hover:tracking-wide'
          }`}>
            📄 Paybill
          </span>
          
          {/* Active pulse indicator */}
          {paymentType === 'bill' && (
            <div className="absolute top-2 right-2 w-2 h-2 bg-blue-300 rounded-full animate-ping" />
          )}
        </button>
      </div>

      {/* Payment Type Specific Fields */}
      {paymentType === 'bill' ? (
        <>
          {/* Paybill Number */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Paybill Number</label>
            <div className="relative">
              <input
                type="text"
                value={tillNumber}
                onChange={(e) => setTillNumber(e.target.value)}
                placeholder="Enter paybill number"
                className="w-full bg-slate-700 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          {/* Business Number */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Business Number</label>
            <div className="relative">
              <input
                type="text"
                value={businessNumber}
                onChange={(e) => setBusinessNumber(e.target.value)}
                placeholder="Enter account number"
                className="w-full bg-slate-700 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </>
      ) : (
        /* Till Number for Buy Goods */
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">
            {paymentType === 'goods' ? 'Till Number' : 'Enter Till Number'}
          </label>
          <div className="relative">
            <input
              type="text"
              value={tillNumber}
              onChange={(e) => setTillNumber(e.target.value)}
              placeholder={paymentType === 'goods' ? 'Enter till number' : 'Enter till number'}
              className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      )}

      {/* Amount Input with Currency Switching */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label className="text-xs text-gray-400">Enter Amount</label>
          <div className="flex gap-2">
            <button 
              onClick={() => setPayCurrency('local')}
              className={`relative px-4 py-2 text-xs rounded-xl font-bold transition-all duration-300 ease-out overflow-hidden group ${
                payCurrency === 'local' 
                  ? 'bg-gradient-to-br from-amber-500 via-orange-600 to-red-600 text-white shadow-xl shadow-orange-500/30 transform scale-110 border-2 border-orange-400/50' 
                  : 'bg-slate-700/80 text-white hover:bg-slate-600/90 hover:scale-105 hover:shadow-lg border-2 border-transparent hover:border-orange-400/30 active:scale-95'
              }`}
            >
              {/* Animated background */}
              {payCurrency === 'local' && (
                <div className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-orange-400/20 animate-pulse" />
              )}
              
              {/* Hover glow */}
              <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                payCurrency === 'local' 
                  ? 'opacity-100 bg-orange-400/10' 
                  : 'opacity-0 group-hover:opacity-100 bg-orange-400/5'
              }`} />
              
              <span className={`relative z-10 transition-all duration-300 ${
                payCurrency === 'local' ? 'drop-shadow-lg' : 'group-hover:tracking-wider'
              }`}>
                🏛️ {selectedCountry.currency}
              </span>
              
              {/* Active indicator */}
              {payCurrency === 'local' && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-orange-400 rounded-full animate-bounce" />
              )}
            </button>
            
            <div className="relative">
              <select
                value={selectedPayToken}
                onChange={(e) => {
                  setSelectedPayToken(e.target.value);
                  setPayCurrency('usdc');
                }}
                onClick={() => setPayCurrency('usdc')}
                className={`relative px-4 py-2 text-xs rounded-xl font-bold transition-all duration-300 ease-out overflow-hidden group appearance-none pr-8 ${
                  payCurrency === 'usdc' 
                    ? 'bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 text-white shadow-xl shadow-blue-500/30 transform scale-110 border-2 border-blue-400/50' 
                    : 'bg-slate-700/80 text-white hover:bg-slate-600/90 hover:scale-105 hover:shadow-lg border-2 border-transparent hover:border-blue-400/30'
                }`}
              >
                {stablecoins.map((token) => (
                  <option key={token.baseToken} value={token.baseToken} className="bg-slate-800">
                    {token.baseToken}
                  </option>
                ))}
              </select>
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none">
                <ChevronDownIcon className="w-3 h-3 text-white" />
              </div>
              {/* Active indicator */}
              {payCurrency === 'usdc' && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-bounce" />
              )}
            </div>
          </div>
        </div>
        <div className="bg-slate-700 rounded-lg px-3 py-3">
          <div className="flex items-center">
            <span className="text-sm text-gray-400 mr-2">
              {payCurrency === 'local' ? selectedCountry.currency : selectedPayToken}
            </span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={payCurrency === 'local' ? '1000' : '1.5'}
              step={payCurrency === 'local' ? '1' : '0.01'}
              className="bg-transparent text-white text-lg font-light flex-1 focus:outline-none placeholder-gray-500"
            />
          </div>
        </div>
        
        {/* You'll pay section */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">You'll pay</span>
            <div className="flex items-center gap-2">
              <img src="/assets/logos/base-logo.jpg" alt="Base" className="w-4 h-4 rounded-full" />
              <span className="text-white text-sm font-medium">Base</span>
            </div>
          </div>
          
          <div className="text-right mb-2">
            <div className="text-sm text-gray-400 flex items-center gap-2">
              <span>Balance:</span>
              <button 
                onClick={() => setAmount(walletBalance)}
                className="text-blue-400 font-medium hover:text-blue-300 transition-colors cursor-pointer inline-flex items-center gap-1"
              >
                {selectedPayToken === 'USDC' ? (
                  <img src="/assets/logos/usdc-logo.png" alt="USDC" className="w-3 h-3" />
                ) : (
                  <span className="text-sm">
                    {stablecoins.find(token => token.baseToken === selectedPayToken)?.flag || '🌍'}
                  </span>
                )}
                {selectedPayToken} {walletBalance}
              </button>
              <button
                onClick={refreshBalance}
                className="text-gray-400 hover:text-blue-400 transition-colors p-1 rounded hover:bg-slate-700/50"
                title="Refresh balance"
              >
                🔄
              </button>
            </div>
          </div>

          <div className="text-center text-xs text-gray-300 mb-4 font-semibold">
            1 {selectedPayToken} = {isLoadingRate ? '...' : currentRate} {selectedCountry.currency} • Payment usually completes in 30s
          </div>
        </div>
      </div>

      {/* Payment Details */}
      <div className="space-y-3">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Total {selectedCountry.currency}</span>
            <span className="text-white">{paymentDetails.totalLocal} {selectedCountry.currency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Fees</span>
            <span className="text-white">{paymentDetails.fee} {selectedCountry.currency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Amount in {selectedPayToken}</span>
            <span className="text-white">{paymentDetails.usdcAmount} {selectedPayToken}</span>
          </div>
        </div>
      </div>

      {/* Swipe to Pay */}
      <div className="mt-6">
        <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 rounded-full p-1 overflow-hidden">
          {/* Progress Background */}
          <div 
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-400 to-purple-400 rounded-full transition-all duration-150 ease-in-out"
            style={{ width: `${swipeProgress}%` }}
          />
          
          <div className="relative flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                <CurrencyDollarIcon className="w-4 h-4 text-blue-600" />
              </div>
              <span className="text-white font-semibold text-sm">
                {isSwipeComplete ? '✅ Processing...' : 'Swipe to Pay'}
              </span>
            </div>
            
            <div className="text-white text-sm font-semibold">
              {payCurrency === 'local' 
                ? `${amount || '0'} ${selectedCountry.currency}`
                : `${amount || '0'} ${selectedPayToken}`
              }
            </div>
          </div>
          
          {/* Touch/Click Handler */}
          <div 
            className="absolute inset-0 cursor-pointer"
            onMouseDown={(e) => {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const startX = e.clientX - rect.left;
              
              const handleMouseMove = (moveEvent: MouseEvent) => {
                const currentX = moveEvent.clientX - rect.left;
                const progress = Math.min(Math.max(((currentX - startX) / rect.width) * 100, 0), 100);
                setSwipeProgress(progress);
                
                if (progress >= 80) {
                  setIsSwipeComplete(true);
                  setTimeout(() => {
                    handlePayTransaction();
                    setIsSwipeComplete(false);
                    setSwipeProgress(0);
                  }, 500);
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                }
              };
              
              const handleMouseUp = () => {
                if (swipeProgress < 80) {
                  setSwipeProgress(0);
                }
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };
              
              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              const startX = e.touches[0].clientX - rect.left;
              
              const handleTouchMove = (moveEvent: TouchEvent) => {
                moveEvent.preventDefault();
                const currentX = moveEvent.touches[0].clientX - rect.left;
                const progress = Math.min(Math.max(((currentX - startX) / rect.width) * 100, 0), 100);
                setSwipeProgress(progress);
                
                if (progress >= 80) {
                  setIsSwipeComplete(true);
                  setTimeout(() => {
                    handlePayTransaction();
                    setIsSwipeComplete(false);
                    setSwipeProgress(0);
                  }, 500);
                  document.removeEventListener('touchmove', handleTouchMove);
                  document.removeEventListener('touchend', handleTouchEnd);
                }
              };
              
              const handleTouchEnd = () => {
                if (swipeProgress < 80) {
                  setSwipeProgress(0);
                }
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);
              };
              
              document.addEventListener('touchmove', handleTouchMove, { passive: false });
              document.addEventListener('touchend', handleTouchEnd);
            }}
          />
        </div>
        
        <div className="text-center mt-2 text-sm text-gray-400 font-medium">
          Drag right to confirm payment
        </div>
      </div>
    </div>
  );

  const renderDepositTab = () => (
    <div className="space-y-3">
      {/* Country Selector */}
      <div className="relative">
        <select 
          value={selectedCountry.code}
          onChange={(e) => setSelectedCountry(orderedCountries.find(c => c.code === e.target.value) || orderedCountries[0])}
          className="w-full bg-slate-700 text-white rounded-lg px-3 py-2.5 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {orderedCountries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.flag} {country.name}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
      </div>

      {/* Amount Input */}
      <div className="text-center py-4 bg-slate-800/30 rounded-xl">
        <div className="text-4xl text-white font-light flex items-center justify-center">
          <span className="text-gray-400">$</span>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="bg-transparent text-white text-4xl font-light w-32 text-center focus:outline-none"
            placeholder="1"
            min="1"
            step="1"
          />
        </div>
      </div>

      {/* Token Selector */}
      <div className="relative">
        <select 
          value={selectedToken.baseToken}
          onChange={(e) => setSelectedToken(stablecoins.find(t => t.baseToken === e.target.value) || stablecoins[0])}
          className="w-full bg-slate-700 text-white rounded-lg px-3 py-2.5 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {stablecoins.map((token) => (
            <option key={token.baseToken} value={token.baseToken}>
              {token.flag} {token.baseToken} - {token.name}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
      </div>

      {/* Quick Amount Buttons */}
      <div className="grid grid-cols-3 gap-1.5">
        {[100, 300, 500].map((value) => (
          <button
            key={value}
            onClick={() => setAmount(value.toString())}
            className="bg-slate-700 hover:bg-slate-600 text-white py-1.5 px-3 rounded-lg transition-colors text-sm"
          >
            ${value}
          </button>
        ))}
      </div>

      {/* Institution Selector */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Select Institution</label>
        <div className="relative">
          <select className="w-full bg-slate-700 text-white rounded-lg px-3 py-2.5 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option>Choose institution...</option>
            {institutions.map((institution) => (
              <option key={institution.code} value={institution.code}>
                {institution.name}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
      </div>

      {/* Phone Number / Account Number */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Phone Number / Account Number</label>
        <input
          type="text"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="Enter phone number or account number..."
          className="w-full bg-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
        />
      </div>

      {/* Wallet Address */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Wallet Address for {selectedToken.baseToken}</label>
        <input
          type="text"
          value={walletAddress || ''}
          readOnly
          placeholder="Enter your wallet address..."
          className="w-full bg-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Exchange Rate */}
      <div className="text-center text-xs text-gray-400">
        1 USDC = {isLoadingRate ? '...' : currentRate} {selectedCountry.currency}
      </div>

      {/* Buy Button */}
      <button className="relative w-full bg-gradient-to-br from-green-500 via-emerald-600 to-teal-700 hover:from-green-400 hover:via-emerald-500 hover:to-teal-600 text-white font-bold py-4 rounded-2xl transition-all duration-300 ease-out shadow-2xl hover:shadow-3xl hover:scale-105 active:scale-95 border-2 border-green-400/30 hover:border-green-300/50 group overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 to-emerald-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        {/* Shimmer effect */}
        <div className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-shimmer" />
        
        <div className="relative z-10 flex items-center justify-center gap-3">
          <span className="text-lg font-bold tracking-wide drop-shadow-lg">💰 Buy Now</span>
          <div className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center">
            <span className="text-sm">→</span>
          </div>
        </div>
      </button>
    </div>
  );

  const renderLinkTab = () => (
    <div className="space-y-3">
      {/* Wallet Connection Status */}
      <div className={`border rounded-lg p-2 ${
        isConnected 
          ? 'bg-green-600/20 border-green-600/30' 
          : 'bg-yellow-600/20 border-yellow-600/30'
      }`}>
        <div className={`flex items-center gap-2 ${
          isConnected ? 'text-green-400' : 'text-yellow-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            isConnected ? 'bg-green-400' : 'bg-yellow-400'
          }`}></span>
          <span className="text-xs font-medium">
            {isConnected 
              ? `✅ Wallet Connected - Ready to Generate Links` 
              : `⚠️ Connect Wallet to Generate Links`
            }
          </span>
        </div>
        {isConnected && walletAddress && (
          <div className="text-xs text-gray-400 mt-1 font-mono">
            {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
          </div>
        )}
      </div>

      {/* Payment Amount */}
      <div>
        <label className="block text-gray-400 text-xs mb-1">Payment Amount</label>
        <div className="text-center py-4 bg-slate-800/30 rounded-lg">
          <div className="text-4xl text-white font-light">
            <span className="text-gray-400">$</span>
            <input
              type="number"
              value={linkAmount}
              onChange={(e) => setLinkAmount(e.target.value)}
              className="bg-transparent text-white text-4xl font-light w-20 text-center focus:outline-none"
              placeholder="6"
            />
          </div>
        </div>
      </div>

      {/* Currency Selector */}
      <div>
        <label className="block text-gray-400 text-xs mb-1">Currency</label>
        <div className="relative">
          <select 
            value={selectedStablecoin.baseToken}
            onChange={(e) => setSelectedStablecoin(stablecoins.find(t => t.baseToken === e.target.value) || stablecoins[0])}
            className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {stablecoins.map((token) => (
              <option key={token.baseToken} value={token.baseToken}>
                {token.flag} {token.baseToken} - {token.name}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-gray-400 text-xs mb-1">Description (Optional)</label>
        <textarea
          value={linkDescription}
          onChange={(e) => setLinkDescription(e.target.value)}
          placeholder="vibe"
          rows={3}
          className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Generate Link Button */}
      <button 
        onClick={isConnected ? handleGeneratePaymentLink : () => {
          if (isSmartWalletEnvironment) {
            console.log('⚠️ Smart wallet environment - connection should happen automatically');
          } else {
            console.log('💻 Desktop environment - manual connection may be needed');
            // Only attempt connection on desktop
            if (connectors.length > 0) {
              connect({ connector: connectors[0] });
            }
          }
        }}
        disabled={!isConnected || !linkAmount}
        className={`w-full font-medium py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm border-2 ${
          isConnected && linkAmount
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white transform hover:scale-105 shadow-lg border-blue-400/30 hover:border-blue-300/50' 
            : 'bg-gray-600 text-gray-300 cursor-not-allowed border-gray-600/30'
        }`}
      >
        {isConnected ? (
          <>
            🔗 Generate Payment Link
          </>
        ) : (
          <>
            <WalletIcon className="w-4 h-4" />
            Connect Wallet First
          </>
        )}
      </button>

      {/* Generated Link Display */}
      {generatedLink && (
        <div className="mt-3 p-3 bg-green-600/20 border border-green-600/30 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
            <span className="text-green-400 text-xs font-medium">✅ Payment Link Generated!</span>
          </div>
          <div className="bg-slate-800/50 rounded-lg p-2 font-mono text-xs text-gray-300 break-all">
            {generatedLink}
          </div>
          <button
            onClick={() => navigator.clipboard.writeText(generatedLink)}
            className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-lg transition-colors text-xs"
          >
            📋 Copy Link
          </button>
        </div>
      )}
    </div>
  );

  const renderCreateInvoice = () => {
    const handleLineItemChange = (idx: number, field: string, value: string) => {
      setInvoiceLineItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
    };
    
    const addLineItem = () => {
      setInvoiceLineItems([...invoiceLineItems, { description: '', amount: '' }]);
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setInvoiceStatus('loading');
      
      try {
        const requestData = {
          merchantId: walletAddress,
          recipient: invoiceRecipient,
          sender: invoiceSender,
          email: invoiceEmail,
          paymentCollection: 'one-time',
          dueDate: invoiceDueDate,
          currency: invoiceCurrency,
          lineItems: invoiceLineItems,
          paymentLink: invoicePaymentLink,
        };
        
        console.log('📤 Sending invoice data:', requestData);
        
        const res = await fetch('/api/send-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestData),
        });
        
        console.log('📥 Response status:', res.status, res.statusText);
        
        if (!res.ok) {
          const errorData = await res.json();
          console.error('❌ API Error:', errorData);
          setInvoiceStatus(errorData.error || `Failed to create invoice (${res.status})`);
          return;
        }
        
        setInvoiceStatus('success');
        setTimeout(() => {
          setInvoiceView('main');
          setInvoiceStatus(null);
          // Reset form
          setInvoiceRecipient('');
          setInvoiceEmail('');
          setInvoiceSender('');
          setInvoicePaymentLink('');
          setInvoiceDueDate(() => {
            const today = new Date();
            today.setDate(today.getDate() + 7);
            return today.toISOString().split('T')[0];
          });
          setInvoiceLineItems([{ description: '', amount: '' }]);
        }, 2000);
      } catch (err: any) {
        console.error('❌ Network/Parse Error:', err);
        setInvoiceStatus(err.message || 'Network error occurred');
      }
    };
    
    const totalAmount = invoiceLineItems.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
    
    return (
      <div className="space-y-4">
        {/* Header with Back Button */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setInvoiceView('main')}
            className="p-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
          >
            ←
          </button>
          <div>
            <h2 className="text-lg font-bold text-white">Create Invoice</h2>
          </div>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-2">
          {/* Client Information */}
          <div className="bg-slate-800/30 rounded-lg p-2">
            <h3 className="text-white font-medium mb-1.5 text-xs">Client Information</h3>
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Client name or company"
                value={invoiceRecipient}
                onChange={(e) => setInvoiceRecipient(e.target.value)}
                className="w-full bg-slate-700 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="email"
                placeholder="client@example.com"
                value={invoiceEmail}
                onChange={(e) => setInvoiceEmail(e.target.value)}
                className="w-full bg-slate-700 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>
          
          {/* Sender Information */}
          <div className="bg-slate-800/30 rounded-lg p-2">
            <h3 className="text-white font-medium mb-1.5 text-xs">Your Information</h3>
            <input
              type="text"
              placeholder="Your name or business"
              value={invoiceSender}
              onChange={(e) => setInvoiceSender(e.target.value)}
              className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          {/* Currency Selection */}
          <div className="bg-slate-800/30 rounded-lg p-2">
            <div className="flex items-center justify-between">
              <span className="text-white text-xs font-medium">Payment Currency</span>
              <select
                value={invoiceCurrency}
                onChange={(e) => setInvoiceCurrency(e.target.value)}
                className="bg-slate-700 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]"
              >
                {stablecoins.map((token) => (
                  <option key={token.baseToken} value={token.baseToken}>
                    {token.flag} {token.baseToken} - {token.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Due Date */}
          <div className="bg-slate-800/30 rounded-lg p-2">
            <div className="flex items-center justify-between">
              <span className="text-white text-xs font-medium">Due Date</span>
              <input
                type="date"
                value={invoiceDueDate}
                onChange={(e) => setInvoiceDueDate(e.target.value)}
                className="bg-slate-700 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]"
              />
            </div>
          </div>
          
          {/* Payment Link Selection */}
          <div className="bg-slate-800/30 rounded-lg p-2">
            <h3 className="text-white font-medium mb-1.5 text-xs">Payment Link</h3>
            <p className="text-gray-400 text-xs mb-1.5">
              Select from recent links or paste a payment link
            </p>
            <input
              type="text"
              placeholder="Paste your payment link here"
              value={invoicePaymentLink}
              onChange={(e) => setInvoicePaymentLink(e.target.value)}
              className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          
          {/* Line Items */}
          <div className="bg-slate-800/30 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-white font-medium text-sm">Invoice Items</h3>
              <button
                type="button"
                onClick={addLineItem}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                + Add Item
              </button>
            </div>
            <div className="space-y-2">
              {invoiceLineItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) => handleLineItemChange(idx, 'description', e.target.value)}
                    className="col-span-2 bg-slate-700 text-white rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required
                  />
                  <input
                    type="number"
                    placeholder="0.00"
                    value={item.amount}
                    onChange={(e) => handleLineItemChange(idx, 'amount', e.target.value)}
                    className="bg-slate-700 text-white rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    step="0.01"
                    required
                  />
                </div>
              ))}
            </div>
            
            {/* Total */}
            <div className="mt-3 pt-2 border-t border-slate-600">
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-sm">Total Amount</span>
                <div className="flex items-center gap-2">
                  {/* Currency Icon */}
                  {invoiceCurrency === 'USDC' ? (
                    <Image 
                      src="/assets/logos/usdc-logo.png" 
                      alt="USDC" 
                      width={20} 
                      height={20} 
                      className="rounded-full"
                    />
                  ) : (
                    <span className="text-lg">
                      {stablecoins.find(s => s.baseToken === invoiceCurrency)?.flag || '💰'}
                    </span>
                  )}
                  <span className="text-white font-bold">
                    {totalAmount.toFixed(2)} {invoiceCurrency}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Submit Button */}
          <button
            type="submit"
            disabled={invoiceStatus === 'loading'}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-50 border-2 border-blue-500 hover:border-blue-400"
          >
            {invoiceStatus === 'loading' ? 'Creating Invoice...' : 'Send Invoice'}
          </button>
          
          {/* Status Messages */}
          {invoiceStatus === 'success' && (
            <div className="bg-green-600/20 border border-green-600/30 text-green-400 p-3 rounded-lg text-sm">
              ✅ Invoice sent successfully!
            </div>
          )}
          
          {invoiceStatus && invoiceStatus !== 'loading' && invoiceStatus !== 'success' && (
            <div className="bg-red-600/20 border border-red-600/30 text-red-400 p-3 rounded-lg text-sm">
              ❌ {invoiceStatus}
            </div>
          )}
        </form>
      </div>
    );
  };
  
  const renderInvoiceList = () => {
    return (
      <div className="space-y-4">
        {/* Header with Back Button */}
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setInvoiceView('main')}
            className="p-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
          >
            ←
          </button>
          <div>
            <h2 className="text-lg font-bold text-white">Your Invoices</h2>
            <p className="text-gray-400 text-xs">Manage your sent invoices</p>
          </div>
        </div>
        
        {/* Coming Soon */}
        <div className="bg-slate-800/30 rounded-lg p-6 text-center">
          <DocumentTextIcon className="w-12 h-12 text-gray-500 mx-auto mb-3" />
          <h3 className="text-white font-medium mb-2">Invoice List Coming Soon</h3>
          <p className="text-gray-400 text-sm mb-4">
            We're working on the invoice management interface. For now, you can create invoices and they'll be sent directly to your clients.
          </p>
          <button
            onClick={() => setInvoiceView('create')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Create New Invoice
          </button>
        </div>
      </div>
    );
  };

  const renderInvoiceTab = () => {
    if (invoiceView === 'create') {
      return renderCreateInvoice();
    } else if (invoiceView === 'list') {
      return renderInvoiceList();
    }
    
    return (
      <div className="space-y-4">
        {/* Invoice Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Invoices</h2>
            <p className="text-gray-400 text-sm">Create and manage your invoices</p>
          </div>
          <DocumentTextIcon className="w-8 h-8 text-blue-400" />
        </div>

        {/* Wallet Connection Status */}
        <div className={`border rounded-lg p-3 ${
          isConnected 
            ? 'bg-green-600/20 border-green-600/30' 
            : 'bg-yellow-600/20 border-yellow-600/30'
        }`}>
          <div className={`flex items-center gap-2 ${
            isConnected ? 'text-green-400' : 'text-yellow-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-400' : 'bg-yellow-400'
            }`}></span>
            <span className="text-sm font-medium">
              {isConnected 
                ? `✅ Wallet Connected - Ready to Create Invoices` 
                : `⚠️ Connect Wallet to Create Invoices`
              }
            </span>
          </div>
          {isConnected && walletAddress && (
            <div className="text-xs text-gray-400 mt-1 font-mono">
              {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => {
              if (isConnected) {
                setInvoiceView('create');
              } else {
                alert('Please connect your wallet first');
              }
            }}
            className={`p-3 rounded-xl border-2 transition-all duration-300 ${
              isConnected
                ? 'bg-blue-600/20 border-blue-600/30 hover:bg-blue-600/30 text-blue-400'
                : 'bg-gray-600/20 border-gray-600/30 text-gray-500 cursor-not-allowed'
            }`}
          >
            <div className="flex flex-col items-center gap-1.5">
              <DocumentTextIcon className="w-5 h-5" />
              <span className="text-xs font-medium">Create Invoice</span>
            </div>
          </button>
          
          <button 
            onClick={() => {
              if (isConnected) {
                setInvoiceView('list');
              } else {
                alert('Please connect your wallet first');
              }
            }}
            className={`p-3 rounded-xl border-2 transition-all duration-300 ${
              isConnected
                ? 'bg-purple-600/20 border-purple-600/30 hover:bg-purple-600/30 text-purple-400'
                : 'bg-gray-600/20 border-gray-600/30 text-gray-500 cursor-not-allowed'
            }`}
          >
            <div className="flex flex-col items-center gap-1.5">
              <ArrowPathIcon className="w-5 h-5" />
              <span className="text-xs font-medium">View Invoices</span>
            </div>
          </button>
        </div>

        {/* Features List */}
        <div className="bg-slate-800/30 rounded-xl p-3">
          <h3 className="text-white font-semibold mb-2 text-sm">Invoice Features</h3>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
              <span>Create professional invoices</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
              <span>Multiple cryptocurrency support</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
              <span>Email delivery to clients</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
              <span>Payment tracking & status</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-300">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full"></span>
              <span>PDF download & sharing</span>
            </div>
          </div>
        </div>

        {/* Help Text */}
        <div className="text-center text-xs text-gray-400 bg-slate-800/20 rounded-lg p-2">
          💡 Create professional invoices and get paid in cryptocurrency. Your clients can pay directly through the generated payment links.
        </div>
      </div>
    );
  };

  const renderSwapTab = () => {
    const fromTokenData = stablecoins.find(token => token.baseToken === swapFromToken);
    const toTokenData = stablecoins.find(token => token.baseToken === swapToToken);

    return (
      <div className="space-y-3">
        {/* Swap Header */}
        <div className="text-center mb-3">
          <h2 className="text-white font-bold text-lg mb-1">Token Swap</h2>
          <p className="text-gray-400 text-xs">Swap between supported stablecoins instantly</p>
        </div>

        {/* From Token */}
        <div className="bg-slate-800/50 rounded-2xl p-3 border border-slate-700/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm font-medium">From</span>
            <span className="text-gray-400 text-sm">Balance: {swapFromBalance}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <div className="relative">
              <button
                onClick={() => setShowSwapFromDropdown(!showSwapFromDropdown)}
                className="flex items-center gap-2 bg-transparent text-white font-bold text-base focus:outline-none border border-slate-600/50 rounded-lg px-2 py-1 hover:border-slate-500 transition-colors w-full justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{fromTokenData?.flag || '🇺🇸'}</span>
                  <span>{swapFromToken}</span>
                </div>
                <ChevronDownIcon className="w-4 h-4 text-gray-400" />
              </button>
              
              {showSwapFromDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-slate-800 rounded-lg border border-slate-600 shadow-xl z-50 max-h-64 overflow-y-auto w-80 min-w-max">
                  {stablecoins.map((token) => (
                    <button
                      key={token.baseToken}
                      onClick={() => {
                        setSwapFromToken(token.baseToken);
                        setShowSwapFromDropdown(false);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3 text-sm transition-colors whitespace-nowrap"
                    >
                      <span className="text-lg">{token.flag || '🌍'}</span>
                      <span className="text-white">{token.baseToken} - {token.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button 
              onClick={() => {
                const maxAmount = parseFloat(swapFromBalance);
                if (maxAmount > 0) {
                  setSwapAmount(maxAmount.toString());
                }
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-2 py-1 rounded-full font-medium transition-colors"
            >
              MAX
            </button>
          </div>
          <input
            type="number"
            placeholder="1"
            value={swapAmount}
            onChange={(e) => setSwapAmount(e.target.value)}
            className="w-full bg-transparent text-white text-2xl font-bold focus:outline-none placeholder-gray-500"
          />
        </div>

        {/* Swap Direction */}
        <div className="flex justify-center -my-1">
          <button
            onClick={() => {
              if (swapToToken) {
                const temp = swapFromToken;
                setSwapFromToken(swapToToken);
                setSwapToToken(temp);
                setSwapAmount('');
                setSwapQuote(null);
              }
            }}
            className="bg-slate-800 rounded-full p-2 border-4 border-slate-900 hover:bg-slate-700 transition-colors"
          >
            <ArrowsRightLeftIcon className="w-4 h-4 text-white transform rotate-90" />
          </button>
        </div>

        {/* To Token */}
        <div className="bg-slate-800/50 rounded-2xl p-3 border border-slate-700/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm font-medium">To</span>
            <span className="text-gray-400 text-sm">Balance: {swapToBalance}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <div className="relative">
              <button
                onClick={() => setShowSwapToDropdown(!showSwapToDropdown)}
                className="flex items-center gap-2 bg-transparent text-white font-bold text-base focus:outline-none border border-slate-600/50 rounded-lg px-2 py-1 hover:border-slate-500 transition-colors w-full justify-between"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xl">{toTokenData?.flag || '🌍'}</span>
                  <span>{swapToToken || 'Select token'}</span>
                </div>
                <ChevronDownIcon className="w-4 h-4 text-gray-400" />
              </button>
              
              {showSwapToDropdown && (
                <div className="absolute top-full left-0 mt-1 bg-slate-800 rounded-lg border border-slate-600 shadow-xl z-50 max-h-64 overflow-y-auto w-80 min-w-max">
                  {stablecoins
                    .filter(token => token.baseToken !== swapFromToken)
                    .map((token) => (
                    <button
                      key={token.baseToken}
                      onClick={() => {
                        setSwapToToken(token.baseToken);
                        setShowSwapToDropdown(false);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-slate-700 flex items-center gap-3 text-sm transition-colors whitespace-nowrap"
                    >
                      <span className="text-lg">{token.flag || '🌍'}</span>
                      <span className="text-white">{token.baseToken} - {token.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="text-2xl font-bold text-white">
            {swapIsLoading ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Getting quote...</span>
              </div>
            ) : swapQuote ? (
              Number(swapQuote).toFixed(toTokenData?.decimals || 6)
            ) : swapToToken ? (
              (0).toFixed(toTokenData?.decimals || 6)
            ) : (
              '0.0'
            )}
          </div>
          {swapQuote && swapAmount && Number(swapAmount) > 0 && (
            <div className="text-gray-400 text-xs mt-1">
              1 {swapFromToken} = {(Number(swapQuote) / Number(swapAmount)).toFixed(toTokenData?.decimals || 6)} {swapToToken}
            </div>
          )}
        </div>

        {/* Error Display */}
        {swapError && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
            <p className="text-red-400 text-xs">{swapError}</p>
          </div>
        )}

        {/* Success Display */}
        {swapSuccess && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <p className="text-green-400 text-sm font-medium">Swap Successful!</p>
              </div>
              {swapSuccess.includes('Transaction:') && (
                <a 
                  href={`https://basescan.org/tx/${swapSuccess.split('Transaction: ')[1]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 text-xs underline"
                >
                  View
                </a>
              )}
            </div>
            {swapSuccess.includes('Transaction:') && (
              <p className="text-green-300 text-xs mt-1 font-mono">
                {swapSuccess.split('Transaction: ')[1].slice(0, 8)}...{swapSuccess.split('Transaction: ')[1].slice(-6)}
              </p>
            )}
          </div>
        )}

        {/* Swap Button */}
        <button
          onClick={executeSwap}
          disabled={!isConnected || !swapAmount || !swapToToken || swapIsLoading}
          className={`w-full py-3 rounded-2xl font-bold text-base transition-all border-2 ${
            isConnected && swapAmount && swapToToken && !swapIsLoading
              ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 hover:border-blue-400 transform hover:scale-[1.02]'
              : 'bg-slate-700 text-slate-400 border-slate-600 cursor-not-allowed'
          }`}
        >
          {!isConnected ? (
            'Connect Wallet'
          ) : swapIsLoading ? (
            <div className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Swapping...
            </div>
          ) : !swapAmount ? (
            'Swap'
          ) : !swapToToken ? (
            'Select token'
          ) : (
            'Swap'
          )}
        </button>


      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'send':
        return renderSendTab();
      case 'pay':
        return renderPayTab();
      case 'deposit':
        return renderDepositTab();
      case 'link':
        return renderLinkTab();
      case 'swap':
        return renderSwapTab();
      case 'invoice':
        return renderInvoiceTab();
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-2">
      <div className="max-w-sm mx-auto">
        {/* Top Header with Wallet */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Image 
              src="/NEDApayLogo.png" 
              alt="NedaPay" 
              width={40} 
              height={40} 
              className="rounded-lg"
            />
            <div>
              <h1 className="text-white font-bold text-lg">NedaPay</h1>
              <p className="text-gray-400 text-xs">Mini App</p>
            </div>
          </div>
          
          {/* Wallet Button - Always show wallet icon */}
          {!isConnected ? (
            <button
              onClick={async () => {
                try {
                  console.log('🔗 Wallet button clicked!');
                  console.log('Environment:', isSmartWalletEnvironment ? 'Farcaster/MiniApp' : 'Website');
                  console.log('Available connectors:', connectors?.map(c => c.name));
                  
                  if (connectors && connectors.length > 0) {
                    // Smart connector selection based on environment
                    let preferredConnector;
                    
                    if (isSmartWalletEnvironment) {
                      // Farcaster environment - prefer MiniApp or Coinbase connectors
                      preferredConnector = connectors.find(c => 
                        c.name.toLowerCase().includes('coinbase') || 
                        c.name.toLowerCase().includes('smart') ||
                        c.name.toLowerCase().includes('miniapp')
                      ) || connectors[0];
                    } else {
                      // Website environment - prefer MetaMask, Coinbase, or WalletConnect
                      preferredConnector = connectors.find(c => 
                        c.name.toLowerCase().includes('metamask') ||
                        c.name.toLowerCase().includes('coinbase') ||
                        c.name.toLowerCase().includes('walletconnect')
                      ) || connectors[0];
                    }
                    
                    console.log('Using connector:', preferredConnector.name);
                    await connect({ connector: preferredConnector });
                  } else {
                    console.error('❌ No connectors available');
                    alert('Please install a wallet extension like MetaMask or Coinbase Wallet');
                  }
                } catch (error) {
                  console.error('❌ Failed to connect wallet:', error);
                  alert('Failed to connect wallet. Please try again.');
                }
              }}
              className="relative w-12 h-12 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 hover:from-blue-500 hover:via-purple-500 hover:to-indigo-600 rounded-xl transition-all duration-300 ease-out flex items-center justify-center shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 border-2 border-blue-400/30 hover:border-blue-300/50 group overflow-hidden"
            >
              {/* Animated background */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              {/* Pulse effect */}
              <div className="absolute inset-0 bg-blue-400/20 rounded-xl animate-ping opacity-75" />
              
              <WalletIcon className="w-6 h-6 text-white relative z-10 drop-shadow-lg" />
            </button>
          ) : (
            isSmartWalletEnvironment ? (
              // Farcaster environment - show same clean connected state
              <div className="flex items-center gap-2 bg-slate-800/60 backdrop-blur-sm rounded-xl px-3 py-2 border border-green-500/30">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-400 text-xs font-medium">Connected</span>
                <span className="text-gray-400 text-xs font-mono">
                  {walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-3)}` : '...'}
                </span>
                <button
                  onClick={async () => {
                    if (walletAddress) {
                      try {
                        await navigator.clipboard.writeText(walletAddress);
                        setAddressCopied(true);
                        setTimeout(() => setAddressCopied(false), 2000);
                      } catch (err) {
                        console.error('Failed to copy address:', err);
                      }
                    }
                  }}
                  className="text-white hover:text-blue-400 transition-colors ml-1"
                  title={addressCopied ? "Copied!" : "Copy address"}
                >
                  {addressCopied ? (
                    <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
                {/* Disconnect button */}
                <button
                  onClick={() => disconnect()}
                  className="text-white hover:text-red-400 transition-colors ml-2"
                  title="Disconnect wallet"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            ) : (
              // Website environment - show same clean connected state
              <div className="flex items-center gap-2 bg-slate-800/60 backdrop-blur-sm rounded-xl px-3 py-2 border border-green-500/30">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-green-400 text-xs font-medium">Connected</span>
                  <span className="text-gray-400 text-xs font-mono">
                    {walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-3)}` : '...'}
                  </span>
                  <button
                    onClick={async () => {
                      if (walletAddress) {
                        try {
                          await navigator.clipboard.writeText(walletAddress);
                          setAddressCopied(true);
                          setTimeout(() => setAddressCopied(false), 2000);
                        } catch (err) {
                          console.error('Failed to copy address:', err);
                        }
                      }
                    }}
                    className="text-white hover:text-blue-400 transition-colors ml-1"
                    title={addressCopied ? "Copied!" : "Copy address"}
                  >
                    {addressCopied ? (
                      <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    )}
                  </button>
                  {/* Disconnect button */}
                  <button
                    onClick={() => disconnect()}
                    className="text-white hover:text-red-400 transition-colors ml-2"
                    title="Disconnect wallet"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  </button>
              </div>
            )
          )}
        </div>

        {/* Floating Rates Ticker */}
        <div className="mb-2 relative overflow-hidden bg-gradient-to-r from-purple-900/20 via-blue-900/20 to-indigo-900/20 backdrop-blur-sm rounded-lg py-1.5">
          <div className="flex animate-scroll-left whitespace-nowrap">
            {/* First set of rates */}
            {Object.entries(floatingRates).map(([currency, data]) => {
              const currencyInfo = currencies.find(c => c.code === currency);
              const flag = countries.find(c => c.currency === currency)?.flag || '';
              return (
                <div key={`${currency}-1`} className="inline-flex items-center gap-2 mx-4 text-sm">
                  <span className="text-yellow-400">{flag}</span>
                  <span className="text-white font-bold">{currency}</span>
                  <span className="text-green-400 font-mono">{parseFloat(data.rate).toLocaleString()}</span>
                </div>
              );
            })}
            
            {/* Static rates for currencies without live data */}
            <div className="inline-flex items-center gap-2 mx-4 text-sm">
              <span className="text-yellow-400">🇺🇬</span>
              <span className="text-white font-bold">UGX</span>
              <span className="text-green-400 font-mono">3,720.00</span>
            </div>
            <div className="inline-flex items-center gap-2 mx-4 text-sm">
              <span className="text-yellow-400">🇬🇭</span>
              <span className="text-white font-bold">GHS</span>
              <span className="text-green-400 font-mono">15.20</span>
            </div>
            <div className="inline-flex items-center gap-2 mx-4 text-sm">
              <span className="text-yellow-400">🇳🇬</span>
              <span className="text-white font-bold">NGN</span>
              <span className="text-green-400 font-mono">1,650.00</span>
            </div>
            <div className="inline-flex items-center gap-2 mx-4 text-sm">
              <span className="text-yellow-400">🇿🇦</span>
              <span className="text-white font-bold">ZAR</span>
              <span className="text-green-400 font-mono">18.75</span>
            </div>
            <div className="inline-flex items-center gap-2 mx-4 text-sm">
              <span className="text-yellow-400">🇰🇪</span>
              <span className="text-white font-bold">KES</span>
              <span className="text-green-400 font-mono">128.50</span>
            </div>
            
            {/* Duplicate set for seamless loop */}
            {Object.entries(floatingRates).map(([currency, data]) => {
              const currencyInfo = currencies.find(c => c.code === currency);
              const flag = countries.find(c => c.currency === currency)?.flag || '';
              return (
                <div key={`${currency}-2`} className="inline-flex items-center gap-2 mx-4 text-sm">
                  <span className="text-yellow-400">{flag}</span>
                  <span className="text-white font-bold">{currency}</span>
                  <span className="text-green-400 font-mono">{parseFloat(data.rate).toLocaleString()}</span>
                </div>
              );
            })}
            
            {/* Duplicate static rates */}
            <div className="inline-flex items-center gap-2 mx-4 text-sm">
              <span className="text-yellow-400">🇺🇬</span>
              <span className="text-white font-bold">UGX</span>
              <span className="text-green-400 font-mono">3,720.00</span>
            </div>
            <div className="inline-flex items-center gap-2 mx-4 text-sm">
              <span className="text-yellow-400">🇬🇭</span>
              <span className="text-white font-bold">GHS</span>
              <span className="text-green-400 font-mono">15.20</span>
            </div>
            <div className="inline-flex items-center gap-2 mx-4 text-sm">
              <span className="text-yellow-400">🇳🇬</span>
              <span className="text-white font-bold">NGN</span>
              <span className="text-green-400 font-mono">1,650.00</span>
            </div>
            <div className="inline-flex items-center gap-2 mx-4 text-sm">
              <span className="text-yellow-400">🇿🇦</span>
              <span className="text-white font-bold">ZAR</span>
              <span className="text-green-400 font-mono">18.75</span>
            </div>
            <div className="inline-flex items-center gap-2 mx-4 text-sm">
              <span className="text-yellow-400">🇰🇪</span>
              <span className="text-white font-bold">KES</span>
              <span className="text-green-400 font-mono">128.50</span>
            </div>
          </div>
        </div>
        
        <style jsx>{`
          @keyframes scroll-left {
            0% {
              transform: translateX(0%);
            }
            100% {
              transform: translateX(-50%);
            }
          }
          
          @keyframes shimmer {
            0% {
              transform: translateX(-100%) skewX(-12deg);
            }
            100% {
              transform: translateX(200%) skewX(-12deg);
            }
          }
          
          .animate-scroll-left {
            animation: scroll-left 30s linear infinite;
          }
          
          .animate-scroll-left:hover {
            animation-play-state: paused;
          }
          
          .animate-shimmer {
            animation: shimmer 2s ease-in-out;
          }
        `}</style>


        


        {/* Tab Navigation */}
        <div className="bg-slate-900/90 rounded-xl p-1.5 mb-2 border border-slate-700/50 shadow-2xl">
          <div className="grid grid-cols-6 gap-1">
            {[
              { key: 'send' as Tab, label: 'Send', icon: ArrowUpIcon },
              { key: 'pay' as Tab, label: 'Pay', icon: CurrencyDollarIcon },
              { key: 'deposit' as Tab, label: 'Deposit', icon: ArrowDownIcon },
              { key: 'link' as Tab, label: 'Link', icon: LinkIcon },
              { key: 'swap' as Tab, label: 'Swap', icon: ArrowsRightLeftIcon },
              { key: 'invoice' as Tab, label: 'Invoice', icon: DocumentTextIcon }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`relative py-2.5 px-2 rounded-lg text-xs font-bold transition-all duration-300 ease-out flex items-center justify-center gap-1 overflow-hidden group ${
                  activeTab === key
                    ? 'bg-gradient-to-br from-blue-500 via-purple-600 to-indigo-700 text-white shadow-2xl shadow-blue-500/30 transform scale-105 border-2 border-blue-400/50'
                    : 'text-white bg-slate-800/60 hover:bg-slate-700/80 hover:scale-102 hover:shadow-lg border-2 border-transparent hover:border-slate-600/30 active:scale-95 active:shadow-inner'
                }`}
              >
                {/* Animated background for active state */}
                {activeTab === key && (
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 animate-pulse" />
                )}
                
                {/* Hover glow effect */}
                <div className={`absolute inset-0 rounded-xl transition-opacity duration-300 ${
                  activeTab === key 
                    ? 'opacity-100 bg-gradient-to-r from-blue-400/10 to-purple-400/10' 
                    : 'opacity-0 group-hover:opacity-100 bg-white/5'
                }`} />
                
                <Icon className={`w-5 h-5 relative z-10 transition-all duration-300 ${
                  activeTab === key ? 'drop-shadow-lg' : 'group-hover:scale-110'
                }`} />
                <span className={`relative z-10 transition-all duration-300 ${
                  activeTab === key ? 'drop-shadow-lg' : 'group-hover:tracking-wide'
                }`}>
                  {label}
                </span>
                
                {/* Active indicator */}
                {activeTab === key && (
                  <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-1 bg-white/60 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-gray-800 rounded-xl p-3">
          {renderTabContent()}
        </div>
      </div>
      
      {/* Success Modal */}
      <SuccessModal />
      

    </div>
  );
}

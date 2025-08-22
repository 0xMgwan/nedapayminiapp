'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useMiniKit, useOpenUrl, useComposeCast, useViewProfile } from '@coinbase/onchainkit/minikit';
import { ConnectWallet, Wallet } from '@coinbase/onchainkit/wallet';
import { Avatar, Name, Address, EthBalance, Identity } from '@coinbase/onchainkit/identity';
import { useAccount, useConnect, useDisconnect } from 'wagmi';
import { useConnectorClient } from 'wagmi';
import { ChevronDownIcon, LinkIcon, CurrencyDollarIcon, ArrowUpIcon, ArrowDownIcon, ArrowPathIcon, ArrowRightIcon, WalletIcon, DocumentTextIcon, ArrowsRightLeftIcon, BellIcon } from '@heroicons/react/24/outline';
import { base } from 'wagmi/chains';
import { ethers } from 'ethers';
import { stablecoins } from './data/stablecoins';
import { initiatePaymentOrder } from './utils/paycrest';
import { executeUSDCTransaction, getUSDCBalance } from './utils/wallet';
import { fetchTokenRate, fetchSupportedCurrencies, fetchSupportedInstitutions } from './utils/paycrest';
import { getAerodromeQuote, swapAerodrome, AERODROME_FACTORY_ADDRESS } from './utils/aerodrome';
import { calculateDynamicFee, formatFeeInfo, isProtocolEnabled } from './utils/nedaPayProtocol';
import { getNedaPayProtocolAddress } from './config/contracts';
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

// Mobile number validation function
const validateMobileNumber = (phoneNumber: string, countryCode: string): { isValid: boolean; message?: string } => {
  if (!phoneNumber) return { isValid: false, message: 'Phone number is required' };
  
  // Remove any non-digit characters
  const cleanNumber = phoneNumber.replace(/\D/g, '');
  
  switch (countryCode) {
    case 'NG': // Nigeria
      if (cleanNumber.length !== 10) return { isValid: false, message: 'Nigerian numbers must be 10 digits' };
      if (!['070', '080', '081', '090', '091'].some(prefix => cleanNumber.startsWith(prefix))) {
        return { isValid: false, message: 'Invalid Nigerian mobile prefix' };
      }
      break;
    case 'KE': // Kenya
      if (cleanNumber.length !== 9) return { isValid: false, message: 'Kenyan numbers must be 9 digits' };
      if (!['070', '071', '072', '073', '074', '075', '076', '077', '078', '079'].some(prefix => cleanNumber.startsWith(prefix))) {
        return { isValid: false, message: 'Invalid Kenyan mobile prefix' };
      }
      break;
    case 'GH': // Ghana
      if (cleanNumber.length !== 9) return { isValid: false, message: 'Ghanaian numbers must be 9 digits' };
      if (!['020', '023', '024', '025', '026', '027', '028', '050', '054', '055', '056', '057', '059'].some(prefix => cleanNumber.startsWith(prefix))) {
        return { isValid: false, message: 'Invalid Ghanaian mobile prefix' };
      }
      break;
    case 'TZ': // Tanzania
      if (cleanNumber.length !== 9) return { isValid: false, message: 'Tanzanian numbers must be 9 digits' };
      if (!['061', '062', '065', '067', '068', '069', '071', '073', '074', '075', '076', '077', '078'].some(prefix => cleanNumber.startsWith(prefix))) {
        return { isValid: false, message: 'Invalid Tanzanian mobile prefix' };
      }
      break;
    case 'UG': // Uganda
      if (cleanNumber.length !== 9) return { isValid: false, message: 'Ugandan numbers must be 9 digits' };
      if (!['070', '071', '072', '073', '074', '075', '076', '077', '078', '079'].some(prefix => cleanNumber.startsWith(prefix))) {
        return { isValid: false, message: 'Invalid Ugandan mobile prefix' };
      }
      break;
    default:
      return { isValid: true }; // Allow other countries without specific validation
  }
  
  return { isValid: true };
};

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
  
  
  // Detect if we're in a smart wallet environment (Farcaster MiniApp) - enhanced detection
  const isSmartWalletEnvironment = useMemo(() => {
    if (typeof window === 'undefined') return false;
    
    const url = window.location.href.toLowerCase();
    const referrer = document.referrer.toLowerCase();
    const userAgent = navigator.userAgent.toLowerCase();
    const isMobile = /mobile|android|iphone|ipad/i.test(navigator.userAgent);
    
    // Check for official Farcaster MiniApp URLs
    const isFarcasterOfficial = url.includes('warpcast.com/~/') || 
                               url.includes('farcaster.xyz/miniapp') ||
                               url.includes('farcaster.xyz/miniapps') ||
                               url.includes('fc_frame=') ||
                               url.includes('fc_miniapp=') ||
                               referrer.includes('warpcast.com') ||
                               referrer.includes('farcaster.xyz');
    
    // Check for MiniKit SDK presence
    const hasMiniKit = typeof (window as any).MiniKit !== 'undefined';
    
    // Check for mobile webview patterns
    const isMobileWebview = userAgent.includes('wv') || 
                           userAgent.includes('webview') ||
                           (userAgent.includes('mobile') && !userAgent.includes('safari'));
    
    // AGGRESSIVE mobile detection - if mobile and not our main site, assume Farcaster
    const isMobileFarcaster = isMobile && (
      isFarcasterOfficial ||
      hasMiniKit ||
      isMobileWebview ||
      // If mobile and not our main domain, likely Farcaster
      (!url.includes('nedapayminiapp.vercel.app') && !url.includes('localhost'))
    );
    
    const result = isFarcasterOfficial || hasMiniKit || isMobileWebview || isMobileFarcaster;
    
    console.log('🔍 Environment Detection:', {
      url: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      isMobile,
      isFarcasterOfficial,
      hasMiniKit,
      isMobileWebview,
      isMobileFarcaster,
      result
    });
    
    return result;
  }, []);

  // Unified wallet state - simplified to use wagmi for all environments
  const walletAddress = address;
  const isWalletConnected = isConnected;
  const isWalletReady = true;

  // Debug component initialization
  useEffect(() => {
    console.log('FarcasterMiniApp component initializing:', {
      url: window.location.href,
      userAgent: navigator.userAgent,
      referrer: document.referrer,
      isSmartWalletEnvironment,
      hasMiniKit: typeof (window as any).MiniKit !== 'undefined',
      hasWindowEthereum: typeof (window as any).ethereum !== 'undefined',
      walletAddress,
      isWalletConnected,
      timestamp: new Date().toISOString()
    });
  }, [isSmartWalletEnvironment, walletAddress, isWalletConnected]);

  // Auto-connect smart wallet in Farcaster environment - MOBILE FOCUSED
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 3;
    const isMobile = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent);
    
    const autoConnectSmartWallet = async () => {
      // Check if already connected
      if (isConnected) {
        console.log('✅ Already connected to wallet');
        return;
      }
      
      // Simple but effective detection - focus on what works
      const shouldAutoConnect = isSmartWalletEnvironment;
      
      console.log('🔍 Auto-connect check:', {
        isMobile,
        isSmartWalletEnvironment,
        shouldAutoConnect,
        isConnected,
        connectorsCount: connectors?.length || 0,
        retryCount
      });
        
      if (shouldAutoConnect && connectors && connectors.length > 0 && !isConnected) {
        console.log('🚀 Attempting auto-connect in smart wallet environment');
        console.log('Available connectors:', connectors.map(c => ({ name: c.name, id: c.id })));
        
        try {
          // For Farcaster MiniApp, find the farcaster connector specifically
          const farcasterConnector = connectors.find(c => 
            c.name.toLowerCase().includes('farcaster') ||
            c.id.toLowerCase().includes('farcaster') ||
            c.name.toLowerCase().includes('miniapp')
          );
          
          if (farcasterConnector) {
            console.log('🔌 Auto-connecting with Farcaster connector:', { 
              name: farcasterConnector.name, 
              id: farcasterConnector.id
            });
            
            await connect({ connector: farcasterConnector });
          } else {
            console.log('⚠️ No Farcaster connector found for auto-connect');
          }
          
        } catch (error) {
          console.error('❌ Auto-connect failed:', error);
          retryCount++;
          if (retryCount < maxRetries) {
            console.log(`🔄 Retrying auto-connect (${retryCount}/${maxRetries}) in 2s...`);
            setTimeout(autoConnectSmartWallet, 2000);
          }
        }
      } else {
        console.log('⏭️ Skipping auto-connect:', {
          shouldAutoConnect,
          isConnected,
          hasConnectors: !!(connectors && connectors.length > 0)
        });
      }
    };

    // Wait for environment detection to stabilize
    const timer = setTimeout(autoConnectSmartWallet, 2000);
    return () => clearTimeout(timer);
  }, [isSmartWalletEnvironment, isConnected, connectors, connect]);



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
  const [sendCurrency, setSendCurrency] = useState<'local' | 'usdc'>('usdc');
  const [payCurrency, setPayCurrency] = useState<'local' | 'usdc'>('usdc');
  const [selectedSendToken, setSelectedSendToken] = useState('USDC');
  const [selectedPayToken, setSelectedPayToken] = useState('USDC');
  const [showSendTokenDropdown, setShowSendTokenDropdown] = useState(false);
  const [showPayTokenDropdown, setShowPayTokenDropdown] = useState(false);
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
  const [showInvoiceCurrencyDropdown, setShowInvoiceCurrencyDropdown] = useState(false);
  const [showLinkCurrencyDropdown, setShowLinkCurrencyDropdown] = useState(false);

  
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
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    message: string;
    timestamp: string;
    type: 'send' | 'pay' | 'deposit' | 'general';
    read: boolean;
  }>>([]);

  // Function to add notification
  const addNotification = useCallback((message: string, type: 'send' | 'pay' | 'deposit' | 'general' = 'general') => {
    const newNotification = {
      id: Date.now().toString(),
      message,
      timestamp: new Date().toLocaleString(),
      type,
      read: false
    };
    setNotifications(prev => [newNotification, ...prev]);
  }, []);

  // Function to mark notification as read
  const markNotificationAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(notif => notif.id === id ? { ...notif, read: true } : notif)
    );
  }, []);

  // Function to clear all notifications
  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // Base App navigation hooks (required for BaseApp compatibility)
  const minikit = useMiniKit();
  const { setFrameReady, isFrameReady, context } = minikit;
  const openUrl = useOpenUrl();
  const composeCast = useComposeCast();
  const viewProfile = useViewProfile();
  
  // Base App client detection (clientFid 309857 = Base App)
  const isBaseApp = context?.client?.clientFid === 309857;

  // MiniKit Auto-Connection: Farcaster smart wallet integration
  const connectedWallet = (() => {
    if (!isWalletConnected || !walletAddress) return null;
    
    // MiniKit automatically connects to Farcaster smart wallet when available
    // Return a simplified wallet object for compatibility with existing code
    return {
      address: address,
      connectorType: 'farcaster_minikit',
      walletClientType: 'farcaster',
      getEthereumProvider: () => walletClient
    };
  })();
  
  // Debug MiniKit wallet info and Base App detection
  useEffect(() => {
    console.log('=== MINIKIT WALLET DEBUG ===');
    console.log('Is Connected:', isConnected);
    console.log('Address:', address);
    console.log('Connectors Available:', connectors.length);
    console.log('Wallet Client:', !!walletClient);
    console.log('Is Base App:', isBaseApp);
    console.log('Client FID:', context?.client?.clientFid);
    
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
    
    if (isBaseApp) {
      console.log('🏗️ Running in Base App - using Base App specific features');
    }
    console.log('===================');
  }, [connectedWallet, isConnected, address, connectors.length, walletClient, isBaseApp, context]);
  
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
    // Removed fallback rates - using only real Paycrest API data
    
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
      
      // No fallback - only show real API data
      setCurrentRate('API Error');
      console.log(`❌ Could not fetch real rate for ${currency} - API unavailable`);
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
        const priorityCurrencies = ['NGN', 'KES', 'GHS', 'TZS', 'UGX']; // Focus on main supported currencies
        const currenciesToLoad = supportedCurrencies
          .filter(currency => priorityCurrencies.includes(currency.code))
          .slice(0, 5); // Limit to 5 to avoid API rate limits
        
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
      if (isFrameReady && !isWalletConnected && !connectError && connectors.length > 0) {
        console.log('🔗 Attempting smart wallet auto-connection...');
        // Use a timeout to prevent immediate popup blocking
        setTimeout(() => {
          if (!isWalletConnected) {
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

  // Execute individual transactions with reasonable approval optimization
  const executeOptimizedTransactions = useCallback(async (
    approvalNeeded: boolean,
    tokenAddress: string,
    spenderAddress: string,
    approvalAmount: string,
    mainTransaction: () => Promise<string>
  ) => {
    try {
      if (!isConnected || !address) {
        throw new Error('Wallet not connected');
      }

      const { writeContract } = await import('wagmi/actions');
      const { config } = await import('../providers/MiniKitProvider');
      
      // 1. Handle approval if needed (with reasonable approval amount)
      if (approvalNeeded) {
        console.log('📝 Setting reasonable approval to avoid security warnings...');
        
        const erc20ABI = [
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
        ];

        // Use 10x the needed amount instead of unlimited to avoid security warnings
        const reasonableAmount = ethers.BigNumber.from(approvalAmount).mul(10);
        
        const approvalHash = await writeContract(config, {
          address: tokenAddress as `0x${string}`,
          abi: erc20ABI,
          functionName: 'approve',
          args: [spenderAddress as `0x${string}`, BigInt(reasonableAmount.toString())],
        });
        
        console.log('✅ Reasonable approval transaction sent:', approvalHash);
      }
      
      // 2. Execute main transaction
      const mainHash = await mainTransaction();
      console.log('✅ Main transaction completed:', mainHash);
      
      return {
        success: true,
        hash: mainHash
      };
      
    } catch (error: any) {
      console.error('❌ Optimized transaction failed:', error);
      throw error;
    }
  }, [isConnected, address]);

  // Optimized swap with fee collection using unlimited approval
  const executeBatchedSwapWithFee = useCallback(async (
    fromTokenAddress: string,
    toTokenAddress: string,
    amountIn: string,
    amountOutMin: string,
    userAddress: string,
    deadline: number,
    feeInfo: any
  ): Promise<{ success: boolean; hash: string }> => {
    try {
      console.log('🔄 Preparing optimized swap with fee collection...');
      
      const { writeContract } = await import('wagmi/actions');
      const { config } = await import('../providers/MiniKitProvider');
      
      // 1. Check if approval is needed for protocol fee
      const erc20ABI = [
        {
          name: 'approve',
          type: 'function',
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ],
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable'
        },
        {
          name: 'allowance',
          type: 'function',
          inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' }
          ],
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view'
        }
      ];
      
      // Check current allowance for protocol contract
      const provider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
      const tokenContract = new ethers.Contract(fromTokenAddress, erc20ABI, provider);
      const currentAllowance = await tokenContract.allowance(userAddress, feeInfo.protocolAddress);
      const totalNeeded = ethers.BigNumber.from(amountIn).add(feeInfo.feeInTokenUnits);
      
      // 2. Set reasonable approval if needed
      if (currentAllowance.lt(totalNeeded)) {
        console.log('📝 Setting approval for protocol fee...');
        
        // Use 10x the needed amount instead of unlimited to avoid security warnings
        const approvalAmount = totalNeeded.mul(10);
        
        const approvalHash = await writeContract(config, {
          address: fromTokenAddress as `0x${string}`,
          abi: erc20ABI,
          functionName: 'approve',
          args: [feeInfo.protocolAddress as `0x${string}`, BigInt(approvalAmount.toString())],
        });
        
        console.log('✅ Approval set for protocol fee:', approvalHash);
      }

      // 3. Process protocol fee
      console.log('💰 Processing protocol fee...');
      const protocolABI = [
        {
          name: 'processSwap',
          type: 'function',
          inputs: [
            { name: 'tokenIn', type: 'address' },
            { name: 'tokenOut', type: 'address' },
            { name: 'amountIn', type: 'uint256' },
            { name: 'amountOutMin', type: 'uint256' },
            { name: 'swapData', type: 'bytes' }
          ],
          outputs: [],
          stateMutability: 'nonpayable'
        }
      ];
      
      const feeHash = await writeContract(config, {
        address: feeInfo.protocolAddress as `0x${string}`,
        abi: protocolABI,
        functionName: 'processSwap',
        args: [
          fromTokenAddress as `0x${string}`,
          toTokenAddress as `0x${string}`,
          BigInt(feeInfo.feeInTokenUnits.toString()),
          BigInt(0),
          '0x' as `0x${string}`
        ],
      });
      
      console.log('✅ Protocol fee processed:', feeHash);

      // 4. Execute main swap
      console.log('🔄 Executing main swap...');
      const swapResult = await executeFarcasterSwap(
        fromTokenAddress,
        toTokenAddress,
        amountIn,
        amountOutMin,
        userAddress,
        deadline
      );
      
      // Clean up fee info
      delete (window as any).batchedFeeInfo;
      delete (window as any).protocolFeeInfo;
      
      return {
        success: swapResult.success,
        hash: swapResult.hash
      };
      
    } catch (error: any) {
      console.error('❌ Optimized swap with fee failed:', error);
      throw error;
    }
  }, []);

  const executeFarcasterSwap = useCallback(async (
    fromTokenAddress: string,
    toTokenAddress: string,
    amountIn: string,
    amountOutMin: string,
    userAddress: string,
    deadline: number
  ): Promise<{ success: boolean; hash: string }> => {
    try {
      console.log('🔍 Swap execution started:', {
        from: fromTokenAddress,
        to: toTokenAddress,
        isConnected,
        hasAddress: !!address,
        hasWalletClient: !!walletClient,
        direction: fromTokenAddress.toLowerCase() === '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'.toLowerCase() ? 'USDC → Local' : 'Local → USDC',
        deadline
      });

      if (!isConnected || !address) {
        throw new Error('Wallet not connected in Farcaster');
      }

      // Use wagmi's writeContract approach for Farcaster MiniApps
      const { writeContract } = await import('wagmi/actions');
      const { config } = await import('../providers/MiniKitProvider');
      
      // Aerodrome Router contract
      const AERODROME_ROUTER = '0xcF77a3Ba9A5CA399B7c97c74d54e5b1Beb874E43';
      
      // 1. Check and set approval if needed
      const erc20ABI = [
        {
          name: 'approve',
          type: 'function',
          inputs: [
            { name: 'spender', type: 'address' },
            { name: 'amount', type: 'uint256' }
          ],
          outputs: [{ name: '', type: 'bool' }],
          stateMutability: 'nonpayable'
        },
        {
          name: 'allowance',
          type: 'function',
          inputs: [
            { name: 'owner', type: 'address' },
            { name: 'spender', type: 'address' }
          ],
          outputs: [{ name: '', type: 'uint256' }],
          stateMutability: 'view'
        }
      ];
      
      // Check current allowance for router
      const rpcProvider = new ethers.providers.JsonRpcProvider('https://mainnet.base.org');
      const tokenContract = new ethers.Contract(fromTokenAddress, erc20ABI, rpcProvider);
      const currentAllowance = await tokenContract.allowance(userAddress, AERODROME_ROUTER);
      const amountNeeded = ethers.BigNumber.from(amountIn);
      
      // Check if this is a local stablecoin (not USDC) for approval
      const isLocalStablecoinApproval = fromTokenAddress.toLowerCase() !== '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'.toLowerCase();
      
      console.log('🔍 Approval validation:', {
        fromTokenAddress,
        amountIn,
        amountNeeded: amountNeeded.toString(),
        currentAllowance: currentAllowance.toString(),
        isLocalStablecoin: isLocalStablecoinApproval
      });

      // Set exact amount approval to avoid "unlimited" warnings
      if (currentAllowance.lt(amountNeeded)) {
        console.log('📝 Setting exact amount approval for router...');
        
        // Use exact amount needed to avoid any "unlimited" interpretation
        // Add specific gas parameters for all local stablecoins to help with gas estimation
        const approvalConfig: any = {
          address: fromTokenAddress as `0x${string}`,
          abi: erc20ABI,
          functionName: 'approve',
          args: [AERODROME_ROUTER as `0x${string}`, BigInt(amountNeeded.toString())],
        };
        
        // Add gas parameters for all local stablecoins to help with estimation
        if (isLocalStablecoinApproval) {
          // Ultra-specific gas handling for IDRX
          if (fromTokenAddress.toLowerCase() === '0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22'.toLowerCase()) {
            approvalConfig.gas = BigInt(120000); // Conservative gas limit for IDRX approval
            console.log('🪙 Using IDRX approval gas limit only (no fee override)');
          } else {
            approvalConfig.gas = BigInt(100000); // Conservative gas limit for other locals
            console.log('🪙 Using local stablecoin approval gas limit only (no fee override)');
          }
        }
        
        console.log('📤 Sending approval transaction to wallet...');
        console.log('🔍 Approval transaction details:', {
          tokenAddress: fromTokenAddress,
          spender: AERODROME_ROUTER,
          amount: amountNeeded.toString(),
          userAddress: userAddress,
          isConnected,
          hasAddress: !!address
        });
        
        // Ensure we have the correct user context for the approval
        if (!userAddress || userAddress === '0x0000000000000000000000000000000000000000') {
          throw new Error('Invalid user address for approval transaction');
        }
        
        const { writeContract: writeApprovalContract } = await import('wagmi/actions');
        const approvalHash = await writeApprovalContract(config, {
          ...approvalConfig,
          account: userAddress as `0x${string}` // Explicitly set the account
        });
        
        console.log('✅ Approval transaction sent:', approvalHash);
        
        // CRITICAL: Wait for approval confirmation before proceeding
        console.log('⏳ Waiting for approval confirmation...');
        const { waitForTransactionReceipt } = await import('wagmi/actions');
        
        try {
          const approvalReceipt = await waitForTransactionReceipt(config, {
            hash: approvalHash,
            timeout: 120000 // 2 minutes timeout
          });
          
          console.log('✅ Approval confirmed on-chain:', {
            status: approvalReceipt.status,
            blockNumber: approvalReceipt.blockNumber,
            gasUsed: approvalReceipt.gasUsed?.toString()
          });
          
          // Double-check allowance after confirmation with retry logic
          let newAllowance;
          let retryCount = 0;
          const maxRetries = 3;
          
          while (retryCount < maxRetries) {
            try {
              await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Wait 1s, 2s, 3s
              newAllowance = await tokenContract.allowance(userAddress, AERODROME_ROUTER);
              console.log(`🔍 Allowance check attempt ${retryCount + 1}:`, {
                expected: amountNeeded.toString(),
                actual: newAllowance.toString(),
                sufficient: newAllowance.gte(amountNeeded)
              });
              
              if (newAllowance.gte(amountNeeded)) {
                console.log('✅ Allowance confirmed sufficient');
                break;
              }
              
              retryCount++;
              if (retryCount === maxRetries) {
                console.log('⚠️ Allowance still insufficient after retries, but proceeding with swap (approval transaction was confirmed)');
                // Don't throw error - the approval transaction was confirmed, so proceed
                break;
              }
            } catch (allowanceCheckError: any) {
              console.log(`❌ Allowance check attempt ${retryCount + 1} failed:`, allowanceCheckError.message);
              retryCount++;
              if (retryCount === maxRetries) {
                console.log('⚠️ Allowance check failed, but approval transaction was confirmed, proceeding with swap');
                // Don't throw error - the approval transaction was confirmed
                break;
              }
            }
          }
          
        } catch (confirmError: any) {
          console.error('❌ Approval confirmation failed:', confirmError);
          throw new Error(`Approval confirmation failed: ${confirmError.message}`);
        }
      } else {
        console.log('✅ Sufficient allowance already exists for router');
      }
      
      // 2. Execute swap with route validation
      // Detect local stablecoins via address set (USDC + known locals)
      const USDC_ADDR = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'.toLowerCase();
      // Build from stablecoins.ts to avoid stale/placeholder addresses
      // Lazy import to avoid circular issues in Next.js build graph
      const { stablecoins } = await import('./data/stablecoins');
      const LOCAL_STABLES = new Set<string>(
        stablecoins
          .filter((t: any) => t.address && t.address.toLowerCase() !== USDC_ADDR)
          .map((t: any) => t.address.toLowerCase())
      );

      const fromIsLocalStable = LOCAL_STABLES.has(fromTokenAddress.toLowerCase());
      const toIsLocalStable = LOCAL_STABLES.has(toTokenAddress.toLowerCase());
      const fromIsUSDC = fromTokenAddress.toLowerCase() === USDC_ADDR;
      const toIsUSDC = toTokenAddress.toLowerCase() === USDC_ADDR;
      
      // Try stable pools first for better gas estimation, then fallback to volatile
      const hasLocalStablecoin = fromIsLocalStable || toIsLocalStable;
      
      // Start with stable pools for all stablecoin pairs
      const useStablePair = true; // Always try stable pools first

      const routes = [{
        from: fromTokenAddress as `0x${string}`,
        to: toTokenAddress as `0x${string}`,
        stable: useStablePair,
        factory: AERODROME_FACTORY_ADDRESS as `0x${string}`
      }];
      
      console.log('🛣️ Route configuration:', {
        routes,
        fromTokenAddress,
        toTokenAddress,
        factoryAddress: AERODROME_FACTORY_ADDRESS,
        stable: useStablePair
      });
      
      // Add local stablecoin gas parameters for better gas estimation (either direction)
      const isFromLocalStablecoin = fromIsLocalStable;
      const isToLocalStablecoin = toIsLocalStable;
      const isLocalStablecoinSwap = isFromLocalStablecoin || isToLocalStablecoin;
      // Use the exact ABI from Aerodrome router contract
      const AERODROME_ROUTER_ABI = [
        {
          "inputs": [
            { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
            { "internalType": "uint256", "name": "amountOutMin", "type": "uint256" },
            {
              "components": [
                { "internalType": "address", "name": "from", "type": "address" },
                { "internalType": "address", "name": "to", "type": "address" },
                { "internalType": "bool", "name": "stable", "type": "bool" },
                { "internalType": "address", "name": "factory", "type": "address" }
              ],
              "internalType": "struct IRouter.Route[]",
              "name": "routes",
              "type": "tuple[]"
            },
            { "internalType": "address", "name": "to", "type": "address" },
            { "internalType": "uint256", "name": "deadline", "type": "uint256" }
          ],
          "name": "swapExactTokensForTokens",
          "outputs": [
            { "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }
          ],
          "stateMutability": "nonpayable",
          "type": "function"
        }
      ];

      const swapConfig: any = {
        address: AERODROME_ROUTER as `0x${string}`,
        abi: AERODROME_ROUTER_ABI,
        functionName: 'swapExactTokensForTokens',
        args: [
          BigInt(amountIn),
          BigInt(amountOutMin), 
          routes,
          userAddress as `0x${string}`,
          BigInt(deadline)
        ]
      };
      
      // Add higher gas limit for local stablecoin swaps to help with gas estimation
      if (isLocalStablecoinSwap) {
        // Apply only gas limits; let wallet estimate fees
        if (fromTokenAddress.toLowerCase() === '0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22'.toLowerCase()) {
          swapConfig.gas = BigInt(500000); // Conservative upper bound for IDRX swaps
          console.log('🪙 Using IDRX swap gas limit only (no fee override):', { gasLimit: '500000' });
        } else if (fromTokenAddress.toLowerCase() === '0x269caE7Dc59803e5C596c95756faEeBb6030E0aF'.toLowerCase()) {
          swapConfig.gas = BigInt(450000); // Slightly higher gas limit for MXNe swaps
          console.log('🪙 Using MXNe swap gas limit only (no fee override):', { gasLimit: '450000' });
        } else {
          swapConfig.gas = BigInt(400000); // Conservative upper bound for other locals
          console.log('🪙 Using local stablecoin swap gas limit only (no fee override):', { gasLimit: '400000' });
        }
      }
      
      // Implement robust swap with stable/volatile pool fallback
      console.log('🔄 Starting robust swap with pool fallback strategy...');
      
      // Robust wallet client retrieval with retry logic
      let currentWalletClient = walletClient;
      
      if (!currentWalletClient) {
        console.log('❌ Wallet client not immediately available, attempting to get fresh client...');
        console.log('🔍 Connection status:', { isConnected, address: address?.slice(0, 6) + '...' });
        
        if (!isWalletConnected || !walletAddress) {
          throw new Error('Wallet not connected. Please connect your wallet first.');
        }
        
        // Wait a moment and try to get the wallet client from the window object (MiniKit specific)
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Try to get wallet client from window.ethereum as fallback
        if ((window as any).ethereum) {
          console.log('✅ Using window.ethereum provider as fallback');
          currentWalletClient = (window as any).ethereum;
        } else {
          throw new Error('Wallet client unavailable. Please refresh the page and try again.');
        }
      }
      
      console.log('✅ Wallet client available, proceeding with swap...');
      
      const swapProvider = new ethers.providers.Web3Provider(currentWalletClient!.transport || currentWalletClient!);
      const signer = swapProvider.getSigner();
      
      // Pre-swap validation and debugging
      console.log('🔍 Pre-swap validation:', {
        amountIn,
        amountOutMin,
        fromToken: fromTokenAddress,
        toToken: toTokenAddress,
        stable: useStablePair,
        factory: AERODROME_FACTORY_ADDRESS,
        userAddress,
        deadline,
        currentAllowance: currentAllowance.toString(),
        amountNeeded: amountNeeded.toString()
      });

      // Double-check allowance before swap
      const finalAllowance = await tokenContract.allowance(userAddress, AERODROME_ROUTER);
      console.log('🔍 Final allowance check:', {
        finalAllowance: finalAllowance.toString(),
        amountNeeded: amountNeeded.toString(),
        sufficient: finalAllowance.gte(amountNeeded)
      });

      if (!finalAllowance.gte(amountNeeded)) {
        throw new Error(`Insufficient allowance: ${finalAllowance.toString()} < ${amountNeeded.toString()}`);
      }

      // Get fresh quote to validate pool and amounts
      try {
        console.log('🔍 Getting fresh quote to validate pool...');
        const freshQuote = await getAerodromeQuote({
          provider: rpcProvider,
          amountIn: amountIn,
          fromToken: fromTokenAddress,
          toToken: toTokenAddress,
          stable: useStablePair,
          factory: AERODROME_FACTORY_ADDRESS
        });
        
        console.log('✅ Fresh quote received:', {
          inputAmount: amountIn,
          outputAmount: freshQuote[1]?.toString(),
          minimumOutput: amountOutMin,
          slippageOk: ethers.BigNumber.from(freshQuote[1]?.toString() || '0').gte(amountOutMin)
        });

        // Check if the fresh quote meets our minimum output
        if (!ethers.BigNumber.from(freshQuote[1]?.toString() || '0').gte(amountOutMin)) {
          throw new Error(`Fresh quote too low: ${freshQuote[1]?.toString()} < ${amountOutMin} (price moved, increase slippage)`);
        }
      } catch (quoteError: any) {
        console.error('❌ Fresh quote failed:', quoteError);
        throw new Error(`Pool validation failed: ${quoteError?.message || 'Pool might not exist or have insufficient liquidity'}`);
      }

      // Simple direct swap execution - copy exact logic from main app
      console.log('🔄 Executing direct swap with volatile pools (like main app)...');
      
      let tx;
      try {
        tx = await swapAerodrome({
          signer,
          amountIn,
          amountOutMin,
          fromToken: fromTokenAddress,
          toToken: toTokenAddress,
          stable: false, // Always use volatile pools for local stablecoins
          factory: AERODROME_FACTORY_ADDRESS,
          userAddress,
          deadline
        });
        
        console.log('✅ Direct swap successful:', tx.hash);
        return { success: true, hash: tx.hash };
        
      } catch (error: any) {
        console.error('❌ Direct swap failed:', error);
        
        // If it's a slippage issue, try with higher slippage once
        if (error?.message?.includes('slippage') || error?.message?.includes('INSUFFICIENT_OUTPUT_AMOUNT')) {
          console.log('🔄 Retrying with higher slippage (15%)...');
          
          try {
            const higherSlippageAmount = Number(amountOutMin) * 0.85; // 15% slippage
            const higherSlippageAmountOut = ethers.utils.parseUnits(
              higherSlippageAmount.toFixed(6), 
              6
            ).toString();
            
            tx = await swapAerodrome({
              signer,
              amountIn,
              amountOutMin: higherSlippageAmountOut,
              fromToken: fromTokenAddress,
              toToken: toTokenAddress,
              stable: false,
              factory: AERODROME_FACTORY_ADDRESS,
              userAddress,
              deadline
            });
            
            console.log('✅ Higher slippage swap successful:', tx.hash);
            return { success: true, hash: tx.hash };
            
          } catch (slippageError: any) {
            console.error('❌ Higher slippage swap also failed:', slippageError);
            throw new Error('Swap failed: Insufficient liquidity or slippage too high. Try reducing the amount or increasing slippage tolerance.');
          }
        }
        
        // Handle other common errors
        if (error?.message?.includes('user rejected') || error?.message?.includes('denied')) {
          throw new Error('Transaction was cancelled by user');
        }
        
        if (error?.message?.includes('execution reverted')) {
          throw new Error('Swap failed: Insufficient liquidity or slippage too high. Try reducing the amount or increasing slippage tolerance.');
        }
        
        if (error?.message?.includes('INSUFFICIENT_LIQUIDITY')) {
          throw new Error('Swap failed: Not enough liquidity in the pool for this token pair.');
        }
        
        if (error?.message?.includes('Unable to estimate')) {
          throw new Error('Unable to estimate gas for this swap. The token pair might not have sufficient liquidity.');
        }
        
        throw new Error(`Swap failed: ${error?.message || 'Unknown error'}`);
      }

    } catch (error: any) {
      console.error('❌ Farcaster swap failed:', error);
      throw error; // Re-throw the error as-is
    }
  }, [isConnected, address]);

  // Farcaster-compatible token approval using wagmi/actions
  const executeFarcasterApproval = useCallback(async (
    tokenAddress: string,
    spenderAddress: string,
    amount: string
  ): Promise<{ success: boolean; hash: string }> => {
    try {
      console.log('🔐 Executing Farcaster token approval:', {
        token: tokenAddress,
        spender: spenderAddress,
        amount
      });

      if (!isConnected || !address) {
        throw new Error('Wallet not connected in Farcaster');
      }

      // Use wagmi's writeContract approach for Farcaster MiniApps
      const { writeContract } = await import('wagmi/actions');
      const { config } = await import('../providers/MiniKitProvider');
      
      const hash = await writeContract(config, {
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
        args: [spenderAddress as `0x${string}`, BigInt(amount)]
      });
      
      console.log('✅ Farcaster approval transaction sent:', hash);
      
      return {
        success: true,
        hash: hash
      };
    } catch (error: any) {
      console.error('❌ Farcaster approval failed:', error);
      
      if (error?.message?.includes('user rejected') || error?.message?.includes('denied')) {
        throw new Error('Approval was cancelled by user');
      }
      
      throw new Error(`Farcaster approval failed: ${error?.message || 'Unknown error'}`);
    }
  }, [isConnected, address]);

  // Farcaster-compatible token transfer using wagmi/actions
  const executeFarcasterTransfer = useCallback(async (
    tokenAddress: string,
    toAddress: string,
    amount: string
  ): Promise<{ success: boolean; hash: string }> => {
    try {
      console.log('💳 Executing Farcaster token transfer:', {
        token: tokenAddress,
        to: toAddress,
        amount
      });

      if (!isConnected || !address) {
        throw new Error('Wallet not connected in Farcaster');
      }

      // Use wagmi's writeContract approach for Farcaster MiniApps
      const { writeContract } = await import('wagmi/actions');
      const { config } = await import('../providers/MiniKitProvider');
      
      const hash = await writeContract(config, {
        address: tokenAddress as `0x${string}`,
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
        args: [
          toAddress as `0x${string}`,
          BigInt(amount)
        ]
      });
      
      console.log('✅ Farcaster transfer transaction sent:', hash);
      
      return {
        success: true,
        hash: hash
      };
    } catch (error: any) {
      console.error('❌ Farcaster transfer failed:', error);
      
      if (error?.message?.includes('user rejected') || error?.message?.includes('denied')) {
        throw new Error('Transfer was cancelled by user');
      }
      
      throw new Error(`Farcaster transfer failed: ${error?.message || 'Unknown error'}`);
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

  // Farcaster sharing functionality
  const handleShareOnFarcaster = useCallback((paymentLink: string) => {
    try {
      // Create shareable text for Farcaster
      const shareText = `💰 ${linkDescription || 'Payment Request'} - $${linkAmount || '0'} ${selectedStablecoin.baseToken}\n\nPay instantly with NedaPay! 🚀`;
      
      // Try to use Farcaster's native sharing if available
      if (typeof window !== 'undefined' && (window as any).parent) {
        // Post message to parent frame (Farcaster client)
        (window as any).parent.postMessage({
          type: 'createCast',
          data: {
            text: shareText,
            embeds: [paymentLink] // Use the direct payment link with embedded metadata
          }
        }, '*');
        
        alert('🚀 Shared to Farcaster! The payment link will display with a rich preview and open directly in NedaPay.');
      } else {
        // Fallback: Copy share text and link to clipboard
        const fullShareText = `${shareText}\n\n${paymentLink}`;
        navigator.clipboard.writeText(fullShareText).then(() => {
          alert('💰 Share text copied to clipboard!\n\nPaste it in Farcaster to share your payment link with a rich preview.');
        });
      }
    } catch (error) {
      console.error('Failed to share on Farcaster:', error);
      // Fallback: Copy link to clipboard
      navigator.clipboard.writeText(paymentLink).then(() => {
        alert('Payment link copied to clipboard!');
      });
    }
  }, [linkAmount, linkDescription, selectedStablecoin]);

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
    if (!swapAmount || !swapFromToken || !swapToToken || !swapQuote || !isWalletConnected || !walletAddress) {
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

      // Simple wallet provider detection: use smart wallet if no window.ethereum but wallet is connected
      console.log('🔍 Wallet detection:', {
        hasWindowEthereum: !!(window as any).ethereum,
        isConnected,
        address,
        userAgent: navigator.userAgent.substring(0, 100)
      });

      // Convert amounts using proper decimals
      const fromDecimals = fromTokenData.decimals || 6;
      const toDecimals = toTokenData.decimals || 6;
      
      console.log('🔍 Token decimal info:', {
        fromToken: fromTokenData.baseToken,
        fromDecimals,
        toToken: toTokenData.baseToken,
        toDecimals,
        swapAmount
      });
      
      // Special handling for all local stablecoins to avoid gas estimation issues
      let amountInUnits;
      const isFromLocalStablecoin = fromTokenData.baseToken !== 'USDC';
      const isToLocalStablecoin = toTokenData.baseToken !== 'USDC';
      const isLocalStablecoinInvolved = isFromLocalStablecoin || isToLocalStablecoin;
      
      if (isLocalStablecoinInvolved) {
        // Ultra-robust handling for ALL local stablecoins to ensure consistent behavior
        if (fromTokenData.baseToken === 'IDRX') {
          // For IDRX, use ultra-conservative decimal handling (2 decimals)
          const idrxAmount = Math.floor(parseFloat(swapAmount) * 100) / 100; // Ensure exactly 2 decimals
          const cleanAmount = idrxAmount.toFixed(2);
          amountInUnits = ethers.utils.parseUnits(cleanAmount, 2);
          console.log('🪙 IDRX ultra-specific handling:', {
            originalAmount: swapAmount,
            idrxAmount,
            cleanAmount,
            amountInUnits: amountInUnits.toString(),
            decimals: 2
          });
        } else if (fromTokenData.baseToken === 'MXNe') {
          // For MXNe, use ultra-conservative decimal handling (6 decimals)
          const mxneAmount = Math.floor(parseFloat(swapAmount) * 1000000) / 1000000; // Ensure exactly 6 decimals
          const cleanAmount = mxneAmount.toFixed(6);
          amountInUnits = ethers.utils.parseUnits(cleanAmount, 6);
          console.log('🪙 MXNe ultra-specific handling:', {
            originalAmount: swapAmount,
            mxneAmount,
            cleanAmount,
            amountInUnits: amountInUnits.toString(),
            decimals: 6
          });
        } else {
          // For all other local stablecoins, use ultra-conservative decimal handling
          const multiplier = Math.pow(10, fromDecimals);
          const preciseAmount = Math.floor(parseFloat(swapAmount) * multiplier) / multiplier;
          const cleanAmount = preciseAmount.toFixed(fromDecimals);
          amountInUnits = ethers.utils.parseUnits(cleanAmount, fromDecimals);
          console.log('🪙 Local stablecoin ultra-robust handling:', {
            fromToken: fromTokenData.baseToken,
            toToken: toTokenData.baseToken,
            originalAmount: swapAmount,
            preciseAmount,
            cleanAmount,
            amountInUnits: amountInUnits.toString(),
            decimals: fromDecimals,
            multiplier,
            isFromLocal: isFromLocalStablecoin,
            isToLocal: isToLocalStablecoin
          });
        }
      } else {
        amountInUnits = ethers.utils.parseUnits(swapAmount, fromDecimals);
      }
      
      console.log('💰 Amount calculation:', {
        originalAmount: swapAmount,
        fromDecimals,
        amountInUnits: amountInUnits.toString(),
        isIDRX: fromTokenData.baseToken === 'IDRX'
      });
      // Calculate minimum amount out with proper decimal handling (increased slippage for production)
      // Use higher slippage for local stablecoins due to lower liquidity
      const isLocalStablecoinSwap = isFromLocalStablecoin || isToLocalStablecoin;
      const slippagePercentage = isLocalStablecoinSwap ? 0.95 : 0.98; // 5% for local stablecoins, 2% for USDC
      const slippageAmount = Number(swapQuote) * slippagePercentage;
      const minAmountOutFormatted = slippageAmount.toFixed(toDecimals);
      const minAmountOut = ethers.utils.parseUnits(minAmountOutFormatted, toDecimals);
      
      console.log('📊 Slippage calculation:', {
        swapQuote,
        slippagePercentage: `${(1 - slippagePercentage) * 100}%`,
        slippageAmount,
        minAmountOutFormatted,
        minAmountOut: minAmountOut.toString(),
        isLocalStablecoinSwap
      });

      // Calculate deadline (10 minutes from now)
      const deadline = Math.floor(Date.now() / 1000) + 600;
      
      console.log('🔄 Swap parameters:', {
        fromToken: fromTokenData.address,
        toToken: toTokenData.address,
        amountIn: amountInUnits.toString(),
        amountOutMin: minAmountOut.toString(),
        userAddress: address,
        deadline: new Date(deadline * 1000).toISOString()
      });
      
      // Force Farcaster approach for all swaps to ensure compatibility
      if (!isConnected || !address) {
        console.error('❌ No wallet available');
        throw new Error('Please connect your wallet first');
      }
      
      console.log('✅ Using Farcaster smart wallet for swap');
      
      // Calculate and collect protocol fee if enabled
      let actualSwapAmount = amountInUnits;
      if (isProtocolEnabled()) {
        // Calculate fee based on USD equivalent
        let usdValue;
        if (swapToToken === 'USDC' || swapToToken === 'USDT' || swapToToken === 'DAI') {
          // If swapping to USD stablecoin, use the output amount as USD value
          usdValue = Number(swapQuote) || 0;
        } else if (swapFromToken === 'USDC' || swapFromToken === 'USDT' || swapFromToken === 'DAI') {
          // If swapping from USD stablecoin, use the input amount as USD value
          usdValue = Number(swapAmount) || 0;
        } else {
          // For other token pairs, use a conservative estimate based on output
          usdValue = Number(swapQuote) || Number(swapAmount) || 0;
        }
        const feeInfo = calculateDynamicFee(usdValue);
        console.log('💰 Protocol fee info:', feeInfo, 'USD value used:', usdValue);
        
        if (feeInfo.feeAmount > 0) {
          // Calculate fee in token units
          const feeInTokenUnits = ethers.utils.parseUnits(
            (feeInfo.feeAmount).toFixed(fromDecimals), 
            fromDecimals
          );
          
          console.log('💳 Protocol fee will be collected during swap:', {
            feeRate: feeInfo.feeRate + '%',
            feeAmountUSD: '$' + feeInfo.feeAmount.toFixed(4),
            feeInTokenUnits: ethers.utils.formatUnits(feeInTokenUnits, fromDecimals) + ' ' + swapFromToken,
            tier: feeInfo.tier
          });
          
          // Store fee info for the swap execution
          (window as any).protocolFeeInfo = {
            feeInTokenUnits,
            feeAmountUSD: feeInfo.feeAmount, // USD amount for USDC conversion
            protocolAddress: getNedaPayProtocolAddress()
          };
        }
      }
      
      // Execute swap with protocol fee handling
      let swapResult;
      
      if (isProtocolEnabled() && (window as any).protocolFeeInfo) {
        console.log('🔄 Executing swap with protocol fee...');
        const feeInfo = (window as any).protocolFeeInfo;
        
        // Use the batched swap function that handles protocol fees
        swapResult = await executeBatchedSwapWithFee(
          fromTokenData.address,
          toTokenData.address,
          amountInUnits.toString(),
          minAmountOut.toString(),
          address,
          deadline,
          feeInfo
        );
      } else {
        console.log('🔄 Executing regular swap...');
        // Regular swap without protocol fee
        swapResult = await executeFarcasterSwap(
          fromTokenData.address,
          toTokenData.address,
          amountInUnits.toString(),
          minAmountOut.toString(),
          address,
          deadline
        );
      }
      
      console.log('💰 Swap executed:', {
        swapAmount: amountInUnits.toString(),
        protocolFeeEnabled: isProtocolEnabled(),
        swapResult: swapResult.success ? 'Success' : 'Failed'
      });
      
      console.log('✅ Swap completed successfully!', swapResult);
      
      // Clean up any remaining fee info since batched transaction handles it
      if (isProtocolEnabled() && (window as any).batchedFeeInfo) {
        console.log('✅ Fee collection completed via batched transaction');
        delete (window as any).batchedFeeInfo;
        delete (window as any).protocolFeeInfo;
      }
      
      setSwapSuccess(`Swap successful! Transaction: ${swapResult.hash}`);
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
    if (!linkAmount || !isWalletConnected || !walletAddress) {
      alert('Please connect wallet and enter amount');
      return;
    }

    try {
      // Generate a unique payment link
      const linkId = `payment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const baseUrl = window.location.origin;
      
      // Calculate protocol fee if enabled
      let protocolFeeParams = '';
      if (isProtocolEnabled()) {
        const feeInfo = calculateDynamicFee(Number(linkAmount));
        protocolFeeParams = `&protocolFee=${feeInfo.feeRate}&feeTier=${encodeURIComponent(feeInfo.tier)}&protocolEnabled=true`;
      }
      
      // Create universal payment link
      const paymentLink = `${baseUrl}/payment-request?id=${linkId}&amount=${linkAmount}&token=${selectedStablecoin.baseToken}&description=${encodeURIComponent(linkDescription)}&merchant=${walletAddress}${protocolFeeParams}`;
      
      // Store payment request data
      const storedPaymentData = {
        id: linkId,
        amount: linkAmount,
        token: selectedStablecoin.baseToken,
        description: linkDescription,
        merchant: walletAddress,
        createdAt: new Date().toISOString(),
        status: 'pending',
        protocolEnabled: isProtocolEnabled(),
        ...(isProtocolEnabled() && {
          protocolFee: calculateDynamicFee(Number(linkAmount))
        })
      };
      
      // Store in localStorage for now (in production, this would be stored in a database)
      localStorage.setItem(`payment-${linkId}`, JSON.stringify(storedPaymentData));
      
      // Set the generated link in state first to update UI
      setGeneratedLink(paymentLink);
      
      // Then copy to clipboard
      try {
        console.log('🔗 Copying payment link to clipboard:', paymentLink);
        
        // Try modern clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(paymentLink);
          // Don't show alert since UI will show the link
          return;
        }

        // Fallback to manual copy method
        console.log('📋 Using fallback copy method');
        
        // Create a temporary text area for copying
        const textArea = document.createElement('textarea');
        textArea.value = paymentLink;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
          const successful = document.execCommand('copy');
          document.body.removeChild(textArea);
          
          if (!successful) {
            // Show the link directly if copy failed
            prompt('Copy this payment link:', paymentLink);
          }
        } catch (copyError) {
          document.body.removeChild(textArea);
          // Show the link directly if all else fails
          prompt('Copy this payment link:', paymentLink);
        }

      } catch (error) {
        console.error('Copy error:', error);
        // Final fallback - show the link in a prompt
        prompt('Copy this payment link:', paymentLink);
      }
      
    } catch (error) {
      console.error('Failed to generate payment link:', error);
      alert('❌ Failed to generate payment link: ' + (error as Error).message);
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
      
      // Add notification for successful send
      addNotification(
        `Successfully sent ${amount} ${selectedSendToken} to ${recipientName || phoneNumber}`,
        'send'
      );
      
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
      
      // Validate that institution is selected for payments
      if (!selectedInstitution) {
        alert('Please select a payment provider');
        return;
      }
      
      // Prepare recipient data for Paycrest API (correct format)
      const recipient = {
        institution: selectedInstitution, // Use actual selected institution
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
      
      // Add notification for successful payment
      addNotification(
        `Successfully paid ${amount} ${selectedPayToken} to ${recipientName || (paymentType === 'bill' ? 'paybill' : 'till')} ${tillNumber}`,
        'pay'
      );
      
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
        <label className="block text-xs text-gray-400 mb-1">Recipient Name (or Account Number)</label>
        <div className="relative">
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="John Doe"
            className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {recipientName && recipientName.includes('.') && (
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
              <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" title="Resolving name..."></div>
            </div>
          )}
        </div>
      </div>

      {/* Phone Number with Country Code */}
      <div>
        <label className="block text-xs text-gray-400 mb-1">Mobile Number</label>
        <div className="relative flex">
          <div className="flex items-center bg-slate-600 text-white px-3 py-2 rounded-l-lg border-r border-slate-500 text-sm font-medium">
            <span className="mr-1">{selectedCountry.flag}</span>
            <span>{selectedCountry.countryCode || '+255'}</span>
          </div>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => {
              // Remove any non-digit characters and format
              const value = e.target.value.replace(/\D/g, '');
              setPhoneNumber(value);
            }}
            placeholder="789123456"
            className="flex-1 bg-slate-700 text-white rounded-r-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={selectedCountry.code === 'NG' ? 10 : selectedCountry.code === 'KE' ? 9 : selectedCountry.code === 'GH' ? 9 : selectedCountry.code === 'TZ' ? 9 : selectedCountry.code === 'UG' ? 9 : 10}
          />
        </div>
        {phoneNumber && (
          <div className="mt-1 text-xs text-gray-400">
            Full number: {selectedCountry.countryCode || '+255'}{phoneNumber}
          </div>
        )}
        {phoneNumber && (() => {
          const validation = validateMobileNumber(phoneNumber, selectedCountry.code);
          return !validation.isValid ? (
            <div className="mt-1 text-xs text-red-400 flex items-center">
              <span className="mr-1">⚠️</span>
              {validation.message}
            </div>
          ) : (
            <div className="mt-1 text-xs text-green-400 flex items-center">
              <span className="mr-1">✓</span>
              Valid mobile number
            </div>
          );
        })()}
      </div>

      {/* Amount Input with Currency Switching */}
      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="text-xs text-gray-400">Enter Amount</label>
          <div className="flex gap-1">
            <div className="relative">
              <div className="relative">
                <button
                  onClick={() => {
                    setSendCurrency('usdc');
                    setShowSendTokenDropdown(!showSendTokenDropdown);
                  }}
                  className="relative px-3 py-1 text-xs rounded-lg font-bold transition-all duration-300 ease-out overflow-hidden group w-full text-left flex items-center justify-between bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 text-white shadow-xl shadow-blue-500/30 border-2 border-blue-400/50"
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
        
      </div>

      {/* Payment Details */}
      <div className="space-y-1">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-gray-400 text-xs">You'll pay</span>
            {/* Currency Conversion Display underneath You'll pay */}
            {amount && (
              <div className="mt-1 text-xs text-gray-400 font-medium">
                {sendCurrency === 'local' ? (
                  <span>≈ {(parseFloat(amount) / parseFloat(currentRate)).toFixed(4)} {selectedSendToken}</span>
                ) : (
                  <span>≈ {(parseFloat(amount) * parseFloat(currentRate)).toFixed(2)} {selectedCountry.currency}</span>
                )}
              </div>
            )}
          </div>
          <div className="text-right">
            {/* Base Network Label */}
            <div className="flex items-center justify-end gap-1 mb-1">
              <img src="/assets/logos/base-logo.jpg" alt="Base" className="w-3 h-3 rounded-full" />
              <span className="text-white text-xs">Base</span>
            </div>
            
            {/* Balance underneath Base */}
            <div className="text-xs text-gray-400 flex items-center justify-end gap-2">
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
                <ArrowPathIcon className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-gray-300 mb-4 font-semibold mt-3">
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
                  <div className="text-white font-mono text-sm">
                    {successData.recipient.startsWith('0x') ? (
                      <Identity address={successData.recipient as `0x${string}`} chain={base}>
                        <Name className="text-white font-mono text-sm">
                          {successData.recipient}
                        </Name>
                      </Identity>
                    ) : (
                      successData.recipient
                    )}
                  </div>
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-white text-lg font-medium">Pay</h2>
        <div className="flex items-center gap-2">
          <img src="/assets/logos/base-logo.jpg" alt="Base" className="w-4 h-4 rounded-full" />
          <span className="text-white text-sm">Base</span>
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

      {/* Institution Selection */}
      <div className="space-y-2">
        <label className="block text-xs text-gray-300 font-medium mb-1">Select Payment Provider</label>
        <div className="relative">
          <select 
            value={selectedInstitution}
            onChange={(e) => setSelectedInstitution(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700/50 text-white rounded-lg px-3 py-2 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-slate-700/50 transition-colors"
          >
            <option value="">Choose payment provider...</option>
            {institutions.map((institution) => (
              <option key={institution.code} value={institution.code}>
                {institution.name}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
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
            <div className="relative">
              <div className="relative">
                <button
                  onClick={() => {
                    setPayCurrency('usdc');
                    setShowPayTokenDropdown(!showPayTokenDropdown);
                  }}
                  className="relative px-3 py-1 text-xs rounded-lg font-bold transition-all duration-300 ease-out overflow-hidden group w-full text-left flex items-center justify-between bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 text-white shadow-xl shadow-blue-500/30 border-2 border-blue-400/50"
                >
                  <div className="flex items-center gap-2">
                    {selectedPayToken === 'USDC' ? (
                      <img src="/assets/logos/usdc-logo.png" alt="USDC" className="w-3 h-3" />
                    ) : (
                      <span className="text-xs">
                        {stablecoins.find(token => token.baseToken === selectedPayToken)?.flag || '🌍'}
                      </span>
                    )}
                    <span>{selectedPayToken}</span>
                  </div>
                  <ChevronDownIcon className="w-3 h-3 text-white" />
                </button>
                
                {showPayTokenDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 rounded-lg border border-slate-600 shadow-xl z-50 max-h-48 overflow-y-auto">
                    {stablecoins.map((token) => (
                      <button
                        key={token.baseToken}
                        onClick={() => {
                          setSelectedPayToken(token.baseToken);
                          setShowPayTokenDropdown(false);
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
          <div className="flex justify-between items-start">
            <span className="text-gray-400 text-sm">You'll pay</span>
            <div className="text-right">
              {/* Base Network Label */}
              <div className="flex items-center justify-end gap-1 mb-1">
                <img src="/assets/logos/base-logo.jpg" alt="Base" className="w-3 h-3 rounded-full" />
                <span className="text-white text-xs">Base</span>
              </div>
              
              {/* Balance underneath Base */}
              <div className="text-xs text-gray-400 flex items-center justify-end gap-2">
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
                  <ArrowPathIcon className="w-3 h-3" />
                </button>
              </div>
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
        <label className="block text-xs text-gray-400 mb-1.5">Mobile Number / Account Number</label>
        <div className="relative flex">
          <div className="flex items-center bg-slate-600 text-white px-3 py-2.5 rounded-l-lg border-r border-slate-500 text-sm font-medium">
            <span className="mr-1">{selectedCountry.flag}</span>
            <span>{selectedCountry.countryCode || '+255'}</span>
          </div>
          <input
            type="tel"
            value={phoneNumber}
            onChange={(e) => {
              // Remove any non-digit characters and format
              const value = e.target.value.replace(/\D/g, '');
              setPhoneNumber(value);
            }}
            placeholder="789123456 or account number"
            className="flex-1 bg-slate-700 text-white rounded-r-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
            maxLength={selectedCountry.code === 'NG' ? 10 : selectedCountry.code === 'KE' ? 9 : selectedCountry.code === 'GH' ? 9 : selectedCountry.code === 'TZ' ? 9 : selectedCountry.code === 'UG' ? 9 : 10}
          />
        </div>
        {phoneNumber && (
          <div className="mt-1 text-xs text-gray-400">
            Full number: {selectedCountry.countryCode || '+255'}{phoneNumber}
          </div>
        )}
        {phoneNumber && (() => {
          const validation = validateMobileNumber(phoneNumber, selectedCountry.code);
          return !validation.isValid ? (
            <div className="mt-1 text-xs text-red-400 flex items-center">
              <span className="mr-1">⚠️</span>
              {validation.message}
            </div>
          ) : (
            <div className="mt-1 text-xs text-green-400 flex items-center">
              <span className="mr-1">✓</span>
              Valid mobile number
            </div>
          );
        })()}
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
            {isWalletConnected 
              ? `✅ Wallet Connected - Ready to Generate Links` 
              : `⚠️ Connect Wallet to Generate Links`
            }
          </span>
        </div>
        {isWalletConnected && walletAddress && (
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
      
      {/* Protocol Fee Display for Link */}
      {isProtocolEnabled() && linkAmount && Number(linkAmount) > 0 && (
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-blue-400 font-medium">Protocol Fee:</span>
            <div className="text-right">
              {(() => {
                const feeInfo = calculateDynamicFee(Number(linkAmount));
                return (
                  <>
                    <div className="text-blue-400 font-mono">
                      {feeInfo.feeRate}%
                    </div>
                    <div className="text-gray-400 text-xs">
                      {feeInfo.tier}
                    </div>
                  </>
                );
              })()} 
            </div>
          </div>
        </div>
      )}

      {/* Currency Selector */}
      <div>
        <label className="block text-gray-400 text-xs mb-1">Currency</label>
        <div className="relative">
          <button
            onClick={() => setShowLinkCurrencyDropdown(!showLinkCurrencyDropdown)}
            className="w-full bg-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between border border-slate-600/50 hover:border-slate-500 transition-colors"
          >
            <div className="flex items-center gap-2">
              {selectedStablecoin.baseToken === 'USDC' ? (
                <img src="/assets/logos/usdc-logo.png" alt="USDC" className="w-4 h-4" />
              ) : (
                <span className="text-sm">{selectedStablecoin.flag || '🌍'}</span>
              )}
              <span>{selectedStablecoin.baseToken} - {selectedStablecoin.name}</span>
            </div>
            <ChevronDownIcon className="w-4 h-4 text-gray-400" />
          </button>
          
          {showLinkCurrencyDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 rounded-lg border border-slate-600 shadow-xl z-50 max-h-64 overflow-y-auto">
              {stablecoins.map((token) => (
                <button
                  key={token.baseToken}
                  onClick={() => {
                    setSelectedStablecoin(token);
                    setShowLinkCurrencyDropdown(false);
                  }}
                  className="w-full px-3 py-2 text-left hover:bg-slate-700 flex items-center gap-2 text-sm transition-colors"
                >
                  {token.baseToken === 'USDC' ? (
                    <img src="/assets/logos/usdc-logo.png" alt="USDC" className="w-4 h-4" />
                  ) : (
                    <span className="text-sm">{token.flag || '🌍'}</span>
                  )}
                  <span className="text-white">{token.baseToken} - {token.name}</span>
                </button>
              ))}
            </div>
          )}
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
        onClick={isWalletConnected ? handleGeneratePaymentLink : () => {
          if (isSmartWalletEnvironment) {
            console.log('⚠️ Smart wallet environment - connection should happen automatically');
            // In Farcaster, try to connect to available connectors
            if (connectors.length > 0) {
              connect({ connector: connectors[0] });
            }
          } else {
            // Use wagmi connect for all environments
            if (connectors && connectors.length > 0) {
              connect({ connector: connectors[0] });
            }
          }
        }}
        disabled={!isWalletConnected || !linkAmount}
        className={`w-full font-medium py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm border-2 ${
          isWalletConnected && linkAmount
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white transform hover:scale-105 shadow-lg border-blue-400/30 hover:border-blue-300/50' 
            : 'bg-gray-600 text-gray-300 cursor-not-allowed border-gray-600/30'
        }`}
      >
        {isWalletConnected ? (
          <>
            🔗 Generate Payment Link
          </>
        ) : (
          <>
            <WalletIcon className="w-4 h-4" />
            Connect Wallet
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
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(generatedLink)}
              className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 rounded-lg transition-colors text-xs"
            >
              📋 Copy Link
            </button>
            <button
              onClick={() => handleShareOnFarcaster(generatedLink)}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 rounded-lg transition-colors text-xs"
            >
              🚀 Share on FC
            </button>
          </div>
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
              <div className="relative">
                <button
                  onClick={() => setShowInvoiceCurrencyDropdown(!showInvoiceCurrencyDropdown)}
                  className="bg-slate-700 text-white rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px] flex items-center justify-between gap-2 border border-slate-600/50 hover:border-slate-500 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {invoiceCurrency === 'USDC' ? (
                      <img src="/assets/logos/usdc-logo.png" alt="USDC" className="w-4 h-4" />
                    ) : (
                      <span className="text-sm">{stablecoins.find(t => t.baseToken === invoiceCurrency)?.flag || '🌍'}</span>
                    )}
                    <span>{invoiceCurrency}</span>
                  </div>
                  <ChevronDownIcon className="w-3 h-3 text-gray-400" />
                </button>
                
                {showInvoiceCurrencyDropdown && (
                  <div className="absolute top-full left-0 mt-1 bg-slate-800 rounded-lg border border-slate-600 shadow-xl z-50 max-h-64 overflow-y-auto w-full min-w-max">
                    {stablecoins.map((token) => (
                      <button
                        key={token.baseToken}
                        onClick={() => {
                          setInvoiceCurrency(token.baseToken);
                          setShowInvoiceCurrencyDropdown(false);
                        }}
                        className="w-full px-3 py-2 text-left hover:bg-slate-700 flex items-center gap-2 text-xs transition-colors whitespace-nowrap"
                      >
                        {token.baseToken === 'USDC' ? (
                          <img src="/assets/logos/usdc-logo.png" alt="USDC" className="w-4 h-4" />
                        ) : (
                          <span className="text-sm">{token.flag || '🌍'}</span>
                        )}
                        <span className="text-white">{token.baseToken} - {token.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
              {isWalletConnected 
                ? `✅ Wallet Connected - Ready to Create Invoices` 
                : `⚠️ Connect Wallet to Create Invoices`
              }
            </span>
          </div>
          {isWalletConnected && walletAddress && (
            <div className="text-xs text-gray-400 mt-1 font-mono">
              {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => {
              if (isWalletConnected) {
                setInvoiceView('create');
              } else {
                alert('Please connect your wallet first');
              }
            }}
            className={`p-3 rounded-xl border-2 transition-all duration-300 ${
              isWalletConnected
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
              if (isWalletConnected) {
                setInvoiceView('list');
              } else {
                alert('Please connect your wallet first');
              }
            }}
            className={`p-3 rounded-xl border-2 transition-all duration-300 ${
              isWalletConnected
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
                  {swapFromToken === 'USDC' ? (
                    <img src="/assets/logos/usdc-logo.png" alt="USDC" className="w-5 h-5" />
                  ) : (
                    <span className="text-xl">{fromTokenData?.flag || '🌍'}</span>
                  )}
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
                      {token.baseToken === 'USDC' ? (
                        <img src="/assets/logos/usdc-logo.png" alt="USDC" className="w-5 h-5" />
                      ) : (
                        <span className="text-lg">{token.flag || '🌍'}</span>
                      )}
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
                  {swapToToken === 'USDC' ? (
                    <img src="/assets/logos/usdc-logo.png" alt="USDC" className="w-5 h-5" />
                  ) : (
                    <span className="text-xl">{toTokenData?.flag || '🌍'}</span>
                  )}
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
                      {token.baseToken === 'USDC' ? (
                        <img src="/assets/logos/usdc-logo.png" alt="USDC" className="w-5 h-5" />
                      ) : (
                        <span className="text-lg">{token.flag || '🌍'}</span>
                      )}
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
          
          {/* Protocol Fee Display */}
          {isProtocolEnabled() && swapAmount && Number(swapAmount) > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 mt-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-blue-400 font-medium">Protocol Fee:</span>
                <div className="text-right">
                  {(() => {
                    // Calculate fee based on USD equivalent
                    let usdValue;
                    if (swapToToken === 'USDC' || swapToToken === 'USDT' || swapToToken === 'DAI') {
                      // If swapping to USD stablecoin, use the output amount as USD value
                      usdValue = Number(swapQuote) || 0;
                    } else if (swapFromToken === 'USDC' || swapFromToken === 'USDT' || swapFromToken === 'DAI') {
                      // If swapping from USD stablecoin, use the input amount as USD value
                      usdValue = Number(swapAmount) || 0;
                    } else {
                      // For other token pairs, use a conservative estimate based on output
                      usdValue = Number(swapQuote) || Number(swapAmount) || 0;
                    }
                    const feeInfo = calculateDynamicFee(usdValue);
                    return (
                      <>
                        <div className="text-blue-400 font-mono">
                          {feeInfo.feeRate}%
                        </div>
                        <div className="text-gray-400 text-xs">
                          {feeInfo.tier}
                        </div>
                      </>
                    );
                  })()} 
                </div>
              </div>
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
          disabled={!isWalletConnected || !swapAmount || !swapToToken || swapIsLoading}
          className={`w-full py-3 rounded-2xl font-bold text-base transition-all border-2 ${
            isWalletConnected && swapAmount && swapToToken && !swapIsLoading
              ? 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 hover:border-blue-400 transform hover:scale-[1.02]'
              : 'bg-slate-700 text-slate-400 border-slate-600 cursor-not-allowed'
          }`}
        >
          {!isWalletConnected ? (
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
      // case 'swap': // Temporarily hidden
      //   return renderSwapTab();
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
        <div className="flex items-center justify-between mb-3 w-full">
          <div className="flex items-center gap-2 flex-shrink-0">
            <Image 
              src="/NEDApayLogo.png" 
              alt="NedaPay" 
              width={32} 
              height={32} 
              className="rounded-lg"
            />
            <div>
              <h1 className="text-white font-bold text-base">NedaPay</h1>
              <p className="text-gray-400 text-xs">Mini App</p>
            </div>
          </div>
          
          {/* Wallet Section - Right aligned with proper spacing */}
          <div className="flex items-center gap-2 flex-shrink min-w-0">
            {!isWalletConnected ? (
            <button
              onClick={async () => {
                try {
                  console.log('🔗 Wallet button clicked!');
                  console.log('Environment:', isSmartWalletEnvironment ? 'Farcaster/MiniApp' : 'Website');
                  console.log('Available connectors:', connectors?.map(c => ({ name: c.name, id: c.id })));
                  
                  if (connectors && connectors.length > 0) {
                    let preferredConnector;
                    
                    if (isSmartWalletEnvironment) {
                      // For Farcaster MiniApp, prioritize farcaster connector
                      preferredConnector = connectors.find(c => 
                        c.name.toLowerCase().includes('farcaster') ||
                        c.id.toLowerCase().includes('farcaster') ||
                        c.name.toLowerCase().includes('miniapp')
                      );
                    } else {
                      // For normal web browser, prioritize web wallet connectors
                      preferredConnector = connectors.find(c => 
                        c.name.toLowerCase().includes('coinbase') ||
                        c.name.toLowerCase().includes('metamask') ||
                        c.name.toLowerCase().includes('walletconnect')
                      );
                    }
                    
                    // Fallback to first available connector
                    preferredConnector = preferredConnector || connectors[0];
                    
                    console.log('🔌 Connecting with:', { 
                      name: preferredConnector.name, 
                      id: preferredConnector.id,
                      environment: isSmartWalletEnvironment ? 'Farcaster' : 'Web',
                      totalConnectors: connectors.length
                    });
                    
                    await connect({ connector: preferredConnector });
                  } else {
                    console.error('❌ No connectors available');
                    alert('No wallet connectors available in this environment');
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
            <>
              {/* Wallet Status - Properly sized */}
              <div className="flex items-center gap-1 bg-slate-800/60 backdrop-blur-sm rounded-lg px-2 py-1 border border-green-500/30">
                <div className="relative">
                  <div className="w-2 h-2 bg-green-400 rounded-full" />
                  <div className="absolute inset-0 w-2 h-2 bg-green-400 rounded-full animate-ping opacity-75" />
                  <div className="absolute inset-0 w-2 h-2 bg-green-400/50 rounded-full animate-pulse" />
                </div>
                <div className="text-white text-xs font-mono">
                  {walletAddress ? (
                    <Identity address={walletAddress as `0x${string}`} chain={base}>
                      <Name className="text-white text-xs font-mono">
                        {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                      </Name>
                    </Identity>
                  ) : '0xF939...84f1'}
                </div>
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
                  className="text-white hover:text-blue-400 transition-colors"
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
                  onClick={() => {
                    disconnect();
                  }}
                  className="text-white hover:text-red-400 transition-colors"
                  title="Disconnect wallet"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
              
              {/* Notification Icon - Compact */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-1.5 bg-slate-800/60 backdrop-blur-sm rounded-lg border border-slate-600/30 hover:border-blue-500/30 transition-all duration-300 hover:bg-slate-700/60"
                >
                  <BellIcon className="w-4 h-4 text-gray-400 hover:text-blue-400 transition-colors" />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                      {notifications.filter(n => !n.read).length}
                    </span>
                  )}
                </button>
              </div>
            </>
          )}
          </div>
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
            animation: scroll-left 8s linear infinite;
          }
          
          .animate-scroll-left:hover {
            animation-play-state: paused;
          }
          
          .animate-shimmer {
            animation: shimmer 2s ease-in-out;
          }
        `}</style>

        {/* Tab Navigation */}
        <div className="bg-slate-900/90 rounded-xl p-1 mb-2 border border-slate-700/50 shadow-2xl">
          <div className="grid grid-cols-5 gap-1">
            {[
              { key: 'send' as Tab, label: 'Send', icon: ArrowUpIcon },
              { key: 'pay' as Tab, label: 'Pay', icon: CurrencyDollarIcon },
              { key: 'deposit' as Tab, label: 'Deposit', icon: ArrowDownIcon },
              { key: 'link' as Tab, label: 'Link', icon: LinkIcon },
              // { key: 'swap' as Tab, label: 'Swap', icon: ArrowsRightLeftIcon }, // Temporarily hidden
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
      
      {/* Notification Panel */}
      {showNotifications && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" 
            onClick={() => setShowNotifications(false)}
          />
          
          {/* Notification Panel */}
          <div className="fixed top-16 right-2 w-80 max-w-[calc(100vw-16px)] bg-gradient-to-br from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-xl border border-slate-600/40 rounded-2xl shadow-2xl z-50 max-h-[65vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="p-3 border-b border-slate-600/20 flex justify-between items-center bg-gradient-to-r from-blue-500/10 to-purple-500/10">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-500/20 rounded-lg border border-blue-500/30">
                  <BellIcon className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white text-sm">Notifications</h3>
                  <p className="text-xs text-gray-400">Recent activity</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {notifications.length > 0 && (
                  <button 
                    className="text-xs text-blue-400 hover:text-blue-300 bg-blue-500/20 hover:bg-blue-500/30 px-2 py-1 rounded-lg transition-all font-medium"
                    onClick={clearAllNotifications}
                  >
                    Clear
                  </button>
                )}
                <button
                  className="p-1.5 hover:bg-slate-700/50 rounded-lg transition-colors"
                  onClick={() => setShowNotifications(false)}
                >
                  <svg className="w-3.5 h-3.5 text-gray-400 hover:text-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {notifications.length === 0 ? (
                <div className="p-4 text-center">
                  <div className="bg-gradient-to-br from-slate-700/30 to-slate-800/30 rounded-xl p-4 border border-slate-600/20">
                    <div className="bg-blue-500/20 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-3 border border-blue-500/30">
                      <BellIcon className="w-6 h-6 text-blue-400" />
                    </div>
                    <h4 className="text-white font-semibold mb-1 text-sm">No notifications yet</h4>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      Send money or make payments to see your transaction history here.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-2">
                  {notifications.map((notification, index) => (
                    <div 
                      key={notification.id} 
                      className={`mb-2 rounded-xl border transition-all duration-300 cursor-pointer group ${
                        !notification.read 
                          ? 'bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30 hover:from-blue-500/15 hover:to-purple-500/15' 
                          : 'bg-gradient-to-r from-slate-800/50 to-slate-700/50 border-slate-600/20 hover:from-slate-700/60 hover:to-slate-600/60'
                      }`}
                      onClick={() => markNotificationAsRead(notification.id)}
                    >
                      <div className="p-3">
                        <div className="flex items-start gap-2">
                          {/* Status Indicator & Icon */}
                          <div className="flex-shrink-0 relative">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center border text-sm ${
                              notification.type === 'send' 
                                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                : notification.type === 'pay'
                                ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                                : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                            }`}>
                              {notification.type === 'send' ? '💸' : notification.type === 'pay' ? '💳' : '📄'}
                            </div>
                            {!notification.read && (
                              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-blue-500 rounded-full border border-slate-800 animate-pulse"></div>
                            )}
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                                notification.type === 'send' 
                                  ? 'bg-green-500/20 text-green-300'
                                  : notification.type === 'pay'
                                  ? 'bg-blue-500/20 text-blue-300'
                                  : 'bg-gray-500/20 text-gray-300'
                              }`}>
                                {notification.type === 'send' ? 'Send' : notification.type === 'pay' ? 'Payment' : 'General'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {notification.timestamp}
                              </span>
                            </div>
                            <div className={`text-xs leading-relaxed break-words ${
                              !notification.read ? 'text-white font-medium' : 'text-gray-300'
                            }`}>
                              {notification.message}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

    </div>
  );
}

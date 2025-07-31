'use client';

import { useState, useEffect, useCallback } from 'react';
import { useMiniKit } from '@coinbase/onchainkit/minikit';
import { ChevronDownIcon, LinkIcon, CurrencyDollarIcon, ArrowUpIcon, ArrowDownIcon, ArrowPathIcon, WalletIcon } from '@heroicons/react/24/outline';
import { usePrivy, useWallets } from '@privy-io/react-auth';
import { ethers } from 'ethers';
import { stablecoins } from './data/stablecoins';
import { initiatePaymentOrder } from './utils/paycrest';
import { executeUSDCTransaction } from './utils/wallet';
import { fetchTokenRate, fetchSupportedCurrencies, fetchSupportedInstitutions } from './utils/paycrest';
import Image from 'next/image';

type Tab = 'send' | 'pay' | 'deposit' | 'link';

interface Country {
  name: string;
  code: string;
  flag: string;
  currency: string;
}

const countries: Country[] = [
  { name: 'Nigeria', code: 'NG', flag: '🇳🇬', currency: 'NGN' },
  { name: 'Kenya', code: 'KE', flag: '🇰🇪', currency: 'KES' },
  { name: 'Ghana', code: 'GH', flag: '🇬🇭', currency: 'GHS' },
  { name: 'Tanzania', code: 'TZ', flag: '🇹🇿', currency: 'TZS' },
  { name: 'Uganda', code: 'UG', flag: '🇺🇬', currency: 'UGX' },
  { name: 'Rwanda', code: 'RW', flag: '🇷🇼', currency: 'RWF' },
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
  const [activeTab, setActiveTab] = useState<Tab>('send');
  const [selectedToken, setSelectedToken] = useState(stablecoins[0]);
  const [selectedCountry, setSelectedCountry] = useState(countries[3]);
  const [amount, setAmount] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [tillNumber, setTillNumber] = useState('');
  const [businessNumber, setBusinessNumber] = useState('');
  // Removed duplicate walletAddress state - using connectedWallet?.address directly
  const [description, setDescription] = useState('');
  const [linkAmount, setLinkAmount] = useState('6');
  const [linkDescription, setLinkDescription] = useState('');
  const [selectedStablecoin, setSelectedStablecoin] = useState(stablecoins[0]);
  const [generatedLink, setGeneratedLink] = useState('');
  const [paymentType, setPaymentType] = useState<'goods' | 'bill' | 'send'>('goods');

  const [isLoadingRate, setIsLoadingRate] = useState(false);
  const [currentRate, setCurrentRate] = useState('2547');
  const [currencies, setCurrencies] = useState<Array<{ code: string; name: string; symbol: string }>>([]);
  const [floatingRates, setFloatingRates] = useState<{ [key: string]: RateData }>({});
  const [institutions, setInstitutions] = useState<Array<{ name: string; code: string; type: string }>>([]);
  const [sendCurrency, setSendCurrency] = useState<'local' | 'usdc'>('local');
  const [payCurrency, setPayCurrency] = useState<'local' | 'usdc'>('local');
  const [isSwipeComplete, setIsSwipeComplete] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [walletBalance, setWalletBalance] = useState('0.00');
  const [isCountryDropdownOpen, setIsCountryDropdownOpen] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successData, setSuccessData] = useState<{
    orderId: string;
    hash: string;
    amount: string;
    recipient: string;
    type: 'send' | 'pay';
  } | null>(null);

  // Farcaster MiniApp SDK initialization
  const { authenticated, user, login, logout, connectWallet } = usePrivy();
  const { wallets } = useWallets();

  // Get connected wallet info
  const connectedWallet = wallets.find(wallet => wallet.connectorType !== 'embedded') || wallets[0];
  const walletAddress = connectedWallet?.address;
  
  // Removed duplicate handleGeneratePaymentLink function - using the one defined later
  
  // Fetch real USDC wallet balance
  const fetchWalletBalance = useCallback(async () => {
    if (!walletAddress || !authenticated) {
      setWalletBalance('0.00');
      return;
    }
    
    try {
      // Get USDC token info (Base network)
      const usdcToken = stablecoins.find(token => token.baseToken === 'USDC');
      if (!usdcToken) {
        setWalletBalance('0.00');
        return;
      }

      // Try to get provider from connected wallet
      const connectedWallet = wallets.find(wallet => wallet.address === walletAddress);
      if (!connectedWallet) {
        setWalletBalance('0.00');
        return;
      }

      // Get Ethereum provider
      const provider = await connectedWallet.getEthereumProvider();
      if (!provider) {
        setWalletBalance('0.00');
        return;
      }

      const ethersProvider = new ethers.providers.Web3Provider(provider);
      
      // USDC contract ABI (minimal for balanceOf)
      const erc20ABI = [
        'function balanceOf(address owner) view returns (uint256)',
        'function decimals() view returns (uint8)'
      ];
      
      // Create contract instance
      const usdcContract = new ethers.Contract(usdcToken.address, erc20ABI, ethersProvider);
      
      // Fetch balance and decimals
      const [balance, decimals] = await Promise.all([
        usdcContract.balanceOf(walletAddress),
        usdcContract.decimals()
      ]);
      
      // Convert from wei to human readable
      const formattedBalance = ethers.utils.formatUnits(balance, decimals);
      setWalletBalance(parseFloat(formattedBalance).toFixed(2));
      
    } catch (error) {
      console.error('Failed to fetch USDC balance:', error);
      // Fallback to mock balance for demo
      const mockBalance = (Math.random() * 100 + 50).toFixed(2);
      setWalletBalance(mockBalance);
    }
  }, [walletAddress, authenticated, wallets]);
  
  // Fetch balance when wallet connects
  useEffect(() => {
    fetchWalletBalance();
  }, [fetchWalletBalance]);

  // Fetch real-time rate from Paycrest
  const fetchRate = useCallback(async (currency: string) => {
    if (!currency || currency === 'USDC') return;
    
    try {
      setIsLoadingRate(true);
      const rate = await fetchTokenRate('USDC', 1, currency);
      setCurrentRate(rate);
      
      // Update floating rates
      setFloatingRates(prev => ({
        ...prev,
        [currency]: {
          rate,
          timestamp: Date.now()
        }
      }));
    } catch (error) {
      console.error('Failed to fetch rate:', error);
      // Fallback to static rate
      setCurrentRate('2585.5');
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
        
        // Load initial floating rates for top currencies
        const topCurrencies = supportedCurrencies.slice(0, 6);
        for (const currency of topCurrencies) {
          try {
            const rate = await fetchTokenRate('USDC', 1, currency.code);
            setFloatingRates(prev => ({
              ...prev,
              [currency.code]: {
                rate,
                timestamp: Date.now()
              }
            }));
          } catch (error) {
            console.error(`Failed to load rate for ${currency.code}:`, error);
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

  // Initialize OnchainKit MiniKit (REQUIRED for proper Farcaster embedding)
  const { setFrameReady, isFrameReady } = useMiniKit();
  
  useEffect(() => {
    if (!isFrameReady) {
      setFrameReady();
    }
  }, [setFrameReady, isFrameReady]);

  const paymentDetails = calculatePaymentDetails();

  // Using imported executeUSDCTransaction from utils/wallet.ts

  const executePaycrestTransaction = useCallback(async (currency: 'local' | 'usdc', amount: string, recipient: any) => {
    if (!walletAddress || !authenticated) {
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
      
      // Execute the blockchain transaction
      const blockchainSuccess = await executeUSDCTransaction(paymentOrder.data.receiveAddress, parseFloat(usdcAmount));
      
      if (!blockchainSuccess) {
        throw new Error('Blockchain transaction failed');
      }
      
      console.log('Blockchain transaction completed successfully');
      
      return {
        success: true,
        orderId: paymentOrder.data?.id || 'unknown',
        paymentOrder: paymentOrder,
        amount: usdcAmount
      };
    } catch (error: any) {
      console.error('Paycrest transaction failed:', error);
      throw error;
    }
  }, [walletAddress, authenticated, currentRate]);

  const handleGeneratePaymentLink = useCallback(async () => {
    if (!linkAmount || !authenticated || !walletAddress) {
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
  }, [linkAmount, authenticated, walletAddress, selectedStablecoin, linkDescription]);

  const handleSendTransaction = useCallback(async () => {
    if (!amount || !phoneNumber) {
      alert('Please enter amount and phone number');
      return;
    }

    if (!walletAddress || !authenticated) {
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
        memo: `Send ${sendCurrency === 'local' ? amount + ' ' + selectedCountry.currency : amount + ' USDC'} to ${phoneNumber}`
      };
      
      // Execute Paycrest API transaction
      const result = await executePaycrestTransaction(sendCurrency, amount, recipient);
      
      // Transaction successful - show animated modal
      setSuccessData({
        orderId: result.orderId,
        hash: result.hash,
        amount: sendCurrency === 'local' ? `${amount} ${selectedCountry.currency}` : `${amount} USDC`,
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
  }, [amount, phoneNumber, walletAddress, authenticated, sendCurrency, selectedCountry.currency, selectedCountry.code, selectedInstitution, executePaycrestTransaction, fetchWalletBalance]);

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

    if (!walletAddress || !authenticated) {
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
        memo: `Pay ${payCurrency === 'local' ? amount + ' ' + selectedCountry.currency : amount + ' USDC'} to ${paymentType === 'bill' ? 'paybill ' + tillNumber + ' account ' + businessNumber : 'till ' + tillNumber}`
      };
      
      // Execute Paycrest API transaction
      const result = await executePaycrestTransaction(payCurrency, amount, recipient);
      
      // Transaction successful - show animated modal
      setSuccessData({
        orderId: result.orderId,
        hash: result.hash,
        amount: payCurrency === 'local' ? `${amount} ${selectedCountry.currency}` : `${amount} USDC`,
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
  }, [amount, tillNumber, businessNumber, paymentType, walletAddress, authenticated, payCurrency, selectedCountry.currency, selectedCountry.code, executePaycrestTransaction, fetchWalletBalance]);

  const renderSendTab = () => (
    <div className="space-y-3">
      {/* Country Selector */}
      <div className="relative">
        <select 
          value={selectedCountry.code}
          onChange={(e) => setSelectedCountry(countries.find(c => c.code === e.target.value) || countries[0])}
          className="w-full bg-slate-700 text-white rounded-lg px-3 py-2.5 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {countries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.flag} {country.name}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
      </div>

      {/* Send Money Button */}
      <button className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2.5 rounded-lg text-sm transition-colors">
        Send Money
      </button>

      {/* Mobile Money Provider */}
      <div>
        <label className="block text-sm text-gray-300 font-medium mb-1.5">Select Mobile Money Provider</label>
        <div className="relative">
          <select 
            value={selectedInstitution}
            onChange={(e) => setSelectedInstitution(e.target.value)}
            className="w-full bg-slate-800/50 border border-slate-700/50 text-white rounded-xl px-4 py-3 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-slate-700/50 transition-colors"
          >
            <option value="">Choose provider...</option>
            {institutions.map((institution) => (
              <option key={institution.code} value={institution.code}>
                {institution.name}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        </div>
      </div>

      {/* Phone Number */}
      <div>
        <label className="block text-xs text-gray-400 mb-1.5">Enter Telephone Number</label>
        <input
          type="text"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="089999"
          className="w-full bg-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Amount Input with Currency Switching */}
      <div>
        <div className="flex justify-between items-center mb-1.5">
          <label className="text-xs text-gray-400">Enter Amount</label>
          <div className="flex gap-2">
            <button 
              onClick={() => setSendCurrency('local')}
              className={`relative px-4 py-2 text-xs rounded-xl font-bold transition-all duration-300 ease-out overflow-hidden group ${
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
            
            <button 
              onClick={() => setSendCurrency('usdc')}
              className={`relative px-4 py-2 text-xs rounded-xl font-bold transition-all duration-300 ease-out overflow-hidden group flex items-center gap-2 ${
                sendCurrency === 'usdc' 
                  ? 'bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 text-white shadow-xl shadow-blue-500/30 transform scale-110 border-2 border-blue-400/50' 
                  : 'bg-slate-700/80 text-white hover:bg-slate-600/90 hover:scale-105 hover:shadow-lg border-2 border-transparent hover:border-blue-400/30 active:scale-95'
              }`}
            >
              {/* Animated background */}
              {sendCurrency === 'usdc' && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 animate-pulse" />
              )}
              
              {/* Hover glow */}
              <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                sendCurrency === 'usdc' 
                  ? 'opacity-100 bg-blue-400/10' 
                  : 'opacity-0 group-hover:opacity-100 bg-blue-400/5'
              }`} />
              
              <img src="/assets/logos/usdc-logo.png" alt="USDC" className={`w-4 h-4 relative z-10 transition-all duration-300 ${
                sendCurrency === 'usdc' ? 'drop-shadow-lg' : 'group-hover:scale-110'
              }`} />
              <span className={`relative z-10 transition-all duration-300 ${
                sendCurrency === 'usdc' ? 'drop-shadow-lg' : 'group-hover:tracking-wider'
              }`}>
                USDC
              </span>
              
              {/* Active indicator */}
              {sendCurrency === 'usdc' && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-bounce" />
              )}
            </button>
          </div>
        </div>
        <div className="bg-slate-700 rounded-lg px-3 py-3">
          <div className="flex items-center">
            <span className="text-sm text-gray-400 mr-2">
              {sendCurrency === 'local' ? selectedCountry.currency : 'USDC'}
            </span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={sendCurrency === 'local' ? '1000' : '1.5'}
              step={sendCurrency === 'local' ? '1' : '0.01'}
              className="bg-transparent text-white text-lg font-light flex-1 focus:outline-none"
            />
          </div>
        </div>
        
        {/* Currency Conversion Display */}
        {amount && (
          <div className="mt-2 text-center text-sm text-gray-400 font-medium">
            {sendCurrency === 'local' ? (
              <span>≈ {(parseFloat(amount) / parseFloat(currentRate)).toFixed(4)} USDC</span>
            ) : (
              <span>≈ {(parseFloat(amount) * parseFloat(currentRate)).toFixed(2)} {selectedCountry.currency}</span>
            )}
          </div>
        )}
      </div>

      {/* Payment Details */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-xs">You'll pay</span>
          <div className="flex items-center gap-1.5">
            <img src="/assets/logos/base-logo.jpg" alt="Base" className="w-4 h-4 rounded-full" />
            <span className="text-white text-sm">Base</span>
            <ChevronDownIcon className="w-3 h-3 text-gray-400" />
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-sm text-gray-400">
            Balance: <span className="text-blue-400 font-medium flex items-center gap-1">
              {walletBalance}
              <img src="/assets/logos/usdc-logo.png" alt="USDC" className="w-3 h-3" />
              USDC
            </span>
            <button className="ml-2 text-blue-500 text-xs hover:text-blue-400 transition-colors">Max</button>
          </div>
        </div>

        <div className="text-center text-xs text-gray-400">
          1 USDC = {isLoadingRate ? '...' : currentRate} {selectedCountry.currency} • Payment usually completes in 30s
        </div>

        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Total {selectedCountry.currency}</span>
            <span className="text-white">{paymentDetails.totalLocal} {selectedCountry.currency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Fees</span>
            <span className="text-white">{paymentDetails.fee} {selectedCountry.currency}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Amount in USDC</span>
            <span className="text-white">{paymentDetails.usdcAmount} USDC</span>
          </div>
        </div>
      </div>
      
      {/* Swipe to Send */}
      <div className="mt-6">
        <div className="relative bg-gradient-to-r from-green-600 to-emerald-600 rounded-full p-1 overflow-hidden">
          {/* Progress Background */}
          <div 
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-green-400 to-emerald-400 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${swipeProgress}%` }}
          />
          
          {/* Swipe Button */}
          <div className="relative flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                <ArrowUpIcon className="w-4 h-4 text-green-600" />
              </div>
              <span className="text-white font-medium text-sm">
                {isSwipeComplete ? '✅ Sending...' : 'Swipe to Send'}
              </span>
            </div>
            
            <div className="text-white text-sm font-medium">
              {sendCurrency === 'local' 
                ? `${amount || '0'} ${selectedCountry.currency}`
                : `${amount || '0'} USDC`
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
          Drag right to confirm send
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
                <span className="text-white font-semibold">{successData.amount}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400 text-xs">{successData.type === 'send' ? 'Recipient' : 'Till Number'}</span>
                <span className="text-white font-mono text-sm">{successData.recipient}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400 text-xs">Order ID</span>
                <span className="text-blue-400 font-mono text-xs">{successData.orderId.slice(0, 8)}...</span>
              </div>
            </div>

            {/* Blockchain Hash */}
            <div className="bg-gradient-to-r from-blue-900/30 to-purple-900/30 rounded-lg p-3 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                <span className="text-blue-400 text-xs font-medium">Blockchain Transaction</span>
              </div>
              <p className="text-gray-300 font-mono text-xs break-all">
                {successData.hash.slice(0, 20)}...{successData.hash.slice(-10)}
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
                navigator.clipboard.writeText(successData.hash);
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
            <img src="/assets/logos/usdc-logo.png" alt="USDC" className="w-4 h-4" />
            <span className="text-white text-sm font-medium">USDC</span>
          </div>
          <ChevronDownIcon className="w-4 h-4 text-gray-400" />
        </div>
      </div>

      {/* Country Selector */}
      <div className="relative">
        <button
          onClick={() => setIsCountryDropdownOpen(!isCountryDropdownOpen)}
          className="w-full bg-slate-800/50 border border-slate-700/50 text-white rounded-xl px-4 py-4 text-left flex items-center justify-between hover:bg-slate-700/50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{selectedCountry.flag}</span>
            <span className="text-white font-medium text-lg">{selectedCountry.name}</span>
          </div>
          <ChevronDownIcon className={`w-5 h-5 text-gray-400 transition-transform ${
            isCountryDropdownOpen ? 'rotate-180' : ''
          }`} />
        </button>
        
        {/* Dropdown Menu */}
        {isCountryDropdownOpen && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
            {countries.map((country) => (
              <button
                key={country.code}
                onClick={() => {
                  setSelectedCountry(country);
                  setIsCountryDropdownOpen(false);
                }}
                className={`w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-700 transition-colors ${
                  selectedCountry.code === country.code ? 'bg-blue-600/20' : ''
                }`}
              >
                <span className="text-2xl">{country.flag}</span>
                <span className="text-white font-medium">{country.name}</span>
                {selectedCountry.code === country.code && (
                  <div className="ml-auto w-2 h-2 bg-blue-500 rounded-full"></div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Payment Type Buttons */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setPaymentType('goods')}
          className={`relative py-4 px-4 rounded-2xl text-sm font-bold transition-all duration-300 ease-out border-2 overflow-hidden group ${
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
          className={`relative py-4 px-4 rounded-2xl text-sm font-bold transition-all duration-300 ease-out border-2 overflow-hidden group ${
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
        
        <button
          onClick={() => setPaymentType('send')}
          className={`relative py-4 px-4 rounded-2xl text-sm font-bold transition-all duration-300 ease-out border-2 overflow-hidden group ${
            paymentType === 'send' 
              ? 'bg-gradient-to-br from-purple-500 via-pink-600 to-rose-700 text-white border-purple-400/60 shadow-2xl shadow-purple-500/40 transform scale-105' 
              : 'bg-slate-800/80 text-white hover:bg-slate-700/90 border-slate-600/50 hover:border-purple-500/30 hover:scale-102 hover:shadow-xl hover:shadow-purple-500/10 active:scale-95'
          }`}
        >
          {/* Animated background */}
          {paymentType === 'send' && (
            <div className="absolute inset-0 bg-gradient-to-r from-purple-400/20 to-pink-400/20 animate-pulse" />
          )}
          
          {/* Hover glow */}
          <div className={`absolute inset-0 rounded-2xl transition-all duration-300 ${
            paymentType === 'send' 
              ? 'opacity-100 bg-purple-400/10' 
              : 'opacity-0 group-hover:opacity-100 bg-purple-400/5'
          }`} />
          
          <span className={`relative z-10 transition-all duration-300 ${
            paymentType === 'send' ? 'drop-shadow-lg' : 'group-hover:tracking-wide'
          }`}>
            💸 Send Money
          </span>
          
          {/* Active pulse indicator */}
          {paymentType === 'send' && (
            <div className="absolute top-2 right-2 w-2 h-2 bg-purple-300 rounded-full animate-ping" />
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
                className="w-full bg-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full bg-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </>
      ) : (
        /* Till Number for Buy Goods and Send Money */
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
              className="w-full bg-slate-700 text-white rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            
            <button 
              onClick={() => setPayCurrency('usdc')}
              className={`relative px-4 py-2 text-xs rounded-xl font-bold transition-all duration-300 ease-out overflow-hidden group flex items-center gap-2 ${
                payCurrency === 'usdc' 
                  ? 'bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 text-white shadow-xl shadow-blue-500/30 transform scale-110 border-2 border-blue-400/50' 
                  : 'bg-slate-700/80 text-white hover:bg-slate-600/90 hover:scale-105 hover:shadow-lg border-2 border-transparent hover:border-blue-400/30 active:scale-95'
              }`}
            >
              {/* Animated background */}
              {payCurrency === 'usdc' && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 animate-pulse" />
              )}
              
              {/* Hover glow */}
              <div className={`absolute inset-0 rounded-xl transition-all duration-300 ${
                payCurrency === 'usdc' 
                  ? 'opacity-100 bg-blue-400/10' 
                  : 'opacity-0 group-hover:opacity-100 bg-blue-400/5'
              }`} />
              
              <img src="/assets/logos/usdc-logo.png" alt="USDC" className={`w-4 h-4 relative z-10 transition-all duration-300 ${
                payCurrency === 'usdc' ? 'drop-shadow-lg' : 'group-hover:scale-110'
              }`} />
              <span className={`relative z-10 transition-all duration-300 ${
                payCurrency === 'usdc' ? 'drop-shadow-lg' : 'group-hover:tracking-wider'
              }`}>
                USDC
              </span>
              
              {/* Active indicator */}
              {payCurrency === 'usdc' && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-400 rounded-full animate-bounce" />
              )}
            </button>
          </div>
        </div>
        <div className="bg-slate-700 rounded-lg px-3 py-3">
          <div className="flex items-center">
            <span className="text-sm text-gray-400 mr-2">
              {payCurrency === 'local' ? selectedCountry.currency : 'USDC'}
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
              <ChevronDownIcon className="w-4 h-4 text-gray-400" />
            </div>
          </div>
          
          <div className="text-right mb-2">
            <div className="text-sm text-gray-400">
              Balance: <span className="text-blue-400 font-medium flex items-center gap-1">
                {walletBalance}
                <img src="/assets/logos/usdc-logo.png" alt="USDC" className="w-3 h-3" />
                USDC
              </span>
              <button className="ml-2 text-blue-500 text-xs hover:text-blue-400 transition-colors">Max</button>
            </div>
          </div>

          <div className="text-center text-xs text-gray-400 mb-4">
            1 USDC = {isLoadingRate ? '...' : currentRate} {selectedCountry.currency} • Payment usually completes in 30s
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
            <span className="text-gray-400">Amount in USDC</span>
            <span className="text-white">{paymentDetails.usdcAmount} USDC</span>
          </div>
        </div>
      </div>

      {/* Swipe to Pay */}
      <div className="mt-6">
        <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 rounded-full p-1 overflow-hidden">
          {/* Progress Background */}
          <div 
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-blue-400 to-purple-400 rounded-full transition-all duration-300 ease-out"
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
                : `${amount || '0'} USDC`
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
          onChange={(e) => setSelectedCountry(countries.find(c => c.code === e.target.value) || countries[0])}
          className="w-full bg-slate-700 text-white rounded-lg px-3 py-2.5 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {countries.map((country) => (
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
              💰 {token.baseToken} - {token.name}
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
        authenticated 
          ? 'bg-green-600/20 border-green-600/30' 
          : 'bg-yellow-600/20 border-yellow-600/30'
      }`}>
        <div className={`flex items-center gap-2 ${
          authenticated ? 'text-green-400' : 'text-yellow-400'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            authenticated ? 'bg-green-400' : 'bg-yellow-400'
          }`}></span>
          <span className="text-xs font-medium">
            {authenticated 
              ? `✅ Wallet Connected - Ready to Generate Links` 
              : `⚠️ Connect Wallet to Generate Links`
            }
          </span>
        </div>
        {authenticated && walletAddress && (
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
            className="w-full bg-white text-gray-900 rounded-lg px-3 py-2 pr-8 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {stablecoins.map((token) => (
              <option key={token.baseToken} value={token.baseToken}>
                {token.baseToken} - {token.name}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-600" />
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
          className="w-full bg-white text-gray-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Generate Link Button */}
      <button 
        onClick={authenticated ? handleGeneratePaymentLink : login}
        disabled={!authenticated || !linkAmount}
        className={`w-full font-medium py-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 text-sm ${
          authenticated && linkAmount
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white transform hover:scale-105 shadow-lg' 
            : 'bg-gray-600 text-gray-300 cursor-not-allowed'
        }`}
      >
        {authenticated ? (
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
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-3">
      <div className="max-w-sm mx-auto">
        {/* Top Header with Wallet */}
        <div className="flex items-center justify-between mb-6">
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
          
          {/* Wallet Button */}
          {!authenticated ? (
            <button
              onClick={login}
              className="relative w-12 h-12 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 hover:from-blue-500 hover:via-purple-500 hover:to-indigo-600 rounded-xl transition-all duration-300 ease-out flex items-center justify-center shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 border-2 border-blue-400/30 hover:border-blue-300/50 group overflow-hidden"
            >
              {/* Animated background */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-purple-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              
              {/* Pulse effect */}
              <div className="absolute inset-0 bg-blue-400/20 rounded-xl animate-ping opacity-75" />
              
              <WalletIcon className="w-6 h-6 text-white relative z-10 drop-shadow-lg" />
            </button>
          ) : (
            <div className="flex items-center gap-3">
              {/* Wallet Status Indicator */}
              <div className="flex items-center gap-2 bg-slate-800/60 backdrop-blur-sm rounded-xl px-3 py-2 border border-green-500/30">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-green-400 text-xs font-medium">Connected</span>
                <span className="text-gray-400 text-xs font-mono">
                  {walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-3)}` : '...'}
                </span>
              </div>
              
              {/* Wallet Menu Button */}
              <button
                onClick={logout}
                className="relative w-12 h-12 bg-gradient-to-br from-green-600 via-emerald-600 to-teal-700 hover:from-green-500 hover:via-emerald-500 hover:to-teal-600 rounded-xl transition-all duration-300 ease-out flex items-center justify-center shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 border-2 border-green-400/30 hover:border-green-300/50 group overflow-hidden"
              >
                {/* Animated background */}
                <div className="absolute inset-0 bg-gradient-to-r from-green-400/20 to-emerald-400/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                
                <WalletIcon className="w-6 h-6 text-white relative z-10 drop-shadow-lg" />
              </button>
            </div>
          )}
        </div>

        {/* Floating Rates Ticker */}
        <div className="mb-4 relative overflow-hidden bg-gradient-to-r from-purple-900/20 via-blue-900/20 to-indigo-900/20 backdrop-blur-sm rounded-xl py-2">
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
        <div className="bg-slate-900/90 rounded-2xl p-2 mb-4 border border-slate-700/50 shadow-2xl">
          <div className="grid grid-cols-4 gap-2">
            {[
              { key: 'send' as Tab, label: 'Send', icon: ArrowUpIcon },
              { key: 'pay' as Tab, label: 'Pay', icon: CurrencyDollarIcon },
              { key: 'deposit' as Tab, label: 'Deposit', icon: ArrowDownIcon },
              { key: 'link' as Tab, label: 'Link', icon: LinkIcon }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`relative py-4 px-3 rounded-xl text-sm font-bold transition-all duration-300 ease-out flex items-center justify-center gap-2 overflow-hidden group ${
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
        <div className="bg-gray-800 rounded-2xl p-4">
          {renderTabContent()}
        </div>
      </div>
      
      {/* Success Modal */}
      <SuccessModal />
    </div>
  );
}

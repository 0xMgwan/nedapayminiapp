"use client";

import { useMiniKit } from '@coinbase/onchainkit/minikit';
import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { stablecoins } from '../data/stablecoins';
import { 
  ArrowUpIcon, 
  ArrowDownIcon, 
  LinkIcon, 
  CreditCardIcon,
  ArrowsRightLeftIcon,
  PlusIcon,
  MinusIcon,
  ChevronDownIcon,
  CheckIcon
} from '@heroicons/react/24/outline';

type TabType = 'pay' | 'withdraw' | 'deposit' | 'swap';

export default function FarcasterMiniApp() {
  const { setFrameReady, isFrameReady } = useMiniKit();
  const { authenticated, login } = usePrivy();
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('pay');
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState(stablecoins[stablecoins.length - 1]); // USDC
  const [selectedCountry, setSelectedCountry] = useState('');
  const [showTokenSelector, setShowTokenSelector] = useState(false);
  const [showCountrySelector, setShowCountrySelector] = useState(false);
  const [recipient, setRecipient] = useState('');
  const [description, setDescription] = useState('');
  const [fromToken, setFromToken] = useState(stablecoins[stablecoins.length - 1]);
  const [toToken, setToToken] = useState(stablecoins[1]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !isFrameReady) {
      setFrameReady();
    }
  }, [mounted, isFrameReady, setFrameReady]);

  const quickAmounts = [100, 300, 500];
  const countries = [...new Set(stablecoins.map(coin => coin.region))];

  const handleQuickAmount = (value: number) => {
    setAmount(value.toString());
  };

  const handleTransaction = async () => {
    if (!authenticated) {
      await login();
      return;
    }

    try {
      const endpoint = activeTab === 'pay' ? '/api/payment-links' : `/api/${activeTab}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          token: selectedToken.baseToken,
          recipient,
          description,
          country: selectedCountry,
          fromToken: fromToken.baseToken,
          toToken: toToken.baseToken
        }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`${activeTab} transaction initiated successfully!`);
      }
    } catch (error) {
      console.error(`Error with ${activeTab}:`, error);
    }
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white font-['Inter',sans-serif]">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-4 border-b border-gray-700">
        <div className="text-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Spend Crypto in Africa
          </h1>
          <p className="text-gray-400 text-sm mt-1">Anytime, Anywhere</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex bg-gray-800 border-b border-gray-700">
        {[
          { id: 'pay', label: 'Pay', icon: CreditCardIcon },
          { id: 'withdraw', label: 'Withdraw', icon: ArrowUpIcon },
          { id: 'deposit', label: 'Deposit', icon: ArrowDownIcon },
          { id: 'swap', label: 'Swap', icon: ArrowsRightLeftIcon }
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as TabType)}
            className={`flex-1 flex items-center justify-center py-4 px-2 text-sm font-medium transition-all duration-200 ${
              activeTab === id
                ? 'text-white bg-gray-700 border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-white hover:bg-gray-750'
            }`}
          >
            <Icon className="w-4 h-4 mr-2" />
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-6">
        {/* Pay Tab */}
        {activeTab === 'pay' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Pay</h2>
              <div className="relative">
                <button
                  onClick={() => setShowCountrySelector(!showCountrySelector)}
                  className="flex items-center justify-between w-full bg-gray-800 rounded-xl p-4 border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  <span className="text-gray-300">
                    {selectedCountry || 'Select Country'}
                  </span>
                  <ChevronDownIcon className="w-5 h-5 text-gray-400" />
                </button>
                
                {showCountrySelector && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto">
                    {countries.map((country) => {
                      const coin = stablecoins.find(c => c.region === country);
                      return (
                        <button
                          key={country}
                          onClick={() => {
                            setSelectedCountry(country);
                            setShowCountrySelector(false);
                            if (coin) setSelectedToken(coin);
                          }}
                          className="w-full text-left p-3 hover:bg-gray-700 transition-colors flex items-center"
                        >
                          <span className="mr-3">{coin?.flag}</span>
                          <span>{country}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Amount Input */}
            <div className="text-center">
              <div className="text-4xl font-bold mb-4">
                <span className="text-gray-400">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1"
                  className="bg-transparent text-white text-4xl font-bold w-32 text-center border-none outline-none"
                />
              </div>
              
              {/* Token Selector */}
              <button
                onClick={() => setShowTokenSelector(!showTokenSelector)}
                className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-full transition-colors flex items-center mx-auto"
              >
                <span className="mr-2">{selectedToken.flag}</span>
                <span className="font-medium">{selectedToken.baseToken}</span>
                <ChevronDownIcon className="w-4 h-4 ml-2" />
              </button>

              {showTokenSelector && (
                <div className="mt-4 bg-gray-800 border border-gray-700 rounded-xl p-2 max-h-48 overflow-y-auto">
                  {stablecoins.map((token) => (
                    <button
                      key={token.baseToken}
                      onClick={() => {
                        setSelectedToken(token);
                        setShowTokenSelector(false);
                      }}
                      className="w-full text-left p-3 hover:bg-gray-700 rounded-lg transition-colors flex items-center justify-between"
                    >
                      <div className="flex items-center">
                        <span className="mr-3">{token.flag}</span>
                        <div>
                          <div className="font-medium">{token.baseToken}</div>
                          <div className="text-sm text-gray-400">{token.name}</div>
                        </div>
                      </div>
                      {selectedToken.baseToken === token.baseToken && (
                        <CheckIcon className="w-5 h-5 text-blue-500" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Quick Amount Buttons */}
              <div className="flex justify-center space-x-4 mt-6">
                {quickAmounts.map((value) => (
                  <button
                    key={value}
                    onClick={() => handleQuickAmount(value)}
                    className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    ${value}
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient Input */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Recipient Address
              </label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="0x... or ENS name"
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none transition-colors"
              />
            </div>

            <div className="text-center text-sm text-gray-400">
              Select country and token
            </div>
          </div>
        )}

        {/* Withdraw Tab */}
        {activeTab === 'withdraw' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4">Withdraw</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">From</span>
                  <div className="flex items-center">
                    <span className="mr-2">{selectedToken.flag}</span>
                    <span className="font-medium">{selectedToken.baseToken}</span>
                    <span className="text-gray-400 ml-2">Balance: 0.00</span>
                  </div>
                </div>
                
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white text-right text-2xl font-bold focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="text-center">
              <button className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-full transition-colors">
                Max
              </button>
            </div>
          </div>
        )}

        {/* Deposit Tab */}
        {activeTab === 'deposit' && (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-4">You're buying</h2>
              <div className="relative">
                <button
                  onClick={() => setShowCountrySelector(!showCountrySelector)}
                  className="flex items-center justify-between w-full bg-gray-800 rounded-xl p-4 border border-gray-700"
                >
                  <span className="text-gray-300">
                    {selectedCountry || 'Select Country'}
                  </span>
                  <ChevronDownIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="text-center">
              <div className="text-4xl font-bold mb-4">
                <span className="text-gray-400">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1"
                  className="bg-transparent text-white text-4xl font-bold w-32 text-center border-none outline-none"
                />
              </div>
              
              <button className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-full transition-colors">
                Select a token ▼
              </button>

              <div className="flex justify-center space-x-4 mt-6">
                {quickAmounts.map((value) => (
                  <button
                    key={value}
                    onClick={() => handleQuickAmount(value)}
                    className="bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition-colors"
                  >
                    ${value}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-center text-sm text-gray-400">
              Select country and token
            </div>
          </div>
        )}

        {/* Swap Tab */}
        {activeTab === 'swap' && (
          <div className="space-y-6">
            <div className="bg-gray-800 rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4">Swap</h3>
              
              {/* From Token */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">From</span>
                  <div className="flex items-center">
                    <span className="mr-2">{fromToken.flag}</span>
                    <span className="font-medium">{fromToken.baseToken}</span>
                    <span className="text-gray-400 ml-2">Balance: 0.00</span>
                    <button className="text-blue-400 ml-2 text-sm">Max</button>
                  </div>
                </div>
                
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="1"
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white text-right text-2xl font-bold focus:border-blue-500 focus:outline-none"
                />
              </div>
              
              {/* Swap Arrow */}
              <div className="flex justify-center my-4">
                <button className="bg-gray-700 hover:bg-gray-600 p-3 rounded-xl transition-colors">
                  <ArrowsRightLeftIcon className="w-5 h-5 rotate-90" />
                </button>
              </div>
              
              {/* To Token */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-300">To</span>
                  <div className="flex items-center">
                    <span className="mr-2">{toToken.flag}</span>
                    <span className="font-medium">{toToken.baseToken}</span>
                  </div>
                </div>
                
                <div className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-right text-2xl font-bold text-gray-400">
                  0.00
                </div>
              </div>
            </div>

            <button
              onClick={handleTransaction}
              disabled={!isFrameReady || !amount}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-400 py-4 rounded-xl font-semibold text-lg transition-colors"
            >
              SWAP
            </button>
          </div>
        )}

        {/* Action Button */}
        {activeTab !== 'swap' && (
          <button
            onClick={handleTransaction}
            disabled={!isFrameReady || !amount}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-400 py-4 rounded-xl font-semibold text-lg transition-colors"
          >
            {authenticated ? activeTab.toUpperCase() : 'CONNECT WALLET'}
          </button>
        )}

        {/* Status */}
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">MiniKit Status</span>
            <span className={isFrameReady ? 'text-green-400' : 'text-yellow-400'}>
              {isFrameReady ? '● Ready' : '● Loading'}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-gray-400">Wallet</span>
            <span className={authenticated ? 'text-green-400' : 'text-red-400'}>
              {authenticated ? '● Connected' : '● Disconnected'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

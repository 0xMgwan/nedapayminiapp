"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { stablecoins } from "../data/stablecoins";
import { ethers } from 'ethers';
import QRCode from 'qrcode';

interface PaymentData {
  id: string;
  amount: string;
  token: string;
  description?: string;
  merchant: string;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

export default function PaymentRequestPage() {
  const searchParams = useSearchParams();
  const { authenticated, login, user } = usePrivy();
  const { wallets } = useWallets();
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [transactionHash, setTransactionHash] = useState("");
  const [isFrameReady, setIsFrameReady] = useState(false);

  const connectedWallet = wallets.find(wallet => wallet.connectorType !== 'embedded') || wallets[0];
  const walletAddress = connectedWallet?.address;

  // Initialize frame detection
  useEffect(() => {
    const checkFrameEnvironment = () => {
      try {
        const isInFrame = window.self !== window.top;
        const userAgent = navigator.userAgent;
        const isFarcasterFrame = userAgent.includes('farcaster') || 
                               window.location !== window.parent.location ||
                               document.referrer.includes('farcaster') ||
                               document.referrer.includes('warpcast');
        
        setIsFrameReady(isInFrame || isFarcasterFrame);
        console.log('Frame environment detected:', { isInFrame, isFarcasterFrame, userAgent });
      } catch (error) {
        console.log('Frame detection error:', error);
        setIsFrameReady(true);
      }
    };

    checkFrameEnvironment();
  }, []);

  useEffect(() => {
    const loadPaymentData = () => {
      const id = searchParams.get('id');
      const amount = searchParams.get('amount');
      const token = searchParams.get('token');
      const description = searchParams.get('description');
      const merchant = searchParams.get('merchant');

      if (id && amount && token && merchant) {
        const data: PaymentData = {
          id,
          amount,
          token,
          description: description || '',
          merchant,
          createdAt: new Date().toISOString(),
          status: 'pending' as const
        };
        setPaymentData(data);
        
        const tokenAddress = getTokenAddress(token);
        const amountInWei = (parseFloat(amount) * 1e6).toString();
        
        let qrData = `ethereum:${tokenAddress}@8453/transfer?address=${merchant}&uint256=${amountInWei}`;
        
        if (!qrData || qrData.length > 500) {
          const currentUrl = window.location.origin;
          qrData = `${currentUrl}/payment-request?id=${id}&amount=${amount}&token=${token}&merchant=${merchant}&description=${encodeURIComponent(description || '')}`;
        }
        
        console.log('Generated QR data:', qrData);
        generateQRCode(qrData);
      }
      setIsLoading(false);
    };

    loadPaymentData();
  }, [searchParams]);

  const generateQRCode = async (data: string) => {
    try {
      const qrDataUrl = await QRCode.toDataURL(data, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });
      
      setQrCode(qrDataUrl);
    } catch (error) {
      console.error('Failed to generate QR code:', error);
      setQrCode('');
    }
  };

  const getTokenAddress = (token: string) => {
    const stablecoin = stablecoins.find(s => s.baseToken === token);
    return stablecoin?.address || "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
  };

  const executeUSDCTransaction = async (toAddress: string, amount: number, description?: string): Promise<boolean> => {
    if (!walletAddress || !authenticated || !connectedWallet) {
      throw new Error('Wallet not connected');
    }

    try {
      const provider = await connectedWallet.getEthereumProvider();
      if (!provider) {
        throw new Error('No provider available');
      }

      const ethersProvider = new ethers.providers.Web3Provider(provider);
      const signer = ethersProvider.getSigner();

      const erc20ABI = [
        'function transfer(address to, uint256 amount) returns (bool)',
        'function balanceOf(address owner) view returns (uint256)',
        'function decimals() view returns (uint8)'
      ];

      const usdcContract = new ethers.Contract(getTokenAddress('USDC'), erc20ABI, signer);
      const amountInWei = ethers.utils.parseUnits(amount.toString(), 6);

      const balance = await usdcContract.balanceOf(walletAddress);
      if (balance.lt(amountInWei)) {
        throw new Error('Insufficient USDC balance');
      }

      const tx = await usdcContract.transfer(toAddress, amountInWei);
      const receipt = await tx.wait();
      
      console.log('USDC transfer successful:', {
        hash: receipt.transactionHash,
        to: toAddress,
        amount: amount,
        description: description
      });
      
      setTransactionHash(receipt.transactionHash);
      return receipt.status === 1;
    } catch (error: any) {
      console.error('Transaction failed:', error);
      throw error;
    }
  };

  const handlePayment = async () => {
    if (!authenticated) {
      login();
      return;
    }

    if (!paymentData || !walletAddress) {
      alert('Missing payment data or wallet not connected');
      return;
    }

    setIsProcessing(true);
    try {
      const amount = parseFloat(paymentData.amount);
      const result = await executeUSDCTransaction(
        paymentData.merchant,
        amount,
        paymentData.description
      );

      if (result) {
        const updatedData = { ...paymentData, status: 'completed' as const };
        localStorage.setItem(`payment-${paymentData.id}`, JSON.stringify(updatedData));
        setPaymentData(updatedData);
        setShowSuccessModal(true);
      } else {
        alert('❌ Payment failed. Please try again.');
      }
    } catch (error) {
      console.error('Payment error:', error);
      alert('❌ Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const copyAddress = () => {
    if (paymentData?.merchant) {
      navigator.clipboard.writeText(paymentData.merchant);
      alert('Address copied to clipboard!');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const SuccessModal = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-800/90 backdrop-blur-xl rounded-2xl shadow-2xl p-8 max-w-sm w-full border border-slate-700/50">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-2">Payment Successful!</h2>
          <p className="text-gray-400 mb-6">Your transaction has been confirmed on the blockchain.</p>
          
          <div className="bg-slate-700/50 rounded-xl p-4 mb-6 text-left">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Amount:</span>
                <div className="flex items-center gap-1">
                  <span className="text-white font-medium">{paymentData?.amount}</span>
                  <img 
                    src="/assets/logos/usdc-logo.png" 
                    alt="USDC" 
                    className="w-4 h-4"
                  />
                  <span className="text-white font-medium">{paymentData?.token}</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">To:</span>
                <span className="text-white font-mono text-xs">
                  {paymentData?.merchant.slice(0, 6)}...{paymentData?.merchant.slice(-4)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Network:</span>
                <div className="flex items-center gap-1">
                  <img 
                    src="/assets/logos/base-logo.jpg" 
                    alt="Base Network" 
                    className="w-4 h-4"
                  />
                  <span className="text-white text-xs">Base</span>
                </div>
              </div>
              {transactionHash && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Tx Hash:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-white font-mono text-xs">
                      {transactionHash.slice(0, 6)}...{transactionHash.slice(-4)}
                    </span>
                    <button
                      onClick={() => copyToClipboard(transactionHash)}
                      className="p-1 hover:bg-slate-600/50 rounded transition-colors"
                    >
                      <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <button
            onClick={() => setShowSuccessModal(false)}
            className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-semibold py-3 rounded-xl transition-all duration-200 transform hover:scale-105"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading payment request...</p>
        </div>
      </div>
    );
  }

  if (!paymentData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-2xl w-full max-w-sm p-6 text-center">
          <div className="text-red-400 mb-4">
            <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Payment Request Not Found</h1>
          <p className="text-gray-400 text-sm mb-4">This payment link may be invalid or expired.</p>
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-2xl w-full max-w-sm p-6">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-white mb-1">Payment Request</h1>
        </div>

        <div className="text-center mb-4">
          <div className="text-xs text-gray-400 mb-1">Amount</div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="text-2xl font-bold text-white">
              {paymentData.amount} {paymentData.token}
            </div>
            <img 
              src="/assets/logos/usdc-logo.png" 
              alt="USDC" 
              className="w-6 h-6"
            />
          </div>
          <div className="flex items-center justify-center gap-1 text-xs text-gray-400">
            <img 
              src="/assets/logos/base-logo.jpg" 
              alt="Base Network" 
              className="w-4 h-4"
            />
            <span>on Base Network</span>
          </div>
        </div>

        {paymentData.description && (
          <div className="text-center mb-4">
            <div className="text-xs text-gray-400 mb-1">Description</div>
            <div className="text-sm text-white">{paymentData.description}</div>
          </div>
        )}

        <div className="bg-slate-700/30 rounded-lg p-3 mb-4 border border-slate-600/30">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="text-xs font-medium text-white">Merchant Wallet</div>
              <div className="text-xs text-gray-400 font-mono">
                {paymentData.merchant.slice(0, 6)}...{paymentData.merchant.slice(-6)}
              </div>
            </div>
            <button 
              onClick={copyAddress}
              className="p-1 hover:bg-slate-600/50 rounded-lg transition-colors"
            >
              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="text-center mb-4">
          <div className="flex items-center justify-center gap-1 mb-3">
            <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1z" clipRule="evenodd" />
              <path d="M11 4a1 1 0 10-2 0v1a1 1 0 002 0V4zM10 7a1 1 0 011 1v1h2a1 1 0 110 2h-3a1 1 0 01-1-1V8a1 1 0 01-1-1zM16 10a1 1 0 100-2H15a1 1 0 100 2h1zM9 15a1 1 0 011-1h1a1 1 0 110 2v2a1 1 0 11-2 0v-3zM7 13a1 1 0 00-1 1v2a1 1 0 002 0v-2a1 1 0 00-1-1zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zM17 13a1 1 0 00-1 1v2a1 1 0 002 0v-2a1 1 0 00-1-1zM16 15a1 1 0 100-2h-3a1 1 0 100 2h3z" />
            </svg>
            <span className="text-blue-400 text-sm font-medium">Scan to Pay</span>
          </div>
          
          <div className="bg-slate-700/30 rounded-lg p-4 mb-3 border border-slate-600/30">
            <div className="w-32 h-32 mx-auto bg-white rounded-lg flex items-center justify-center p-2">
              {qrCode ? (
                <img 
                  src={qrCode} 
                  alt="Payment QR Code" 
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center">
                  <svg className="w-16 h-16 text-gray-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  <p className="text-sm text-gray-500">Loading QR Code...</p>
                </div>
              )}
            </div>
          </div>
          
          <p className="text-xs text-gray-400">Scan with wallet app</p>
        </div>

        <button
          onClick={handlePayment}
          disabled={isProcessing || paymentData.status === 'completed'}
          className={`w-full py-3 rounded-lg font-medium transition-all duration-200 text-sm ${
            isProcessing 
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
              : paymentData.status === 'completed'
              ? 'bg-green-600 text-white'
              : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white transform hover:scale-105 shadow-lg'
          }`}
        >
          {isProcessing ? (
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              <span className="text-white">Processing...</span>
            </div>
          ) : paymentData.status === 'completed' ? (
            '✅ Payment Completed'
          ) : authenticated ? (
            'Pay with Wallet'
          ) : (
            'Connect Wallet to Pay'
          )}
        </button>

        {authenticated && paymentData.status === 'pending' && (
          <div className="mt-4 p-3 bg-blue-600/20 border border-blue-600/30 rounded-lg">
            <p className="text-xs text-blue-300 text-center">
              Send exactly <strong className="text-white">{paymentData.amount} {paymentData.token}</strong> to complete payment.
              <br />
              <span className="text-blue-400">Transaction confirmation will appear automatically.</span>
            </p>
          </div>
        )}
      </div>
      
      {showSuccessModal && <SuccessModal />}
    </div>
  );
}

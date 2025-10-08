"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import dynamic from "next/dynamic";
import { stablecoins } from "../../data/stablecoins";
import { utils } from "ethers";
import { Toaster, toast } from 'react-hot-toast';
import { pad, numberToHex, parseUnits, encodeFunctionData } from "viem";
import { useTranslation } from "react-i18next";
import "../../../lib/i18n";
import { createBaseAccountSDK, getCryptoKeyAccount, base } from '@base-org/account';

const WalletConnectButton = dynamic(() => import("./WalletConnectButton"), {
  ssr: false,
});

function isMobile() {
  if (typeof window === "undefined") return false;
  return /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

// Detect if we're in Farcaster environment
function isFarcasterEnvironment() {
  if (typeof window === "undefined") return false;
  return window.location.href.includes('warpcast.com') || 
         window.navigator.userAgent.includes('Warpcast') ||
         window.navigator.userAgent.includes('farcaster') ||
         (window as any).farcaster !== undefined;
}

// Detect if we're in Base app environment
function isBaseAppEnvironment() {
  if (typeof window === "undefined") return false;
  return window.navigator.userAgent.includes('Base') ||
         window.location.href.includes('base.org') ||
         (window as any).base !== undefined;
}

// Detect if we're in a wallet app environment
function isWalletAppEnvironment() {
  if (typeof window === "undefined") return false;
  return window.navigator.userAgent.includes('MetaMask') ||
         window.navigator.userAgent.includes('Coinbase') ||
         window.navigator.userAgent.includes('Rainbow') ||
         window.navigator.userAgent.includes('Trust') ||
         isFarcasterEnvironment() ||
         isBaseAppEnvironment();
}

export default function PayWithWallet({
  to,
  amount,
  currency,
  description,
  linkId
}: {
  to: string;
  amount: string;
  currency: string;
  description?: string;
  linkId: string;
}) {
  const { t, i18n } = useTranslation();
  
  // Set language from localStorage on component mount
  useEffect(() => {
    const savedLanguage = localStorage.getItem('language') || 'en';
    if (i18n.language !== savedLanguage) {
      i18n.changeLanguage(savedLanguage);
    }
  }, [i18n]);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<
    "idle" | "preparing" | "submitting" | "pending" | "confirming" | "confirmed" | "failed"
  >("idle");

  // Function to save a new transaction (Pending)
  const saveTransactionToDB = async (
    merchantId: string,
    wallet: string,
    amount: string,
    currency: string,
    description: string | undefined,
    status: "Pending" | "Completed",
    txHash: string
  ) => {
    try {
      const response = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          merchantId,
          wallet: wallet,
          amount,
          currency,
          description: description || undefined,
          status,
          txHash,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to save transaction:", errorData);
        return false;
      }
      return true;
    } catch (dbError) {
      console.error("Error saving transaction to database:", dbError);
      return false;
    }
  };

// Function to update invoice status to paid
const updateInvoiceToPaid = async (linkId: string) => {
  try {
    const response = await fetch(`/api/send-invoice/invoices/`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        linkId,
        paidAt: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Failed to update invoice:", errorData);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Error updating invoice:", error);
    return false;
  }
};

// function to create notification
const createNotification = async (
  transactionId: string,
  merchantId: string,
  amount: string,
  currency: string,
  description: string | undefined
) => {
  try {
    const message = description
      ? `Payment received: ${amount} ${currency} for ${description}`
      : `Payment received: ${amount} ${currency}`;

    const response = await fetch("/api/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message,
        recipient: merchantId,
        type: "payment_received",
        status: "unseen",
        relatedTransactionId: transactionId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      // console.error("Failed to create notification:", errorData);
      return false;
    }
    return true;
  } catch (error) {
    // console.error("Error creating notification:", error);
    return false;
  }
};

  // Function to update transaction status to Completed
  const updateTransactionStatus = async (
    txHash: string,
    merchantId: string,
    walletAddress: string,
    amount: string,
    currency: string,
    description: string | undefined,
  ) => {
    try {
      const response = await fetch(`/api/transactions?txHash=${txHash}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          merchantId,
          wallet: walletAddress,
          amount,
          currency,
          description: description || undefined,
          status: "Completed",
        }),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to update transaction:", errorData);
        return false;
      }
  
      // Get the updated transaction to get its ID for notification
      const updatedTransaction = await response.json();
      
      // Create notification after successful transaction update
      if (updatedTransaction) {
        await createNotification(
          updatedTransaction.id,
          merchantId,
          amount,
          currency,
          description
        );
      }

      // Update invoice to paid status
      await updateInvoiceToPaid(linkId);
  
      return true;
    } catch (dbError) {
      console.error("Error updating transaction in database:", dbError);
      return false;
    }
  };

  // Function to check and update transaction status
  const checkTransactionStatus = async (
    txHash: string,
    provider: ethers.providers.Web3Provider,
    merchantId: string,
    walletAddress: string,
    amount: string,
    currency: string,
    description: string | undefined
  ) => {
    try {
      setTxStatus("confirming");
      const receipt = await provider.waitForTransaction(txHash, 1, 120000); // Wait up to 2 minutes
      if (receipt && receipt.status === 1) {
        setTxStatus("confirmed");
        // Update existing Pending entry to Completed
        const updated = await updateTransactionStatus(
          txHash,
          merchantId,
          walletAddress,
          amount,
          currency,
          description
        );
        if (!updated) {
          setError(
            "Transaction confirmed on-chain, but failed to update in database. Please contact support."
          );
        } else {
          const shortSender = walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4);
          const shortMerchant = merchantId.slice(0, 6) + '...' + merchantId.slice(-4);
          const toastMessage = description
            ? `Payment sent: ${amount} ${currency} from ${shortSender} to ${shortMerchant} for ${description}`
            : `Payment sent: ${amount} ${currency} from ${shortSender} to ${shortMerchant}`;
          toast.success(toastMessage);
          window.dispatchEvent(new CustomEvent('neda-notification', {
            detail: {
              message: toastMessage
            }
          }));
        }
      } else {
        setTxStatus("failed");
        setError("Transaction failed on-chain.");
      }
    } catch (error: any) {
      console.warn("Transaction confirmation error:", error);
      setError(
        error.message ||
          "Transaction confirmation timed out. It may still confirm later."
      );
      return false;
    }
    return true;
  };

  // Enhanced payment function with Base Account SDK and batch transactions
  const handlePayWithBaseAccount = async () => {
    setError(null);
    setLoading(true);
    setTxHash(null);
    setTxStatus("preparing");

    try {
      // Validate inputs
      if (!to || !utils.isAddress(to)) {
        setError("Invalid merchant address. Please check the payment link.");
        setLoading(false);
        setTxStatus("failed");
        return;
      }
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        setError("Invalid amount.");
        setLoading(false);
        setTxStatus("failed");
        return;
      }

      // Initialize Base Account SDK
      const sdk = createBaseAccountSDK({
        appName: 'NedaPay Merchant',
        appLogoUrl: 'https://nedapay.com/logo.png',
        appChainIds: [base.constants.CHAIN_IDS.base],
      });

      const provider = sdk.getProvider();
      const cryptoAccount = await getCryptoKeyAccount();
      const walletAddress = cryptoAccount?.account?.address;

      if (!walletAddress) {
        setError("Unable to get wallet address. Please connect your wallet.");
        setLoading(false);
        setTxStatus("failed");
        return;
      }

      setTxStatus("submitting");

      // Find token info from stablecoins
      const token = stablecoins.find(
        (sc) =>
          sc.baseToken.toLowerCase() === currency?.toLowerCase() ||
          sc.currency.toLowerCase() === currency?.toLowerCase()
      );

      let calls = [];
      let txHash = '';

      if (
        token &&
        token.address &&
        token.address !== "0x0000000000000000000000000000000000000000"
      ) {
        // ERC-20 transfer using batch transaction
        const decimals = token.decimals || 18;
        const transferAmount = parseUnits(amount, decimals);

        // ERC-20 ABI for transfer
        const erc20Abi = [
          {
            name: 'transfer',
            type: 'function',
            stateMutability: 'nonpayable',
            inputs: [
              { name: 'to', type: 'address' },
              { name: 'amount', type: 'uint256' }
            ],
            outputs: [{ name: '', type: 'bool' }]
          }
        ] as const;

        calls = [{
          to: token.address,
          value: '0x0',
          data: encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [to as `0x${string}`, transferAmount]
          })
        }];
      } else {
        // Native ETH transfer
        const transferAmount = parseUnits(amount, 18);
        calls = [{
          to: to as `0x${string}`,
          value: numberToHex(transferAmount),
          data: '0x'
        }];
      }

      // Send batch transaction (even if single call, for consistency)
      const result = await provider.request({
        method: 'wallet_sendCalls',
        params: [{
          version: '2.0.0',
          from: walletAddress,
          chainId: numberToHex(base.constants.CHAIN_IDS.base),
          atomicRequired: true, // All calls must succeed or all fail
          calls: calls
        }]
      });

      txHash = result;
      setTxHash(txHash);
      setTxStatus("pending");

      // Save transaction as Pending initially
      const saved = await saveTransactionToDB(
        to,
        walletAddress,
        amount,
        currency,
        description,
        "Pending",
        txHash
      );

      if (!saved) {
        setError(
          "Transaction sent, but failed to record in database. Please contact support."
        );
      } else {
        const shortSender = walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4);
        const shortMerchant = to.slice(0, 6) + '...' + to.slice(-4);
        const toastMessage = description
          ? `Payment sent: ${amount} ${currency} from ${shortSender} to ${shortMerchant} for ${description}`
          : `Payment sent: ${amount} ${currency} from ${shortSender} to ${shortMerchant}`;
        toast.success(toastMessage, {
          duration: 3000,
        });
        window.dispatchEvent(new CustomEvent('neda-notification', {
          detail: {
            message: toastMessage
          }
        }));
      }

      // For Base Account SDK, we'll handle confirmation differently
      // The SDK handles the transaction confirmation internally
      setTxStatus("confirmed");
      
      // Update transaction to completed
      const updated = await updateTransactionStatus(
        txHash as string,
        to,
        walletAddress,
        amount,
        currency,
        description
      );

      if (!updated) {
        setError(
          "Transaction confirmed, but failed to update in database. Please contact support."
        );
      }

    } catch (e: any) {
      console.error("Payment error:", e);
      setError(e.message || "Transaction failed");
      setTxStatus("failed");
    }

    setLoading(false);
  };

  // Fallback to traditional method if Base Account SDK is not available
  const handlePayFallback = async () => {
    setError(null);
    setLoading(true);
    setTxHash(null);
    setTxStatus("preparing");

    try {
      // Validate recipient address
      let isValidAddress = false;
      try {
        isValidAddress = !!to && utils.isAddress(to);
      } catch {
        isValidAddress = false;
      }
      if (!isValidAddress) {
        setError("Invalid merchant address. Please check the payment link.");
        setLoading(false);
        setTxStatus("failed");
        return;
      }
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        setError("Invalid amount.");
        setLoading(false);
        setTxStatus("failed");
        return;
      }
      if (!window.ethereum) {
        setError("No wallet detected. Please install a Web3 wallet.");
        setLoading(false);
        setTxStatus("failed");
        return;
      }

      await (window as any).ethereum.request({ method: "eth_requestAccounts" });
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      const signer = provider.getSigner();
      const walletAddress = await signer.getAddress();

      // Find token info from stablecoins
      const token = stablecoins.find(
        (sc) =>
          sc.baseToken.toLowerCase() === currency?.toLowerCase() ||
          sc.currency.toLowerCase() === currency?.toLowerCase()
      );

      let txResponse;
      setTxStatus("submitting");

      if (
        token &&
        token.address &&
        token.address !== "0x0000000000000000000000000000000000000000"
      ) {
        // ERC-20 transfer
        const erc20ABI = [
          "function transfer(address to, uint256 amount) public returns (bool)",
          "function decimals() public view returns (uint8)",
        ];
        const contract = new ethers.Contract(token.address, erc20ABI, signer);
        let decimals = 18;
        try {
          decimals = await contract.decimals();
        } catch (error) {
          console.warn("Failed to get token decimals, using default 18:", error);
          decimals = 18;
        }

        let value;
        try {
          value = utils.parseUnits(amount, decimals);
        } catch {
          setError("Invalid amount format.");
          setLoading(false);
          setTxStatus("failed");
          return;
        }

        try {
          const gasPrice = await provider.getGasPrice();
          const gasLimit = await contract.estimateGas.transfer(to, value);
          const safeGasLimit = gasLimit.mul(120).div(100);

          txResponse = await contract.transfer(to, value, {
            gasPrice,
            gasLimit: safeGasLimit,
          });
        } catch (error: any) {
          console.warn(
            "Gas estimation failed, trying without gas parameters:",
            error
          );
          txResponse = await contract.transfer(to, value);
        }
      } else {
        // Native ETH/coin transfer
        let value;
        try {
          value = utils.parseEther(amount);
        } catch {
          setError("Invalid amount format.");
          setLoading(false);
          setTxStatus("failed");
          return;
        }

        try {
          const gasPrice = await provider.getGasPrice();
          const gasLimit = await provider.estimateGas({ to, value });
          const safeGasLimit = gasLimit.mul(120).div(100);

          txResponse = await signer.sendTransaction({
            to,
            value,
            gasPrice,
            gasLimit: safeGasLimit,
          });
        } catch (error: any) {
          console.warn(
            "Gas estimation failed, trying without gas parameters:",
            error
          );
          txResponse = await signer.sendTransaction({ to, value });
        }
      }

      setTxHash(txResponse.hash);
      setTxStatus("pending");

      // Save transaction as Pending initially
      const saved = await saveTransactionToDB(
        to,
        walletAddress,
        amount,
        currency,
        description,
        "Pending",
        txResponse.hash
      );
      if (!saved) {
        setError(
          "Transaction sent, but failed to record in database. Please contact support."
        );
      } else {
        const shortSender = walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4);
        const shortMerchant = to.slice(0, 6) + '...' + to.slice(-4);
        const toastMessage = description
          ? `Payment sent: ${amount} ${currency} from ${shortSender} to ${shortMerchant} for ${description}`
          : `Payment sent: ${amount} ${currency} from ${shortSender} to ${shortMerchant}`;
        toast.success(toastMessage, {
          duration: 3000,
        });
        window.dispatchEvent(new CustomEvent('neda-notification', {
          detail: {
            message: toastMessage
          }
        }));
      }

      // Check transaction status
      const confirmed = await checkTransactionStatus(
        txResponse.hash,
        provider,
        to,
        walletAddress,
        amount,
        currency,
        description
      );

      if (!confirmed) {
        // Schedule a retry in the background
        setTimeout(
          () =>
            checkTransactionStatus(
              txResponse.hash,
              provider,
              to,
              walletAddress,
              amount,
              currency,
              description
            ),
          30000
        ); // Retry after 30 seconds
      }
    } catch (e: any) {
      console.error("Payment error:", e);
      setError(e.message || "Transaction failed");
      setTxStatus("failed");
    }

    setLoading(false);
  };

  // Check if Base Account is available
  const isBaseAccountAvailable = () => {
    return typeof window !== 'undefined' && 
           window.ethereum && 
           window.ethereum.isMetaMask === false; // Not MetaMask, could be Base Account
  };

  // Enhanced payment handler for Farcaster/Base app environments
  const handleFarcasterPayment = async () => {
    setError(null);
    setLoading(true);
    setTxHash(null);
    setTxStatus("preparing");

    try {
      // Validate inputs
      if (!to || !utils.isAddress(to)) {
        setError("Invalid merchant address. Please check the payment link.");
        setLoading(false);
        setTxStatus("failed");
        return;
      }
      if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
        setError("Invalid amount.");
        setLoading(false);
        setTxStatus("failed");
        return;
      }

      // Try to use Farcaster SDK or Base Account SDK first
      if (isFarcasterEnvironment() || isBaseAppEnvironment()) {
        try {
          // Initialize Base Account SDK for Farcaster/Base environments
          const sdk = createBaseAccountSDK({
            appName: 'NedaPay Merchant',
            appLogoUrl: 'https://nedapay.com/logo.png',
            appChainIds: [base.constants.CHAIN_IDS.base],
          });

          const provider = sdk.getProvider();
          
          // Request account access
          await provider.request({ method: 'eth_requestAccounts' });
          
          const accounts = await provider.request({ method: 'eth_accounts' }) as string[];
          if (!accounts || accounts.length === 0) {
            throw new Error('No accounts found');
          }
          
          const walletAddress = accounts[0];
          setTxStatus("submitting");

          // Find token info from stablecoins
          const token = stablecoins.find(
            (sc) =>
              sc.baseToken.toLowerCase() === currency?.toLowerCase() ||
              sc.currency.toLowerCase() === currency?.toLowerCase()
          );

          let txResponse;

          if (
            token &&
            token.address &&
            token.address !== "0x0000000000000000000000000000000000000000"
          ) {
            // ERC-20 transfer
            const decimals = token.decimals || 18;
            const transferAmount = parseUnits(amount, decimals);

            // Use wallet_sendCalls for batch transaction
            const calls = [{
              to: token.address,
              value: '0x0',
              data: encodeFunctionData({
                abi: [{
                  name: 'transfer',
                  type: 'function',
                  stateMutability: 'nonpayable',
                  inputs: [
                    { name: 'to', type: 'address' },
                    { name: 'amount', type: 'uint256' }
                  ],
                  outputs: [{ name: '', type: 'bool' }]
                }] as const,
                functionName: 'transfer',
                args: [to as `0x${string}`, transferAmount]
              })
            }];

            const result = await provider.request({
              method: 'wallet_sendCalls',
              params: [{
                version: '2.0.0',
                from: walletAddress,
                chainId: numberToHex(base.constants.CHAIN_IDS.base),
                atomicRequired: true,
                calls: calls
              }]
            }) as string;

            txResponse = { hash: result };
          } else {
            // Native ETH transfer
            const transferAmount = parseUnits(amount, 18);
            
            const result = await provider.request({
              method: 'wallet_sendCalls',
              params: [{
                version: '2.0.0',
                from: walletAddress,
                chainId: numberToHex(base.constants.CHAIN_IDS.base),
                atomicRequired: true,
                calls: [{
                  to: to as `0x${string}`,
                  value: numberToHex(transferAmount),
                  data: '0x'
                }]
              }]
            }) as string;

            txResponse = { hash: result };
          }

          setTxHash(txResponse.hash);
          setTxStatus("pending");

          // Save transaction as Pending initially
          const saved = await saveTransactionToDB(
            to,
            walletAddress,
            amount,
            currency,
            description,
            "Pending",
            txResponse.hash
          );

          if (saved) {
            const shortSender = walletAddress.slice(0, 6) + '...' + walletAddress.slice(-4);
            const shortMerchant = to.slice(0, 6) + '...' + to.slice(-4);
            const toastMessage = description
              ? `Payment sent: ${amount} ${currency} from ${shortSender} to ${shortMerchant} for ${description}`
              : `Payment sent: ${amount} ${currency} from ${shortSender} to ${shortMerchant}`;
            toast.success(toastMessage, { duration: 3000 });
            
            // Auto-confirm for Farcaster/Base environments
            setTxStatus("confirmed");
            await updateTransactionStatus(
              txResponse.hash as string,
              to,
              walletAddress,
              amount,
              currency,
              description
            );
          }

        } catch (sdkError: any) {
          console.warn("Base Account SDK failed, falling back to traditional method:", sdkError);
          // Fallback to traditional method
          await handlePayFallback();
          return;
        }
      } else {
        // Not in Farcaster/Base environment, use traditional method
        await handlePayFallback();
        return;
      }

    } catch (e: any) {
      console.error("Farcaster payment error:", e);
      setError(e.message || "Transaction failed");
      setTxStatus("failed");
    }

    setLoading(false);
  };

  // Main payment handler that detects environment and uses appropriate method
  const handlePay = async () => {
    if (isFarcasterEnvironment() || isBaseAppEnvironment() || isWalletAppEnvironment()) {
      await handleFarcasterPayment();
    } else {
      await handlePayFallback();
    }
  };

  // Auto-connect for Farcaster/Base environments
  useEffect(() => {
    const autoConnectWallet = async () => {
      if (isFarcasterEnvironment() || isBaseAppEnvironment() || isWalletAppEnvironment()) {
        try {
          // Try to auto-connect in wallet environments
          if (window.ethereum && typeof window.ethereum.request === 'function') {
            const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
            if (accounts && accounts.length > 0) {
              console.log('Auto-connected to wallet in Farcaster/Base environment');
            }
          }
        } catch (error) {
          console.log('Auto-connect failed, user will need to connect manually');
        }
      }
    };

    autoConnectWallet();
  }, []);

  // Cleanup effect to prevent memory leaks and reset state
  useEffect(() => {
    // Reset state on component mount
    setLoading(false);
    setTxStatus("idle");
    setError(null);
    setTxHash(null);
    
    return () => {
      setLoading(false);
      setTxStatus("idle");
    };
  }, []);

  const statusInfo = () => {
    switch (txStatus) {
      case "preparing":
      case "submitting":
      case "pending":
      case "confirming":
        return {
          message: "Transaction processing...",
          color: "text-blue-600 dark:text-blue-400",
        };
      case "confirmed":
        return {
          message: description
            ? `Transaction confirmed for ${description}!`
            : "Transaction confirmed!",
          color: "text-green-600 dark:text-green-400",
        };
      case "failed":
        return {
          message: error || "Transaction failed",
          color: "text-red-600 dark:text-red-400",
        };
      default:
        return { message: "", color: "" };
    }
  };

  const { message, color } = statusInfo();

  return (
    <div className="mt-4 text-center">
      <button
        onClick={handlePay}
        disabled={loading}
        className="w-full px-6 py-4 !bg-blue-500 hover:!bg-blue-600 text-white rounded-xl font-semibold text-lg transition disabled:opacity-60 shadow-lg"
      >
        {loading ? (
          <span className="flex items-center justify-center">
            <svg
              className="animate-spin -ml-1 mr-2 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            {txStatus === "idle" ? "Processing..." : message}
          </span>
        ) : (
          <>
            {isFarcasterEnvironment() || isBaseAppEnvironment() || isWalletAppEnvironment() ? (
              <>🔗 {t('paymentLink.payWithWallet')}</>
            ) : (
              t('paymentLink.payWithWallet')
            )}
          </>
        )}
      </button>

      {/* Transaction status messages */}
      {txStatus !== "idle" && txStatus !== "confirmed" && !error && (
        <div className={`mt-2 ${color} text-sm font-medium`}>{message}</div>
      )}

      {/* Transaction hash with link */}
      {txHash && (
        <div className="mt-2 text-green-600 dark:text-green-400">
          <span className="block mb-1">Transaction sent!</span>
          <a
            href={`https://basescan.org/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center space-x-1 underline"
          >
            <span>View on BaseScan</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="mt-2 text-red-600 dark:text-red-400 text-sm" style={{color: "red"}}>{error}</div>
      )}

      {/* Mobile wallet options - Only show if no wallet detected */}
      {!window.ethereum && isMobile() && (
        <div className="mt-4 text-center">
          <div className="mb-3 text-sm text-gray-600">No wallet detected. Open in your wallet app:</div>
          <div className="flex flex-col gap-3 items-center">
            <button
              onClick={() => {
                const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
                const metamaskUrl = `metamask://dapp/${typeof window !== 'undefined' ? window.location.host + window.location.pathname + window.location.search : ''}`;
                window.location.href = metamaskUrl;
                setTimeout(() => {
                  window.location.href = 'https://metamask.app.link/dapp/' + encodeURIComponent(currentUrl);
                }, 1000);
              }}
              className="w-full max-w-xs px-4 py-3 !bg-orange-500 hover:!bg-orange-600 text-white rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2"
            >
              <span>🦊</span> Open in MetaMask
            </button>
            <button
              onClick={() => {
                const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
                const coinbaseUrl = `cbwallet://dapp?url=${encodeURIComponent(currentUrl)}`;
                window.location.href = coinbaseUrl;
                setTimeout(() => {
                  window.location.href = 'https://go.cb-w.com/dapp?cb_url=' + encodeURIComponent(currentUrl);
                }, 1000);
              }}
              className="w-full max-w-xs px-4 py-3 !bg-blue-600 hover:!bg-blue-700 text-white rounded-lg font-semibold transition-all duration-200 flex items-center justify-center gap-2"
            >
              <span>🔵</span> Open in Coinbase Wallet
            </button>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            If wallet doesn't open, please copy the URL and paste it in your wallet's browser
          </div>
        </div>
      )}
    </div>
  );
}
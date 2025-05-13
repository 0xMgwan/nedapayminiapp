"use client";

import { useState, useEffect } from "react";
import { ethers } from "ethers";
import dynamic from "next/dynamic";
import { stablecoins } from "../../data/stablecoins";
import { utils } from "ethers";

const WalletConnectButton = dynamic(() => import("./WalletConnectButton"), {
  ssr: false,
});

function isMobile() {
  if (typeof window === "undefined") return false;
  return /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

export default function PayWithWallet({
  to,
  amount,
  currency,
}: {
  to: string;
  amount: string;
  currency: string;
}) {
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [txStatus, setTxStatus] = useState<
    "idle" | "preparing" | "submitting" | "pending" | "confirming" | "confirmed" | "failed"
  >("idle");

  // Function to save a new transaction (Pending)
  const saveTransactionToDB = async (
    merchantId: string,
    walletAddress: string,
    amount: string,
    currency: string,
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
          wallet: walletAddress,
          amount,
          currency,
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

  // Function to update transaction status to Completed
  const updateTransactionStatus = async (
    txHash: string,
    merchantId: string,
    walletAddress: string,
    amount: string,
    currency: string
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
          status: "Completed",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Failed to update transaction:", errorData);
        return false;
      }
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
    currency: string
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
          currency
        );
        if (!updated) {
          setError(
            "Transaction confirmed on-chain, but failed to update in database. Please contact support."
          );
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

  const handlePay = async () => {
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

      await window.ethereum.request({ method: "eth_requestAccounts" });
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
        "Pending",
        txResponse.hash
      );
      if (!saved) {
        setError(
          "Transaction sent, but failed to record in database. Please contact support."
        );
      }

      // Check transaction status
      const confirmed = await checkTransactionStatus(
        txResponse.hash,
        provider,
        to,
        walletAddress,
        amount,
        currency
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
              currency
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

  // Cleanup effect to prevent memory leaks
  useEffect(() => {
    return () => {
      setLoading(false);
      setTxStatus("idle");
    };
  }, []);

  const statusInfo = () => {
    switch (txStatus) {
      case "preparing":
        return {
          message: "Preparing transaction...",
          color: "text-blue-600 dark:text-blue-400",
        };
      case "submitting":
        return {
          message: "Submitting to blockchain...",
          color: "text-blue-600 dark:text-blue-400",
        };
      case "pending":
        return {
          message: "Transaction submitted, waiting for confirmation...",
          color: "text-yellow-600 dark:text-yellow-400",
        };
      case "confirming":
        return {
          message: "Confirming transaction...",
          color: "text-yellow-600 dark:text-yellow-400",
        };
      case "confirmed":
        return {
          message: "Transaction confirmed!",
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
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition disabled:opacity-60"
      >
        {loading ? (
          <span className="flex items-center justify-center">
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
          `Pay with Wallet`
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
        <div className="mt-2 text-red-600 dark:text-red-400 text-sm">{error}</div>
      )}

      {/* Mobile wallet options */}
      {!window.ethereum && isMobile() && (
        <div className="mt-4 text-center">
          <div className="mb-2 text-sm text-gray-600 dark:text-gray-300">
            No wallet detected. Open in your wallet app:
          </div>
          <div className="flex flex-col gap-2 items-center">
            <a
              href={`metamask://dapp/${
                typeof window !== "undefined"
                  ? window.location.host +
                    window.location.pathname +
                    window.location.search
                  : ""
              }`}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold transition"
            >
              Open in MetaMask
            </a>
            <a
              href={`cbwallet://dapp?url=${
                typeof window !== "undefined"
                  ? encodeURIComponent(window.location.href)
                  : ""
              }`}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
            >
              Open in Coinbase Wallet
            </a>
            <WalletConnectButton to={to} amount={amount} currency={currency} />
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useState, FormEvent } from "react";
import {
  usePrivy,
  useWallets,
  useSign7702Authorization,
} from "@privy-io/react-auth";
import axios from "axios";
import { ethers, utils } from "ethers";
import { Loader2, AlertTriangle, Info } from "lucide-react";
import Header from "../components/Header";
import Footer from "../components/Footer";
import {
  fetchTokenRate,
  fetchSupportedInstitutions,
  verifyAccount,
  fetchSupportedCurrencies,
} from "../utils/paycrest";
import {
  initializeBiconomy as initializeBiconomyEmbedded,
  executeGasAbstractedTransfer as executeGasAbstractedTransferEmbedded,
  type BiconomyClient as BiconomyEmbeddedClient,
} from "../utils/biconomyEmbedded";
import {
  initializeBiconomy as initializeBiconomyExternal,
  executeGasAbstractedTransfer as executeGasAbstractedTransferExternal,
  type BiconomyClient as BiconomyExternalClient,
} from "../utils/biconomyExternal";

import { WalletType } from "../utils/biconomyExternal";

import { base } from "viem/chains";

// Constants
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_ABI = [
  "function transfer(address to, uint256 amount) public returns (bool)",
  "function balanceOf(address account) public view returns (uint256)",
  "function decimals() public view returns (uint8)",
];

// Fee estimates
const GAS_ABSTRACTED_FEE_USDC = 0.023; // Estimated fee for gas abstracted transactions in USDC
const GAS_NORMAL_FEE_ETH = 0.0005; // Estimated fee for normal transactions in ETH

const PaymentForm: React.FC = () => {
  // Authentication and wallet state
  const { authenticated, login, connectWallet } = usePrivy();
  const { wallets } = useWallets();
  const { signAuthorization } = useSign7702Authorization();

  // Form state
  const [amount, setAmount] = useState("");
  const [fiat, setFiat] = useState("NGN");
  const [rate, setRate] = useState("");
  const [institution, setInstitution] = useState("");
  const [accountIdentifier, setAccountIdentifier] = useState("");
  const [accountName, setAccountName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [memo, setMemo] = useState("");
  const [institutions, setInstitutions] = useState<
    Array<{ name: string; code: string; type: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showWarning, setShowWarning] = useState(false);
  const [currencies, setCurrencies] = useState<
    Array<{ code: string; name: string }>
  >([]);
  const [isAccountVerified, setIsAccountVerified] = useState(false);
  const [biconomyEmbeddedClient, setBiconomyEmbeddedClient] =
    useState<BiconomyEmbeddedClient | null>(null);
  const [biconomyExternalClient, setBiconomyExternalClient] =
    useState<BiconomyExternalClient | null>(null);
  const [gasAbstractionFailed, setGasAbstractionFailed] = useState(false);
  const [gasAbstractionInitializing, setGasAbstractionInitializing] =
    useState(false);

  // Balance states
  const [balance, setBalance] = useState<string>("0");
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [usdcToFiatRate, setUsdcToFiatRate] = useState<number | null>(null);

  // Get the active wallet
  const activeWallet = wallets[0] as WalletType | undefined;
  const isEmbeddedWallet = activeWallet?.walletClientType === "privy";
  const isCoinbaseWallet = activeWallet?.walletClientType === "coinbase_wallet";

  // Calculate derived values
  const gasAbstractionActive =
    !gasAbstractionFailed &&
    (biconomyEmbeddedClient || biconomyExternalClient) &&
    !isCoinbaseWallet;
  const estimatedFee = gasAbstractionActive
    ? GAS_ABSTRACTED_FEE_USDC
    : GAS_NORMAL_FEE_ETH;
  const feeCurrency = gasAbstractionActive ? "USDC" : "ETH";

  const amountNum = parseFloat(amount) || 0;
  const totalDeduction = gasAbstractionActive
    ? amountNum + estimatedFee
    : amountNum;
  const receiveAmount =
    amountNum > 0 && rate
      ? ((amountNum - amountNum * 0.005) * parseFloat(rate)).toFixed(2)
      : "0.00";

  // Initialize Biconomy when wallet is ready (skip for Coinbase wallet)
  useEffect(() => {
    const initBiconomy = async () => {
      if (!activeWallet?.address || isCoinbaseWallet) return;

      setGasAbstractionInitializing(true);
      setGasAbstractionFailed(false);

      try {
        if (isEmbeddedWallet && signAuthorization) {
          await activeWallet.switchChain(base.id);
          const client = await initializeBiconomyEmbedded(
            activeWallet,
            signAuthorization
          );
          setBiconomyEmbeddedClient(client);
        } else if (!isEmbeddedWallet) {
          await activeWallet.switchChain(base.id);
          const client = await initializeBiconomyExternal(activeWallet);
          setBiconomyExternalClient(client);
        }
      } catch (err) {
        console.warn("Biconomy initialization failed:", err);
        setGasAbstractionFailed(true);
      } finally {
        setGasAbstractionInitializing(false);
      }
    };

    initBiconomy();
  }, [activeWallet, signAuthorization, isEmbeddedWallet, isCoinbaseWallet]);

  // Fetch supported currencies on mount
  useEffect(() => {
    const loadCurrencies = async () => {
      try {
        const data = await fetchSupportedCurrencies();
        setCurrencies(data);
      } catch (err) {
        setError("Failed to load currencies");
      }
    };
    loadCurrencies();
  }, []);

  // Fetch balance when wallet changes
  useEffect(() => {
    const fetchBalance = async () => {
      if (!activeWallet?.address) {
        setBalance("0");
        return;
      }

      try {
        setBalanceLoading(true);
        const provider = new ethers.providers.Web3Provider(
          await activeWallet.getEthereumProvider()
        );
        const usdcContract = new ethers.Contract(
          USDC_ADDRESS,
          USDC_ABI,
          provider
        );

        const decimals = await usdcContract.decimals();
        const balance = await usdcContract.balanceOf(activeWallet.address);
        setBalance(ethers.utils.formatUnits(balance, decimals));
      } catch (err) {
        console.error("Failed to fetch balance", err);
        setError("Failed to load balance");
      } finally {
        setBalanceLoading(false);
      }
    };

    fetchBalance();
  }, [activeWallet]);

  // Fetch USDC to fiat rate for fee display
  useEffect(() => {
    const fetchUsdcToFiat = async () => {
      try {
        const rate = await fetchTokenRate("USDC", 1, fiat);
        setUsdcToFiatRate(parseFloat(rate));
      } catch (err) {
        console.error("Failed to fetch USDC rate", err);
      }
    };

    if (fiat) fetchUsdcToFiat();
  }, [fiat]);

  const fetchInstitutions = async () => {
    try {
      const data = await fetchSupportedInstitutions(fiat);
      setInstitutions(data);
    } catch (err) {
      setError("Failed to fetch institutions");
    }
  };

  const handleVerifyAccount = async () => {
    if (!institution || !accountIdentifier) return;

    try {
      setIsLoading(true);
      await verifyAccount(institution, accountIdentifier);
      setIsAccountVerified(true);
      setError("");
    } catch (err) {
      setError("Account verification failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleFetchRate = async () => {
    if (!amount || !fiat) return;

    try {
      const fetchedRate = await fetchTokenRate(
        "USDC",
        parseFloat(amount),
        fiat
      );
      setRate(fetchedRate);
      setError("");
    } catch (err) {
      setError("Failed to fetch rate");
    }
  };

  useEffect(() => {
    // Clear rate when amount or currency changes
    setRate("");
    setError("");
  }, [amount, fiat]);

  const executeNormalTransaction = async (
    receiveAddress: string,
    amountInWei: ethers.BigNumber
  ) => {
    if (!activeWallet?.address) {
      throw new Error("No wallet connected");
    }

    // embedded wallet's provider instead of window.ethereum
    const provider = new ethers.providers.Web3Provider(
      await activeWallet.getEthereumProvider()
    );
    const signer = provider.getSigner();

    const erc20ABI = [
      "function transfer(address to, uint256 amount) public returns (bool)",
      "function decimals() public view returns (uint8)",
    ];

    const contract = new ethers.Contract(USDC_ADDRESS, erc20ABI, signer);

    try {
      const gasPrice = await provider.getGasPrice();
      const gasLimit = await contract.estimateGas.transfer(
        receiveAddress,
        amountInWei
      );
      const safeGasLimit = gasLimit.mul(120).div(100);

      const txResponse = await contract.transfer(receiveAddress, amountInWei, {
        gasPrice,
        gasLimit: safeGasLimit,
      });

      return txResponse;
    } catch (error: any) {
      console.warn(
        "Gas estimation failed, trying without gas parameters:",
        error
      );
      const txResponse = await contract.transfer(receiveAddress, amountInWei);
      return txResponse;
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!authenticated) return login();
    if (!activeWallet?.address) return setError("Wallet not connected");
    if (!isAccountVerified) return setError("Please verify account first");
    if (!rate) return setError("Please fetch exchange rate first");

    try {
      setIsLoading(true);

      // Check balance
      const provider = new ethers.providers.Web3Provider(
        await activeWallet.getEthereumProvider()
      );
      const signer = provider.getSigner();
      const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, signer);

      const decimals = await usdcContract.decimals();
      const amountInWei = ethers.utils.parseUnits(amount, decimals);

      // Balance check with fee consideration
      const balance = await usdcContract.balanceOf(activeWallet.address);
      const requiredBalance = gasAbstractionActive
        ? amountInWei.add(
            ethers.utils.parseUnits(
              GAS_ABSTRACTED_FEE_USDC.toString(),
              decimals
            )
          )
        : amountInWei;

      if (balance.lt(requiredBalance)) {
        throw new Error(
          `Insufficient USDC balance. Need ${ethers.utils.formatUnits(requiredBalance, decimals)} USDC`
        );
      }

      // Create payment order
      const orderResponse = await axios.post("/api/paycrest/orders", {
        amount: parseFloat(amount),
        rate: parseFloat(rate),
        network: "base",
        token: "USDC",
        recipient: { institution, accountIdentifier, accountName, memo },
        returnAddress: activeWallet.address,
        reference: `order-${Date.now()}`,
      });

      // console.log("paycrest order debugg", orderResponse);

      const {
        receiveAddress,
        amount: orderAmount,
        reference,
        senderFee,
        transactionFee,
        validUntil,
      } = orderResponse.data.data;

      // Execute transaction
      if (gasAbstractionActive && !isCoinbaseWallet) {
        try {
          if (isEmbeddedWallet && biconomyEmbeddedClient) {
            await executeGasAbstractedTransferEmbedded(
              biconomyEmbeddedClient,
              receiveAddress,
              amountInWei.toBigInt(),
              USDC_ADDRESS,
              USDC_ABI
            );
          } else if (!isEmbeddedWallet && biconomyExternalClient) {
            await executeGasAbstractedTransferExternal(
              biconomyExternalClient,
              receiveAddress as `0x${string}`,
              amountInWei.toBigInt(),
              USDC_ADDRESS as `0x${string}`
            );
          } else {
            throw new Error("Gas abstraction client not ready");
          }
        } catch (gasError) {
          console.warn(
            "Gas abstracted transfer failed, falling back to normal transaction:",
            gasError
          );
          // Fallback to normal transaction
          await executeNormalTransaction(receiveAddress, amountInWei);
        }
      } else {
        // Normal transaction for Coinbase wallet and other cases
        await executeNormalTransaction(receiveAddress, amountInWei);
      }

      setSuccess(
        `Payment order initiated! \nReference: ${reference}\nAmount: ${orderAmount}\nNetwork: Base\nToken: USDC\nFee: ${senderFee}\nTransaction Fee: ${transactionFee}\nValid Until: ${validUntil}`
      );
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setIsLoading(false);
    }
  };

  const renderFeeInfo = () => {
    if (gasAbstractionInitializing && !isCoinbaseWallet) {
      return (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 mb-4">
          <div className="flex items-start gap-2">
            <Loader2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0 animate-spin" />
            <div>
              <p className="text-blue-800 font-medium text-xs">
                Initializing Gas Abstraction
              </p>
              <p className="text-blue-700 text-xs mt-1">
                Setting up fee sponsorship. This may take a moment...
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (isCoinbaseWallet) {
      return (
        <div className="space-y-3 mb-4">
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-blue-800 font-medium text-xs">
                  Coinbase Wallet Detected
                </p>
                <p className="text-blue-700 text-xs mt-1">
                  USDC transfers in Coinbase Wallet have no gas fees on Base
                  network.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 text-xs">
                  Available Balance:
                </span>
                {balanceLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                ) : (
                  <span className="font-medium text-xs">
                    {parseFloat(balance).toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })}{" "}
                    USDC
                  </span>
                )}
              </div>
              {usdcToFiatRate && (
                <div className="text-xs text-gray-500 mt-1">
                  ≈{" "}
                  {(parseFloat(balance) * usdcToFiatRate).toLocaleString(
                    undefined,
                    {
                      maximumFractionDigits: 2,
                    }
                  )}{" "}
                  {fiat}
                </div>
              )}
            </div>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 text-xs">Network Fee:</span>
                <span className="font-medium text-xs text-green-600">Free</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                No gas fees for USDC transfers
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (
      !gasAbstractionFailed &&
      (biconomyEmbeddedClient || biconomyExternalClient)
    ) {
      return (
        <div className="space-y-3 mb-4">
          <div className="p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-green-800 font-medium text-xs">
                  Gas Abstraction Active
                </p>
                <p className="text-green-700 text-xs mt-1">
                  Transaction fees will be paid in USDC instead of ETH.{" "}
                  <a
                    className="!text-blue-600 hover:underline"
                    href="https://blog.ambire.com/gas-abstraction-explained/"
                    target="_blank"
                  >
                    Learn more
                  </a>
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 text-xs">
                  Available Balance:
                </span>
                {balanceLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                ) : (
                  <span className="font-medium text-xs">
                    {parseFloat(balance).toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })}{" "}
                    USDC
                  </span>
                )}
              </div>
              {usdcToFiatRate && (
                <div className="text-xs text-gray-500 mt-1">
                  ≈{" "}
                  {(parseFloat(balance) * usdcToFiatRate).toLocaleString(
                    undefined,
                    {
                      maximumFractionDigits: 2,
                    }
                  )}{" "}
                  {fiat}
                </div>
              )}
            </div>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 text-xs">Estimated Fee:</span>
                <span className="font-medium text-xs">
                  {estimatedFee} {feeCurrency}
                </span>
              </div>
              {usdcToFiatRate && feeCurrency === "USDC" && (
                <div className="text-xs text-gray-500 mt-1">
                  ≈{" "}
                  {(estimatedFee * usdcToFiatRate).toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })}{" "}
                  {fiat}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    } else {
      return (
        <div className="space-y-3 mb-4">
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-amber-800 font-medium text-xs">
                  Transaction Fees Required
                </p>
                <p className="text-amber-700 text-xs mt-1">
                  You need ETH in your wallet to pay for Base network
                  transaction fees.
                  {gasAbstractionFailed && " (Gas abstraction unavailable)"}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 text-sm">
                  Available Balance:
                </span>
                {balanceLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
                ) : (
                  <span className="font-medium">
                    {parseFloat(balance).toLocaleString(undefined, {
                      maximumFractionDigits: 6,
                    })}{" "}
                    USDC
                  </span>
                )}
              </div>
              {usdcToFiatRate && (
                <div className="text-xs text-gray-500 mt-1">
                  ≈{" "}
                  {(parseFloat(balance) * usdcToFiatRate).toLocaleString(
                    undefined,
                    {
                      maximumFractionDigits: 2,
                    }
                  )}{" "}
                  {fiat}
                </div>
              )}
            </div>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 text-sm">Estimated Fee:</span>
                <span className="font-medium">
                  {estimatedFee} {feeCurrency}
                </span>
              </div>
              {usdcToFiatRate && feeCurrency === "ETH" && (
                <div className="text-xs text-gray-500 mt-1">
                  ≈{" "}
                  {(estimatedFee * (usdcToFiatRate * 2000)).toLocaleString(
                    undefined,
                    {
                      maximumFractionDigits: 2,
                    }
                  )}{" "}
                  {fiat}*
                </div>
              )}
            </div>
          </div>

          {feeCurrency === "ETH" && (
            <p className="text-xs text-gray-500">
              *ETH fee estimate based on current market rates. Actual fee may
              vary.
            </p>
          )}
        </div>
      );
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50">
      <div className="fixed inset-0 overflow-y-auto">
        <Header />

        {/* Back Button */}
        <div className="container mx-auto max-w-4xl px-6 pt-6">
          <button
            onClick={() => window.history.back()}
            className="group flex items-center gap-2 px-4 py-2 !bg-white/80 !backdrop-blur-sm !border !border-gray-200 !rounded-xl hover:!bg-white hover:!shadow-lg transition-all duration-300 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            <span className="group-hover:-translate-x-1 transition-transform duration-300">
              ←
            </span>
            Back
          </button>
        </div>

        <div className="container mx-auto max-w-4xl px-6 py-8 lg:!w-[50%]">
          {/* Hero Section */}
          <div className="text-center mb-8 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-200/30 to-blue-200/30 blur-3xl rounded-4xl"></div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-full text-xs font-medium animate-pulse mb-4 border border-purple-200">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4zM18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" />
              </svg>
              Stablecoins to Fiat Offramp
            </div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              <span className="block bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Convert USDC to Cash
              </span>
            </h1>
            <p className="text-sm text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Seamlessly convert your USDC to local currency with instant bank
              transfers.
            </p>
          </div>

          {/* Authentication Status */}
          {!authenticated && (
            <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-amber-100 to-orange-100">
                  <svg
                    className="w-4 h-4 text-amber-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-amber-900 text-sm">
                    Authentication Required
                  </h3>
                  <p className="text-amber-700 text-xs mt-1">
                    Please login to access the offramp service
                  </p>
                </div>
                <button
                  onClick={login}
                  className="px-4 py-2 !bg-gradient-to-r !from-purple-600 !to-blue-600 hover:!from-purple-700 hover:!to-blue-700 !text-white !font-medium !rounded-xl !shadow-lg hover:!shadow-xl !transition-all !duration-300 text-base transform hover:-translate-y-0.5"
                >
                  Login with Privy
                </button>
              </div>
            </div>
          )}

          {/* Wallet Connection Status */}
          {authenticated && !activeWallet && (
            <div className="mb-6 p-4 rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-red-50 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-orange-100 to-red-100">
                  <svg
                    className="w-4 h-4 text-orange-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.4 16c-.77 1.333.192 3 1.732 3z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-orange-900 text-sm">
                    Wallet Connection Required
                  </h3>
                  <p className="text-orange-700 text-xs mt-1">
                    Please connect a wallet to proceed with the offramp
                  </p>
                </div>
                <button
                  onClick={connectWallet}
                  className="px-4 py-2 !bg-gradient-to-r !from-emerald-600 !to-green-600 hover:!from-emerald-700 hover:!to-green-700 !text-white !font-medium !rounded-xl !shadow-lg hover:!shadow-xl !transition-all !duration-300 text-base transform hover:-translate-y-0.5"
                >
                  Connect Wallet
                </button>
              </div>
            </div>
          )}

          {/* Wallet Info */}
          {authenticated && activeWallet && (
            <div className="mb-6 p-4 rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100">
                  <svg
                    className="w-4 h-4 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-green-900 text-sm">
                    Wallet Connected
                  </h3>
                  <p className="text-green-700 text-xs mt-1 font-mono">
                    {activeWallet.address?.slice(0, 6)}...
                    {activeWallet.address?.slice(-4)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-green-600 font-medium">
                    Base Network Ready
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Main Form Card */}
          {authenticated && activeWallet && (
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-white/20 mb-8">
              <div className="flex items-center gap-4 mb-8">
                <div className="p-4 bg-gradient-to-br from-purple-100 to-blue-100 rounded-2xl">
                  <svg
                    className="w-6 h-6 text-purple-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-semibold text-gray-900 mb-2">
                    Initiate Offramp Payment
                  </h2>
                  <p className="text-gray-600 text-xs">
                    Follow the steps below to convert your USDC to fiat and
                    receive funds in your account.
                  </p>
                </div>
              </div>

              {/* Fee Information */}
              {renderFeeInfo()}

              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Step 1: Amount and Currency */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-700 bg-gradient-to-r from-purple-100 to-blue-100 rounded-full px-3 py-1">
                      Step 1
                    </span>
                    <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                      Enter Amount and Currency
                    </h3>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label
                        htmlFor="amount"
                        className="block text-sm font-semibold mb-3 text-gray-700"
                      >
                        Amount (USDC)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          id="amount"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="w-full px-4 py-4 text-base rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-white/50 backdrop-blur-sm"
                          placeholder="Minimum 1 USDC"
                          min="0.01"
                          step="0.01"
                          required
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Available: {balanceLoading ? "Loading..." : balance}{" "}
                        USDC
                      </p>
                    </div>
                    <div>
                      <label
                        htmlFor="fiat"
                        className="block text-sm font-semibold mb-3 text-gray-700"
                      >
                        Fiat Currency
                      </label>
                      <select
                        id="fiat"
                        value={fiat}
                        onChange={(e) => {
                          setFiat(e.target.value);
                          fetchInstitutions();
                          setInstitution("");
                          setIsAccountVerified(false);
                        }}
                        className="w-full px-4 py-4 text-base rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-white/50 backdrop-blur-sm"
                      >
                        <option value="">Select Currency</option>
                        {currencies.map((currency) => (
                          <option key={currency.code} value={currency.code}>
                            {currency.name} ({currency.code})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-sm font-semibold text-gray-700">
                        Exchange Rate
                      </label>
                      <button
                        type="button"
                        onClick={handleFetchRate}
                        disabled={!amount || !fiat}
                        className="px-4 py-2 !bg-gradient-to-r !from-purple-600 !to-blue-600 hover:!from-purple-700 hover:!to-blue-700 !text-white !rounded-xl !font-medium !shadow-lg hover:!shadow-xl !transition-all !duration-300 !text-base disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
                      >
                        Fetch Rate
                      </button>
                    </div>
                    {rate && (
                      <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 backdrop-blur-sm">
                        <div className="grid grid-rows-1 gap-2">
                          <div>
                            <p className="text-blue-800 font-medium text-sm">
                              1 USDC = {rate} {fiat}
                            </p>
                          </div>
                          <div className="border-l-2 border-blue-300 pl-3">
                            <p className="text-green-700 font-medium text-sm">
                              You will receive:
                            </p>
                            <p className="text-green-800 font-semibold">
                              {receiveAmount} {fiat}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 2: Recipient Details */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-700 bg-gradient-to-r from-green-100 to-emerald-100 rounded-full px-3 py-1">
                      Step 2
                    </span>
                    <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      Recipient Details
                    </h3>
                  </div>
                  <div>
                    <label
                      htmlFor="institution"
                      className="block text-sm font-semibold mb-3 text-gray-700"
                    >
                      Choose Bank or Mobile Network
                    </label>
                    <select
                      id="institution"
                      value={institution}
                      onChange={(e) => {
                        setInstitution(e.target.value);
                        setIsAccountVerified(false);
                      }}
                      onFocus={fetchInstitutions}
                      className="w-full px-4 py-4 text-base rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-white/50 backdrop-blur-sm"
                      required
                    >
                      <option value="">Select Institution</option>
                      {institutions.map((inst) => (
                        <option key={inst.code} value={inst.code}>
                          {inst.name}{" "}
                          {inst.type === "mobile"
                            ? "(Mobile Network)"
                            : "(Bank)"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="accountNumber"
                      className="block text-sm font-semibold mb-3 text-gray-700"
                    >
                      Account or Mobile Number
                    </label>
                    <input
                      type="text"
                      id="accountNumber"
                      value={accountIdentifier}
                      onChange={(e) => {
                        setAccountIdentifier(e.target.value);
                        setIsAccountVerified(false);
                      }}
                      className="w-full px-4 py-4 text-base rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-white/50 backdrop-blur-sm"
                      placeholder="Enter account or mobile number"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      For mobile numbers include country code (e.g.,
                      +2341234567890)
                    </p>
                  </div>
                  <div>
                    <label
                      htmlFor="accountName"
                      className="block text-sm font-semibold mb-3 text-gray-700"
                    >
                      Account Name
                    </label>
                    <input
                      type="text"
                      id="accountName"
                      value={accountName}
                      onChange={(e) => {
                        setAccountName(e.target.value);
                        setIsAccountVerified(false);
                      }}
                      className="w-full px-4 py-4 text-base rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-white/50 backdrop-blur-sm"
                      placeholder="Enter the exact account holder's name"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Ensure the name matches exactly
                    </p>
                  </div>
                  <div>
                    <button
                      type="button"
                      onClick={handleVerifyAccount}
                      disabled={
                        isLoading ||
                        !institution ||
                        !accountIdentifier ||
                        !accountName
                      }
                      className="w-full px-4 py-4 !bg-gradient-to-r !from-indigo-600 !to-purple-600 hover:!from-indigo-700 hover:!to-purple-700 !text-white !rounded-xl !font-medium !shadow-lg hover:!shadow-xl !transition-all !duration-300 disabled:opacity-50 disabled:cursor-not-allowed text-base transform hover:-translate-y-0.5"
                    >
                      {isLoading ? (
                        <div className="flex items-center justify-center">
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Verifying...
                        </div>
                      ) : (
                        "Verify Account"
                      )}
                    </button>
                    {isAccountVerified && (
                      <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 mt-3 backdrop-blur-sm">
                        <p className="text-green-800 font-medium text-sm">
                          ✓ Account verified successfully
                        </p>
                        <p className="text-green-700 text-xs mt-1">
                          Please double-check that this is your account
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Step 3: Transaction Memo */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-700 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-full px-3 py-1">
                      Step 3
                    </span>
                    <h3 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                      Transaction Description
                    </h3>
                  </div>
                  <div>
                    <label
                      htmlFor="memo"
                      className="block text-sm font-semibold mb-3 text-gray-700"
                    >
                      Transaction Memo
                    </label>
                    <textarea
                      id="memo"
                      value={memo}
                      onChange={(e) => setMemo(e.target.value)}
                      className="w-full px-4 py-4 text-base rounded-xl border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none transition-all bg-white/50 backdrop-blur-sm resize-none"
                      rows={3}
                      placeholder="Add a memo for this transaction..."
                      required
                    />
                  </div>
                </div>

                {/* Error and Success Messages */}
                {error && (
                  <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 rounded-xl border border-red-200 backdrop-blur-sm">
                    <p className="text-red-800 font-medium text-sm">{error}</p>
                  </div>
                )}

                {success && (
                  <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200 backdrop-blur-sm">
                    <p className="text-green-800 font-medium text-sm">
                      {success}
                    </p>
                  </div>
                )}

                {/* Submit Button */}
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200 backdrop-blur-sm">
                    <p className="text-amber-800 text-sm font-medium">
                      Important:
                    </p>
                    <p className="text-amber-700 text-xs mt-1">
                      Fetch rate and verify account before initiating payment
                    </p>
                  </div>
               
                  <button
                    type="submit"
                    disabled={isLoading || !rate || !isAccountVerified}
                    className="w-full py-4 px-6 !bg-gradient-to-r !from-purple-600 !to-blue-600 hover:!from-purple-700 hover:!to-blue-700 !text-white !font-medium text-base !rounded-xl !shadow-lg hover:!shadow-xl !transition-all !duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-1"
                  >
                    <div className="flex items-center justify-center gap-2">
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                          />
                        </svg>
                      )}
                      {isLoading
                        ? "Processing Payment..."
                        : "Initiate Offramp Payment"}
                    </div>
                  </button>
                  <p className="text-xs text-gray-600 text-center">
                    Funds will be refunded to your wallet if the transaction
                    fails
                  </p>
                </div>
              </form>
            </div>
          )}
        </div>

        <Footer />
      </div>
    </div>
  );
};

export default PaymentForm;

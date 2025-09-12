"use client";
export const dynamic = "force-dynamic";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import dynamicImport from "next/dynamic";
import { utils } from "ethers";
import { useAccount } from "wagmi";
import { useTranslation } from "react-i18next";
import "../../../lib/i18n";
import {
  ClipboardCopy,
  CheckCircle,
  QrCode,
  Wallet,
} from "lucide-react";

const PaymentQRCode = dynamicImport(() => import("./QRCode"), { ssr: false });
const PayWithWallet = dynamicImport(() => import("./PayWithWallet"), { ssr: false });

export default function PayPage({ params }: { params: { id: string } }) {
  const { t, i18n } = useTranslation();
  const searchParams = useSearchParams();
  
  // Set language from URL params or localStorage on component mount
  useEffect(() => {
    const urlLang = searchParams.get('lang');
    const savedLanguage = localStorage.getItem('language') || 'en';
    const targetLanguage = urlLang || savedLanguage;
    
    if (i18n.language !== targetLanguage) {
      i18n.changeLanguage(targetLanguage);
    }
  }, [i18n, searchParams]);
  const [copied, setCopied] = useState(false);
  const [isValidLink, setIsValidLink] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const amount = searchParams.get("amount");
  const currency = searchParams.get("currency");
  const description = searchParams.get("description");
  const to = searchParams.get("to");
  const signature = searchParams.get("sig");
  const { address: connectedAddress } = useAccount();

  const merchantAddress = to && utils.isAddress(to) ? to : connectedAddress || "";
  const shortAddress = merchantAddress ? `${merchantAddress.slice(0, 6)}...${merchantAddress.slice(-4)}` : "";

  useEffect(() => {
    const validateLink = async () => {
      try {
        const response = await fetch(`/api/payment-links/validate/${params.id}?${searchParams.toString()}`);
        const data = await response.json();
        
        if (!response.ok) {
          setIsValidLink(false);
          setErrorMessage(data.error || "Invalid or expired payment link");
        } else {
          setIsValidLink(true);
        }
      } catch (error) {
        setIsValidLink(false);
        setErrorMessage("Error validating payment link");
      } finally {
        setIsLoading(false);
      }
    };

    validateLink();
  }, [searchParams]);

  const handleCopy = () => {
    if (merchantAddress) {
      navigator.clipboard.writeText(merchantAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 space-y-4">
          <div className="text-center space-y-3">
            <h1 className="text-2xl font-bold text-gray-900">{t('paymentLink.validating')}</h1>
            <div className="flex justify-center">
              <svg className="animate-spin w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isValidLink) {
    return (
      <div className="min-h-screen bg-gray-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 space-y-4">
          <div className="text-center space-y-3">
            <h1 className="text-2xl font-bold text-red-600">{t('paymentLink.invalidLink')}</h1>
            <p className="text-sm text-gray-600">{errorMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-6 space-y-4">
        <div className="text-center space-y-3">
          <h1 className="text-2xl font-bold text-gray-900">{t('paymentLink.paymentRequest')}</h1>
        </div>

        <div className="text-center bg-gray-50 p-4 rounded-xl">
          <p className="text-sm text-gray-600 mb-1">{t('paymentLink.amount')}</p>
          <p className="text-3xl font-bold text-gray-900">
            {amount} <span className="text-xl font-normal">{currency}</span>
          </p>
        </div>

        {description && (
          <div className="text-center bg-gray-50 p-4 rounded-xl">
            <p className="text-sm text-gray-600 mb-1">{t('paymentLink.description')}</p>
            <p className="text-lg font-medium text-gray-900">
              {decodeURIComponent(description)}
            </p>
          </div>
        )}

        <div className="w-80 mx-auto space-y-2">
          <div className="flex items-center justify-between gap-4 bg-gray-100 px-4 py-3 rounded-lg group transition-all duration-200 group-hover:border-blue-500 border">
            <div className="flex-1 flex items-center gap-2">
              <Wallet size={18} className="text-blue-500" />
              <span className="text-sm font-medium text-gray-700">
                {t('paymentLink.merchantWallet')}
              </span>
            </div>
            <div className="flex-1 text-center">
              <span className="font-mono text-sm text-gray-800">
                {shortAddress}
              </span>
            </div>
            <div className="flex-1 flex justify-end">
              <button
                onClick={handleCopy}
                className="p-2 !bg-blue-500 rounded-lg text-white hover:!bg-blue-600 hover:text-white transition-colors duration-200"
                aria-label="Copy address"
              >
                {copied ? <CheckCircle size={16} /> : <ClipboardCopy size={16} />}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-2 rounded-xl">
          <div className="flex items-center justify-center gap-1 mb-4">
            <QrCode size={18} className="text-blue-500" />
            <h2 className="text-sm font-semibold text-gray-700">{t('paymentLink.scanToPay')}</h2>
          </div>
          <div className="flex justify-center">
            <PaymentQRCode to={merchantAddress} amount={amount || ""} currency={currency || ""} description={description || ""} />
          </div>
        </div>

        <PayWithWallet to={merchantAddress} amount={amount || ""} currency={currency || ""} description={description || ""} linkId={params.id} />

        <div className="text-center text-sm text-gray-600 bg-amber-50 p-4 rounded-xl">
          <p className="mb-1">
            {t('paymentLink.sendExactly')} <span className="font-semibold text-blue-600">{amount} {currency}</span> {t('paymentLink.toCompletePayment')}
          </p>
          <p>{t('paymentLink.transactionConfirmation')}</p>
        </div>
      </div>
    </div>
  );
}
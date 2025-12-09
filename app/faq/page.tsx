"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ChevronDown, 
  HelpCircle, 
  Shield, 
  Globe, 
  CreditCard, 
  DollarSign, 
  MessageCircle, 
  ArrowLeft,
  Zap,
  Users,
  Clock,
  Wallet
} from 'lucide-react';

export default function FAQPage() {
  const [expandedFaqs, setExpandedFaqs] = useState<Record<number, boolean>>({});

  const toggleFaq = (index: number) => {
    setExpandedFaqs(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  const faqs = [
    {
      icon: HelpCircle,
      iconColor: "from-blue-500 to-blue-600",
      question: "What is NEDA Pay?",
      answer: "NEDA Pay is a seamless platform for merchants and creators to get paid in local stablecoins. Whether you're online or on the ground, you can easily generate payment links & invoices, manage, swap, and withdraw your earnings & funds straight to your bank or mobile as well as keep track of performance and growth."
    },
    {
      icon: CreditCard,
      iconColor: "from-emerald-500 to-emerald-600",
      question: "How do I receive stablecoin payments?",
      answer: "Just sign up with your email with social login or simply connect your wallet, create a payment link or QR code or generate an invoice and share it with your customers. Payments arrive instantly, and you have the option to either swap to your preferred currency or withdraw to your bank account instantly, no delays, no hassle."
    },
    {
      icon: Shield,
      iconColor: "from-violet-500 to-violet-600",
      question: "Is NEDA Pay secure?",
      answer: "Absolutely. Your private keys stay with you. NEDA Pay uses secure wallet connections and processes all transactions transparently on-chain, so you stay in control at all times. You have a dashboard that displays all transactions in real time."
    },
    {
      icon: Globe,
      iconColor: "from-cyan-500 to-cyan-600",
      question: "Can I use NEDA Pay internationally?",
      answer: "Yes, you can accept payments from anyone, anywhere instantly with ease. NEDA Pay has you covered."
    },
    {
      icon: DollarSign,
      iconColor: "from-amber-500 to-amber-600",
      question: "What fees does NEDA Pay charge?",
      answer: "We keep it simple and affordable with low transaction fees on every payment. Full details are available in your merchant dashboard or on our website."
    },
    {
      icon: Zap,
      iconColor: "from-yellow-500 to-orange-500",
      question: "How fast are transactions?",
      answer: "Transactions on Base network are near-instant, typically confirming within seconds. You'll see payments reflected in your wallet almost immediately."
    },
    {
      icon: Wallet,
      iconColor: "from-purple-500 to-pink-500",
      question: "Which wallets are supported?",
      answer: "NEDA Pay supports all major wallets including Coinbase Wallet, MetaMask, Rainbow, and any WalletConnect compatible wallet. You can also use Farcaster frames for seamless payments."
    },
    {
      icon: Users,
      iconColor: "from-green-500 to-teal-500",
      question: "Can I use NEDA Pay for my business?",
      answer: "Yes! NEDA Pay is perfect for businesses of all sizes. Create payment links, generate invoices, and track all your transactions in one place. Our merchant dashboard gives you full visibility into your payment activity."
    },
    {
      icon: Clock,
      iconColor: "from-red-500 to-rose-500",
      question: "How do withdrawals work?",
      answer: "You can withdraw your stablecoin balance to your bank account or mobile money at any time. Withdrawals are processed quickly, and you'll receive your funds in your local currency."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-blue-900">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white hover:text-blue-400 transition-colors">
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </Link>
          <h1 className="text-lg font-bold text-white">FAQ</h1>
          <div className="w-16"></div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 border border-blue-400/30 rounded-full text-blue-300 font-medium text-sm mb-6">
            <HelpCircle className="w-4 h-4" />
            Support Center
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">
            Frequently Asked{' '}
            <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Questions</span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Find answers to common questions about NEDA Pay and how it works for your business
          </p>
        </div>

        {/* FAQ Items */}
        <div className="space-y-4 mb-12">
          {faqs.map((faq, index) => {
            const Icon = faq.icon;
            const isExpanded = expandedFaqs[index];
            
            return (
              <div
                key={index}
                className="group bg-slate-800/60 backdrop-blur-lg rounded-2xl border border-slate-700/50 overflow-hidden transition-all duration-300 hover:border-slate-600/50"
              >
                {/* Question Button */}
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full p-4 flex items-center justify-between hover:bg-slate-700/30 transition-all duration-300 focus:outline-none text-left"
                >
                  <div className="flex items-center flex-1 min-w-0">
                    <div className={`w-10 h-10 bg-gradient-to-br ${faq.iconColor} rounded-xl flex items-center justify-center mr-4 shadow-lg flex-shrink-0`}>
                      <Icon className="w-5 h-5 text-white" strokeWidth={2} />
                    </div>
                    <h3 className="text-sm font-semibold text-white pr-4">
                      {faq.question}
                    </h3>
                  </div>
                  <div className="flex-shrink-0 ml-4">
                    <div className="w-8 h-8 rounded-full bg-slate-700/50 flex items-center justify-center transition-colors duration-300">
                      <ChevronDown
                        className={`h-4 w-4 text-gray-400 transform transition-transform duration-300 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </div>
                </button>

                {/* Answer Content */}
                <div
                  className={`transition-all duration-300 ease-in-out overflow-hidden ${
                    isExpanded 
                      ? "max-h-96 opacity-100" 
                      : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="px-4 pb-4 border-t border-slate-700/50">
                    <div className="pt-4 pl-14">
                      <p className="text-gray-300 leading-relaxed text-sm">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Contact CTA */}
        <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-lg rounded-2xl p-8 border border-blue-400/20 text-center">
          <h3 className="text-xl font-bold text-white mb-3">
            Still have questions?
          </h3>
          <p className="text-gray-400 mb-6 text-sm">
            Our support team is here to help you get started with NEDA Pay
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a 
              href="https://t.me/nedapay" 
              target="_blank" 
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              Contact Support
            </a>
            
            <Link 
              href="/"
              className="w-full sm:w-auto px-6 py-3 bg-slate-700/50 hover:bg-slate-600/50 text-white font-semibold rounded-xl border border-slate-600/50 transition-all duration-300 flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to App
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

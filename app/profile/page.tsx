"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAccount } from "wagmi";
import {
  User,
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Copy,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { useFarcasterProfile } from "../hooks/useFarcasterProfile";

interface Transaction {
  id: string;
  merchantId: string;
  wallet: string;
  amount: number;
  currency: string;
  status: string;
  txHash: string;
  type?: string;
  network?: string;
  recipient?: string;
  createdAt: string;
}

interface ProfileStats {
  totalVolume: number;
  totalTransactions: number;
  completedTransactions: number;
  pendingTransactions: number;
  failedTransactions: number;
  volumeByCurrency: { [key: string]: number };
  recentTransactions: Transaction[];
}

export default function ProfilePage() {
  const { address, isConnected } = useAccount();
  const { profile: farcasterProfile } = useFarcasterProfile();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!address) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/transactions?merchantId=${address}`);
      if (response.ok) {
        const data = await response.json();
        const transactions: Transaction[] = data.transactions || [];
        const serverStats = data.stats;
        
        // Calculate stats locally or use server stats if available
        // We recalculate here to support the volumeByCurrency breakdown which might not be in server stats
        const completed = transactions.filter(t => {
          const status = (t.status || '').toLowerCase();
          return status === 'completed' || status === 'success' || status === 'settled';
        });
        
        const pending = transactions.filter(t => {
          const status = (t.status || '').toLowerCase();
          return status === 'pending';
        });
        
        const failed = transactions.filter(t => {
          const status = (t.status || '').toLowerCase();
          return status === 'failed' || status === 'refunded' || status === 'expired';
        });
        
        const volumeByCurrency = completed.reduce((acc, t) => {
          acc[t.currency] = (acc[t.currency] || 0) + t.amount;
          return acc;
        }, {} as { [key: string]: number });
        
        const totalVolume = Object.values(volumeByCurrency).reduce((a, b) => a + b, 0);
        
        setStats({
          totalVolume,
          totalTransactions: transactions.length,
          completedTransactions: completed.length,
          pendingTransactions: pending.length,
          failedTransactions: failed.length,
          volumeByCurrency,
          recentTransactions: transactions.slice(0, 5),
        });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const copyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-blue-900 flex items-center justify-center p-4">
        <div className="text-center">
          <User className="w-16 h-16 text-blue-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Connect Wallet</h2>
          <p className="text-gray-400">Please connect your wallet to view your profile.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-blue-900 p-4 pb-24">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="text-white hover:text-blue-400 transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-bold text-white">My Profile</h1>
          <button onClick={fetchStats} disabled={loading} className="text-white hover:text-blue-400">
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Profile Card */}
        <div className="bg-slate-800/60 backdrop-blur-lg rounded-2xl p-6 border border-slate-700/50 mb-6">
          <div className="flex items-center gap-4 mb-6">
            {farcasterProfile?.pfpUrl ? (
              <img
                src={farcasterProfile.pfpUrl}
                alt="Profile"
                className="w-16 h-16 rounded-full border-2 border-purple-400"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <User className="w-8 h-8 text-white" />
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-xl font-bold text-white">
                {farcasterProfile?.username ? `@${farcasterProfile.username}` : 'Anonymous User'}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-gray-400 text-sm font-mono">
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </span>
                <button onClick={copyAddress} className="text-gray-400 hover:text-blue-400">
                  {copied ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-400" />
            </div>
          ) : stats ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-700/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-gray-400 uppercase">Total Volume</span>
                </div>
                <p className="text-xl font-bold text-white">
                  ${stats.totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              
              <div className="bg-slate-700/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-blue-400" />
                  <span className="text-xs text-gray-400 uppercase">Transactions</span>
                </div>
                <p className="text-xl font-bold text-white">{stats.totalTransactions}</p>
              </div>
              
              <div className="bg-slate-700/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-gray-400 uppercase">Completed</span>
                </div>
                <p className="text-xl font-bold text-green-400">{stats.completedTransactions}</p>
              </div>
              
              <div className="bg-slate-700/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-yellow-400" />
                  <span className="text-xs text-gray-400 uppercase">Pending</span>
                </div>
                <p className="text-xl font-bold text-yellow-400">{stats.pendingTransactions}</p>
              </div>
            </div>
          ) : (
            <p className="text-center text-gray-400 py-4">No data available</p>
          )}
        </div>

        {/* Volume by Currency */}
        {stats && Object.keys(stats.volumeByCurrency).length > 0 && (
          <div className="bg-slate-800/60 backdrop-blur-lg rounded-2xl p-6 border border-slate-700/50 mb-6">
            <h3 className="text-lg font-semibold text-white mb-4">Volume by Currency</h3>
            <div className="space-y-3">
              {Object.entries(stats.volumeByCurrency).map(([currency, amount]) => (
                <div key={currency} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-xl">
                  <span className="text-white font-medium">{currency}</span>
                  <span className="text-green-400 font-bold">
                    {amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <div className="bg-slate-800/60 backdrop-blur-lg rounded-2xl p-6 border border-slate-700/50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Recent Transactions</h3>
            <Link 
              href="/all-transactions" 
              className="text-blue-400 text-sm flex items-center gap-1 hover:text-blue-300"
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
            </div>
          ) : stats?.recentTransactions.length ? (
            <div className="space-y-3">
              {stats.recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      tx.type === 'send' ? 'bg-green-500/20' : 'bg-blue-500/20'
                    }`}>
                      {tx.type === 'send' ? (
                        <ArrowUpRight className="w-4 h-4 text-green-400" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4 text-blue-400" />
                      )}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">
                        {tx.amount} {tx.currency}
                      </p>
                      <p className="text-gray-400 text-xs">
                        {new Date(tx.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      (() => {
                        const s = (tx.status || '').toLowerCase();
                        if (s === 'completed' || s === 'success' || s === 'settled') return 'bg-green-500/20 text-green-400';
                        if (s === 'pending') return 'bg-yellow-500/20 text-yellow-400';
                        return 'bg-red-500/20 text-red-400';
                      })()
                    }`}>
                      {tx.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-400 py-8">No transactions yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

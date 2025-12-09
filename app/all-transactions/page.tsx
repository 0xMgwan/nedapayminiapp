"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useAccount } from "wagmi";
import {
  Search,
  Filter,
  Download,
  RefreshCw,
  Calendar,
  ChevronDown,
  Eye,
  ExternalLink,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  DollarSign,
  Wallet,
  Hash,
  Copy,
  CreditCard,
} from "lucide-react";
import { stablecoins } from "../data/stablecoins";
import Header from "../components/Header";
import Footer from "../components/Footer";

// Types
interface Transaction {
  id: string;
  merchantId: string;
  wallet: string;
  amount: number;
  currency: string;
  status: "Pending" | "Completed" | "Failed" | "Cancelled";
  txHash: string;
  createdAt: string;
  updatedAt?: string;
}

interface FilterState {
  search: string;
  status: string;
  currency: string;
  dateRange: string;
  amountRange: {
    min: string;
    max: string;
  };
}

// Status configuration
const statusConfig = {
  Pending: {
    color: "text-yellow-700 !bg-yellow-100 !border-yellow-200",
    icon: Clock,
    darkColor:
      "dark:text-yellow-300 dark:bg-yellow-900/30 dark:border-yellow-700",
  },
  Completed: {
    color: "text-green-700 !bg-green-100 !border-green-200",
    icon: CheckCircle,
    darkColor: "dark:text-green-300 dark:bg-green-900/30 dark:border-green-700",
  },
  Failed: {
    color: "text-red-700 !bg-red-100 !border-red-200",
    icon: XCircle,
    darkColor: "dark:text-red-300 dark:bg-red-900/30 dark:border-red-700",
  },
  Cancelled: {
    color: "text-gray-700 !bg-gray-100 !border-gray-200",
    icon: AlertCircle,
    darkColor: "dark:text-gray-300 dark:bg-gray-900/30 dark:border-gray-700",
  },
};

// Currency symbols from stablecoins data
const currencySymbols: { [key: string]: string } = stablecoins.reduce(
  (acc, coin) => ({
    ...acc,
     // Use currency code as symbol, default to $ for USD
  }),
  {} as { [key: string]: string }
);

export default function TransactionsPage() {
  const { authenticated: privyAuthenticated, user } = usePrivy();
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  
  // Support both Privy and wagmi authentication
  const isAuthenticated = privyAuthenticated || wagmiConnected;
  const walletAddress = user?.wallet?.address || wagmiAddress;
  
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "",
    currency: "",
    dateRange: "",
    amountRange: { min: "", max: "" },
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    if (!isAuthenticated || !walletAddress) return;

    try {
      setRefreshing(true);
      const response = await fetch(
        `/api/transactions?merchantId=${walletAddress}`
      );
      if (response.ok) {
        const data = await response.json();
        setTransactions(data);
      } else {
        console.error("Failed to fetch transactions:", response.status);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isAuthenticated, walletAddress]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((transaction) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          transaction.txHash.toLowerCase().includes(searchLower) ||
          transaction.wallet.toLowerCase().includes(searchLower) ||
          transaction.currency.toLowerCase().includes(searchLower) ||
          transaction.amount.toString().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Status filter
      if (filters.status && transaction.status !== filters.status) {
        return false;
      }

      // Currency filter
      if (filters.currency && transaction.currency !== filters.currency) {
        return false;
      }

      // Amount range filter
      if (
        filters.amountRange.min &&
        transaction.amount < parseFloat(filters.amountRange.min)
      ) {
        return false;
      }
      if (
        filters.amountRange.max &&
        transaction.amount > parseFloat(filters.amountRange.max)
      ) {
        return false;
      }

      // Date range filter
      if (filters.dateRange) {
        const transactionDate = new Date(transaction.createdAt);
        const now = new Date();
        let cutoffDate = new Date();

        switch (filters.dateRange) {
          case "today":
            cutoffDate.setHours(0, 0, 0, 0);
            break;
          case "week":
            cutoffDate.setDate(now.getDate() - 7);
            break;
          case "month":
            cutoffDate.setMonth(now.getMonth() - 1);
            break;
          case "quarter":
            cutoffDate.setMonth(now.getMonth() - 3);
            break;
          default:
            return true;
        }

        if (transactionDate < cutoffDate) {
          return false;
        }
      }

      return true;
    });
  }, [transactions, filters]);

  // Pagination
  const paginatedTransactions = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredTransactions, currentPage]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

  // Statistics
  const stats = useMemo(() => {
    // Calculate totals by currency
    const totalsByCurrency = filteredTransactions.reduce(
      (acc, transaction) => {
        const currency = transaction.currency;
        if (!acc[currency]) {
          acc[currency] = 0;
        }
        acc[currency] += transaction.amount;
        return acc;
      },
      {} as { [key: string]: number }
    );

    const completed = filteredTransactions.filter(
      (t) => t.status === "Completed"
    );
    const pending = filteredTransactions.filter((t) => t.status === "Pending");
    const failed = filteredTransactions.filter((t) => t.status === "Failed");

    // Calculate completed value by currency
    const completedValueByCurrency = completed.reduce(
      (acc, transaction) => {
        const currency = transaction.currency;
        if (!acc[currency]) {
          acc[currency] = 0;
        }
        acc[currency] += transaction.amount;
        return acc;
      },
      {} as { [key: string]: number }
    );

    return {
      totalsByCurrency,
      completed: completed.length,
      pending: pending.length,
      failed: failed.length,
      completedValueByCurrency,
    };
  }, [filteredTransactions]);

  // Get unique currencies from stablecoins
  const availableCurrencies = useMemo(() => {
    return [...new Set(stablecoins.map((coin) => coin.baseToken))];
  }, []);

  // Format currency
  const formatCurrency = (amount: number, currency: string) => {
    const symbol = currencySymbols[currency] || currency;
    return `${symbol} ${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    })}`;
  };

  // Helper function to format currency totals for display
  const formatCurrencyTotals = (totals: { [key: string]: number }) => {
    return Object.entries(totals)
      .map(([currency, amount]) => formatCurrency(amount, currency))
      .join(" | ");
  };

  // Copy to clipboard
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  // Export transactions
  const exportTransactions = () => {
    const csvContent = [
      ["Date", "Hash", "Wallet", "Amount", "Currency", "Status"],
      ...filteredTransactions.map((t) => [
        new Date(t.createdAt).toLocaleDateString(),
        t.txHash,
        t.wallet,
        t.amount.toString(),
        t.currency,
        t.status,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Open transaction in explorer
  const openInExplorer = (txHash: string, chainId: number) => {
    const chain = stablecoins.find((coin) => coin.chainId === chainId);
    if (chain) {
      const explorerUrl =
        chain.chainId === 8453
          ? `https://basescan.org/tx/${txHash}`
          : chain.chainId === 11155111
            ? `https://sepolia.etherscan.io/tx/${txHash}`
            : "";
      if (explorerUrl) {
        window.open(explorerUrl, "_blank");
      }
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <CreditCard className="w-16 h-16 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Authentication Required
          </h2>
          <p className="text-gray-600">
            Please connect your wallet to view your transactions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white">
      <Header />
      <div className="container mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Transactions
              </h1>
              <p className="text-gray-600">
                Monitor and manage your payment transactions
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={fetchTransactions}
                disabled={refreshing}
                className="flex items-center gap-2 px-4 py-2 !bg-white !border !border-gray-200 !rounded-lg hover:!bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                />
                Refresh
              </button>
              <button
                onClick={exportTransactions}
                className="flex items-center gap-2 px-4 py-2 !bg-blue-600 !text-white !rounded-lg hover:!bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-600">
                    Total Volume
                  </p>
                  {Object.keys(stats.totalsByCurrency).length === 0 ? (
                    <p className="text-2xl font-bold text-gray-900">$0.00</p>
                  ) : Object.keys(stats.totalsByCurrency).length === 1 ? (
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCurrencyTotals(stats.totalsByCurrency)}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {Object.entries(stats.totalsByCurrency).map(
                        ([currency, amount]) => (
                          <p
                            key={currency}
                            className="text-lg font-bold text-gray-900"
                          >
                            {formatCurrency(amount, currency)}
                          </p>
                        )
                      )}
                    </div>
                  )}
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <DollarSign className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.completed}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {stats.pending}
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Clock className="w-6 h-6 text-yellow-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Failed</p>
                  <p className="text-2xl font-bold text-red-600">
                    {stats.failed}
                  </p>
                </div>
                <div className="p-3 bg-red-100 rounded-lg">
                  <XCircle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by hash, wallet, or amount..."
                  value={filters.search}
                  onChange={(e) =>
                    setFilters((prev) => ({ ...prev, search: e.target.value }))
                  }
                  className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2 !border !border-gray-200 !rounded-lg hover:!bg-gray-50 transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filters
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${showFilters ? "rotate-180" : ""}`}
                />
              </button>
            </div>

            {/* Advanced Filters */}
            {showFilters && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Status Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={filters.status}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          status: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">All Statuses</option>
                      <option value="Pending">Pending</option>
                      <option value="Completed">Completed</option>
                      <option value="Failed">Failed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>

                  {/* Currency Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Currency
                    </label>
                    <select
                      value={filters.currency}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          currency: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 !border !border-gray-200 !rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">All Currencies</option>
                      {availableCurrencies.map((currency) => (
                        <option key={currency} value={currency}>
                          {currency}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Date Range Filter */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date Range
                    </label>
                    <select
                      value={filters.dateRange}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          dateRange: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 !border !border-gray-200 !rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">All Time</option>
                      <option value="today">Today</option>
                      <option value="week">Last 7 Days</option>
                      <option value="month">Last 30 Days</option>
                      <option value="quarter">Last 90 Days</option>
                    </select>
                  </div>

                  {/* Amount Range */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount Range
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="Min"
                        value={filters.amountRange.min}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            amountRange: {
                              ...prev.amountRange,
                              min: e.target.value,
                            },
                          }))
                        }
                        className="w-full px-3 py-2 !border !border-gray-200 !rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <input
                        type="number"
                        placeholder="Max"
                        value={filters.amountRange.max}
                        onChange={(e) =>
                          setFilters((prev) => ({
                            ...prev,
                            amountRange: {
                              ...prev.amountRange,
                              max: e.target.value,
                            },
                          }))
                        }
                        className="w-full px-3 py-2 !border !border-gray-200 !rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Clear Filters */}
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() =>
                      setFilters({
                        search: "",
                        status: "",
                        currency: "",
                        dateRange: "",
                        amountRange: { min: "", max: "" },
                      })
                    }
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Clear All Filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Transactions Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : paginatedTransactions.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No transactions found
              </h3>
              <p className="text-gray-600">
                {filteredTransactions.length === 0 && transactions.length > 0
                  ? "Try adjusting your filters to see more results."
                  : "Your transactions will appear here once you start receiving payments."}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Transaction
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginatedTransactions.map((transaction) => {
                      const StatusIcon = statusConfig[transaction.status].icon;
                      return (
                        <tr
                          key={transaction.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex-shrink-0">
                                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                  <Hash className="w-5 h-5 text-blue-600" />
                                </div>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-medium text-gray-900 truncate">
                                    {transaction.txHash.slice(0, 10)}...
                                    {transaction.txHash.slice(-8)}
                                  </p>
                                  <button
                                    onClick={() =>
                                      copyToClipboard(transaction.txHash)
                                    }
                                    className="text-gray-400 hover:text-gray-600 transition-colors"
                                  >
                                    <Copy className="w-4 h-4" />
                                  </button>
                                </div>
                                <p className="text-sm text-gray-500 truncate">
                                  {transaction.wallet.slice(0, 8)}...
                                  {transaction.wallet.slice(-6)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <p className="font-medium text-gray-900">
                                {transaction.amount}
                              </p>
                              <p className="text-gray-500">
                                {transaction.currency}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-bold border ${
                                statusConfig[transaction.status].color
                              } ${statusConfig[transaction.status].darkColor}`}
                            >
                              <StatusIcon className="w-3 h-3" />
                              {transaction.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm">
                              <p className="text-gray-900">
                                {new Date(
                                  transaction.createdAt
                                ).toLocaleDateString()}
                              </p>
                              <p className="text-gray-500">
                                {new Date(
                                  transaction.createdAt
                                ).toLocaleTimeString()}
                              </p>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() =>
                                  setSelectedTransaction(transaction)
                                }
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  const chainId = stablecoins.find(
                                    (coin) =>
                                      coin.baseToken === transaction.currency
                                  )?.chainId;
                                  if (chainId)
                                    openInExplorer(transaction.txHash, chainId);
                                }}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
                    {Math.min(
                      currentPage * itemsPerPage,
                      filteredTransactions.length
                    )}{" "}
                    of {filteredTransactions.length} transactions
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setCurrentPage(Math.max(1, currentPage - 1))
                      }
                      disabled={currentPage === 1}
                      className="px-3 py-1 !border !border-gray-200 !rounded hover:!bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Previous
                    </button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const page = i + Math.max(1, currentPage - 2);
                      if (page > totalPages) return null;
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`px-3 py-1 !border !rounded transition-colors ${
                            page === currentPage
                              ? "bg-blue-600 text-white !border-blue-600"
                              : "!border-gray-200 hover:bg-gray-50"
                          }`}
                        >
                          {page}
                        </button>
                      );
                    })}
                    <button
                      onClick={() =>
                        setCurrentPage(Math.min(totalPages, currentPage + 1))
                      }
                      disabled={currentPage === totalPages}
                      className="px-3 py-1 !border !border-gray-200 !rounded hover:!bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Transaction Detail Modal */}
        {selectedTransaction && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Transaction Details
                  </h3>
                  <button
                    onClick={() => setSelectedTransaction(null)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Transaction Hash
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded flex-1 break-all">
                      {selectedTransaction.txHash}
                    </code>
                    <button
                      onClick={() =>
                        copyToClipboard(selectedTransaction.txHash)
                      }
                      className="text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Wallet Address
                  </label>
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded flex-1 break-all">
                      {selectedTransaction.wallet}
                    </code>
                    <button
                      onClick={() =>
                        copyToClipboard(selectedTransaction.wallet)
                      }
                      className="text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount
                    </label>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatCurrency(
                        selectedTransaction.amount,
                        selectedTransaction.currency
                      )}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border ${
                        statusConfig[selectedTransaction.status].color
                      } ${statusConfig[selectedTransaction.status].darkColor}`}
                    >
                      {React.createElement(
                        statusConfig[selectedTransaction.status].icon,
                        {
                          className: "w-3 h-3",
                        }
                      )}
                      {selectedTransaction.status}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Created
                    </label>
                    <p className="text-sm text-gray-900">
                      {new Date(selectedTransaction.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {selectedTransaction.updatedAt && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Updated
                      </label>
                      <p className="text-sm text-gray-900">
                        {new Date(
                          selectedTransaction.updatedAt
                        ).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Currency
                  </label>
                  <p className="text-sm text-gray-900">
                    {selectedTransaction.currency}
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => {
                      const chainId = stablecoins.find(
                        (coin) =>
                          coin.baseToken === selectedTransaction.currency
                      )?.chainId;
                      if (chainId)
                        openInExplorer(selectedTransaction.txHash, chainId);
                    }}
                    className="flex items-center gap-2 px-4 py-2 !bg-blue-600 text-white !rounded-lg hover:!bg-blue-700 transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View on Explorer
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}

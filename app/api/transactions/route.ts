import { NextRequest, NextResponse } from 'next/server';
import prisma from '../../../lib/prisma';

// Interfaces for External API Response
interface ExternalTransaction {
  id: string;
  createdAt: string;
  merchantId: string;
  status: string;
  amount: string;
  rate: string;
  currency: string;
  accountName: string;
  accountNumber: string;
  institution: string;
}

interface ExternalApiResponse {
  success: boolean;
  data: {
    transactions: ExternalTransaction[];
    pagination: {
      page: number;
      pageSize: number;
      totalCount: number;
      totalPages: number;
    };
  };
}

// GET: Fetch transactions - by id, merchantId, or txHash
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const transactionId = searchParams.get('id');
    const merchantId = searchParams.get('merchantId');
    const txHash = searchParams.get('txHash');

    const API_BASE_URL = 'https://api.nedapay.xyz/api/v1/ramp/paycrest/transactions';
    const API_KEY = process.env.NEDAPAY_API_KEY || '';

    // Helper for headers
    const headers = {
      'Content-Type': 'application/json',
      'x-api-key': API_KEY,
    };

    // Fetch single transaction by ID from External API
    if (transactionId) {
      const res = await fetch(`${API_BASE_URL}/${transactionId}`, {
        headers,
        cache: 'no-store'
      });
      
      if (!res.ok) {
        if (res.status === 404) {
          return NextResponse.json(
            { error: 'Transaction not found' },
            { status: 404 }
          );
        }
        throw new Error(`External API error: ${res.status} ${res.statusText}`);
      }

      const transaction = await res.json();
      return NextResponse.json(transaction);
    }

    // Fetch single transaction by txHash
    // Note: External API docs don't explicitly list txHash filter, utilizing local DB for now.
    if (txHash) {
      const transaction = await prisma.transaction.findFirst({
        where: { txHash }
      });
      
      if (!transaction) {
        return NextResponse.json(
          { error: 'Transaction not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(transaction);
    }

    // Fetch all transactions for a merchant from External API
    if (merchantId) {
      const res = await fetch(`${API_BASE_URL}?wallet=${merchantId}`, {
        headers,
        cache: 'no-store'
      });

      if (!res.ok) {
        throw new Error(`External API error: ${res.status} ${res.statusText}`);
      }

      const responseData: ExternalApiResponse = await res.json();
      const transactions = responseData.data.transactions;
      console.log(`📊 Fetched ${transactions.length} transactions for merchantId: ${merchantId} from API`);

      // Calculate stats to match /api/sync-transactions payload structure
      const totalVolume = transactions.reduce((sum: number, tx: any) => sum + (parseFloat(tx.amount) || 0), 0);
      
      const completedCount = transactions.filter((tx: any) => {
        const status = (tx.status || '').toLowerCase();
        return status === 'completed' || status === 'success' || status === 'settled';
      }).length;
      
      const pendingCount = transactions.filter((tx: any) => {
        const status = (tx.status || '').toLowerCase();
        return status === 'pending';
      }).length;
      
      const failedCount = transactions.filter((tx: any) => {
        const status = (tx.status || '').toLowerCase();
        return status === 'failed' || status === 'refunded' || status === 'expired';
      }).length;

      return NextResponse.json({
        transactions,
        stats: {
          totalVolume,
          totalCount: transactions.length,
          completedCount,
          pendingCount,
          failedCount
        }
      });
    }

    // No valid query params provided
    return NextResponse.json(
      { error: 'Please provide id, txHash, or merchantId parameter' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error fetching transaction(s):', error);
    return NextResponse.json(
      { error: 'Failed to fetch transaction(s)' },
      { status: 500 }
    );
  }
}

// POST: Add a new transaction
export async function POST(req: NextRequest) {
  const data = await req.json();
  const { merchantId, wallet, amount, currency, status, txHash, recipient, orderId, type, network } = data;
  if (!merchantId || !wallet || !amount || !currency || !status || !txHash) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount)) {
    return NextResponse.json({ error: 'Invalid amount format' }, { status: 400 });
  }

  const transaction = await prisma.transaction.create({
    data: {
      merchantId,
      wallet,
      amount: parsedAmount,
      currency,
      status,
      txHash,
      recipient: recipient || null,
      orderId: orderId || null,
      type: type || null,
      network: network || null,
    },
  });
  return NextResponse.json(transaction, { status: 201 });
}

// PUT: Update a transaction by txHash
export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const txHash = searchParams.get('txHash');

    if (!txHash) {
      return NextResponse.json({ error: 'txHash is required' }, { status: 400 });
    }

    const data = await req.json();
    const { merchantId, wallet, amount, currency, status, recipient, orderId, type, network } = data;

    if (!merchantId || !wallet || !amount || !currency || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) {
      return NextResponse.json({ error: 'Invalid amount format' }, { status: 400 });
    }

    // Check for exactly one Pending transaction with the given txHash
    const pendingTransactions = await prisma.transaction.findMany({
      where: {
        txHash,
        status: 'Pending',
      },
    });

    if (pendingTransactions.length === 0) {
      return NextResponse.json(
        { error: 'No Pending transaction found for this txHash' },
        { status: 404 }
      );
    }

    if (pendingTransactions.length > 1) {
      return NextResponse.json(
        { error: 'Multiple Pending transactions found for this txHash' },
        { status: 400 }
      );
    }

    // Update the single Pending transaction
    const updatedTransaction = await prisma.transaction.updateMany({
      where: {
        txHash,
        status: 'Pending',
      },
      data: {
        merchantId,
        wallet,
        amount: parsedAmount,
        currency,
        status,
        recipient: recipient || null,
        orderId: orderId || null,
        type: type || null,
        network: network || null,
      },
    });

    if (updatedTransaction.count === 0) {
      return NextResponse.json(
        { error: 'Failed to update transaction' },
        { status: 500 }
      );
    }

    // Fetch the updated transaction to return it
    const transaction = await prisma.transaction.findFirst({
      where: { txHash, status },
    });

    return NextResponse.json(transaction, { status: 200 });
  } catch (error) {
    console.error('Error updating transaction:', error);
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}

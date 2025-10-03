import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Fetch all transactions for a merchant (by merchantId query param)
export async function GET(req: NextRequest) {
  // Prevent build/static analysis from triggering this API route
  if (process.env.NODE_ENV === 'production' && process.env.NETLIFY === 'true') {
    return new NextResponse('Not Found', { status: 404 });
  }
  const { searchParams } = new URL(req.url);
  const merchantId = searchParams.get('merchantId');
  if (!merchantId) {
    // Return 404 to prevent build/static analysis failures
    return new NextResponse('Not Found', { status: 404 });
  }
  const transactions = await prisma.transaction.findMany({
    where: { merchantId },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(transactions);
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
  } finally {
    await prisma.$disconnect();
  }
}

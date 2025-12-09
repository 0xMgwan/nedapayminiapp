import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Fetch transactions - by id, merchantId, or txHash
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const transactionId = searchParams.get('id');
    const merchantId = searchParams.get('merchantId');
    const txHash = searchParams.get('txHash');

    // Fetch single transaction by ID
    if (transactionId) {
      const transaction = await prisma.transaction.findUnique({
        where: { id: transactionId }
      });
      
      if (!transaction) {
        return NextResponse.json(
          { error: 'Transaction not found' },
          { status: 404 }
        );
      }
      
      return NextResponse.json(transaction);
    }

    // Fetch single transaction by txHash
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

    // Fetch all transactions for a merchant
    if (merchantId) {
      const transactions = await prisma.transaction.findMany({
        where: { merchantId },
        orderBy: { createdAt: 'desc' },
      });
      return NextResponse.json(transactions);
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
  try {
    const data = await req.json();
    const { merchantId, wallet, amount, currency, status, txHash, recipient, orderId, type, network } = data;
    
    console.log('📝 Creating transaction:', { merchantId, wallet, amount, currency, status, txHash, recipient, orderId, type, network });
    
    if (!merchantId || !wallet || !amount || !currency || !status || !txHash) {
      console.error('❌ Missing required fields:', { merchantId: !!merchantId, wallet: !!wallet, amount: !!amount, currency: !!currency, status: !!status, txHash: !!txHash });
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount)) {
      console.error('❌ Invalid amount format:', amount);
      return NextResponse.json({ error: 'Invalid amount format' }, { status: 400 });
    }

    // Check if transaction with this txHash already exists
    const existingTransaction = await prisma.transaction.findFirst({
      where: { txHash }
    });

    if (existingTransaction) {
      console.log('⚠️ Transaction already exists with txHash:', txHash);
      // Return existing transaction instead of creating duplicate
      return NextResponse.json(existingTransaction, { status: 200 });
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
    
    console.log('✅ Transaction created:', transaction.id);
    return NextResponse.json(transaction, { status: 201 });
  } catch (error: any) {
    console.error('❌ Error creating transaction:', error);
    return NextResponse.json({ error: 'Failed to create transaction', details: error.message }, { status: 500 });
  }
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

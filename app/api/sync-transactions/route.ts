import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PAYCREST_API_URL = 'https://api.paycrest.io';
const CLIENT_ID = process.env.PAYCREST_CLIENT_ID!;

const headers = {
  'API-Key': CLIENT_ID,
  'Content-Type': 'application/json',
};

// GET: Sync transactions from Paycrest API and return them
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
    }

    const normalizedWallet = walletAddress.toLowerCase();
    console.log(`🔄 Syncing transactions for wallet: ${normalizedWallet}`);

    // Fetch orders from Paycrest API
    let paycrestOrders: any[] = [];
    try {
      const response = await fetch(`${PAYCREST_API_URL}/v1/sender/orders/`, { 
        headers,
        cache: 'no-store'
      });
      
      if (response.ok) {
        const data = await response.json();
        paycrestOrders = data.data?.orders || [];
        console.log(`📦 Fetched ${paycrestOrders.length} orders from Paycrest`);
      } else {
        console.error('Failed to fetch from Paycrest:', response.status);
      }
    } catch (error) {
      console.error('Error fetching from Paycrest:', error);
    }

    // Sync Paycrest orders to database
    let syncedCount = 0;
    for (const order of paycrestOrders) {
      // Check if this order already exists in database
      const existingTx = await prisma.transaction.findFirst({
        where: { txHash: order.txHash || order.id }
      });

      if (!existingTx && order.fromAddress) {
        // Only sync if fromAddress matches the wallet (case-insensitive)
        const orderWallet = order.fromAddress.toLowerCase();
        
        try {
          await prisma.transaction.create({
            data: {
              merchantId: orderWallet,
              wallet: orderWallet,
              amount: parseFloat(order.amount) || 0,
              currency: order.token || 'USDC',
              status: order.status === 'settled' ? 'Completed' : 
                      order.status === 'pending' ? 'Pending' : 
                      order.status === 'failed' ? 'Failed' : order.status,
              txHash: order.txHash || order.id,
              recipient: order.recipient?.accountIdentifier || null,
              orderId: order.id,
              type: 'send',
              network: order.network || 'base',
            }
          });
          syncedCount++;
          console.log(`✅ Synced order ${order.id}`);
        } catch (err) {
          console.error(`Failed to sync order ${order.id}:`, err);
        }
      }
    }

    console.log(`📊 Synced ${syncedCount} new transactions`);

    // Now fetch all transactions for this wallet from database
    const transactions = await prisma.transaction.findMany({
      where: { 
        merchantId: {
          equals: normalizedWallet,
          mode: 'insensitive'
        }
      },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate stats
    const totalVolume = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
    const completedCount = transactions.filter(tx => 
      tx.status === 'Completed' || tx.status === 'Success' || tx.status === 'settled'
    ).length;
    const pendingCount = transactions.filter(tx => tx.status === 'Pending' || tx.status === 'pending').length;
    const failedCount = transactions.filter(tx => tx.status === 'Failed' || tx.status === 'failed').length;

    return NextResponse.json({
      transactions,
      stats: {
        totalVolume,
        totalCount: transactions.length,
        completedCount,
        pendingCount,
        failedCount
      },
      paycrestOrdersCount: paycrestOrders.length,
      syncedCount
    });

  } catch (error) {
    console.error('Error syncing transactions:', error);
    return NextResponse.json({ error: 'Failed to sync transactions' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

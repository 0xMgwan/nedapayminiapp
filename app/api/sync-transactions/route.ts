import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PAYCREST_API_URL = 'https://api.paycrest.io';
const CLIENT_ID = process.env.PAYCREST_CLIENT_ID || '';

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
    let paycrestError = null;
    
    try {
      console.log(`📡 Fetching from Paycrest with API key: ${CLIENT_ID ? CLIENT_ID.substring(0, 8) + '...' : 'MISSING'}`);
      const response = await fetch(`${PAYCREST_API_URL}/v1/sender/orders/`, { 
        headers: {
          'API-Key': CLIENT_ID,
          'Content-Type': 'application/json',
        },
        cache: 'no-store'
      });
      
      console.log(`📡 Paycrest response status: ${response.status}`);
      
      if (response.ok) {
        const data = await response.json();
        paycrestOrders = data.data?.orders || [];
        console.log(`📦 Fetched ${paycrestOrders.length} orders from Paycrest`);
      } else {
        const errorText = await response.text();
        paycrestError = `Paycrest API error: ${response.status} - ${errorText}`;
        console.error(paycrestError);
      }
    } catch (error: any) {
      paycrestError = `Paycrest fetch error: ${error.message}`;
      console.error(paycrestError);
    }

    // Sync Paycrest orders to database
    let syncedCount = 0;
    const syncErrors: string[] = [];
    
    for (const order of paycrestOrders) {
      if (!order.fromAddress) continue;
      
      try {
        // Check if this order already exists in database
        const existingTx = await prisma.transaction.findFirst({
          where: { txHash: order.txHash || order.id }
        });

        if (!existingTx) {
          const orderWallet = order.fromAddress.toLowerCase();
          
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
        }
      } catch (err: any) {
        syncErrors.push(`Order ${order.id}: ${err.message}`);
        console.error(`Failed to sync order ${order.id}:`, err.message);
      }
    }

    console.log(`📊 Synced ${syncedCount} new transactions`);

    // Fetch all transactions for this wallet from database (simple query without mode)
    let transactions: any[] = [];
    try {
      transactions = await prisma.transaction.findMany({
        where: { 
          merchantId: normalizedWallet
        },
        orderBy: { createdAt: 'desc' },
      });
      console.log(`📊 Found ${transactions.length} transactions in DB for ${normalizedWallet}`);
    } catch (dbError: any) {
      console.error('DB query error:', dbError.message);
      return NextResponse.json({ 
        error: 'Database query failed', 
        details: dbError.message 
      }, { status: 500 });
    }

    // Calculate stats
    const totalVolume = transactions.reduce((sum: number, tx: any) => sum + (tx.amount || 0), 0);
    const completedCount = transactions.filter((tx: any) => 
      tx.status === 'Completed' || tx.status === 'Success' || tx.status === 'settled'
    ).length;
    const pendingCount = transactions.filter((tx: any) => tx.status === 'Pending' || tx.status === 'pending').length;
    const failedCount = transactions.filter((tx: any) => tx.status === 'Failed' || tx.status === 'failed').length;

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
      syncedCount,
      paycrestError,
      syncErrors: syncErrors.length > 0 ? syncErrors : undefined
    });

  } catch (error: any) {
    console.error('Error syncing transactions:', error);
    return NextResponse.json({ 
      error: 'Failed to sync transactions',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

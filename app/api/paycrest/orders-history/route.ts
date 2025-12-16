import { NextResponse } from 'next/server';

import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet = searchParams.get('wallet');
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');

    if (!wallet) {
      return NextResponse.json(
        { status: 'error', message: 'Wallet address is required' },
        { status: 400 }
      );
    }

    // Find user by wallet address
    const user = await prisma.user.findUnique({
      where: { wallet },
      select: { wallet: true },
    });

    if (!user) {
      return NextResponse.json(
        { status: 'error', message: 'User not found' },
        { status: 404 }
      );
    }

    // Fetch offramp transactions for the user's merchantId with all fields
    const transactions = await prisma.offRampTransaction.findMany({
      where: {
        merchantId: user.wallet!,
      },
      select: {
        id: true,
        createdAt: true,
        status: true,
        merchantId: true,
        amount: true,
        currency: true,
        accountName: true,
        accountNumber: true,
        institution: true,
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Count total transactions for pagination
    const total = await prisma.offRampTransaction.count({
      where: {
        merchantId: user.wallet!,
      },
    });

    return NextResponse.json({
      status: 'success',
      data: {
        transactions,
        total,
        page,
        pageSize,
      },
    });
  } catch (error) {
    console.error('Error fetching offramp transactions:', error);
    return NextResponse.json(
      { status: 'error', message: 'Failed to fetch transactions' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
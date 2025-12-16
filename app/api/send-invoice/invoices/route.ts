import { NextResponse } from 'next/server';

import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    // Parse query parameters
    const url = new URL(req.url);
    const merchantId = url.searchParams.get('merchantId');
    const status = url.searchParams.get('status') || '';
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);
    const skip = (page - 1) * limit;

    // Validate merchantId
    if (!merchantId) {
      return NextResponse.json({ error: 'Merchant ID is required' }, { status: 400 });
    }

    // Build where clause for filtering
    const where: any = { merchantId };
    if (status) {
      where.status = status.toLowerCase();
    }

    // Fetch invoices
    const invoices = await prisma.invoice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        paymentLink: { select: { url: true } },
      },
    });

    // Get total count for pagination
    const totalInvoices = await prisma.invoice.count({ where });
    const totalPages = Math.ceil(totalInvoices / limit);

    // Format response to match frontend expectations
    const formattedInvoices = invoices.map((invoice) => ({
      id: invoice.id,
      createdAt: invoice.createdAt.toISOString(),
      recipient: invoice.recipient,
      email: invoice.email,
      status: invoice.status,
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
      paymentLink: invoice.paymentLink,
    }));

    return NextResponse.json({
      invoices: formattedInvoices,
      totalPages,
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}

export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function PUT(req: Request) {
  try {
    const { linkId, paidAt } = await req.json();

    if (!linkId || !paidAt) {
      return NextResponse.json(
        { error: 'Missing required fields: linkId and paidAt' },
        { status: 400 }
      );
    }

    // Find the payment link first
    const paymentLink = await prisma.paymentLink.findUnique({
      where: { linkId },
      include: { invoice: true }
    });

    if (!paymentLink) {
      return NextResponse.json(
        { error: 'Payment link not found' },
        { status: 404 }
      );
    }

    if (!paymentLink.invoice) {
      return NextResponse.json(
        { error: 'No invoice associated with this payment link' },
        { status: 404 }
      );
    }

    // Update the invoice to paid status
    const updatedInvoice = await prisma.invoice.update({
      where: { id: paymentLink.invoice.id },
      data: {
        status: 'paid',
        paidAt: new Date(paidAt)
      }
    });

    return NextResponse.json({
      message: 'Invoice updated successfully',
      invoice: updatedInvoice
    });

  } catch (error) {
    console.error('Error updating invoice:', error);
    return NextResponse.json(
      { error: 'Failed to update invoice' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
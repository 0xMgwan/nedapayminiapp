import { NextResponse } from 'next/server';

import prisma from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: params.id },
      include: { lineItems: true, paymentLink: { select: { url: true } } },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: invoice.id,
      createdAt: invoice.createdAt.toISOString(),
      recipient: invoice.recipient,
      email: invoice.email,
      status: invoice.status,
      totalAmount: invoice.totalAmount,
      currency: invoice.currency,
      paymentLink: invoice.paymentLink,
      lineItems: invoice.lineItems,
      dueDate: invoice.dueDate.toISOString(),
      paymentCollection: invoice.paymentCollection,
    });
  } catch (error) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json({ error: 'Failed to fetch invoice' }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
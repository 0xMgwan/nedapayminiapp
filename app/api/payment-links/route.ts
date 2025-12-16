import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { Redis } from '@upstash/redis';


import prisma from '@/lib/prisma';
const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 10; // Max requests per window

// Rate limiting middleware
const rateLimit = async (ip: string) => {
  const key = `rate_limit:${ip}`;
  const requests = await redis.get(key);
  const currentRequests = requests ? parseInt(requests as string) : 0;

  if (currentRequests >= MAX_REQUESTS) {
    return false;
  }

  await redis.multi()
    .incr(key)
    .pexpire(key, RATE_LIMIT_WINDOW)
    .exec();

  return true;
};

// GET: Fetch all payment links for a merchant
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  if (!(await rateLimit(ip))) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const merchantId = searchParams.get('merchantId');
  if (!merchantId || !/^0x[a-fA-F0-9]{40}$/.test(merchantId)) {
    return NextResponse.json({ error: 'Invalid merchantId' }, { status: 400 });
  }

  const links = await prisma.paymentLink.findMany({
    where: { 
      merchantId,
      status: 'Active',
      expiresAt: { gt: new Date() }
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(links);
}

// POST: Create a new payment link
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  if (!(await rateLimit(ip))) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  const data = await req.json();
  console.log("data", data);
  const { merchantId, amount, currency, description, status, expiresAt, linkId } = data;

  // Input validation
  if (!merchantId || !amount || !currency || !status || !expiresAt || !linkId) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  if (!/^0x[a-fA-F0-9]{40}$/.test(merchantId)) {
    return NextResponse.json({ error: 'Invalid merchantId format' }, { status: 400 });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return NextResponse.json({ error: 'Invalid amount format' }, { status: 400 });
  }

  if (!/^[A-Z]{3,10}$/i.test(currency)) {
    return NextResponse.json({ error: 'Invalid currency format' }, { status: 400 });
  }

  if (description && description.length > 1000) {
    return NextResponse.json({ error: 'Description too long' }, { status: 400 });
  }

  if (status !== 'Active') {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  try {
    const expiresAtDate = new Date(expiresAt);
    if (isNaN(expiresAtDate.getTime()) || expiresAtDate <= new Date()) {
      return NextResponse.json({ error: 'Invalid expiration date' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid expiration date format' }, { status: 400 });
  }

  // Generate payment link URL and HMAC signature
  const getBaseUrl = (req: NextRequest) => {
    if (req) {
      const protocol = req.headers.get('x-forwarded-proto') || 'http';
      const host = req.headers.get('host');
      return `${protocol}://${host}`;
    }
    return typeof window !== 'undefined' 
      ? `${window.location.protocol}//${window.location.host}`
      : 'http://localhost:3000';
  };

  const baseUrl =getBaseUrl(req);
  const queryString = `amount=${parsedAmount}&currency=${currency}&to=${merchantId}&description=${encodeURIComponent(description || '')}`;
  const signature = crypto.createHmac('sha256', process.env.HMAC_SECRET || 'default-secret')
    .update(queryString)
    .digest('hex');
  const url = `${baseUrl}/pay/${linkId}?${queryString}&sig=${signature}`;

  try {
    const newLink = await prisma.paymentLink.create({
      data: {
        merchantId,
        url,
        amount: parsedAmount,
        currency,
        description,
        status,
        expiresAt: new Date(expiresAt),
        signature,
        linkId,
      },
    });
    return NextResponse.json(newLink, { status: 201 });
  } catch (error) {
    console.error('Error creating payment link:', error);
    return NextResponse.json({ error: 'Failed to create payment link' }, { status: 500 });
  }
}
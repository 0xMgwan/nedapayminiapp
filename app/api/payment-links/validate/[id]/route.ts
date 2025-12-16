import { NextRequest, NextResponse } from 'next/server';
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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // Await params before accessing its properties
  const resolvedParams = await params;
  
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  
  if (!(await rateLimit(ip))) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  console.log("Resolved params:", resolvedParams); //debug
  const link = await prisma.paymentLink.findUnique({
    where: { linkId: resolvedParams.id },
  });

  if (!link) {
    return NextResponse.json({ error: 'Payment link not found' }, { status: 404 });
  }

  if (link.status !== 'Active') {
    return NextResponse.json({ error: 'Payment link is not active' }, { status: 400 });
  }

  if (new Date() > link.expiresAt) {
    await prisma.paymentLink.update({
      where: { linkId: resolvedParams.id },
      data: { status: 'Expired' },
    });
    return NextResponse.json({ error: 'Payment link has expired' }, { status: 400 });
  }

  return NextResponse.json({ valid: true });
}
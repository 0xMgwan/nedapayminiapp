import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    message: 'Farcaster endpoint active',
    timestamp: new Date().toISOString(),
    status: 'ok'
  });
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

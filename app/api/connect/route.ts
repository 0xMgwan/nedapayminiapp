import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Get the origin from the request
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_URL;
    
    // Return the Farcaster Connect headers
    const response = NextResponse.json({
      props: {
        headers: process.env.FARCASTER_HEADER,
        payload: process.env.FARCASTER_PAYLOAD,
        signature: process.env.FARCASTER_SIGNATURE
      }
    });

    // Set the required Farcaster headers
    response.headers.set('FARCASTER_HEADER', process.env.FARCASTER_HEADER || '');
    response.headers.set('FARCASTER_PAYLOAD', process.env.FARCASTER_PAYLOAD || '');
    response.headers.set('FARCASTER_SIGNATURE', process.env.FARCASTER_SIGNATURE || '');
    
    // CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type');

    return response;
  } catch (error) {
    console.error('Connect API error:', error);
    return NextResponse.json({ error: 'Failed to connect' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Handle Farcaster Connect authentication
    const response = NextResponse.json({
      success: true,
      message: 'Connected to Farcaster with FID ' + (body.fid || 'unknown')
    });

    // Set the required Farcaster headers
    response.headers.set('FARCASTER_HEADER', process.env.FARCASTER_HEADER || '');
    response.headers.set('FARCASTER_PAYLOAD', process.env.FARCASTER_PAYLOAD || '');
    response.headers.set('FARCASTER_SIGNATURE', process.env.FARCASTER_SIGNATURE || '');

    return response;
  } catch (error) {
    console.error('Connect POST error:', error);
    return NextResponse.json({ error: 'Failed to process connection' }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';

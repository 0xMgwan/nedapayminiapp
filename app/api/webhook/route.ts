import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Log the webhook payload for debugging
    console.log('Farcaster webhook received:', body);
    
    // Handle different webhook events
    const { type, data } = body;
    
    switch (type) {
      case 'frame_interaction':
        // Handle frame interactions
        console.log('Frame interaction:', data);
        break;
      
      case 'miniapp_launch':
        // Handle MiniApp launches
        console.log('MiniApp launched:', data);
        break;
      
      default:
        console.log('Unknown webhook type:', type);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: 'Webhook endpoint active',
    timestamp: new Date().toISOString()
  });
}

export const dynamic = 'force-dynamic';

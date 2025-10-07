import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const amount = searchParams.get('amount');
    const currency = searchParams.get('currency');
    const description = searchParams.get('description');
    const to = searchParams.get('to');
    const sig = searchParams.get('sig');
    
    // Construct the payment URL with all parameters
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://nedapayminiapp.vercel.app';
    const paymentParams = new URLSearchParams();
    
    if (amount) paymentParams.set('amount', amount);
    if (currency) paymentParams.set('currency', currency);
    if (description) paymentParams.set('description', description);
    if (to) paymentParams.set('to', to);
    if (sig) paymentParams.set('sig', sig);
    
    const paymentUrl = `${baseUrl}/pay/${id}?${paymentParams.toString()}`;
    
    // Return a redirect response for Farcaster frames
    return NextResponse.redirect(paymentUrl, { status: 302 });
    
  } catch (error) {
    console.error('Frame redirect error:', error);
    
    // Fallback to main app if there's an error
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://nedapayminiapp.vercel.app';
    return NextResponse.redirect(baseUrl, { status: 302 });
  }
}

// Handle GET requests as well for compatibility
export async function GET(request: NextRequest) {
  return POST(request);
}

import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const URL = process.env.NEXT_PUBLIC_URL;

  const response = Response.json({
    frame: {
      version: "1",
      name: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'NedaPay',
      iconUrl: `${URL}/icon.png`,
      homeUrl: URL,
      imageUrl: `${URL}/og-image.png`,
      splashImageUrl: `${URL}/splash.png`,
      splashBackgroundColor: '#1e293b',
      webhookUrl: `${URL}/api/webhook`,
      subtitle: "Seamless crypto payments across Africa",
      primaryCategory: "finance",
      description: "Send money instantly across Africa using USDC on Base. Convert crypto to local currencies in Kenya, Nigeria, Tanzania and more."
    },
    accountAssociation: {
      header: process.env.FARCASTER_HEADER,
      payload: process.env.FARCASTER_PAYLOAD,
      signature: process.env.FARCASTER_SIGNATURE,
    },
  });

  // Add stronger cache-busting headers to force fresh fetch
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  response.headers.set('Last-Modified', new Date().toUTCString());
  response.headers.set('ETag', `"${Date.now()}"`);
  response.headers.set('Vary', '*');
  
  return response;
}

export const dynamic = 'force-dynamic';

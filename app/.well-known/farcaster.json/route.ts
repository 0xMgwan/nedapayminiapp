import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const URL = process.env.NEXT_PUBLIC_URL;

  const response = Response.json({
    accountAssociation: {
      header: process.env.FARCASTER_HEADER,
      payload: process.env.FARCASTER_PAYLOAD,
      signature: process.env.FARCASTER_SIGNATURE,
    },
    miniapp: {
      version: "1",
      name: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'NedaPay',
      iconUrl: `${URL}/icon.png`,
      homeUrl: URL,
      imageUrl: `${URL}/api/og/nedapay-frame`,
      buttonTitle: `Open ${process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'NedaPay'}`,
      splashImageUrl: `${URL}/splash.png`,
      splashBackgroundColor: '#1e293b',
      universalLink: `${URL}/connect`,
      screenshotUrls: [
        `${URL}/api/og/nedapay-frame`
      ],
      webhookUrl: `${URL}/api/webhook`,
      requiredChains: [
        'eip155:8453' // Base mainnet
      ],
      requiredCapabilities: [
        'actions.signIn',
        'wallet.getEthereumProvider',
        'actions.sendTransaction'
      ],
      _lastUpdated: new Date().toISOString()
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

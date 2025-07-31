import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const URL = process.env.NEXT_PUBLIC_URL;

  const response = Response.json({
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
      ]
    },
  });

  // Add cache-busting headers to force fresh fetch
  response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  
  return response;
}

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  const URL = process.env.NEXT_PUBLIC_URL;

  return Response.json({
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
}

export const dynamic = 'force-dynamic';

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
      subtitle: 'Crypto Payments Made Simple',
      description: 'Seamless crypto payments on Base network with USDC integration',
      iconUrl: `${URL}/icon.png`,
      homeUrl: `${URL}/embed`,
      imageUrl: `${URL}/api/og/nedapay-frame`,
      buttonTitle: `Open ${process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'NedaPay'}`,
      splashImageUrl: `${URL}/splash.png`,
      splashBackgroundColor: '#1e293b',
      webhookUrl: `${URL}/api/webhook`,
      screenshotUrls: [
        `${URL}/api/og/nedapay-frame`
      ],
      primaryCategory: 'finance',
      tags: ['payments', 'crypto', 'usdc', 'base'],
      heroImageUrl: `${URL}/api/og/nedapay-frame`,
      tagline: 'Send, Accept Crypto with ease',
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

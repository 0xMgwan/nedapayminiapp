import { NextRequest, NextResponse } from 'next/server';

function withValidProperties(
  properties: Record<string, undefined | string | string[]>,
) {
  return Object.fromEntries(
    Object.entries(properties).filter(([key, value]) => {
      if (Array.isArray(value)) {
        return value.length > 0;
      }
      return !!value;
    }),
  );
}

export async function GET() {
  const URL = process.env.NEXT_PUBLIC_URL;

  return Response.json({
    accountAssociation: {
      header: process.env.FARCASTER_HEADER,
      payload: process.env.FARCASTER_PAYLOAD,
      signature: process.env.FARCASTER_SIGNATURE,
    },
    frame: withValidProperties({
      version: 'next',
      name: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'NedaPay',
      iconUrl: `${URL}/icon.png`,
      homeUrl: `${URL}/farcaster`,
      imageUrl: `${URL}/api/og/nedapay-frame`,
      buttonTitle: `Open ${process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'NedaPay'}`,
      splashImageUrl: `${URL}/splash.png`,
      splashBackgroundColor: '#1e293b',
      webhookUrl: `${URL}/api/webhook`,
    }),
    miniapp: {
      url: `${URL}/farcaster`,
      name: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'NedaPay',
      description: 'Seamless crypto payments on Base network with USDC integration',
      icon: `${URL}/icon.png`,
      manifest: `${URL}/.well-known/farcaster.json`,
    },
  });
}

export const dynamic = 'force-dynamic';

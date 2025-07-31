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
      version: "1",
      name: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'NedaPay',
      subtitle: 'Crypto Payments Made Simple',
      description: 'Seamless crypto payments on Base network with USDC integration',
      screenshotUrls: [],
      iconUrl: `${URL}/icon.png`,
      splashImageUrl: `${URL}/splash.png`,
      splashBackgroundColor: '#1e293b',
      homeUrl: URL,
      webhookUrl: `${URL}/api/webhook`,
      primaryCategory: 'finance',
      tags: [],
      heroImageUrl: `${URL}/api/og/nedapay-frame`,
      tagline: 'Send, Pay, Deposit with USDC on Base',
      ogTitle: 'NedaPay MiniApp',
      ogDescription: 'Seamless crypto payments on Base network with USDC integration',
      ogImageUrl: `${URL}/api/og/nedapay-frame`,
    }),
  });
}

export const dynamic = 'force-dynamic';

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

  const response = Response.json({
    accountAssociation: {
      header: process.env.FARCASTER_HEADER,
      payload: process.env.FARCASTER_PAYLOAD,
      signature: process.env.FARCASTER_SIGNATURE,
    },
    frame: withValidProperties({
      version: "1",
      name: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME,
      subtitle: "Seamless crypto payments across Africa",
      description: "Send money instantly across Africa using USDC on Base. Convert crypto to local currencies in Kenya, Nigeria, Tanzania and more.",
      screenshotUrls: [],
      iconUrl: `${URL}/icon.png`,
      splashImageUrl: `${URL}/splash.png`,
      splashBackgroundColor: '#1e293b',
      homeUrl: URL,
      webhookUrl: `${URL}/api/webhook`,
      primaryCategory: "finance",
      tags: [],
      heroImageUrl: `${URL}/og-image.png`,
      tagline: "Cross-border payments made simple",
      ogTitle: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME,
      ogDescription: "Send money instantly across Africa using USDC on Base",
      ogImageUrl: `${URL}/og-image.png`,
    }),
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

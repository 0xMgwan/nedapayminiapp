import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://nedapayminiapp.vercel.app';
  
  const manifest = {
    accountAssociation: {
      header: "eyJmaWQiOjg2OTUyNywidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweEQ0NTRFMTQxNzE0OTVFNTY0NjFiMjFDMDc3QzE4NzI1MDU4NjdEOTkifQ",
      payload: "eyJkb21haW4iOiJuZWRhcGF5bWluaWFwcC52ZXJjZWwuYXBwIn0",
      signature: "MHg2NjI0NjM2ZTY1NjQ2MTcwNjE3OTZkNjk2ZTY5NjE3MDcwMmU3NjY1NzI2MzY1NmMyZTYxNzA3MA"
    },
    frame: {
      version: '1',
      name: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'NedaPay',
      iconUrl: `${baseUrl}/icon-512.png`,
      homeUrl: baseUrl,
      imageUrl: `${baseUrl}/og-image.png`,
      buttonTitle: 'Open NedaPay',
      splashImageUrl: `${baseUrl}/splash.png`,
      splashBackgroundColor: '#1e40af',
      webhookUrl: `${baseUrl}/api/webhook`
    }
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export const dynamic = 'force-dynamic';

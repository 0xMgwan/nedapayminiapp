import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const manifest = {
    name: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'NedaPay',
    version: '1.0.0',
    description: 'Accept Stablecoins, Swap instantly, Cash Out Easily',
    icon: `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3001'}/favicon.png`,
    homeUrl: process.env.NEXT_PUBLIC_URL || 'http://localhost:3001',
    imageUrl: `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3001'}/api/og/nedapay-frame`,
    buttonTitle: 'Open NedaPay',
    splashImageUrl: `${process.env.NEXT_PUBLIC_URL || 'http://localhost:3001'}/api/og/nedapay-frame`,
    splashBackgroundColor: '#1e40af',
    theme: {
      colorScheme: 'light',
      primaryColor: '#1e40af',
      backgroundColor: '#ffffff',
    },
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export const dynamic = 'force-dynamic';

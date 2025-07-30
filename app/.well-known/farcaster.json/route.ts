import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const manifest = {
    accountAssociation: {
      header: process.env.FARCASTER_HEADER!,
      payload: process.env.FARCASTER_PAYLOAD!,
    },
    frame: {
      name: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME!,
      version: '1.0.0',
      iconUrl: `${process.env.NEXT_PUBLIC_URL}/favicon.png`,
      homeUrl: process.env.NEXT_PUBLIC_URL!,
    },
  };

  return NextResponse.json(manifest);
}

export const dynamic = 'force-dynamic';

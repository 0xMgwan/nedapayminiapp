import { NextResponse } from 'next/server';

export async function GET() {
  // Redirect to Farcaster Hosted Manifest
  return NextResponse.redirect(
    'https://api.farcaster.xyz/miniapps/hosted-manifest/019b687a-6abd-3133-7691-a9f2921ecfb7',
    { status: 307 }
  );
}

import { NextRequest, NextResponse } from 'next/server';

// Simple endpoint to get user data for FID 9152 (your FID)
export async function GET(request: NextRequest) {
  const neynarApiKey = process.env.NEYNAR_API_KEY;
  
  if (!neynarApiKey) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    // Hardcode your FID for now
    const fid = 9152;
    
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
      {
        headers: {
          'api_key': neynarApiKey,
          'accept': 'application/json'
        }
      }
    );

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch' }, { status: response.status });
    }

    const data = await response.json();
    
    if (data.users && data.users.length > 0) {
      const user = data.users[0];
      return NextResponse.json({
        fid: user.fid,
        username: user.username,
        displayName: user.display_name,
        pfpUrl: user.pfp_url,
        bio: user.profile?.bio?.text || ''
      });
    }

    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

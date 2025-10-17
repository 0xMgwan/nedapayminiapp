import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const fid = searchParams.get('fid');

  if (!fid) {
    return NextResponse.json({ error: 'FID is required' }, { status: 400 });
  }

  const neynarApiKey = process.env.NEYNAR_API_KEY || process.env.NEXT_PUBLIC_NEYNAR_API_KEY;
  
  console.log('🔑 Environment check:', {
    hasNeynarApiKey: !!process.env.NEYNAR_API_KEY,
    hasNextPublicNeynarApiKey: !!process.env.NEXT_PUBLIC_NEYNAR_API_KEY,
    usingKey: neynarApiKey ? 'Found' : 'Missing'
  });
  
  if (!neynarApiKey) {
    console.error('❌ No Neynar API key found in environment variables');
    return NextResponse.json({ error: 'Neynar API key not configured' }, { status: 500 });
  }

  try {
    console.log('🔄 Fetching Farcaster profile for FID:', fid);
    
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
      console.error('❌ Neynar API error:', response.status, response.statusText);
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: response.status });
    }

    const data = await response.json();
    console.log('📊 Neynar API response:', data);

    if (data.users && data.users.length > 0) {
      const userData = data.users[0];
      const profileData = {
        fid: userData.fid,
        username: userData.username,
        displayName: userData.display_name || userData.username,
        pfpUrl: userData.pfp_url || '/default-avatar.svg',
        bio: userData.profile?.bio?.text || '',
        followerCount: userData.follower_count || 0,
        followingCount: userData.following_count || 0,
        verifications: userData.verifications || []
      };

      console.log('✅ Returning profile data:', profileData);
      return NextResponse.json(profileData);
    } else {
      console.log('⚠️ No user found for FID:', fid);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('❌ Error fetching Farcaster profile:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';

// Cache for user data to avoid rate limiting
let cachedUserData: any = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Dynamic endpoint to get user data for any FID
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestedFid = searchParams.get('fid');
  
  // Use requested FID or fallback to 9152
  const fid = requestedFid ? parseInt(requestedFid) : 9152;
  
  console.log('🎯 API called with FID:', fid, requestedFid ? '(from request)' : '(fallback)');
  
  // Check cache first (cache per FID)
  const cacheKey = `user_${fid}`;
  const now = Date.now();
  if (cachedUserData && cachedUserData.fid === fid && (now - cacheTimestamp) < CACHE_DURATION) {
    console.log('✅ Returning cached user data for FID:', fid);
    return NextResponse.json(cachedUserData);
  }

  const neynarApiKey = process.env.NEYNAR_API_KEY;
  
  if (!neynarApiKey) {
    console.error('❌ No Neynar API key found');
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    
    console.log('🔄 Fetching fresh data from Neynar for FID:', fid);
    
    const response = await fetch(
      `https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`,
      {
        headers: {
          'api_key': neynarApiKey,
          'accept': 'application/json'
        }
      }
    );

    console.log('📡 Neynar API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Neynar API error:', response.status, errorText);
      
      // If we have cached data, return it even if stale
      if (cachedUserData) {
        console.log('⚠️ Using stale cached data due to API error');
        return NextResponse.json(cachedUserData);
      }
      
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: response.status });
    }

    const data = await response.json();
    console.log('📊 Neynar API response data:', data);
    
    if (data.users && data.users.length > 0) {
      const user = data.users[0];
      const userData = {
        fid: user.fid,
        username: user.username,
        displayName: user.display_name,
        pfpUrl: user.pfp_url,
        bio: user.profile?.bio?.text || ''
      };
      
      // Cache the result
      cachedUserData = userData;
      cacheTimestamp = now;
      
      console.log('✅ Cached fresh user data:', userData);
      return NextResponse.json(userData);
    }

    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  } catch (error) {
    console.error('❌ Server error:', error);
    
    // If we have cached data, return it
    if (cachedUserData) {
      console.log('⚠️ Using cached data due to server error');
      return NextResponse.json(cachedUserData);
    }
    
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

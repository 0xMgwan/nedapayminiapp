import { NextRequest, NextResponse } from 'next/server';

// Cache for user data to avoid rate limiting
let cachedUserData: any = null;
let cacheTimestamp: number = 0;
let lastApiCall: number = 0;
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes - longer cache to avoid rate limits
const MIN_API_INTERVAL = 30 * 1000; // Minimum 30 seconds between API calls

// Dynamic endpoint to get user data for any FID or address
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const requestedFid = searchParams.get('fid');
  const requestedAddress = searchParams.get('address');
  
  const neynarApiKey = process.env.NEYNAR_API_KEY;
  
  if (!neynarApiKey) {
    console.error('❌ No Neynar API key found');
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 });
  }
  
  // If address is provided, fetch by address
  if (requestedAddress) {
    console.log('🎯 API called with address:', requestedAddress);
    
    try {
      const response = await fetch(
        `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${requestedAddress}`,
        {
          headers: {
            'api_key': neynarApiKey,
            'accept': 'application/json'
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Neynar address lookup response:', data);
        
        // The response is keyed by lowercase address
        const userData = data[requestedAddress.toLowerCase()]?.[0];
        
        if (userData) {
          const result = {
            fid: userData.fid,
            username: userData.username,
            displayName: userData.display_name,
            pfpUrl: userData.pfp_url,
            bio: userData.profile?.bio?.text || '',
            custodyAddress: userData.custody_address,
            verifiedAddresses: userData.verified_addresses?.eth_addresses || [],
            primaryAddress: userData.verified_addresses?.eth_addresses?.[0] || userData.custody_address
          };
          console.log('✅ Found user by address:', result);
          return NextResponse.json(result);
        }
      }
      
      console.log('⚠️ No Farcaster user found for address:', requestedAddress);
      return NextResponse.json({ error: 'User not found for address' }, { status: 404 });
    } catch (error) {
      console.error('❌ Error fetching by address:', error);
      return NextResponse.json({ error: 'Failed to fetch by address' }, { status: 500 });
    }
  }
  
  // ONLY use requested FID - NO FALLBACK TO 9152
  if (!requestedFid) {
    console.log('❌ No FID or address provided');
    return NextResponse.json({ 
      error: 'No FID or address provided',
      message: 'Provide either fid or address parameter'
    }, { status: 400 });
  }
  
  const fid = parseInt(requestedFid);
  
  if (fid === 9152) {
    console.log('❌ Refusing to use Warpcast client FID 9152');
    return NextResponse.json({ 
      error: 'Invalid FID',
      message: 'FID 9152 is Warpcast client, not a real user'
    }, { status: 400 });
  }
  
  console.log('🎯 API called with FID:', fid, requestedFid ? '(from request)' : '(fallback)');
  
  // Check cache first (cache per FID)
  const cacheKey = `user_${fid}`;
  const now = Date.now();
  if (cachedUserData && cachedUserData.fid === fid && (now - cacheTimestamp) < CACHE_DURATION) {
    console.log('✅ Returning cached user data for FID:', fid);
    return NextResponse.json(cachedUserData);
  }

  // neynarApiKey already declared at top of function

  try {
    // Check if we're making API calls too frequently
    const now = Date.now();
    if (lastApiCall && (now - lastApiCall) < MIN_API_INTERVAL) {
      console.log('⚠️ Rate limiting protection - using cached data');
      if (cachedUserData) {
        return NextResponse.json(cachedUserData);
      }
      return NextResponse.json({ error: 'Rate limited, try again later' }, { status: 429 });
    }
    
    lastApiCall = now;
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
      
      // Extract verified addresses
      const verifications = user.verifications || [];
      const custodyAddress = user.custody_address;
      const verifiedAddresses = user.verified_addresses?.eth_addresses || [];
      
      console.log('🔍 User verifications:', { verifications, custodyAddress, verifiedAddresses });
      
      const userData = {
        fid: user.fid,
        username: user.username,
        displayName: user.display_name,
        pfpUrl: user.pfp_url,
        bio: user.profile?.bio?.text || '',
        custodyAddress,
        verifiedAddresses,
        // Use first verified address or custody address
        primaryAddress: verifiedAddresses[0] || custodyAddress
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

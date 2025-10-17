import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  console.log('🔍 DETECTING REAL USER FROM REQUEST...');
  
  // Get all headers to analyze
  const headers = Object.fromEntries(request.headers.entries());
  console.log('📋 Request headers:', headers);
  
  // Check for Farcaster-specific headers
  const farcasterHeaders = {
    userAgent: headers['user-agent'] || '',
    referer: headers['referer'] || '',
    origin: headers['origin'] || '',
    xForwardedFor: headers['x-forwarded-for'] || '',
    // Check for any custom Farcaster headers
    customHeaders: Object.keys(headers).filter(key => 
      key.toLowerCase().includes('farcaster') || 
      key.toLowerCase().includes('frame') ||
      key.toLowerCase().includes('minikit')
    )
  };
  
  console.log('🎯 Farcaster-related headers:', farcasterHeaders);
  
  // Try to extract user info from URL or headers
  const url = new URL(request.url);
  const searchParams = Object.fromEntries(url.searchParams.entries());
  
  console.log('🔗 URL parameters:', searchParams);
  
  // Look for any user identifiers
  const userIdentifiers = {
    fid: searchParams.fid || searchParams.user_fid || searchParams.userFid,
    username: searchParams.username || searchParams.user || searchParams.handle,
    address: searchParams.address || searchParams.wallet || searchParams.eth_address
  };
  
  console.log('👤 Found user identifiers:', userIdentifiers);
  
  // If we found a FID, fetch the user data
  if (userIdentifiers.fid && userIdentifiers.fid !== '9152') {
    console.log('✅ Found real user FID:', userIdentifiers.fid);
    
    const neynarApiKey = process.env.NEYNAR_API_KEY;
    if (neynarApiKey) {
      try {
        const response = await fetch(
          `https://api.neynar.com/v2/farcaster/user/bulk?fids=${userIdentifiers.fid}`,
          {
            headers: {
              'api_key': neynarApiKey,
              'accept': 'application/json'
            }
          }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.users && data.users.length > 0) {
            const user = data.users[0];
            const userData = {
              fid: user.fid,
              username: user.username,
              displayName: user.display_name,
              pfpUrl: user.pfp_url,
              bio: user.profile?.bio?.text || '',
              source: 'detected_from_request'
            };
            
            console.log('🎉 Successfully detected real user:', userData);
            return NextResponse.json(userData);
          }
        }
      } catch (error) {
        console.error('❌ Error fetching detected user:', error);
      }
    }
  }
  
  // Return detection info even if we couldn't fetch user data
  return NextResponse.json({
    detected: false,
    headers: farcasterHeaders,
    params: searchParams,
    identifiers: userIdentifiers,
    message: 'No real user FID detected in request'
  });
}

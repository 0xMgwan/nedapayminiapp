import { NextRequest, NextResponse } from 'next/server';

// Endpoint to detect current user from frame context
export async function GET(request: NextRequest) {
  console.log('🔍 DETECTING CURRENT USER FROM FRAME CONTEXT...');
  
  // Get all headers to analyze for user data
  const headers = Object.fromEntries(request.headers.entries());
  console.log('📋 All request headers:', headers);
  
  // Check for Farcaster-specific headers that might contain user info
  const farcasterHeaders = {
    userAgent: headers['user-agent'] || '',
    referer: headers['referer'] || '',
    origin: headers['origin'] || '',
    xForwardedFor: headers['x-forwarded-for'] || '',
    xRealIp: headers['x-real-ip'] || '',
    // Check for any custom Farcaster headers
    customHeaders: Object.keys(headers).filter(key => 
      key.toLowerCase().includes('farcaster') || 
      key.toLowerCase().includes('frame') ||
      key.toLowerCase().includes('fc-') ||
      key.toLowerCase().includes('minikit')
    )
  };
  
  console.log('🎯 Farcaster-related info:', farcasterHeaders);
  
  // Try to extract user FID from various sources
  let detectedFid = null;
  
  // Method 1: Check URL parameters
  const { searchParams } = new URL(request.url);
  const urlFids = [
    searchParams.get('fid'),
    searchParams.get('user_fid'),
    searchParams.get('fc_fid'),
    searchParams.get('author_fid')
  ].filter(fid => fid && fid !== '9152' && !isNaN(parseInt(fid)));
  
  if (urlFids.length > 0) {
    detectedFid = parseInt(urlFids[0]!);
    console.log('✅ Found user FID from URL params:', detectedFid);
  }
  
  // Method 2: Check referer URL for user data
  if (!detectedFid && headers.referer) {
    try {
      const refererUrl = new URL(headers.referer);
      const refererFid = refererUrl.searchParams.get('fid') || 
                        refererUrl.searchParams.get('user_fid');
      if (refererFid && refererFid !== '9152' && !isNaN(parseInt(refererFid))) {
        detectedFid = parseInt(refererFid);
        console.log('✅ Found user FID from referer:', detectedFid);
      }
    } catch (e) {
      console.log('❌ Could not parse referer URL');
    }
  }
  
  // Method 3: Try to extract from user agent or other headers
  if (!detectedFid) {
    // Look for patterns in user agent that might indicate user context
    const userAgent = headers['user-agent'] || '';
    console.log('🔍 Analyzing user agent for user context:', userAgent);
  }
  
  if (detectedFid) {
    console.log('🎯 DETECTED USER FID:', detectedFid);
    
    // Fetch user data from Neynar
    const neynarApiKey = process.env.NEYNAR_API_KEY;
    if (neynarApiKey) {
      try {
        const response = await fetch(
          `https://api.neynar.com/v2/farcaster/user/bulk?fids=${detectedFid}`,
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
              source: 'server_side_detection'
            };
            
            console.log('✅ CURRENT USER DATA:', userData);
            return NextResponse.json(userData);
          }
        }
      } catch (error) {
        console.error('❌ Error fetching user from Neynar:', error);
      }
    }
  }
  
  console.log('❌ Could not detect current user');
  return NextResponse.json({ 
    error: 'User not detected',
    message: 'Could not determine current user from frame context'
  }, { status: 404 });
}

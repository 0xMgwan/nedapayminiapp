import { NextRequest, NextResponse } from 'next/server';

// This endpoint will receive Farcaster frame actions with real user data
export async function POST(request: NextRequest) {
  console.log('🎯 FRAME ACTION RECEIVED - EXTRACTING REAL USER FID...');
  
  try {
    const body = await request.json();
    console.log('📋 Frame action body:', JSON.stringify(body, null, 2));
    
    // Extract user FID from frame action data
    const userFid = body.untrustedData?.fid || body.trustedData?.messageBytes?.fid;
    
    if (userFid && userFid !== 9152) {
      console.log('🎯 REAL USER FID FROM FRAME ACTION:', userFid);
      
      // Store the user FID in a simple cache/storage
      // For now, we'll use a simple in-memory store
      (global as any).realUserFid = userFid;
      
      // Fetch user data from Neynar
      const neynarApiKey = process.env.NEYNAR_API_KEY;
      if (neynarApiKey) {
        try {
          const response = await fetch(
            `https://api.neynar.com/v2/farcaster/user/bulk?fids=${userFid}`,
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
                source: 'frame_action'
              };
              
              // Store user data globally
              (global as any).realUserData = userData;
              
              console.log('✅ STORED REAL USER DATA:', userData);
            }
          }
        } catch (error) {
          console.error('❌ Error fetching user from Neynar:', error);
        }
      }
    }
    
    // Return a simple frame response
    return NextResponse.json({
      message: "User data captured",
      fid: userFid
    });
    
  } catch (error) {
    console.error('❌ Error processing frame action:', error);
    return NextResponse.json({ error: 'Failed to process frame action' }, { status: 400 });
  }
}

// GET endpoint to retrieve stored user data
export async function GET(request: NextRequest) {
  console.log('🔍 GETTING STORED REAL USER DATA...');
  
  if ((global as any).realUserData) {
    console.log('✅ Returning stored user data:', (global as any).realUserData);
    return NextResponse.json((global as any).realUserData);
  }
  
  return NextResponse.json({ 
    error: 'No real user data available yet',
    message: 'User needs to interact with frame first'
  }, { status: 404 });
}

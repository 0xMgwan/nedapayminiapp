import { NextRequest, NextResponse } from 'next/server';

// Simple test endpoint that returns mock user data to test the UI
export async function GET(request: NextRequest) {
  console.log('🧪 Test user endpoint called');
  
  // Return mock user data to test the display
  const mockUser = {
    fid: 999999,
    username: 'machuche',
    displayName: 'David Machuche',
    pfpUrl: 'https://i.imgur.com/default-avatar.png',
    bio: 'Software Developer',
    followerCount: 100,
    followingCount: 50,
    verifications: [],
    source: 'mock_data'
  };
  
  console.log('✅ Returning mock user data:', mockUser);
  return NextResponse.json(mockUser);
}

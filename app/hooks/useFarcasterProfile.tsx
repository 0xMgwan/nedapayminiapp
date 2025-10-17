'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

export interface FarcasterProfile {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  bio: string;
  followerCount: number;
  followingCount: number;
  verifications: string[];
}

export interface UseFarcasterProfileReturn {
  profile: FarcasterProfile | null;
  isLoading: boolean;
  error: string | null;
  isFarcasterEnvironment: boolean;
}

export function useFarcasterProfile(): UseFarcasterProfileReturn {
  const [profile, setProfile] = useState<FarcasterProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFarcasterEnvironment, setIsFarcasterEnvironment] = useState(false);
  
  const { address } = useAccount();

  // Detect if we're in a Farcaster environment
  useEffect(() => {
    const detectFarcasterEnvironment = () => {
      if (typeof window === 'undefined') return false;
      
      // Check for MiniKit SDK
      const hasMiniKit = !!(window as any).MiniKit;
      
      // Check URL patterns
      const url = window.location.href.toLowerCase();
      const referrer = document.referrer.toLowerCase();
      
      const farcasterPatterns = [
        'farcaster.xyz',
        'warpcast.com',
        'farcaster',
        'warpcast'
      ];
      
      const isFarcasterUrl = farcasterPatterns.some(pattern => 
        url.includes(pattern) || referrer.includes(pattern)
      );
      
      // Check user agent for Farcaster apps
      const userAgent = navigator.userAgent.toLowerCase();
      const isFarcasterApp = userAgent.includes('farcaster') || userAgent.includes('warpcast');
      
      return hasMiniKit || isFarcasterUrl || isFarcasterApp;
    };

    setIsFarcasterEnvironment(detectFarcasterEnvironment());
  }, []);

  // Fetch Farcaster profile data
  useEffect(() => {
    if (!isFarcasterEnvironment || !address) {
      setProfile(null);
      return;
    }

    const fetchFarcasterProfile = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Try to get profile from MiniKit SDK first
        if ((window as any).MiniKit?.user) {
          const miniKitUser = (window as any).MiniKit.user;
          console.log('MiniKit user data:', miniKitUser);
          
          if (miniKitUser.fid) {
            setProfile({
              fid: miniKitUser.fid,
              username: miniKitUser.username || `fid:${miniKitUser.fid}`,
              displayName: miniKitUser.displayName || miniKitUser.username || `User ${miniKitUser.fid}`,
              pfpUrl: miniKitUser.pfpUrl || '/default-avatar.svg',
              bio: miniKitUser.bio || '',
              followerCount: miniKitUser.followerCount || 0,
              followingCount: miniKitUser.followingCount || 0,
              verifications: miniKitUser.verifications || []
            });
            setIsLoading(false);
            return;
          }
        }

        // Fallback: Try to fetch from Neynar API using the wallet address
        const neynarApiKey = process.env.NEXT_PUBLIC_NEYNAR_API_KEY;
        if (neynarApiKey && address) {
          const response = await fetch(
            `https://api.neynar.com/v2/farcaster/user/bulk-by-address?addresses=${address}`,
            {
              headers: {
                'api_key': neynarApiKey,
                'accept': 'application/json'
              }
            }
          );

          if (response.ok) {
            const data = await response.json();
            if (data && data[address.toLowerCase()]) {
              const userData = data[address.toLowerCase()][0]; // Get first user if multiple
              setProfile({
                fid: userData.fid,
                username: userData.username,
                displayName: userData.display_name || userData.username,
                pfpUrl: userData.pfp_url || '/default-avatar.svg',
                bio: userData.profile?.bio?.text || '',
                followerCount: userData.follower_count || 0,
                followingCount: userData.following_count || 0,
                verifications: userData.verifications || []
              });
            } else {
              // No Farcaster profile found for this address
              setProfile(null);
            }
          } else {
            console.warn('Failed to fetch from Neynar API:', response.status);
            setProfile(null);
          }
        } else {
          // No API key available, create a minimal profile
          setProfile({
            fid: 0,
            username: 'farcaster-user',
            displayName: 'Farcaster User',
            pfpUrl: '/default-avatar.svg',
            bio: '',
            followerCount: 0,
            followingCount: 0,
            verifications: []
          });
        }
      } catch (err) {
        console.error('Error fetching Farcaster profile:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch profile');
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFarcasterProfile();
  }, [isFarcasterEnvironment, address]);

  return {
    profile,
    isLoading,
    error,
    isFarcasterEnvironment
  };
}

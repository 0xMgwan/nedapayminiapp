'use client';

import { useEffect, useState, createContext, useContext } from 'react';

interface MiniKitContextType {
  isReady: boolean;
  context: any;
  userFid: number | null;
}

const MiniKitContext = createContext<MiniKitContextType>({
  isReady: false,
  context: null,
  userFid: null
});

export function useMiniKit() {
  return useContext(MiniKitContext);
}

export function MiniKitProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [context, setContext] = useState<any>(null);
  const [userFid, setUserFid] = useState<number | null>(null);

  useEffect(() => {
    const initializeMiniKit = async () => {
      console.log('🔍 Initializing Farcaster Frame SDK...');
      
      // Wait for the SDK script to load - check multiple possible names
      const waitForSDK = async (maxAttempts = 20): Promise<any> => {
        for (let i = 0; i < maxAttempts; i++) {
          if (typeof window !== 'undefined') {
            // Check different possible SDK locations
            const possibleSDKs = [
              (window as any).sdk,
              (window as any).FrameSDK,
              (window as any).farcaster,
              (window as any).Farcaster
            ];
            
            const foundSDK = possibleSDKs.find(sdk => sdk !== undefined);
            
            if (foundSDK) {
              console.log('✅ Farcaster Frame SDK loaded!');
              console.log('📊 SDK object:', foundSDK);
              console.log('📊 SDK keys:', Object.keys(foundSDK));
              return foundSDK;
            }
            
            // Log what's available on window for debugging
            if (i === 0) {
              console.log('🔍 Checking window for Frame SDK...');
              console.log('  window.sdk:', !!(window as any).sdk);
              console.log('  window.FrameSDK:', !!(window as any).FrameSDK);
              console.log('  window.farcaster:', !!(window as any).farcaster);
              console.log('  window.Farcaster:', !!(window as any).Farcaster);
            }
          }
          console.log(`⏳ Waiting for Frame SDK... (attempt ${i + 1}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        return null;
      };

      const sdk = await waitForSDK();

      if (!sdk) {
        console.log('❌ Farcaster Frame SDK not found after', 20, 'attempts');
        console.log('💡 SDK might not be loaded or exposed under different name');
        console.log('🔍 Available window properties:', Object.keys(window).filter(k => k.toLowerCase().includes('frame') || k.toLowerCase().includes('farcaster') || k.toLowerCase().includes('sdk')));
        return;
      }

      try {
        // Initialize the SDK and get context
        console.log('🚀 Calling sdk.actions.ready()...');
        const sdkContext = await sdk.actions.ready();
        
        console.log('✅ Frame SDK initialized!');
        console.log('📊 SDK Context:', sdkContext);
        
        setContext(sdkContext);
        setIsReady(true);

        // Extract user FID from context
        let detectedFid = null;

        // Try context.user.fid
        if (sdkContext?.user?.fid) {
          detectedFid = sdkContext.user.fid;
          console.log('🎯 Found user FID:', detectedFid);
        }
        // Try context.castAuthor.fid (if opened from a cast)
        else if (sdkContext?.castAuthor?.fid) {
          detectedFid = sdkContext.castAuthor.fid;
          console.log('🎯 Found cast author FID:', detectedFid);
        }

        if (detectedFid && detectedFid !== 9152) {
          setUserFid(detectedFid);
          console.log('✅ User FID set:', detectedFid);
          
          // Dispatch custom event for other components
          window.dispatchEvent(new CustomEvent('minikit-user-detected', {
            detail: { fid: detectedFid, context: sdkContext }
          }));
        } else {
          console.log('⚠️ No valid user FID found in context');
        }

        // Send ready signal to Frame
        if (sdk.actions.ready) {
          sdk.actions.ready();
          console.log('📤 Frame ready signal sent!');
        }

      } catch (error) {
        console.error('❌ Error initializing Frame SDK:', error);
      }
    };

    initializeMiniKit();
  }, []);

  return (
    <MiniKitContext.Provider value={{ isReady, context, userFid }}>
      {children}
    </MiniKitContext.Provider>
  );
}

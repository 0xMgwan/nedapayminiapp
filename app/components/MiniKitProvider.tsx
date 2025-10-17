'use client';

import { useEffect, useState, createContext, useContext } from 'react';
import sdk from '@farcaster/frame-sdk';

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
      console.log('🔍 Initializing Farcaster Frame SDK from npm package...');
      
      if (!sdk) {
        console.log('❌ Frame SDK not imported correctly');
        return;
      }
      
      console.log('✅ Frame SDK imported successfully');
      console.log('📊 SDK object:', sdk);
      console.log('📊 SDK keys:', Object.keys(sdk));

      try {
        // Initialize the SDK and get context
        console.log('🚀 Calling sdk.actions.ready()...');
        const sdkContext: any = await sdk.actions.ready();
        
        console.log('✅ Frame SDK initialized!');
        console.log('📊 SDK Context:', sdkContext);
        
        setContext(sdkContext);
        setIsReady(true);

        // Extract user FID from context
        let detectedFid: number | null = null;

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

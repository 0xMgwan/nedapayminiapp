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
      console.log('🔍 Getting Farcaster context...');
      
      const ctx: any = await sdk.context;
      console.log('📊 SDK context:', ctx);
      console.log('📊 Context user:', ctx?.user);
      console.log('📊 User wallet addresses:', ctx?.user?.verifications);
      console.log('📊 User custody address:', ctx?.user?.custodyAddress);
      
      setContext(ctx);
      setIsReady(true);

      let fid = ctx?.user?.fid || null;
      
      if (fid) {
        console.log('✅ Found FID:', fid);
        if (fid !== 9152) {
          setUserFid(fid);
          
          // Get verified wallet address from context
          const verifiedAddress = ctx?.user?.custodyAddress || ctx?.user?.verifications?.[0];
          
          window.dispatchEvent(new CustomEvent('minikit-user-detected', {
            detail: { 
              fid, 
              context: ctx,
              verifiedAddress 
            }
          }));
        }
      } else {
        console.log('❌ No FID found');
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

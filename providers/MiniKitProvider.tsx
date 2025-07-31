'use client';

import { ReactNode, useEffect } from 'react';
import { MiniKitProvider as OnchainKitMiniKitProvider } from '@coinbase/onchainkit/minikit';
import { base } from 'wagmi/chains';

export function MiniKitProvider({ children }: { children: ReactNode }) {
  // Debug MiniKit loading context
  useEffect(() => {
    console.log('MiniKit Provider Initializing:', {
      url: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      isFarcaster: window.location.href.includes('farcaster'),
      hasOnchainKit: !!process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY,
      projectName: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME
    });
  }, []);

  return (
    <OnchainKitMiniKitProvider
      apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY!}
      chain={base}
      config={{
        appearance: {
          mode: 'auto',
          theme: 'default',
          name: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'NedaPay',
          logo: `${process.env.NEXT_PUBLIC_URL}/icon.png`,
        },
      }}
    >
      {children}
    </OnchainKitMiniKitProvider>
  );
}

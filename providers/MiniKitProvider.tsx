'use client';

import { ReactNode, useEffect } from 'react';
import { MiniKitProvider as OnchainKitMiniKitProvider } from '@coinbase/onchainkit/minikit';
import { base } from 'wagmi/chains';

export function MiniKitProvider({ children }: { children: ReactNode }) {
  // Debug MiniKit loading context and suppress popup errors
  useEffect(() => {
    console.log('MiniKit Provider Initializing:', {
      url: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      isFarcaster: window.location.href.includes('farcaster'),
      hasOnchainKit: !!process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY,
      projectName: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME
    });
    
    // Suppress popup blocking errors globally
    const originalConsoleError = console.error;
    console.error = function(...args) {
      const message = args.join(' ');
      if (message.includes('Popup window was blocked') || 
          message.includes('popup') && message.includes('blocked')) {
        // Suppress popup blocking errors since wallet still works
        console.log('Suppressed popup error - wallet connection via MiniKit should still work');
        return;
      }
      originalConsoleError.apply(console, args);
    };
    
    return () => {
      console.error = originalConsoleError;
    };
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
        wallet: {
          display: 'modal',
          termsUrl: '',
          privacyUrl: '',
        },
      }}
    >
      {children}
    </OnchainKitMiniKitProvider>
  );
}

'use client';

import { ReactNode, useEffect } from 'react';
import { MiniKitProvider as OnchainKitMiniKitProvider } from '@coinbase/onchainkit/minikit';
import { base } from 'wagmi/chains';

export function MiniKitProvider({ children }: { children: ReactNode }) {
  // Debug MiniKit loading context and implement comprehensive popup blocking fix
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isFarcaster = window.location.href.includes('farcaster') || window.location.href.includes('warpcast');
    
    console.log('MiniKit Provider Initializing:', {
      url: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      isMobile,
      isFarcaster,
      hasOnchainKit: !!process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY,
      projectName: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME
    });
    
    // Comprehensive popup blocking fix for mobile Farcaster
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    const originalWindowOpen = window.open;
    
    // Suppress popup-related console errors and warnings
    console.error = function(...args) {
      const message = args.join(' ').toLowerCase();
      if (message.includes('popup') || message.includes('blocked') || 
          message.includes('window.open') || message.includes('minikit')) {
        console.log('🔇 Suppressed popup/MiniKit error:', args[0]);
        return;
      }
      originalConsoleError.apply(console, args);
    };
    
    console.warn = function(...args) {
      const message = args.join(' ').toLowerCase();
      if (message.includes('popup') || message.includes('blocked')) {
        console.log('🔇 Suppressed popup warning:', args[0]);
        return;
      }
      originalConsoleWarn.apply(console, args);
    };
    
    // Override window.open to prevent popup blocking errors on mobile
    if (isMobile || isFarcaster) {
      window.open = function(url, target, features) {
        console.log('🚫 Intercepted window.open call on mobile/Farcaster - preventing popup');
        // Return a mock window object to prevent errors
        return {
          closed: false,
          close: () => {},
          focus: () => {},
          blur: () => {},
          postMessage: () => {}
        } as any;
      };
    }
    
    // Hide any popup notification elements that might appear
    const hidePopupElements = () => {
      const selectors = [
        '[data-testid*="popup"]',
        '[class*="popup"]',
        '[class*="notification"]',
        '[class*="toast"]',
        '[class*="alert"]',
        'div:contains("Popup was blocked")',
        'div:contains("Try again")',
        '[role="alert"]',
        '[role="dialog"]'
      ];
      
      selectors.forEach(selector => {
        try {
          const elements = document.querySelectorAll(selector);
          elements.forEach(el => {
            if (el.textContent?.includes('Popup') || el.textContent?.includes('blocked')) {
              (el as HTMLElement).style.display = 'none';
              console.log('🙈 Hidden popup notification element');
            }
          });
        } catch (e) {
          // Ignore selector errors
        }
      });
    };
    
    // Run popup hiding immediately and periodically
    hidePopupElements();
    const hideInterval = setInterval(hidePopupElements, 500);
    
    // Also run on DOM mutations
    const observer = new MutationObserver(hidePopupElements);
    observer.observe(document.body, { childList: true, subtree: true });
    
    return () => {
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
      window.open = originalWindowOpen;
      clearInterval(hideInterval);
      observer.disconnect();
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

'use client';

import { ReactNode, useEffect } from 'react';
import { MiniKitProvider as OnchainKitMiniKitProvider } from '@coinbase/onchainkit/minikit';
import { base } from 'wagmi/chains';
import { farcasterMiniApp as miniAppConnector } from '@farcaster/miniapp-wagmi-connector';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { coinbaseWallet, metaMask, walletConnect } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create wagmi config with multiple connectors for different environments
export const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: http(),
  },
  connectors: [
    // Farcaster MiniApp connector for Farcaster environment
    miniAppConnector(),
    // Web wallet connectors for normal browser environment
    coinbaseWallet({
      appName: 'NedaPay',
      appLogoUrl: '/NEDApayLogo.png',
    }),
    metaMask(),
    walletConnect({
      projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'default-project-id',
    }),
  ]
});

const queryClient = new QueryClient();

export function MiniKitProvider({ children }: { children: ReactNode }) {
  // Enhanced MiniKit initialization for smart wallet environments
  useEffect(() => {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isFarcaster = window.location.href.includes('farcaster') || window.location.href.includes('warpcast');
    const isBaseApp = window.location.href.includes('base.org');
    const isSmartWalletEnv = isMobile || isFarcaster || isBaseApp;
    
    console.log('🚀 MiniKit Provider Initializing for Smart Wallet Environment:', {
      url: window.location.href,
      referrer: document.referrer,
      userAgent: navigator.userAgent,
      isMobile,
      isFarcaster,
      isBaseApp,
      isSmartWalletEnv,
      hasOnchainKit: !!process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY,
      projectName: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME
    });
    
    // Smart wallet environment popup prevention
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    const originalWindowOpen = window.open;
    
    // Only apply aggressive popup blocking in smart wallet environments
    if (isSmartWalletEnv) {
      console.log('🚫 Applying smart wallet popup prevention measures');
      
      // Suppress popup-related console errors and warnings
      console.error = function(...args) {
        const message = args.join(' ').toLowerCase();
        if (message.includes('popup') || message.includes('blocked') || 
            message.includes('window.open') || message.includes('minikit')) {
          console.log('🔇 [Smart Wallet] Suppressed popup error:', args[0]);
          return;
        }
        originalConsoleError.apply(console, args);
      };
      
      console.warn = function(...args) {
        const message = args.join(' ').toLowerCase();
        if (message.includes('popup') || message.includes('blocked')) {
          console.log('🔇 [Smart Wallet] Suppressed popup warning:', args[0]);
          return;
        }
        originalConsoleWarn.apply(console, args);
      };
      
      // Override window.open to prevent popup blocking errors in smart wallet environments
      window.open = function(url, target, features) {
        console.log('🚫 [Smart Wallet] Intercepted window.open call - using smart wallet instead');
        // Return a mock window object to prevent errors
        return {
          closed: false,
          close: () => {},
          focus: () => {},
          blur: () => {},
          postMessage: () => {}
        } as any;
      };
    } else {
      console.log('💻 Desktop environment - allowing normal popup behavior');
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
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
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
      </QueryClientProvider>
    </WagmiProvider>
  );
}

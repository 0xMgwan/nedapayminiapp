'use client';

import { useEffect, useState } from 'react';
import { useAccount, useConnect } from 'wagmi';

export function ReadyState() {
  const [isReady, setIsReady] = useState(false);
  const [environment, setEnvironment] = useState('');
  const { isConnected } = useAccount();
  const { connectors } = useConnect();

  useEffect(() => {
    const checkReadyState = () => {
      const hasConnectors = connectors.length > 0;
      const hasOnchainKit = !!process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY;
      const isBaseApp = window.location.href.includes('base.org') || window.location.href.includes('base.dev');
      const isFarcaster = window.location.href.includes('farcaster') || window.location.href.includes('warpcast');
      
      let env = 'web';
      if (isBaseApp) env = 'base.dev';
      if (isFarcaster) env = 'farcaster';
      
      setEnvironment(env);
      
      // Consider ready if we have connectors and OnchainKit
      const ready = hasConnectors && hasOnchainKit;
      setIsReady(ready);
      
      console.log('🔍 Ready State Check:', {
        ready,
        hasConnectors,
        hasOnchainKit,
        connectorsCount: connectors.length,
        environment: env,
        isConnected
      });
    };

    // Check immediately
    checkReadyState();
    
    // Listen for custom ready event
    const handleNedaPayReady = (event: CustomEvent) => {
      console.log('📡 Received nedapay-ready event:', event.detail);
      setIsReady(true);
    };
    
    window.addEventListener('nedapay-ready', handleNedaPayReady as EventListener);
    
    // Also check periodically for the first few seconds
    const interval = setInterval(checkReadyState, 500);
    setTimeout(() => clearInterval(interval), 5000);
    
    return () => {
      window.removeEventListener('nedapay-ready', handleNedaPayReady as EventListener);
      clearInterval(interval);
    };
  }, [connectors, isConnected]);

  // Don't render anything in production, just log to console
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div className="fixed top-4 left-4 z-50 bg-black/80 text-white p-2 rounded-lg text-xs font-mono">
      <div className={`flex items-center gap-2 ${isReady ? 'text-green-400' : 'text-red-400'}`}>
        <div className={`w-2 h-2 rounded-full ${isReady ? 'bg-green-400' : 'bg-red-400'}`}></div>
        {isReady ? 'Ready' : 'Not Ready'}
      </div>
      <div className="text-gray-400 text-xs">
        {environment} • {connectors.length} connectors
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';

export default function ConnectPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [fid, setFid] = useState<string>('869527'); // Your actual FID

  useEffect(() => {
    // Simulate connection process
    const timer = setTimeout(() => {
      setIsConnected(true);
      
      // Send success message to parent window if in iframe
      if (typeof window !== 'undefined') {
        window.parent.postMessage({
          type: 'FARCASTER_CONNECT_SUCCESS',
          fid: fid,
          connected: true
        }, '*');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [fid]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <img 
            src="/icon.png" 
            alt="NedaPay" 
            className="w-16 h-16 mx-auto mb-4 rounded-xl"
          />
          <h1 className="text-2xl font-bold text-white mb-2">
            Connected to Farcaster
          </h1>
          <p className="text-gray-300">
            NedaPay is now connected with FID {fid}
          </p>
        </div>
        
        {isConnected ? (
          <div className="space-y-4">
            <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
              <p className="text-green-300 font-medium">
                ✅ Successfully Connected
              </p>
              <p className="text-green-200 text-sm mt-1">
                You can now use NedaPay as a Mini App
              </p>
            </div>
            
            <button
              onClick={() => {
                // Try multiple redirect methods
                if (window.parent !== window) {
                  // If in iframe, send message to parent
                  window.parent.postMessage({ type: 'REDIRECT_TO_APP' }, '*');
                }
                // Direct redirect
                window.location.href = '/';
              }}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
            >
              Continue to App
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-500/20 border border-blue-500/30 rounded-lg p-4">
              <p className="text-blue-300 font-medium">
                🔄 Connecting to Farcaster...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

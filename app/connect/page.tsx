'use client';

import { useEffect, useState } from 'react';
import { FarcasterConnect } from '@farcaster/hub-web';

export default function ConnectPage() {
  const [fcConnect, setFcConnect] = useState<FarcasterConnect | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [fid, setFid] = useState<string>('');

  useEffect(() => {
    const initializeFarcasterConnect = async () => {
      try {
        const connect = new FarcasterConnect({
          fid: process.env.NEXT_PUBLIC_FARCASTER_FID || 'YOUR_FID',
          privateKey: process.env.NEXT_PUBLIC_FARCASTER_PRIVATE_KEY || 'YOUR_PRIVATE_KEY'
        });
        
        const { headers, payload, signature } = await connect.getAuthHeaders(window.location.origin);
        
        // Set the connection state
        setFcConnect(connect);
        setIsConnected(true);
        setFid(process.env.NEXT_PUBLIC_FARCASTER_FID || 'YOUR_FID');
        
        // Return the proper headers for Farcaster recognition
        if (typeof window !== 'undefined') {
          // Send headers back to parent if in iframe
          window.parent.postMessage({
            type: 'FARCASTER_CONNECT_SUCCESS',
            headers,
            payload,
            signature,
            fid: process.env.NEXT_PUBLIC_FARCASTER_FID
          }, '*');
        }
        
      } catch (error) {
        console.error('Failed to initialize Farcaster Connect:', error);
      }
    };

    initializeFarcasterConnect();
  }, []);

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
              onClick={() => window.close()}
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

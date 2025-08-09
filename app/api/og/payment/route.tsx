import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const amount = searchParams.get('amount') || '0';
  const currency = searchParams.get('currency') || 'USDC';
  const description = searchParams.get('description') || 'Payment Request';

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          fontSize: 32,
          fontWeight: 600,
          color: 'white',
          position: 'relative',
        }}
      >
        {/* Background Pattern */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 119, 198, 0.3) 0%, transparent 50%)',
          }}
        />
        
        {/* Main Content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            borderRadius: '30px',
            padding: '60px 80px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            zIndex: 1,
          }}
        >
          {/* Logo/Title */}
          <div
            style={{
              fontSize: '48px',
              fontWeight: 'bold',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '15px',
            }}
          >
            💰 NedaPay
          </div>
          
          {/* Amount */}
          <div
            style={{
              fontSize: '72px',
              fontWeight: 'bold',
              marginBottom: '10px',
              textShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
            }}
          >
            ${amount}
          </div>
          
          {/* Currency */}
          <div
            style={{
              fontSize: '36px',
              opacity: 0.9,
              marginBottom: '30px',
              background: 'rgba(255, 255, 255, 0.2)',
              padding: '10px 20px',
              borderRadius: '20px',
            }}
          >
            {currency}
          </div>
          
          {/* Description */}
          <div
            style={{
              fontSize: '28px',
              textAlign: 'center',
              opacity: 0.8,
              marginBottom: '30px',
              maxWidth: '500px',
            }}
          >
            {description}
          </div>
          
          {/* Call to Action */}
          <div
            style={{
              fontSize: '24px',
              background: 'linear-gradient(45deg, #667eea, #764ba2)',
              padding: '15px 30px',
              borderRadius: '50px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            🚀 Pay with NedaPay
          </div>
        </div>
        
        {/* Footer */}
        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            fontSize: '20px',
            opacity: 0.7,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          ⚡ Instant payments on Base network
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

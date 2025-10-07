import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const amount = searchParams.get('amount') || '0';
  const currency = searchParams.get('currency') || 'USDC';
  const description = searchParams.get('description') || '';

  // Format the amount with commas
  const formatNumber = (num: string): string => {
    const parts = num.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  };

  const formattedAmount = formatNumber(amount);
  const displayDescription = description ? decodeURIComponent(description) : 'Payment Request';

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
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)',
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
            background: 'radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.3) 0%, transparent 50%)',
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
            textAlign: 'center',
          }}
        >
          {/* Logo/Title */}
          <div
            style={{
              fontSize: '48px',
              fontWeight: 'bold',
              marginBottom: '30px',
              display: 'flex',
              alignItems: 'center',
              gap: '15px',
            }}
          >
            💰 NedaPay
          </div>
          
          {/* Payment Request Label */}
          <div
            style={{
              fontSize: '28px',
              opacity: 0.8,
              marginBottom: '20px',
              background: 'rgba(59, 130, 246, 0.2)',
              padding: '10px 25px',
              borderRadius: '20px',
            }}
          >
            Payment Request
          </div>
          
          {/* Amount */}
          <div
            style={{
              fontSize: '80px',
              fontWeight: 'bold',
              marginBottom: '10px',
              textShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '20px',
            }}
          >
            {formattedAmount} {currency}
          </div>
          
          {/* Description */}
          {description && (
            <div
              style={{
                fontSize: '24px',
                textAlign: 'center',
                opacity: 0.9,
                marginBottom: '30px',
                maxWidth: '600px',
                background: 'rgba(255, 255, 255, 0.1)',
                padding: '15px 25px',
                borderRadius: '15px',
              }}
            >
              {displayDescription}
            </div>
          )}
          
          {/* Call to Action */}
          <div
            style={{
              fontSize: '28px',
              background: 'linear-gradient(45deg, #3b82f6, #8b5cf6)',
              padding: '20px 40px',
              borderRadius: '50px',
              display: 'flex',
              alignItems: 'center',
              gap: '15px',
              boxShadow: '0 10px 20px rgba(0, 0, 0, 0.3)',
            }}
          >
            🚀 Click to Pay
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
          ⚡ Secure payments on Base & Celo networks
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

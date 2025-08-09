import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export default async function Image({ params, searchParams }: {
  params: { slug: string }
  searchParams: { [key: string]: string | string[] | undefined }
}) {
  const amount = searchParams.amount as string || '0';
  const currency = searchParams.token as string || 'USDC';
  const description = searchParams.description as string || 'Payment Request';

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
        }}
      >
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
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>
            💰 NedaPay
          </div>
          
          <div style={{ fontSize: '72px', fontWeight: 'bold', marginBottom: '10px' }}>
            ${amount}
          </div>
          
          <div style={{ fontSize: '36px', opacity: 0.9, marginBottom: '30px' }}>
            {currency}
          </div>
          
          <div style={{ fontSize: '28px', textAlign: 'center', opacity: 0.8 }}>
            {description}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

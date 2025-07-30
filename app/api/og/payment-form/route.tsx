import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET() {
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
          backgroundColor: '#f8fafc',
          backgroundImage: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'white',
            borderRadius: '20px',
            padding: '60px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0',
          }}
        >
          <h1
            style={{
              fontSize: '48px',
              fontWeight: 'bold',
              marginBottom: '20px',
              color: '#1e40af',
            }}
          >
            Create Payment Link
          </h1>
          <p
            style={{
              fontSize: '24px',
              marginBottom: '40px',
              color: '#64748b',
              textAlign: 'center',
            }}
          >
            Enter payment details to generate a secure stablecoin payment link
          </p>
          
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              width: '100%',
              maxWidth: '400px',
            }}
          >
            <div
              style={{
                backgroundColor: '#f1f5f9',
                padding: '20px',
                borderRadius: '12px',
                border: '2px solid #e2e8f0',
              }}
            >
              <div style={{ fontSize: '18px', color: '#475569', marginBottom: '8px' }}>
                Amount (USDC)
              </div>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#1e293b' }}>
                $0.00
              </div>
            </div>
            
            <div
              style={{
                backgroundColor: '#f1f5f9',
                padding: '20px',
                borderRadius: '12px',
                border: '2px solid #e2e8f0',
              }}
            >
              <div style={{ fontSize: '18px', color: '#475569', marginBottom: '8px' }}>
                Description
              </div>
              <div style={{ fontSize: '20px', color: '#64748b' }}>
                Payment for...
              </div>
            </div>
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

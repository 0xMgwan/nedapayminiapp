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
          backgroundColor: '#1e40af',
          backgroundImage: 'linear-gradient(45deg, #1e40af 0%, #7c3aed 100%)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            textAlign: 'center',
            padding: '40px',
          }}
        >
          <h1
            style={{
              fontSize: '64px',
              fontWeight: 'bold',
              marginBottom: '20px',
              textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
            }}
          >
            NedaPay
          </h1>
          <p
            style={{
              fontSize: '28px',
              marginBottom: '30px',
              opacity: 0.9,
            }}
          >
            Accept Stablecoins, Swap instantly, Cash Out Easily
          </p>
          <div
            style={{
              display: 'flex',
              gap: '20px',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '18px',
              }}
            >
              USDC
            </div>
            <div
              style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '18px',
              }}
            >
              cNGN
            </div>
            <div
              style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '18px',
              }}
            >
              TSHC
            </div>
            <div
              style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '18px',
              }}
            >
              IDRX
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

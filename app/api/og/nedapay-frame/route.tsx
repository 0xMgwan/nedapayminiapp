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
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #8B5CF6 0%, #A855F7 50%, #C084FC 100%)',
        }}
      >
        {/* NedaPay Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
          }}
        >
          {/* Logo Icon */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              marginRight: '20px',
            }}
          >
            <svg
              width="80"
              height="80"
              viewBox="0 0 100 100"
              style={{
                filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
              }}
            >
              <rect x="10" y="20" width="25" height="60" rx="4" fill="white" opacity="0.9" />
              <rect x="40" y="10" width="25" height="80" rx="4" fill="white" opacity="0.95" />
              <rect x="70" y="30" width="25" height="40" rx="4" fill="white" />
            </svg>
          </div>
          
          {/* Logo Text */}
          <h1
            style={{
              fontSize: '72px',
              fontWeight: '600',
              margin: '0',
              letterSpacing: '-2px',
              textShadow: '0 4px 12px rgba(0,0,0,0.2)',
            }}
          >
            NEDApay
          </h1>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

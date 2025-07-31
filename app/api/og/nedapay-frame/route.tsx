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
          background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #3730a3 100%)',
          padding: '40px',
        }}
      >
        {/* Phone Frame */}
        <div
          style={{
            width: '320px',
            height: '600px',
            background: 'linear-gradient(135deg, #581c87 0%, #7c3aed 50%, #a855f7 100%)',
            borderRadius: '24px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  background: 'white',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: '#7c3aed',
                }}
              >
                N
              </div>
              <div>
                <div style={{ color: 'white', fontSize: '18px', fontWeight: 'bold' }}>NedaPay</div>
                <div style={{ color: '#c4b5fd', fontSize: '12px' }}>Mini App</div>
              </div>
            </div>
            <div
              style={{
                background: 'rgba(34, 197, 94, 0.2)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '12px',
                padding: '8px 12px',
                color: '#22c55e',
                fontSize: '12px',
                fontWeight: 'bold',
              }}
            >
              ● Connected
            </div>
          </div>

          {/* Floating Rates */}
          <div
            style={{
              background: 'rgba(139, 92, 246, 0.2)',
              borderRadius: '12px',
              padding: '8px 12px',
              marginBottom: '16px',
              display: 'flex',
              gap: '16px',
              fontSize: '12px',
            }}
          >
            <span style={{ color: '#fbbf24' }}>🇹🇿</span>
            <span style={{ color: 'white', fontWeight: 'bold' }}>TZS</span>
            <span style={{ color: '#22c55e', fontFamily: 'monospace' }}>2,547</span>
            <span style={{ color: '#fbbf24' }}>🇳🇬</span>
            <span style={{ color: 'white', fontWeight: 'bold' }}>NGN</span>
            <span style={{ color: '#22c55e', fontFamily: 'monospace' }}>1,523</span>
          </div>

          {/* Tabs */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.9)',
              borderRadius: '12px',
              padding: '8px',
              marginBottom: '16px',
              display: 'flex',
              gap: '4px',
            }}
          >
            <div
              style={{
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #6366f1 100%)',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 'bold',
                flex: 1,
                textAlign: 'center',
              }}
            >
              Send
            </div>
            <div
              style={{
                color: 'white',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 'bold',
                flex: 1,
                textAlign: 'center',
                background: 'rgba(51, 65, 85, 0.6)',
              }}
            >
              Pay
            </div>
            <div
              style={{
                color: 'white',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 'bold',
                flex: 1,
                textAlign: 'center',
                background: 'rgba(51, 65, 85, 0.6)',
              }}
            >
              Deposit
            </div>
            <div
              style={{
                color: 'white',
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 'bold',
                flex: 1,
                textAlign: 'center',
                background: 'rgba(51, 65, 85, 0.6)',
              }}
            >
              Link
            </div>
          </div>

          {/* Main Content */}
          <div
            style={{
              background: 'rgba(31, 41, 55, 1)',
              borderRadius: '12px',
              padding: '16px',
              flex: 1,
            }}
          >
            {/* Country Selector */}
            <div
              style={{
                background: 'rgba(51, 65, 85, 1)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '12px',
                color: 'white',
                fontSize: '14px',
              }}
            >
              🇹🇿 Tanzania
            </div>

            {/* Send Money Button */}
            <div
              style={{
                background: 'rgba(51, 65, 85, 1)',
                borderRadius: '8px',
                padding: '10px',
                marginBottom: '12px',
                color: 'white',
                fontSize: '14px',
                textAlign: 'center',
              }}
            >
              Send Money
            </div>

            {/* Amount Input */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}
            >
              <span style={{ color: '#9ca3af', fontSize: '12px' }}>Enter Amount</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <div
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b 0%, #ea580c 50%, #dc2626 100%)',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                  }}
                >
                  🏛️ TZS
                </div>
                <div
                  style={{
                    background: 'rgba(51, 65, 85, 0.8)',
                    color: 'white',
                    padding: '4px 12px',
                    borderRadius: '6px',
                    fontSize: '10px',
                    fontWeight: 'bold',
                  }}
                >
                  USDC
                </div>
              </div>
            </div>

            <div
              style={{
                background: 'rgba(51, 65, 85, 1)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '8px',
                color: 'white',
                fontSize: '16px',
              }}
            >
              TZS 1000
            </div>

            {/* Bottom Info */}
            <div style={{ fontSize: '10px', color: '#9ca3af', textAlign: 'center' }}>
              1 USDC = 2,547 TZS • Payment usually completes in 30s
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

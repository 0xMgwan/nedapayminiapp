import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const URL = process.env.NEXT_PUBLIC_URL || 'https://miniapp.nedapay.xyz';
  const PROJECT_NAME = process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'NedaPay';

  // Return frame metadata for root domain validation
  return new Response(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>${PROJECT_NAME} MiniApp</title>
        <meta name="description" content="Seamless crypto payments on Base network with USDC integration">
        
        <!-- Farcaster Frame Meta Tags -->
        <meta property="fc:frame" content="vNext">
        <meta property="fc:frame:image" content="${URL}/api/og/nedapay-frame">
        <meta property="fc:frame:button:1" content="Open ${PROJECT_NAME}">
        <meta property="fc:frame:button:1:action" content="link">
        <meta property="fc:frame:button:1:target" content="${URL}">
        <meta property="fc:frame:button:1:post_url" content="${URL}/api/webhook">
        
        <!-- Open Graph -->
        <meta property="og:title" content="${PROJECT_NAME} MiniApp">
        <meta property="og:description" content="Seamless crypto payments on Base network with USDC integration">
        <meta property="og:image" content="${URL}/api/og/nedapay-frame">
        <meta property="og:type" content="website">
        
        <!-- Twitter -->
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="${PROJECT_NAME} MiniApp">
        <meta name="twitter:description" content="Seamless crypto payments on Base network with USDC integration">
        <meta name="twitter:image" content="${URL}/api/og/nedapay-frame">
      </head>
      <body>
        <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
          <h1>${PROJECT_NAME} MiniApp</h1>
          <p>Seamless crypto payments on Base network with USDC integration</p>
          <a href="${URL}" style="background: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
            Open MiniApp
          </a>
        </div>
      </body>
    </html>
  `, {
    headers: {
      'Content-Type': 'text/html',
    },
  });
}

export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const URL = process.env.NEXT_PUBLIC_URL || 'https://nedapayminiapp.vercel.app';
  const PROJECT_NAME = process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'NedaPay';

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${PROJECT_NAME} MiniApp</title>
  
  <!-- Farcaster Frame Meta Tags (EXACT FORMAT) -->
  <meta property="fc:frame" content="vNext">
  <meta property="fc:frame:image" content="${URL}/api/og/nedapay-frame">
  <meta property="fc:frame:button:1" content="Open ${PROJECT_NAME}">
  <meta property="fc:frame:button:1:action" content="link">
  <meta property="fc:frame:button:1:target" content="${URL}">
  
  <!-- Farcaster MiniApp Embed Detection -->
  <meta name="farcaster:frame" content="vNext">
  <meta name="farcaster:frame:miniapp" content="true">
  <meta name="farcaster:frame:miniapp:url" content="${URL}">
  <meta name="farcaster:frame:miniapp:manifest" content="${URL}/.well-known/farcaster.json">
  
  <!-- Additional Embed Detection -->
  <meta name="fc:frame" content="vNext">
  <meta name="fc:frame:miniapp" content="true">
  
  <!-- Open Graph -->
  <meta property="og:title" content="${PROJECT_NAME} MiniApp">
  <meta property="og:description" content="Seamless crypto payments on Base network with USDC integration">
  <meta property="og:image" content="${URL}/api/og/nedapay-frame">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${URL}">
  
  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${PROJECT_NAME} MiniApp">
  <meta name="twitter:description" content="Seamless crypto payments on Base network with USDC integration">
  <meta name="twitter:image" content="${URL}/api/og/nedapay-frame">
  
  <link rel="icon" type="image/png" href="/favicon.png">
  <link rel="manifest" href="${URL}/.well-known/farcaster.json">
  
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      text-align: center;
    }
    .container {
      max-width: 400px;
      padding: 2rem;
    }
    .logo {
      font-size: 2rem;
      font-weight: bold;
      margin-bottom: 1rem;
      background: linear-gradient(45deg, #3b82f6, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .description {
      margin-bottom: 2rem;
      opacity: 0.8;
    }
    .button {
      background: linear-gradient(45deg, #3b82f6, #8b5cf6);
      color: white;
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      text-decoration: none;
      display: inline-block;
      transition: transform 0.2s;
    }
    .button:hover {
      transform: scale(1.05);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">${PROJECT_NAME}</div>
    <div class="description">Seamless crypto payments on Base network with USDC integration</div>
    <a href="${URL}" class="button">Open MiniApp</a>
  </div>
  
  <script>
    // Initialize Farcaster SDK if available
    if (typeof window !== 'undefined') {
      import('@farcaster/miniapp-sdk').then(({ sdk }) => {
        sdk.actions.ready().catch(console.error);
      }).catch(() => {
        // Fallback if SDK not available
        console.log('Farcaster SDK not available');
      });
    }
  </script>
</body>
</html>
  `;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

export const dynamic = 'force-dynamic';

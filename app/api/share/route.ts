import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const amount = searchParams.get('amount') || '0';
  const currency = searchParams.get('currency') || 'USDC';
  const description = searchParams.get('description') || 'Payment Request';
  const link = searchParams.get('link') || '';
  
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://nedapayminiapp.vercel.app';
  
  // Create the Farcaster MiniApp embed metadata
  const miniappData = {
    version: '1',
    imageUrl: `${baseUrl}/api/og/payment?amount=${amount}&currency=${currency}&description=${encodeURIComponent(description)}`,
    button: {
      title: `💰 Pay $${amount} ${currency}`,
      action: {
        type: 'launch_miniapp',
        name: 'NedaPay',
        url: link || baseUrl, // This should be the direct payment-request URL
        splashImageUrl: `${baseUrl}/splash.png`,
        splashBackgroundColor: '#1e293b'
      }
    }
  };

  // Generate the HTML with proper meta tags
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NedaPay - ${description}</title>
  
  <!-- Farcaster MiniApp metadata -->
  <meta name="fc:miniapp" content='${JSON.stringify(miniappData)}' />
  <meta name="fc:frame" content='${JSON.stringify({
    ...miniappData,
    button: {
      ...miniappData.button,
      action: {
        ...miniappData.button.action,
        type: 'launch_frame'
      }
    }
  })}' />
  
  <!-- Open Graph metadata -->
  <meta property="og:title" content="NedaPay - ${description}" />
  <meta property="og:description" content="Pay $${amount} ${currency} instantly with NedaPay on Base" />
  <meta property="og:image" content="${baseUrl}/api/og/payment?amount=${amount}&currency=${currency}&description=${encodeURIComponent(description)}" />
  <meta property="og:url" content="${link}" />
  <meta property="og:type" content="website" />
  
  <!-- Twitter Card metadata -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="NedaPay - ${description}" />
  <meta name="twitter:description" content="Pay $${amount} ${currency} instantly with NedaPay on Base" />
  <meta name="twitter:image" content="${baseUrl}/api/og/payment?amount=${amount}&currency=${currency}&description=${encodeURIComponent(description)}" />
  
  
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      margin: 0;
      padding: 20px;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .container {
      text-align: center;
      max-width: 400px;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 40px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }
    .amount {
      font-size: 3rem;
      font-weight: bold;
      margin: 20px 0;
    }
    .currency {
      font-size: 1.2rem;
      opacity: 0.8;
      margin-bottom: 20px;
    }
    .description {
      font-size: 1.1rem;
      margin-bottom: 30px;
    }
    .launch-btn {
      background: linear-gradient(45deg, #667eea, #764ba2);
      border: none;
      color: white;
      padding: 15px 30px;
      border-radius: 50px;
      font-size: 1.1rem;
      font-weight: bold;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
      transition: transform 0.2s;
    }
    .launch-btn:hover {
      transform: scale(1.05);
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>💰 NedaPay</h1>
    <div class="amount">$${amount}</div>
    <div class="currency">${currency}</div>
    <div class="description">${description}</div>
    <a href="${link || baseUrl}" class="launch-btn">
      🚀 Pay with NedaPay
    </a>
    <p style="margin-top: 30px; opacity: 0.7; font-size: 0.9rem;">
      Instant crypto payments on Base network
    </p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

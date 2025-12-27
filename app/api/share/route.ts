import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const amount = searchParams.get('amount') || '0';
  const currency = searchParams.get('currency') || 'USDC';
  const description = searchParams.get('description') || 'Payment Request';
  const link = searchParams.get('link') || '';
  
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://miniapp.nedapay.xyz';
  
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
  
  <script>
    // Redirect to payment page immediately for direct access
    // This ensures that when someone clicks the link, they go straight to the payment page
    if (window.location !== window.parent.location) {
      // We're in a frame (like Farcaster), let the frame handle the launch
      console.log('In frame context - letting frame handle launch');
    } else {
      // Direct access - redirect to payment page
      console.log('Direct access - redirecting to payment page');
      window.location.href = '${link}';
    }
  </script>
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
    }
    .description {
      font-size: 1rem;
      margin: 20px 0;
      opacity: 0.9;
    }
    .button {
      background: linear-gradient(45deg, #4CAF50, #45a049);
      color: white;
      border: none;
      padding: 15px 30px;
      font-size: 1.1rem;
      border-radius: 25px;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
      margin-top: 20px;
      transition: transform 0.2s;
    }
    .button:hover {
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
    <p>Redirecting to payment page...</p>
    <a href="${link}" class="button">Pay Now</a>
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

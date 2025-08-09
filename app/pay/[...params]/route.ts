import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { params: string[] } }
) {
  const { searchParams } = new URL(request.url);
  
  // Extract payment parameters
  const id = searchParams.get('id') || '';
  const amount = searchParams.get('amount') || '0';
  const token = searchParams.get('token') || 'USDC';
  const description = searchParams.get('description') || 'Payment Request';
  const merchant = searchParams.get('merchant') || '';
  
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://nedapayminiapp.vercel.app';
  const currentUrl = request.url;
  
  // Create the payment request URL that the MiniApp should open
  const paymentUrl = `${baseUrl}/payment-request?id=${id}&amount=${amount}&token=${token}&description=${encodeURIComponent(description)}&merchant=${merchant}`;
  
  // Create Farcaster MiniApp metadata
  const miniappData = {
    version: '1',
    imageUrl: `${baseUrl}/api/og/payment?amount=${amount}&currency=${token}&description=${encodeURIComponent(description)}`,
    button: {
      title: `💰 Pay $${amount} ${token}`,
      action: {
        type: 'launch_miniapp',
        name: 'NedaPay',
        url: paymentUrl,
        splashImageUrl: `${baseUrl}/splash.png`,
        splashBackgroundColor: '#1e293b'
      }
    }
  };

  // Generate HTML with proper Farcaster metadata using name attributes
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NedaPay - Pay $${amount} ${token}</title>
  
  <!-- Farcaster MiniApp metadata with name attributes -->
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
  <meta property="og:title" content="NedaPay - Pay $${amount} ${token}" />
  <meta property="og:description" content="${description} - Pay $${amount} ${token} instantly with NedaPay on Base" />
  <meta property="og:image" content="${baseUrl}/api/og/payment?amount=${amount}&currency=${token}&description=${encodeURIComponent(description)}" />
  <meta property="og:url" content="${currentUrl}" />
  <meta property="og:type" content="website" />
  
  <!-- Twitter Card metadata -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="NedaPay - Pay $${amount} ${token}" />
  <meta name="twitter:description" content="${description} - Pay $${amount} ${token} instantly with NedaPay on Base" />
  <meta name="twitter:image" content="${baseUrl}/api/og/payment?amount=${amount}&currency=${token}&description=${encodeURIComponent(description)}" />
  
  <script>
    // Redirect to the actual payment page
    window.location.href = '${paymentUrl}';
  </script>
</head>
<body>
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; min-height: 100vh; display: flex; align-items: center; justify-content: center;">
    <div style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border-radius: 20px; padding: 40px; max-width: 400px;">
      <h1>💰 NedaPay</h1>
      <div style="font-size: 2rem; font-weight: bold; margin: 20px 0;">$${amount}</div>
      <div style="font-size: 1.2rem; opacity: 0.8; margin-bottom: 20px;">${token}</div>
      <div style="font-size: 1rem; margin: 20px 0; opacity: 0.9;">${description}</div>
      <p>Redirecting to payment page...</p>
      <a href="${paymentUrl}" style="background: linear-gradient(45deg, #4CAF50, #45a049); color: white; border: none; padding: 15px 30px; font-size: 1.1rem; border-radius: 25px; text-decoration: none; display: inline-block; margin-top: 20px;">Pay Now</a>
    </div>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 
      'Content-Type': 'text/html',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    },
  });
}

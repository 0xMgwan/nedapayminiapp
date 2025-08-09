import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  // Extract payment parameters
  const id = searchParams.get('id') || '';
  const amount = searchParams.get('amount') || '0';
  const token = searchParams.get('token') || 'USDC';
  const description = searchParams.get('description') || 'Payment Request';
  const merchant = searchParams.get('merchant') || '';
  const protocolFee = searchParams.get('protocolFee') || '';
  const feeTier = searchParams.get('feeTier') || '';
  const protocolEnabled = searchParams.get('protocolEnabled') || '';
  
  console.log('🔍 Payment share route parameters:', { id, amount, token, description, merchant, protocolFee });
  
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://nedapayminiapp.vercel.app';
  
  // Create the payment request URL that the MiniApp should open
  let paymentUrl = `${baseUrl}/payment-request?id=${id}&amount=${amount}&token=${token}&description=${encodeURIComponent(description)}&merchant=${merchant}`;
  
  // Add protocol fee parameters if present
  if (protocolFee && feeTier && protocolEnabled) {
    paymentUrl += `&protocolFee=${protocolFee}&feeTier=${encodeURIComponent(feeTier)}&protocolEnabled=${protocolEnabled}`;
  }
  
  // Create Farcaster MiniApp metadata with specific payment details
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

  console.log('🎯 Generated Farcaster metadata:', JSON.stringify(miniappData, null, 2));

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
  <meta property="og:url" content="${request.url}" />
  <meta property="og:type" content="website" />
  
  <!-- Twitter Card metadata -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="NedaPay - Pay $${amount} ${token}" />
  <meta name="twitter:description" content="${description} - Pay $${amount} ${token} instantly with NedaPay on Base" />
  <meta name="twitter:image" content="${baseUrl}/api/og/payment?amount=${amount}&currency=${token}&description=${encodeURIComponent(description)}" />
  
  <!-- No JavaScript redirect - let Farcaster handle MiniApp launch -->
</head>
<body>
  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; text-align: center; padding: 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; min-height: 100vh; display: flex; align-items: center; justify-content: center;">
    <div style="background: rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); border-radius: 20px; padding: 40px; max-width: 400px;">
      <h1>💰 NedaPay</h1>
      <div style="font-size: 2rem; font-weight: bold; margin: 20px 0;">$${amount}</div>
      <div style="font-size: 1.2rem; opacity: 0.8; margin-bottom: 20px;">${token}</div>
      <div style="font-size: 1rem; margin: 20px 0; opacity: 0.9;">${description}</div>
      <p>Click the launch button above to open in NedaPay MiniApp</p>
      <p style="font-size: 0.8rem; opacity: 0.7; margin-top: 20px;">If you're seeing this page directly, <a href="${paymentUrl}" style="color: #4CAF50;">click here to pay</a></p>
      <div style="font-size: 0.7rem; opacity: 0.5; margin-top: 20px; word-break: break-all;">
        Debug: ${paymentUrl}
      </div>
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

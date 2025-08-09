import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  
  // In a real app, you'd fetch the payment data from a database
  // For now, we'll decode the payment info from the ID
  try {
    // The ID contains encoded payment information (browser-compatible base64)
    const base64Data = id
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(id.length + (4 - id.length % 4) % 4, '=');
    const decodedData = Buffer.from(base64Data, 'base64').toString('utf-8');
    const paymentData = JSON.parse(decodedData);
    
    const { amount, currency, description, merchant, linkId, protocolFee, feeTier, protocolEnabled } = paymentData;
    
    // Build the full payment request URL
    let protocolFeeParams = '';
    if (protocolEnabled) {
      protocolFeeParams = `&protocolFee=${protocolFee}&feeTier=${encodeURIComponent(feeTier)}&protocolEnabled=true`;
    }
    
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://nedapayminiapp.vercel.app';
    const paymentUrl = `${baseUrl}/payment-request?id=${linkId}&amount=${amount}&token=${currency}&description=${encodeURIComponent(description || '')}&merchant=${merchant}${protocolFeeParams}`;
    
    // Check if this is a request for metadata (from Farcaster crawlers)
    const userAgent = request.headers.get('user-agent') || '';
    const isBot = userAgent.includes('facebookexternalhit') || 
                  userAgent.includes('Twitterbot') || 
                  userAgent.includes('LinkedInBot') ||
                  userAgent.includes('WhatsApp') ||
                  userAgent.toLowerCase().includes('bot');
    
    if (isBot) {
      // Return HTML with proper Farcaster metadata
      const miniappData = {
        version: '1',
        imageUrl: `${baseUrl}/api/og/payment?amount=${amount}&currency=${currency}&description=${encodeURIComponent(description)}`,
        button: {
          title: `💰 Pay $${amount} ${currency}`,
          action: {
            type: 'launch_miniapp',
            name: 'NedaPay',
            url: paymentUrl,
            splashImageUrl: `${baseUrl}/splash.png`,
            splashBackgroundColor: '#1e293b'
          }
        }
      };

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NedaPay - Pay $${amount} ${currency}</title>
  
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
  <meta property="og:title" content="NedaPay - Pay $${amount} ${currency}" />
  <meta property="og:description" content="${description} - Pay $${amount} ${currency} instantly with NedaPay on Base" />
  <meta property="og:image" content="${baseUrl}/api/og/payment?amount=${amount}&currency=${currency}&description=${encodeURIComponent(description)}" />
  <meta property="og:url" content="${request.url}" />
  <meta property="og:type" content="website" />
</head>
<body>
  <script>window.location.href = '${paymentUrl}';</script>
  <p>Redirecting to payment...</p>
  <a href="${paymentUrl}">Click here if not redirected</a>
</body>
</html>`;

      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html' },
      });
    }
    
    // For regular users, redirect with a script to store payment data in localStorage
    const redirectHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Redirecting to Payment...</title>
</head>
<body>
  <script>
    // Store payment data in localStorage before redirecting
    const paymentData = {
      id: '${linkId}',
      amount: '${amount}',
      token: '${currency}',
      description: '${description}',
      merchant: '${merchant}',
      createdAt: new Date().toISOString(),
      status: 'pending',
      protocolEnabled: ${protocolEnabled || false},
      ${protocolEnabled ? `protocolFee: { feeRate: ${protocolFee}, tier: '${feeTier}' },` : ''}
    };
    
    localStorage.setItem('payment-${linkId}', JSON.stringify(paymentData));
    
    // Redirect to payment page
    window.location.href = '${paymentUrl}';
  </script>
  <p>Redirecting to payment page...</p>
  <a href="${paymentUrl}">Click here if not redirected</a>
</body>
</html>`;

    return new NextResponse(redirectHtml, {
      headers: { 'Content-Type': 'text/html' },
    });
    
  } catch (error) {
    console.error('Error processing payment redirect:', error);
    const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://nedapayminiapp.vercel.app';
    return NextResponse.redirect(baseUrl);
  }
}

import { Metadata } from 'next';
import Head from 'next/head';

// Static metadata for payment request pages
export async function generateMetadata({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }): Promise<Metadata> {
  // Extract payment parameters from URL
  const amount = searchParams.amount as string || '0';
  const token = searchParams.token as string || 'USDC';
  const description = searchParams.description as string || 'Payment Request';
  const id = searchParams.id as string || '';
  const merchant = searchParams.merchant as string || '';
  const protocolFee = searchParams.protocolFee as string || '';
  const feeTier = searchParams.feeTier as string || '';
  const protocolEnabled = searchParams.protocolEnabled as string || '';
  
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://nedapayminiapp.vercel.app';
  
  // Reconstruct the current URL with all parameters
  let currentUrl = `${baseUrl}/payment-request?id=${id}&amount=${amount}&token=${token}&description=${encodeURIComponent(description)}&merchant=${merchant}`;
  if (protocolFee && feeTier && protocolEnabled) {
    currentUrl += `&protocolFee=${protocolFee}&feeTier=${encodeURIComponent(feeTier)}&protocolEnabled=${protocolEnabled}`;
  }
  
  // Create dynamic Farcaster metadata
  const farcasterMiniappData = {
    version: '1',
    imageUrl: `${baseUrl}/og-image.png`,
    button: {
      title: `💰 Pay $${amount} ${token}`,
      action: {
        type: 'launch_miniapp',
        url: currentUrl,
        name: 'NedaPay',
        splashImageUrl: `${baseUrl}/splash.png`,
        splashBackgroundColor: '#1e293b'
      }
    }
  };

  return {
    title: `NedaPay - Pay $${amount} ${token}`,
    description: `${description} - Pay $${amount} ${token} instantly with NedaPay on Base`,
    openGraph: {
      title: `NedaPay - Pay $${amount} ${token}`,
      description: `${description} - Pay $${amount} ${token} instantly with NedaPay on Base`,
      type: 'website',
      images: [
        {
          url: `${baseUrl}/api/og/payment?amount=${amount}&currency=${token}&description=${encodeURIComponent(description)}`,
          width: 1200,
          height: 630,
          alt: `Pay $${amount} ${token} with NedaPay`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `NedaPay - Pay $${amount} ${token}`,
      description: `${description} - Pay $${amount} ${token} instantly with NedaPay on Base`,
      images: [`${baseUrl}/api/og/payment?amount=${amount}&currency=${token}&description=${encodeURIComponent(description)}`],
    },
    other: {
      // Dynamic Farcaster MiniApp metadata with payment-specific details
      'fc:miniapp': JSON.stringify(farcasterMiniappData),
      'fc:frame': JSON.stringify({
        ...farcasterMiniappData,
        button: {
          ...farcasterMiniappData.button,
          action: {
            ...farcasterMiniappData.button.action,
            type: 'launch_frame'
          }
        }
      }),
    },
  };
}

export default function PaymentRequestLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      {children}
    </>
  )
}

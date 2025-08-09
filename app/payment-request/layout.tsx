import { Metadata } from 'next';
import Head from 'next/head';

// Static metadata for payment request pages
export const metadata: Metadata = {
  title: 'NedaPay - Payment Request',
  description: 'Complete your payment instantly with NedaPay on Base',
  openGraph: {
    title: 'NedaPay - Payment Request',
    description: 'Complete your payment instantly with NedaPay on Base',
    type: 'website',
    images: [
      {
        url: 'https://nedapayminiapp.vercel.app/api/og/payment',
        width: 1200,
        height: 630,
        alt: 'Pay with NedaPay',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NedaPay - Payment Request',
    description: 'Complete your payment instantly with NedaPay on Base',
    images: ['https://nedapayminiapp.vercel.app/api/og/payment'],
  },
  other: {
    // Farcaster MiniApp metadata - static fallback that will be enhanced by client-side updates
    'fc:miniapp': JSON.stringify({
      version: '1',
      imageUrl: 'https://nedapayminiapp.vercel.app/api/og/payment',
      button: {
        title: '💰 Pay with NedaPay',
        action: {
          type: 'launch_miniapp',
          name: 'NedaPay',
          url: 'https://nedapayminiapp.vercel.app/payment-request',
          splashImageUrl: 'https://nedapayminiapp.vercel.app/splash.png',
          splashBackgroundColor: '#1e293b'
        }
      }
    }),
    
    // Backward compatibility
    'fc:frame': JSON.stringify({
      version: '1',
      imageUrl: 'https://nedapayminiapp.vercel.app/api/og/payment',
      button: {
        title: '💰 Pay with NedaPay',
        action: {
          type: 'launch_frame',
          name: 'NedaPay',
          url: 'https://nedapayminiapp.vercel.app/payment-request',
          splashImageUrl: 'https://nedapayminiapp.vercel.app/splash.png',
          splashBackgroundColor: '#1e293b'
        }
      }
    }),
  },
};

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

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
    // Note: All static Farcaster metadata removed to prevent conflicts
    // Dynamic metadata is handled by client-side updates in the page component
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

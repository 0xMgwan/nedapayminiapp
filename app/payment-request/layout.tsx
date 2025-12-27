import { Metadata } from 'next'

// Static metadata for payment request pages (dynamic metadata moved to page component)
export const metadata: Metadata = {
  title: 'NedaPay - Payment Request',
  description: 'Complete your payment instantly with NedaPay on Base',
  openGraph: {
    title: 'NedaPay - Payment Request',
    description: 'Complete your payment instantly with NedaPay on Base',
    type: 'website',
    images: [
      {
        url: 'https://miniapp.nedapay.xyz/api/og/payment',
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
    images: ['https://miniapp.nedapay.xyz/api/og/payment'],
  },
  // Note: Dynamic Farcaster metadata is handled in the page component
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

import { Metadata } from 'next';

// Static metadata for the payment request layout
export const metadata: Metadata = {
  title: 'NedaPay - Payment Request',
  description: 'Pay instantly with NedaPay on Base network',
  openGraph: {
    title: 'NedaPay - Payment Request',
    description: 'Pay instantly with NedaPay on Base network',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NedaPay - Payment Request',
    description: 'Pay instantly with NedaPay on Base network',
  },
};

export default function PaymentRequestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

import { Metadata } from 'next';

type Props = {
  searchParams: { [key: string]: string | string[] | undefined }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const amount = searchParams.amount as string || '0';
  const currency = searchParams.token as string || 'USDC';
  const description = searchParams.description as string || 'Payment Request';
  const merchant = searchParams.merchant as string || '';
  
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://nedapayminiapp.vercel.app';
  const currentUrl = `${baseUrl}/payment-request?${new URLSearchParams(searchParams as Record<string, string>).toString()}`;
  
  // Create the Farcaster MiniApp embed metadata
  const miniappData = {
    version: '1',
    imageUrl: `${baseUrl}/api/og/payment?amount=${amount}&currency=${currency}&description=${encodeURIComponent(description)}`,
    button: {
      title: `💰 Pay $${amount} ${currency}`,
      action: {
        type: 'launch_miniapp',
        name: 'NedaPay',
        url: currentUrl,
        splashImageUrl: `${baseUrl}/splash.png`,
        splashBackgroundColor: '#1e293b'
      }
    }
  };

  return {
    title: `NedaPay - Pay $${amount} ${currency}`,
    description: `${description} - Pay $${amount} ${currency} instantly with NedaPay on Base`,
    openGraph: {
      title: `NedaPay - Pay $${amount} ${currency}`,
      description: `${description} - Pay $${amount} ${currency} instantly with NedaPay on Base`,
      type: 'website',
      url: currentUrl,
      images: [
        {
          url: `${baseUrl}/api/og/payment?amount=${amount}&currency=${currency}&description=${encodeURIComponent(description)}`,
          width: 1200,
          height: 630,
          alt: `Pay $${amount} ${currency} with NedaPay`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `NedaPay - Pay $${amount} ${currency}`,
      description: `${description} - Pay $${amount} ${currency} instantly with NedaPay on Base`,
      images: [`${baseUrl}/api/og/payment?amount=${amount}&currency=${currency}&description=${encodeURIComponent(description)}`],
    },
    other: {
      // Primary frame metadata for Farcaster MiniApp
      'fc:miniapp': JSON.stringify(miniappData),
      
      // Backward compatibility
      'fc:frame': JSON.stringify({
        ...miniappData,
        button: {
          ...miniappData.button,
          action: {
            ...miniappData.button.action,
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
  children: React.ReactNode;
}) {
  return children;
}

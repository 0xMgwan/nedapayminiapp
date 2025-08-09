import { Metadata } from 'next';

type Props = {
  params: { slug: string }
  searchParams: { [key: string]: string | string[] | undefined }
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const amount = searchParams.amount as string || '0';
  const currency = searchParams.token as string || 'USDC';
  const description = searchParams.description as string || 'Payment Request';
  
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://nedapayminiapp.vercel.app';
  const currentUrl = `${baseUrl}/payment-request?${new URLSearchParams(searchParams as Record<string, string>).toString()}`;
  
  // Create the Farcaster MiniApp embed metadata for this specific payment
  const miniappData = {
    version: '1',
    imageUrl: `${baseUrl}/api/og/payment?amount=${amount}&currency=${currency}&description=${encodeURIComponent(description)}`,
    button: {
      title: `💰 Pay $${amount} ${currency}`,
      action: {
        type: 'launch_miniapp',
        name: 'NedaPay',
        url: currentUrl, // This is the key - it should open to this specific payment page
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
      // This is the critical part - override the main app's Farcaster metadata
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

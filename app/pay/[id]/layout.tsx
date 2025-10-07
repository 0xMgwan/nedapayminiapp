import type { Metadata } from 'next';

const URL = process.env.NEXT_PUBLIC_URL || 'https://nedapayminiapp.vercel.app';
const PROJECT_NAME = process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'NedaPay';

export async function generateMetadata({ 
  params, 
  searchParams 
}: { 
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}): Promise<Metadata> {
  const { id } = params;
  const amount = searchParams.amount as string;
  const currency = searchParams.currency as string;
  const description = searchParams.description as string;
  
  // Construct the full payment link URL
  const paymentUrl = `${URL}/pay/${id}?${new URLSearchParams(searchParams as Record<string, string>).toString()}`;
  
  // Create descriptive title and description
  const title = amount && currency 
    ? `Payment Request: ${amount} ${currency}` 
    : 'Payment Request';
  
  const desc = description 
    ? `Pay ${amount} ${currency} - ${decodeURIComponent(description)}` 
    : `Pay ${amount} ${currency} via ${PROJECT_NAME}`;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      type: 'website',
      locale: 'en',
      siteName: PROJECT_NAME,
      url: paymentUrl,
      images: [
        {
          url: `${URL}/api/og/payment-request?amount=${amount}&currency=${currency}&description=${description || ''}`,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: desc,
      images: [`${URL}/api/og/payment-request?amount=${amount}&currency=${currency}&description=${description || ''}`],
    },
    other: {
      // Farcaster Frame metadata - points to the specific payment link
      'fc:frame': 'vNext',
      'fc:frame:image': `${URL}/api/og/payment-request?amount=${amount}&currency=${currency}&description=${description || ''}`,
      'fc:frame:button:1': `Pay ${amount} ${currency}`,
      'fc:frame:button:1:action': 'link',
      'fc:frame:button:1:target': paymentUrl,
      
      // OpenFrames
      'of:version': 'vNext',
      'of:accepts:xmtp': '2024-02-01',
      'of:accepts:lens': '1.1',
      'of:image': `${URL}/api/og/payment-request?amount=${amount}&currency=${currency}&description=${description || ''}`,
      'of:button:1': `Pay ${amount} ${currency}`,
      'of:button:1:action': 'link',
      'of:button:1:target': paymentUrl,
    },
  };
}

export default function PaymentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

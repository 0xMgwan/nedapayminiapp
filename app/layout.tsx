import '@coinbase/onchainkit/styles.css';
import type { Metadata } from 'next';
import './globals.css';
import './compliance/user/kyc.css';
import './components/name-fallback.css';
import { Providers } from './providers';
import AppToaster from './components/Toaster';
import { ReadyState } from './components/ReadyState';
import { MiniKitProvider } from './components/MiniKitProvider';
import {Analytics} from '@vercel/analytics/next';

const URL = process.env.NEXT_PUBLIC_URL || 'https://miniapp.nedapay.xyz';
const PROJECT_NAME = process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'NedaPay';

export async function generateMetadata(): Promise<Metadata> {
  // Default metadata for main app
  const defaultMetadata = {
    title: PROJECT_NAME,
    description: 'Pay, Accept, Swap and On/Offramp your Stablecoins to Fiat in seconds.',
    keywords: ['NedaPay', 'Farcaster', 'MiniApp', 'Base', 'USDC', 'Crypto Payments', 'Stablecoins'],
    authors: [{ name: 'NedaPay' }],
    openGraph: {
      title: `${PROJECT_NAME} MiniApp`,
      description: 'Pay, Accept, Swap and On/Offramp your Stablecoins to Fiat in seconds.',
      type: 'website',
      locale: 'en',
      siteName: PROJECT_NAME,
      images: [
        {
          url: `${URL}/api/og/nedapay-frame`,
          width: 1200,
          height: 630,
          alt: `${PROJECT_NAME} MiniApp`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${PROJECT_NAME} MiniApp`,
      description: 'Pay, Accept, Swap and On/Offramp your Stablecoins to Fiat in seconds.',
      images: [`${URL}/og-image.png`],
    },
    // Note: Removed Farcaster metadata from main layout to prevent conflicts
    // Payment-request pages have their own specific Farcaster metadata
    other: {
      // Base app verification
      'base:app_id': '68a5c58dd3f637a5b9984595',
      // OpenFrames
      'of:version': 'vNext',
      'of:accepts:xmtp': '2024-02-01',
      'of:accepts:lens': '1.1',
      'of:image': `${URL}/api/og/nedapay-frame`,
      'of:button:1': `Open ${PROJECT_NAME}`,
      'of:button:1:action': 'link',
      'of:button:1:target': URL,
    },
    icons: {
      icon: '/icon-512.png',
      apple: '/icon-512.png',
    },
    manifest: `${URL}/manifest.json`,
  };

  return defaultMetadata;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        {/* Base app verification */}
        <meta name="base:app_id" content="68a5c58dd3f637a5b9984595" />
        {/* Farcaster MiniApp metadata - only for main app, payment pages have their own */}
        <meta name="fc:miniapp" content='{"version":"1","imageUrl":"https://miniapp.nedapay.xyz/og-image.png","button":{"title":"💰 Launch NedaPay","action":{"type":"launch_miniapp","name":"NedaPay","url":"https://miniapp.nedapay.xyz","splashImageUrl":"https://miniapp.nedapay.xyz/splash.png","splashBackgroundColor":"#1e293b"}}}' />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <script src="https://cdn.jsdelivr.net/npm/@farcaster/frame-sdk/dist/index.min.js" defer></script>
      </head>
      <body className="bg-slate-900 text-white">
        <div className="flex flex-col min-h-screen">
          <Providers>
            <MiniKitProvider>
              <AppToaster />
              <ReadyState />
              <main className="flex-grow">{children}</main>
            </MiniKitProvider>
          </Providers>
        </div>
        <Analytics />
      </body>
    </html>
  );
}

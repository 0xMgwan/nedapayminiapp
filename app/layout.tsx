import '@coinbase/onchainkit/styles.css';
import type { Metadata } from 'next';
import './globals.css';
import './compliance/user/kyc.css';
import './components/name-fallback.css';
import { Providers } from './providers';
import AppToaster from './components/Toaster';
import {Analytics} from '@vercel/analytics/next';

const URL = process.env.NEXT_PUBLIC_URL || 'https://nedapayminiapp.vercel.app';
const PROJECT_NAME = process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'NedaPay';

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: PROJECT_NAME,
    description: 'Seamless crypto payments on Base network with USDC integration. Send money, pay bills, and manage payments globally.',
    keywords: ['NedaPay', 'Farcaster', 'MiniApp', 'Base', 'USDC', 'Crypto Payments', 'Stablecoins'],
    authors: [{ name: 'NedaPay' }],
    openGraph: {
      title: `${PROJECT_NAME} MiniApp`,
      description: 'Seamless crypto payments on Base network with USDC integration',
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
      description: 'Seamless crypto payments on Base network with USDC integration',
      images: [`${URL}/api/og/nedapay-frame`],
    },
    other: {

      // Critical Farcaster MiniApp Embed Detection (CORRECT FORMAT)
      'fc:miniapp': JSON.stringify({
        version: '1',
        imageUrl: `${URL}/api/og/nedapay-frame`,
        button: {
          title: `Open ${PROJECT_NAME}`,
          action: {
            type: 'launch_miniapp',
            url: URL,
            name: PROJECT_NAME,
            splashImageUrl: `${URL}/splash.png`,
            splashBackgroundColor: '#1e293b'
          }
        }
      }),
      // Backward compatibility
      'fc:frame': JSON.stringify({
        version: '1',
        imageUrl: `${URL}/api/og/nedapay-frame`,
        button: {
          title: `Open ${PROJECT_NAME}`,
          action: {
            type: 'launch_frame',
            url: URL,
            name: PROJECT_NAME,
            splashImageUrl: `${URL}/splash.png`,
            splashBackgroundColor: '#1e293b'
          }
        }
      }),
      
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
      icon: '/favicon.png',
    },
    manifest: `${URL}/.well-known/farcaster.json`,
  };
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
        <meta name="farcaster:frame" content="vNext" />
        <meta name="farcaster:frame:miniapp" content="true" />
        <meta name="farcaster:frame:miniapp:url" content="https://nedapayminiapp.vercel.app" />
        <meta name="farcaster:frame:miniapp:manifest" content="https://nedapayminiapp.vercel.app/.well-known/farcaster.json" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" type="image/png" href="/favicon.png" />
      </head>
      <body className="bg-white text-black dark:text-white">
        <div className="flex flex-col min-h-screen">
          <Providers>
            <AppToaster />
            <main className="flex-grow">{children}</main>
          </Providers>
        </div>
        <Analytics />
      </body>
    </html>
  );
}

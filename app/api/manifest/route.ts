import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_URL || 'https://miniapp.nedapay.xyz';
  
  const manifest = {
    accountAssociation: {
      header: "eyJmaWQiOjg2OTUyNywidHlwZSI6ImF1dGgiLCJrZXkiOiIweDdFMzQ3N2M0RWQ2OUE4RTdBMDAxQzg3ZTlFQTI4ODJlOTc2NERDMzEifQ",
      payload: "eyJkb21haW4iOiJtaW5pYXBwLm5lZGFwYXkueHl6In0",
      signature: "eRFq8YzRNq1OTMQFm/3ph+TvcbS7vKRjc7iqpNohnNAjfLWi3f8fuzwMcNgzkmgMWyu31iUoQUf+dVzHVZw4MBw="
    },
    frame: {
      version: '1',
      name: process.env.NEXT_PUBLIC_ONCHAINKIT_PROJECT_NAME || 'NedaPay',
      iconUrl: `${baseUrl}/icon-512.png`,
      homeUrl: baseUrl,
      imageUrl: `${baseUrl}/og-image.png`,
      buttonTitle: 'Open NedaPay',
      splashImageUrl: `${baseUrl}/splash.png`,
      splashBackgroundColor: '#1e40af',
      webhookUrl: `${baseUrl}/api/webhook`,
      subtitle: 'Accept Stablecoins, Swap instantly, Cash Out Easily',
      description: 'NedaPay is a stablecoin payment solution for Africa. Send money to mobile money, create payment links, generate invoices, and accept crypto payments seamlessly.',
      primaryCategory: 'finance',
      tags: ['payments', 'stablecoins', 'mobile-money', 'africa', 'crypto'],
      screenshotUrls: [
        `${baseUrl}/screenshot-send.png`,
        `${baseUrl}/screenshot-invoice.png`,
        `${baseUrl}/screenshot-link.png`
      ]
    }
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  const farcasterConfig = {
    "accountAssociation": {
      "header": "eyJmaWQiOjg2OTUyNywidHlwZSI6ImF1dGgiLCJrZXkiOiIweDdFMzQ3N2M0RWQ2OUE4RTdBMDAxQzg3ZTlFQTI4ODJlOTc2NERDMzEifQ",
      "payload": "eyJkb21haW4iOiJtaW5pYXBwLm5lZGFwYXkueHl6In0",
      "signature": "eRFq8YzRNq1OTMQFm/3ph+TvcbS7vKRjc7iqpNohnNAjfLWi3f8fuzwMcNgzkmgMWyu31iUoQUf+dVzHVZw4MBw="
    },
    "frame": {
      "version": "1",
      "name": "NEDApay",
      "subtitle": "Global Stablecoin payments",
      "description": "NedaPay is a stablecoin payment solution for Africa. Send money to mobile money, create payment links, generate invoices, and accept crypto payments seamlessly.",
      "screenshotUrls": [
        "https://miniapp.nedapay.xyz/screenshot-send.png",
        "https://miniapp.nedapay.xyz/screenshot-invoice.png",
        "https://miniapp.nedapay.xyz/screenshot-link.png"
      ],
      "iconUrl": "https://miniapp.nedapay.xyz/icon-512.png",
      "splashImageUrl": "https://miniapp.nedapay.xyz/splash.png",
      "splashBackgroundColor": "#1e40af",
      "homeUrl": "https://miniapp.nedapay.xyz",
      "webhookUrl": "https://miniapp.nedapay.xyz/api/webhook",
      "primaryCategory": "finance",
      "tags": ["payments", "stablecoins", "mobile-money", "africa", "crypto"],
      "heroImageUrl": "https://miniapp.nedapay.xyz/og-image.png",
      "tagline": "Pay anywhere, Settle instantly",
      "ogTitle": "NEDApay - Stablecoin Payments",
      "ogDescription": "Send stablecoins to mobile money and bank accounts globally instantly.",
      "ogImageUrl": "https://miniapp.nedapay.xyz/og-image.png",
      "castShareUrl": "https://miniapp.nedapay.xyz",
      "imageUrl": "https://miniapp.nedapay.xyz/og-image.png",
      "buttonTitle": "☄️ Launch NEDApay"
    },
    "baseBuilder": {
      "allowedAddresses": ["0x9BdBE16907547C1C0751FD15c1101B74cC0ba0F4"],
      "appType": "miniapp",
      "supportedNetworks": ["base"],
      "supportedWallets": ["coinbase_wallet", "metamask"],
      "launchOptions": {
        "type": "miniapp",
        "theme": "dark",
        "features": ["wallet_connect"]
      },
      "metadata": {
        "short_name": "NEDApay",
        "orientation": "portrait",
        "display": "standalone",
        "theme_color": "#1e293b",
        "background_color": "#1e293b"
      }
    }
  };

  return NextResponse.json(farcasterConfig, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600'
    }
  });
}

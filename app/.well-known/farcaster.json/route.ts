import { NextResponse } from 'next/server';

export async function GET() {
  const farcasterConfig = {
    "accountAssociation": {
      "header": "eyJmaWQiOjg2OTUyNywidHlwZSI6ImN1c3RvZHkiLCJrZXkiOiIweEY5N0NFZkRiNTIzMzFiZDk3YWUyMDY5NjQ0NjcxMTNkMGQ3QjM2MjkifQ",
      "payload": "eyJkb21haW4iOiJuZWRhcGF5bWluaWFwcC52ZXJjZWwuYXBwIn0",
      "signature": "MHgxMzE0YjJjM2ZlYjljNjIxYzkzZjA1MDk4OWU4M2FkYjFjNDEwM2QxMDllNWQwYjhjNWU4MmY0NmY4MWYyNWY2NjYwNGE0NzViN2Q1ZjU3MjIwZDdhNmE4YTU0ZDhjYjRiNzQyMTk0ZTJkN2MwZDRjZDUzOTVkNDI4ZGRiZjM3MTFi"
    },
    "miniapp": {
      "version": "1",
      "name": "NedaPay",
      "subtitle": "Global Stablecoin payments for you ",
      "description": "NedaPay is a stablecoin payment solution for Africa. Send money to mobile money, create payment links, generate invoices, and accept crypto payments seamlessly.",
      "screenshotUrls": [
        "https://nedapayminiapp.vercel.app/screenshot-send.png",
        "https://nedapayminiapp.vercel.app/screenshot-invoice.png",
        "https://nedapayminiapp.vercel.app/screenshot-link.png"
      ],
      "iconUrl": "https://nedapayminiapp.vercel.app/icon-512.png",
      "splashImageUrl": "https://nedapayminiapp.vercel.app/splash.png",
      "splashBackgroundColor": "#1e40af",
      "homeUrl": "https://nedapayminiapp.vercel.app",
      "webhookUrl": "https://nedapayminiapp.vercel.app/api/webhook",
      "primaryCategory": "finance",
      "tags": ["payments", "stablecoins", "mobile-money", "africa", "crypto"],
      "heroImageUrl": "https://nedapayminiapp.vercel.app/og-image.png",
      "tagline": "Pay anywhere, Settle instantly",
      "ogTitle": "NedaPay - Stablecoin Payments",
      "ogDescription": "Send stablecoins to mobile money and bank accounts globally instantly.",
      "ogImageUrl": "https://nedapayminiapp.vercel.app/og-image.png",
      "castShareUrl": "https://nedapayminiapp.vercel.app"
    },
    "frame": {
      "version": "1",
      "name": "NedaPay",
      "iconUrl": "https://nedapayminiapp.vercel.app/icon-192.png",
      "homeUrl": "https://nedapayminiapp.vercel.app",
      "imageUrl": "https://nedapayminiapp.vercel.app/og-image.png",
      "buttonTitle": "💰 Open NedaPay",
      "splashImageUrl": "https://nedapayminiapp.vercel.app/splash.png",
      "splashBackgroundColor": "#1e293b",
      "webhookUrl": "https://nedapayminiapp.vercel.app/api/webhook"
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
        "short_name": "NedaPay",
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

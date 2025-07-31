import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Protected routes that require wallet connection
const PROTECTED_ROUTES = [
  '/dashboard',
  '/payments',
  '/payment-link',
  '/stablecoins',
  '/settings',
  '/offramp'
];

export function middleware(request: NextRequest) {
  // Check if the requested path is a protected route
  const isProtectedRoute = PROTECTED_ROUTES.some(route => 
    request.nextUrl.pathname.startsWith(route)
  );

  // Special case for payment-link route to prevent redirect loops
  const isPaymentLinkRoute = request.nextUrl.pathname.startsWith('/payment-link');
  
  // Skip middleware check for payment-link route if coming from another page
  // This prevents redirect loops when navigating to payment-link
  if (isPaymentLinkRoute) {
    // Check if the request has a referer from the same host or if there's a wallet_connected cookie
    const hasInternalReferer = request.headers.get('referer')?.includes(request.headers.get('host') || '');
    const hasWalletCookie = request.cookies.get('wallet_connected')?.value === 'true';
    
    if (hasInternalReferer || hasWalletCookie) {
      console.log('Middleware: Allowing access to payment-link from internal navigation or with wallet cookie');
      return NextResponse.next();
    }
  }

  if (isProtectedRoute) {
    // Since we can't access localStorage directly in middleware,
    // we'll create a special cookie when the wallet connects
    // and check for that cookie here
    const walletConnected = request.cookies.get('wallet_connected');
    
    // If wallet is not connected, redirect to home page
    if (!walletConnected || walletConnected.value !== 'true') {
      console.log('Middleware: No wallet connection detected, redirecting to home');
      const url = new URL('/', request.url);
      url.searchParams.set('walletRequired', 'true');
      return NextResponse.redirect(url);
    }
    
    // Log successful authentication
    console.log('Middleware: Wallet connection verified, allowing access to protected route');
  }

  // Create response with CORS and framing headers for Farcaster compatibility
  const response = NextResponse.next();
  
  // Add CORS headers
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Add framing headers for Farcaster
  response.headers.set('Content-Security-Policy', 
    "frame-ancestors 'self' https://farcaster.xyz https://*.farcaster.xyz https://warpcast.com https://client.warpcast.com https://wallet.farcaster.xyz https://*.privy.io https://auth.privy.io;"
  );
  
  return response;
}

// Configure the middleware to run on ALL paths for CORS
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};


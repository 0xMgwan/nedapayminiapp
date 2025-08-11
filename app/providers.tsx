"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { MiniKitProvider } from '../providers/MiniKitProvider';
import { PrivyProvider } from '@privy-io/react-auth';

export function Providers(props: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'clpispdty00ycl80fpueukbhl'}
        config={{
          appearance: {
            theme: 'dark',
            accentColor: '#676FFF',
            logo: 'https://nedapayminiapp.vercel.app/NEDApayLogo.png',
            showWalletLoginFirst: false,
            walletChainType: 'ethereum-only',
          },
          embeddedWallets: {
            createOnLogin: 'users-without-wallets',
            requireUserPasswordOnCreate: false,
            showWalletUIs: true,
          },
          loginMethods: ['email', 'sms', 'wallet'],
          supportedChains: [
            {
              id: 8453, // Base mainnet
              name: 'Base',
              network: 'base',
              nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
              rpcUrls: {
                default: { http: ['https://mainnet.base.org'] },
                public: { http: ['https://mainnet.base.org'] },
              },
              blockExplorers: {
                default: { name: 'BaseScan', url: 'https://basescan.org' },
              },
            },
          ],
          defaultChain: {
            id: 8453,
            name: 'Base',
            network: 'base',
            nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
            rpcUrls: {
              default: { http: ['https://mainnet.base.org'] },
              public: { http: ['https://mainnet.base.org'] },
            },
            blockExplorers: {
              default: { name: 'BaseScan', url: 'https://basescan.org' },
            },
          },
        }}
      >
        <MiniKitProvider>
          {props.children}
        </MiniKitProvider>
      </PrivyProvider>
    </ThemeProvider>
  );
}

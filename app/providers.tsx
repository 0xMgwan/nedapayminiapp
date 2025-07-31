"use client";

import { base } from "wagmi/chains";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { http, fallback } from "wagmi";
import { createConfig as createPrivyConfig } from "@privy-io/wagmi";
import { WagmiProvider } from "@privy-io/wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrivyProvider } from "@privy-io/react-auth";
import { MiniKitProvider } from '@coinbase/onchainkit/minikit';

// Create a query client for React Query
const queryClient = new QueryClient();

// Configure wagmi with all supported wallet connectors
const wagmiConfig = createPrivyConfig({
  chains: [base],
  ssr: true,
  transports: {
    [base.id]: fallback([
      http(process.env.NEXT_PUBLIC_COINBASE_BASE_RPC || 'https://api.developer.coinbase.com/rpc/v1/base/n4RnEAzBQtErAI53dP6DCa6l6HRGODgV'),
      http('https://mainnet.base.org'),
      http('https://base-mainnet.g.alchemy.com/v2/demo'),
      http('https://base.llamarpc.com'),
      http('https://1rpc.io/base')
    ]),
  },
});

export function Providers(props: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <PrivyProvider
        appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
        config={{
          appearance: {
            walletList: ['coinbase_wallet', 'metamask', 'wallet_connect'],
            walletChainType: 'ethereum-only',
            showWalletLoginFirst: true,
            theme: 'light',
            accentColor: '#8B5CF6',
          },
          embeddedWallets: {
            ethereum: {
              createOnLogin: "users-without-wallets",
            },
          },
          // Handle iframe contexts like Farcaster
          mfa: {
            noPromptOnMfaRequired: true,
          },
          defaultChain: base,
          // WalletConnect configuration for Reown
          walletConnectCloudProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
          // Allow framing in iframe contexts like Farcaster
          loginMethods: ['wallet', 'email', 'sms', 'google', 'twitter', 'discord', 'github', 'farcaster'],
        }}
      >
        <QueryClientProvider client={queryClient}>
          <WagmiProvider config={wagmiConfig}>
            <MiniKitProvider
              apiKey={process.env.NEXT_PUBLIC_CDP_CLIENT_API_KEY}
              chain={base}
            >
              {props.children}
            </MiniKitProvider>
          </WagmiProvider>
        </QueryClientProvider>
      </PrivyProvider>
    </ThemeProvider>
  );
}

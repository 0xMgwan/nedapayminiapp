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
          },
          embeddedWallets: {
            createOnLogin: 'users-without-wallets',
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

"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { MiniKitProvider } from '../providers/MiniKitProvider';

export function Providers(props: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <MiniKitProvider>
        {props.children}
      </MiniKitProvider>
    </ThemeProvider>
  );
}

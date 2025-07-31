'use client';

import { ReactNode } from 'react';

// Simple provider wrapper - Farcaster SDK is initialized directly in components
export function MiniKitContextProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

'use client';

import { HeroUIProvider, ToastProvider } from '@heroui/react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { AuthProvider } from '../lib/auth/auth-context';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const router = useRouter();
  return (
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider navigate={router.push}>
        <ToastProvider
          placement="top-right"
          toastProps={{ timeout: 4000, variant: 'flat', radius: 'lg' }}
        />
        <NextThemesProvider
          // Set BOTH data-theme (used by our CSS tokens) and class (used by
          // HeroUI tokens — Modal/Toast/etc. render in body portals and rely
          // on .light/.dark classes inherited from <html>).
          attribute={['data-theme', 'class']}
          defaultTheme="light"
          enableSystem={false}
          themes={['light', 'dark']}
          storageKey="ics-theme"
        >
          <AuthProvider>{children}</AuthProvider>
        </NextThemesProvider>
      </HeroUIProvider>
    </QueryClientProvider>
  );
}

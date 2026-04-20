import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'ICS Select — Preparacao para tech de elite | Inteli',
  description:
    'Programa exclusivo que prepara os 12 melhores alunos do Inteli para Big Tech, consulting tech, competitive programming e startups top.',
  openGraph: {
    title: 'ICS Select — Preparacao para tech de elite',
    description:
      'Programa exclusivo pra entrevistas tecnicas em Big Tech, consulting tech, competitive programming e startups top.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // `data-theme` is set by next-themes on the client; we seed a no-flash default
  // via a small inline script (see providers.tsx ThemeScript).
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;1,6..72,400&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body className="min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

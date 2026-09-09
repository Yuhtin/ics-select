import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Newsreader } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
  display: 'swap',
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Academy Fellow | Preparação para tech de elite | Inteli Academy',
  description:
    'Programa exclusivo que prepara os 12 melhores alunos do Inteli para Big Tech, consulting tech, competitive programming e startups top.',
  openGraph: {
    title: 'Academy Fellow | Preparação para tech de elite',
    description:
      'Programa exclusivo pra entrevistas técnicas em Big Tech, consulting tech, competitive programming e startups top.',
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
      <body className={`${inter.variable} ${newsreader.variable} ${jetbrainsMono.variable} min-h-screen font-sans`}>
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}

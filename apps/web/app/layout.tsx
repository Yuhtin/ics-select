import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'ICS Select — Preparacao para Big Techs | Inteli',
  description: 'Programa exclusivo que prepara os 12 melhores alunos do Inteli para entrevistas em Google, Meta, Amazon e consultorias de elite.',
  openGraph: {
    title: 'ICS Select — Preparacao para Big Techs',
    description: 'Programa exclusivo de preparacao para entrevistas tecnicas em Big Techs e consultorias de elite.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className="light" data-theme="light">
      <head>
        <link href="https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,600,700,800,900&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

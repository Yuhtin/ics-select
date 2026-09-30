import { Figtree, IBM_Plex_Mono } from 'next/font/google';

// Every font the BTG skin uses lives in this file. To switch to the official
// "BTG Pactual Sans" once BTG hands over the files, drop them in
// btg/assets/fonts/ and replace `Figtree(...)` with
// `localFont({ src: [...], variable: '--btg-font-sans' })` from 'next/font/local'.
export const btgSans = Figtree({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--btg-font-sans',
  display: 'swap',
});

export const btgMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--btg-font-mono',
  display: 'swap',
});

export const btgFontVariables = `${btgSans.variable} ${btgMono.variable}`;

// ponytail: Material Symbols isn't in next/font's catalog, so it loads as a
// hoisted stylesheet (React 19 `precedence`) only on the BTG routes.
export function BtgIconFont() {
  return (
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..24,300,0,0&display=block"
      precedence="default"
    />
  );
}

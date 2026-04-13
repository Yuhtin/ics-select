'use client';

/* ──────────────────────────────────────────────────────────────────────────────
 * Infinite logo marquee — company logos scroll seamlessly without flicker.
 *
 * Technique: render the logo list TWICE inside a flex container, then animate
 * translateX(0 → -50%) so the second copy slides into view as the first exits.
 * Because both copies are identical the loop is visually seamless.
 * ────────────────────────────────────────────────────────────────────────── */

import Image from 'next/image';

const LOGOS = [
  { name: 'Google', src: '/logos/google.svg', height: 30 },
  { name: 'Meta', src: '/logos/meta.svg', height: 24 },
  { name: 'Amazon', src: '/logos/amazon.svg', height: 22 },
  { name: 'Apple', src: '/logos/apple.svg', height: 28 },
  { name: 'Microsoft', src: '/logos/microsoft.svg', height: 24 },
  { name: 'Netflix', src: '/logos/netflix.svg', height: 22 },
] as const;

function LogoSet({ prefix }: { prefix: string }) {
  return (
    <>
      {LOGOS.map((logo) => (
        <div
          key={`${prefix}-${logo.name}`}
          className="flex-shrink-0 mx-10 opacity-50 hover:opacity-100 transition-opacity duration-300"
          title={logo.name}
        >
          <Image
            src={logo.src}
            alt={logo.name}
            width={logo.height * 3}
            height={logo.height}
            className="h-auto object-contain"
            style={{ height: logo.height }}
            aria-hidden={prefix === 'b'}
          />
        </div>
      ))}
    </>
  );
}

export function CompanyMarquee() {
  return (
    <section className="py-10 overflow-hidden border-y border-border/30 bg-surface/40 backdrop-blur-sm">
      <p className="text-center text-xs font-medium text-foreground-subtle tracking-widest uppercase mb-6">
        Preparando para as maiores empresas do mundo
      </p>

      <div className="relative">
        {/* Fade edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10 bg-gradient-to-l from-background to-transparent" />

        <div
          className="flex items-center"
          style={{
            animation: 'marquee 35s linear infinite',
            width: 'max-content',
          }}
        >
          <LogoSet prefix="a" />
          <LogoSet prefix="b" />
        </div>
      </div>
    </section>
  );
}

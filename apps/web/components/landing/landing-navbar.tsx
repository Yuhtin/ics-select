'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BrandLockup } from '../shell/brand-lockup';

const NAV_LINKS = [
  { href: '#programa', label: 'Programa' },
  { href: '#resultados', label: 'Resultados' },
  { href: '#processo', label: 'Processo' },
];

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? 'backdrop-blur-xl bg-surface/80 border-b border-border/30 shadow-xs' : ''
    }`}>
      <div className="mx-auto max-w-6xl px-6 lg:px-8 h-16 flex items-center justify-between">
        <BrandLockup size="md" />

        <nav className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              className="text-sm font-medium text-foreground-muted hover:text-foreground transition-colors"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="hidden sm:inline-flex text-sm font-medium text-foreground-muted hover:text-foreground transition-colors"
          >
            Entrar
          </Link>
          <a
            href="#interesse"
            className="bg-brand hover:bg-brand-hover text-white px-5 py-2.5 rounded-pill text-sm font-semibold transition-all hover:scale-[1.02] shadow-glow-primary"
          >
            Quero participar
          </a>
        </div>
      </div>
    </header>
  );
}

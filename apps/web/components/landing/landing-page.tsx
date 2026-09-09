'use client';

import { useCallback, useEffect, useState } from 'react';
import { LandingBigTechs } from './landing-bigtechs';
import { LandingClosingCta } from './landing-closing-cta';
import { LandingFooter } from './landing-footer';
import { LandingHero } from './landing-hero';
import { LandingPillars } from './landing-pillars';
import { LandingProduct } from './landing-product';
import { LandingTopbar } from './landing-topbar';
import { WaitlistModal } from './waitlist-modal';

export function LandingPage() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const open = useCallback(() => setWaitlistOpen(true), []);
  const close = useCallback(() => setWaitlistOpen(false), []);

  // Landing is locked to the light palette — the marketing page is designed
  // against the Academy off-white palette. We
  // override the html data-theme for the duration of the landing mount and
  // restore the user's persisted choice on unmount so their dark preference
  // survives navigation to the rest of the app.
  useEffect(() => {
    const html = document.documentElement;
    const previousTheme = html.getAttribute('data-theme');
    const previousClasses = Array.from(html.classList).filter(
      (c) => c === 'light' || c === 'dark',
    );
    html.setAttribute('data-theme', 'light');
    html.classList.remove('dark');
    html.classList.add('light');
    return () => {
      if (previousTheme) html.setAttribute('data-theme', previousTheme);
      else html.removeAttribute('data-theme');
      html.classList.remove('light', 'dark');
      for (const c of previousClasses) html.classList.add(c);
    };
  }, []);

  return (
    <>
      <LandingTopbar />
      <main className="landing-stage">
        <span id="top" aria-hidden className="block" />
        <LandingHero />
        <LandingPillars />
        <LandingBigTechs />
        <LandingProduct />
        <LandingClosingCta onOpenWaitlist={open} />
      </main>
      <LandingFooter />
      <WaitlistModal open={waitlistOpen} onClose={close} />
    </>
  );
}

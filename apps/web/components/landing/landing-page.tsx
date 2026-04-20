'use client';

import { useState } from 'react';
import { LandingBigTechs } from './landing-bigtechs';
import { LandingClosingCta } from './landing-closing-cta';
import { LandingFooter } from './landing-footer';
import { LandingFx } from './landing-fx';
import { LandingHero } from './landing-hero';
import { LandingPillars } from './landing-pillars';
import { LandingProduct } from './landing-product';
import { LandingTopbar } from './landing-topbar';
import { WaitlistModal } from './waitlist-modal';

export function LandingPage() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const open = () => setWaitlistOpen(true);
  const close = () => setWaitlistOpen(false);

  return (
    <>
      <LandingFx />
      <LandingTopbar />
      <div className="landing-stage">
        <span id="top" aria-hidden className="block" />
        <LandingHero />
        <LandingPillars />
        <LandingBigTechs />
        <LandingProduct />
        <LandingClosingCta onOpenWaitlist={open} />
        <LandingFooter />
      </div>
      <WaitlistModal open={waitlistOpen} onClose={close} />
    </>
  );
}

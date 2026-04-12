'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth/auth-context';
import { LandingNavbar } from '../components/landing/landing-navbar';
import { HeroBento } from '../components/landing/hero-bento';
import { CompanyMarquee } from '../components/landing/company-marquee';
import { FeatureBento } from '../components/landing/feature-bento';
import { StatsCounter } from '../components/landing/stats-counter';
import { TestimonialSection } from '../components/landing/testimonial-section';
import { StepsTimeline } from '../components/landing/steps-timeline';
import { InterestForm } from '../components/landing/interest-form';

export default function RootPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [showLanding, setShowLanding] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      setShowLanding(true);
      return;
    }
    if (!user.privacyAcceptedAt) {
      router.replace('/privacy');
    } else {
      router.replace(user.role === 'ADMIN' ? '/admin/cycles' : '/map');
    }
  }, [user, isLoading, router]);

  if (!showLanding) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-foreground-muted">Carregando...</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <LandingNavbar />
      <main>
        <HeroBento />
        <CompanyMarquee />
        <FeatureBento />
        <StatsCounter />
        <TestimonialSection />
        <StepsTimeline />
        <InterestForm />
      </main>
    </div>
  );
}

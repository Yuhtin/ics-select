'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth/auth-context';
import { LandingPage } from '../components/landing/landing-page';

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
    router.replace(user.role === 'ADMIN' ? '/admin/cycle/active' : '/me');
  }, [user, isLoading, router]);

  if (!showLanding) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-fg-mute">Carregando…</p>
      </main>
    );
  }

  return <LandingPage />;
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/auth-context';
import { AppNav } from '../../components/nav/app-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace('/login');
    else if (!user.privacyAcceptedAt) router.replace('/privacy');
  }, [user, isLoading, router]);

  if (isLoading || !user || !user.privacyAcceptedAt) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-foreground/60">Carregando...</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <div className="p-6">{children}</div>
    </div>
  );
}

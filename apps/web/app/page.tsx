'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth/auth-context';

export default function RootPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace('/login');
    else if (!user.privacyAcceptedAt) router.replace('/privacy');
    else router.replace(user.role === 'ADMIN' ? '/admin/cycles' : '/map');
  }, [user, isLoading, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-foreground/60">Carregando...</p>
    </main>
  );
}

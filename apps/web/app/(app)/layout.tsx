'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/auth-context';
import { AppShell } from '../../components/shell/app-shell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace('/login');
    else if (!user.privacyAcceptedAt) router.replace('/privacy');
  }, [user, isLoading, router]);

  if (isLoading || !user || !user.privacyAcceptedAt) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-foreground-muted">Carregando...</p>
      </main>
    );
  }

  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        role: user.role,
        avatarUrl: user.pictureUrl,
      }}
      onLogout={() => {
        void logout();
      }}
    >
      {children}
    </AppShell>
  );
}

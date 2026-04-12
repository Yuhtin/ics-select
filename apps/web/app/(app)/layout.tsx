'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/auth-context';
import { NavbarAdmin } from '../../components/admin/navbar-admin';
import { BottomTabBarAdmin } from '../../components/admin/bottom-tab-bar-admin';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace('/login');
    else if (!user.privacyAcceptedAt) router.replace('/privacy');
    else if (user.role === 'MEMBER') router.replace('/map');
  }, [user, isLoading, router]);

  if (isLoading || !user || !user.privacyAcceptedAt || user.role === 'MEMBER') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-foreground-muted">Carregando...</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <NavbarAdmin
        userName={user.name}
        email={user.email}
        avatarUrl={user.pictureUrl}
        onLogout={() => { void logout(); }}
      />
      <main className="pt-14 lg:pt-14 pb-20 lg:pb-0">
        <div className="mx-auto max-w-6xl px-6 lg:px-8 py-8">
          {children}
        </div>
      </main>
      <BottomTabBarAdmin />
    </div>
  );
}

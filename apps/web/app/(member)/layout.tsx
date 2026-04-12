'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/auth-context';
import { TopbarMember } from '../../components/member/topbar-member';
import { BottomTabBar } from '../../components/member/bottom-tab-bar';

export default function MemberLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (!user.privacyAcceptedAt) {
      router.replace('/privacy');
      return;
    }
    if (user.role === 'ADMIN') {
      router.replace('/admin/dashboard');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role === 'ADMIN') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-foreground-muted">Carregando...</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <TopbarMember
        userName={user.name}
        avatarUrl={user.pictureUrl}
        onLogout={() => { void logout(); }}
      />
      <main className="pt-14 lg:pt-14 pb-20 lg:pb-0">
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}

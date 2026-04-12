'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../lib/auth/auth-context';
import { apiFetch } from '../../lib/api/client';
import { TopbarMember } from '../../components/member/topbar-member';
import { BottomTabBar } from '../../components/member/bottom-tab-bar';
import { NoCycleScreen } from '../../components/member/no-cycle-screen';

type MemberProgress = {
  userId: string;
  name: string;
  pictureUrl: string | null;
  done: number;
  total: number;
  percent: number;
};

export default function MemberLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  const { data: cohort, isLoading: cohortLoading } = useQuery({
    queryKey: ['cohort-progress'],
    queryFn: () => apiFetch<MemberProgress[]>('/me/cohort/progress'),
    enabled: !!user && user.role === 'MEMBER',
  });

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

  if (isLoading || cohortLoading || !user || user.role === 'ADMIN') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-foreground-muted">Carregando...</p>
      </main>
    );
  }

  if (cohort && cohort.length === 0) {
    return <NoCycleScreen userName={user.name} onLogout={() => { void logout(); }} />;
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

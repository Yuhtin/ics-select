'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/auth-context';
import { AdminShell } from '../../components/admin-shell/admin-shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace('/login');
    else if (!user.privacyAcceptedAt) router.replace('/privacy');
    else if (user.role === 'MEMBER') router.replace('/me');
  }, [user, isLoading, router]);

  if (isLoading || !user || !user.privacyAcceptedAt || user.role === 'MEMBER') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Loading…</p>
      </main>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}

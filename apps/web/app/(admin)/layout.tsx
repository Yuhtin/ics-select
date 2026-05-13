'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../../lib/auth/auth-context';
import { AdminShell } from '../../components/admin-shell/admin-shell';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading } = useAuth();

  // The cycle receipt view is screenshot-targeted and renders without the
  // admin shell so the captured PNG isn't polluted by sidebar/topbar chrome.
  const skipShell = pathname?.endsWith('/receipt') ?? false;

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace('/login');
    else if (user.role === 'MEMBER') router.replace('/me');
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role === 'MEMBER') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Loading…</p>
      </main>
    );
  }

  if (skipShell) return <main className="min-h-screen bg-paper">{children}</main>;
  return <AdminShell>{children}</AdminShell>;
}

import type { ReactNode } from 'react';
import { SidebarAdmin } from './sidebar-admin';

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-paper text-ink">
      <SidebarAdmin />
      <main className="flex-1">
        <div className="mx-auto w-full px-8 py-12 md:py-14">{children}</div>
      </main>
    </div>
  );
}

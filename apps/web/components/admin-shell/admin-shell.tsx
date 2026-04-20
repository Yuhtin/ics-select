import type { ReactNode } from 'react';
import { TopbarAdmin } from './topbar-admin';

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <TopbarAdmin />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-[1400px] px-6 py-10 md:py-12">
          {children}
        </div>
      </main>
    </div>
  );
}

import type { ReactNode } from 'react';
import { TopbarAdmin } from './topbar-admin';

export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg text-fg">
      <div className="print:hidden">
        <TopbarAdmin />
      </div>
      <main className="flex-1">
        <div className="mx-auto w-full max-w-[1400px] px-4 py-8 md:px-6 md:py-12 print:max-w-none print:px-0 print:py-0">
          {children}
        </div>
      </main>
    </div>
  );
}

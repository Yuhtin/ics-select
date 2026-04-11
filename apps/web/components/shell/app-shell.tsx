'use client';

import { useState, type ReactNode } from 'react';
import { Sidebar, type SidebarUser } from './sidebar';
import { Topbar } from './topbar';

interface AppShellProps {
  user: SidebarUser;
  onLogout?: () => void;
  children: ReactNode;
}

export function AppShell({ user, onLogout, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar: fixed left, visible ≥lg */}
      <div className="fixed left-0 top-0 z-30 hidden lg:block">
        <Sidebar user={user} onLogout={onLogout} />
      </div>

      {/* Mobile drawer: overlay + sidebar, visible only when mobileOpen */}
      {mobileOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          />
          <div className="fixed left-0 top-0 z-50 lg:hidden">
            <Sidebar user={user} onLogout={onLogout} />
          </div>
        </>
      )}

      <Topbar onMenuClick={() => setMobileOpen(true)} />

      <main className="lg:ml-60 min-h-[calc(100vh-3.5rem)]">
        <div className="mx-auto max-w-7xl px-6 sm:px-8 py-8">{children}</div>
      </main>
    </div>
  );
}

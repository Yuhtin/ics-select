import type { ReactNode } from 'react';

// Minimal placeholder layout. PR 2 rebuilds this with the Magazine Editorial
// shell (floating topbar + bottom tab bar on mobile).
export default function MemberLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>
    </div>
  );
}

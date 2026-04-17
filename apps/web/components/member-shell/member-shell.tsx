import type { ReactNode } from 'react';
import { TopbarMember } from './topbar-member';
import { BottomTabBar } from './bottom-tab-bar';

interface MemberShellProps {
  children: ReactNode;
}

export function MemberShell({ children }: MemberShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      <TopbarMember />
      <main className="flex-1 pb-20 md:pb-0">
        <div className="mx-auto w-full max-w-6xl px-5 py-6 md:px-6 md:py-10">{children}</div>
      </main>
      <BottomTabBar />
    </div>
  );
}

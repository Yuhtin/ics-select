'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { TopbarMember } from './topbar-member';
import { BottomTabBar } from './bottom-tab-bar';
import { OnboardingGate } from './onboarding-gate';
import { GoogleReconnectGate } from './google-reconnect-gate';

interface MemberShellProps {
  children: ReactNode;
}

export function MemberShell({ children }: MemberShellProps) {
  const pathname = usePathname();
  const isOnboarding = pathname === '/me/onboarding';
  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg text-fg">
      {!isOnboarding && <TopbarMember />}
      <main className="flex-1 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
        <div className="mx-auto w-full max-w-6xl px-6 py-8 md:py-10">
          <OnboardingGate>
            <GoogleReconnectGate>{children}</GoogleReconnectGate>
          </OnboardingGate>
        </div>
      </main>
      {!isOnboarding && <BottomTabBar />}
    </div>
  );
}

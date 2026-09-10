'use client';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { BottomTabBar } from './bottom-tab-bar';
import { OnboardingGate } from './onboarding-gate';
import { GoogleReconnectGate } from './google-reconnect-gate';
import { MemberMobileRetroAction } from './member-mobile-retro-action';
import { MemberRail } from './member-rail';

interface MemberShellProps {
  children: ReactNode;
}

export function MemberShell({ children }: MemberShellProps) {
  const pathname = usePathname();
  const isOnboarding = pathname === '/me/onboarding';

  return (
    <div className="min-h-[100dvh] bg-bg text-fg md:flex">
      {!isOnboarding && <MemberRail />}
      <div className="min-w-0 flex-1">
        <main className="pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">
          <div className="mx-auto w-full max-w-[1360px] px-5 py-7 sm:px-6 md:px-6 md:py-9 min-[1200px]:px-8 min-[1440px]:px-10">
            <OnboardingGate>
              <GoogleReconnectGate>{children}</GoogleReconnectGate>
            </OnboardingGate>
          </div>
        </main>
        {!isOnboarding && <MemberMobileRetroAction />}
        {!isOnboarding && <BottomTabBar />}
      </div>
    </div>
  );
}

'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '../../lib/auth/auth-context';

const ONBOARDING_PATH = '/me/onboarding';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

/**
 * Blocks member routes when the user's GoogleAccount has no refresh_token
 * (legacy rows from before access_type=offline + prompt=consent were wired
 * correctly). Forces a re-OAuth so server-side Calendar calls start working.
 *
 * Runs after OnboardingGate — if onboarding is pending, we yield to it.
 */
export function GoogleReconnectGate({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();

  if (isLoading || !user) return <>{children}</>;
  if (user.role !== 'MEMBER') return <>{children}</>;
  if (pathname === ONBOARDING_PATH) return <>{children}</>;
  if (user.googleConnected) return <>{children}</>;

  return (
    <div className="flex min-h-[60dvh] items-center justify-center">
      <section data-testid="google-reconnect-gate" aria-labelledby="google-reconnect-title" className="w-full max-w-lg space-y-5 py-10">
        <p role="status" className="font-mono text-[11px] font-semibold uppercase tracking-eyebrow text-fg-mute">
          Reconnect required
        </p>
        <h2 id="google-reconnect-title" className="text-[28px] font-semibold leading-[1.15] tracking-[-0.045em] text-fg sm:text-[36px]">
          Reconnect your Google Calendar
        </h2>
        <p className="font-sans text-sm text-fg-soft">
          We updated how Academy Fellow syncs with your calendar. Sign in with Google once
          more so your study blocks can be created and updated automatically.
        </p>
        <a
          href={`${API_URL}/auth/google`}
          className="inline-flex min-h-11 items-center justify-center rounded-input bg-primary px-5 font-sans text-sm font-semibold text-primary-fg transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          Reconnect Google
        </a>
      </section>
    </div>
  );
}

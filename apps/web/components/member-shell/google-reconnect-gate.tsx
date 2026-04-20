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
    <div className="flex min-h-[60vh] items-center justify-center px-5">
      <div className="max-w-md space-y-5 rounded-card border border-border-token bg-surface p-8">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute">
          Reconnect required
        </p>
        <h2 className="font-serif text-2xl font-medium tracking-tight text-fg">
          Reconnect your Google Calendar
        </h2>
        <p className="font-sans text-sm text-fg-soft">
          We updated how ICS syncs with your calendar. Sign in with Google once
          more so your study blocks can be created and updated automatically.
        </p>
        <a
          href={`${API_URL}/auth/google`}
          className="inline-flex h-9 items-center justify-center rounded-input bg-fg px-4 font-sans text-sm font-medium text-bg transition-opacity hover:opacity-90"
        >
          Reconnect Google
        </a>
      </div>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useAuth } from '../../lib/auth/auth-context';

const ONBOARDING_PATH = '/me/onboarding';

/**
 * Gate that forces members through onboarding on first login.
 *
 * First-login heuristic: a MEMBER whose active-cycle membership has no
 * `targetTrack` set yet. While that's the case the gate redirects every
 * member route to `/me/onboarding` so the user fills phone + track before
 * they can use the rest of the app.
 */
export function OnboardingGate({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const needsOnboarding =
    user?.role === 'MEMBER' && (user.targetTrack === null || user.targetTrack === '');
  const onOnboardingPath = pathname === ONBOARDING_PATH;

  useEffect(() => {
    if (isLoading || !user) return;
    if (needsOnboarding && !onOnboardingPath) {
      router.replace(ONBOARDING_PATH);
    } else if (!needsOnboarding && onOnboardingPath) {
      router.replace('/me');
    }
  }, [isLoading, user, needsOnboarding, onOnboardingPath, router]);

  // Hold rendering until we've resolved whether onboarding is required so we
  // don't flash the real UI to a member that needs onboarding.
  if (!isLoading && user && needsOnboarding && !onOnboardingPath) {
    return (
      <section className="flex min-h-[60dvh] items-center justify-center px-2 py-8">
        <p role="status" className="font-sans text-sm text-fg-mute">
          Redirecting…
        </p>
      </section>
    );
  }

  return <>{children}</>;
}

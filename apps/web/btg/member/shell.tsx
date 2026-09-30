'use client';

import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/auth-context';
import { useMeCohort } from '../../lib/queries/me-cohort';
import { BtgLogin, useBtgLogout } from '../auth';
import { Avatar, BTG_LOGO_NAVY, Icon, Loading } from '../ui';

export const BTG_MEMBER_BASE = '/btg-poc';

const NAV = [
  { href: BTG_MEMBER_BASE, label: 'Hoje', icon: 'today', exact: true },
  { href: `${BTG_MEMBER_BASE}/plano`, label: 'Plano', icon: 'checklist' },
  { href: `${BTG_MEMBER_BASE}/turma`, label: 'Turma', icon: 'groups' },
  { href: `${BTG_MEMBER_BASE}/agenda`, label: 'Agenda', icon: 'calendar_month' },
  { href: `${BTG_MEMBER_BASE}/retro`, label: 'Retro', icon: 'edit_note' },
];

export function BtgMemberShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const logout = useBtgLogout(BTG_MEMBER_BASE);

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (user.role === 'ADMIN') {
      router.replace('/btgadmin-poc');
    }
  }, [isLoading, user, router]);

  // Same first-login rule as the classic OnboardingGate, pointed at the BTG route.
  const onboardingPath = `${BTG_MEMBER_BASE}/onboarding`;
  const needsOnboarding = user?.role === 'MEMBER' && !user.targetTrack;
  const onOnboarding = pathname === onboardingPath;

  useEffect(() => {
    if (!user || user.role !== 'MEMBER') return;
    if (needsOnboarding && !onOnboarding) router.replace(onboardingPath);
    else if (!needsOnboarding && onOnboarding) router.replace(BTG_MEMBER_BASE);
  }, [user, needsOnboarding, onOnboarding, onboardingPath, router]);

  if (!isLoading && !user) return <BtgLogin area="member" />;
  if (isLoading || !user || user.role === 'ADMIN') return <Loading />;
  if (needsOnboarding && !onOnboarding) return <Loading label="Redirecionando…" />;
  if (onOnboarding) return <>{children}</>;
  // Same rule as the classic GoogleReconnectGate: no refresh token → no Calendar sync, so block until re-OAuth.
  if (!user.googleConnected) return <BtgLogin area="member" reconnect />;

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      <header className="btg-topbar">
        <div className="btg-topbar-inner">
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Link href={BTG_MEMBER_BASE} className="btg-brand" aria-label="ICS Select × BTG Pactual">
              <span className="btg-brand-name">ICS Select</span>
              <span className="btg-brand-rule" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={BTG_LOGO_NAVY} alt="BTG Pactual" />
            </Link>
            <nav className="btg-nav" aria-label="Principal">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} aria-current={isActive(n.href, n.exact) ? 'page' : undefined}>
                  <Icon name={n.icon} />
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="btg-topbar-right">
            <CycleName />
            <Link href={`${BTG_MEMBER_BASE}/configuracoes`} aria-label="Configurações" title={user.name}>
              <Avatar name={user.name} pictureUrl={user.pictureUrl} />
            </Link>
            <button type="button" className="btg-icon-btn" aria-label="Sair" onClick={() => void logout()}>
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </header>
      {children}
      <nav className="btg-tabbar" aria-label="Principal">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} aria-current={isActive(n.href, n.exact) ? 'page' : undefined}>
            <Icon name={n.icon} />
            {n.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

// Rendered only once signed in, so the cohort query never fires unauthenticated.
function CycleName() {
  const { data: cohort } = useMeCohort();
  if (!cohort?.cycleName) return null;
  return (
    <span className="btg-mono btg-mute btg-topbar-week" style={{ fontSize: 13 }}>
      {cohort.cycleName}
    </span>
  );
}

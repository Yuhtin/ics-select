'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, CalendarDays, Users, LogOut } from 'lucide-react';
import { clsx } from 'clsx';
import { useMeRetroCurrent } from '../../lib/queries/me-retro';
import { useAuth } from '../../lib/auth/auth-context';
import { ThemeToggle } from '../ui/theme-toggle';
import { BrandLockup } from '../shell/brand-lockup';

type NavItem = {
  href: string;
  label: string;
  icon: typeof Compass;
  exact?: boolean;
};

const NAV: readonly NavItem[] = [
  { href: '/me', label: 'Today', icon: Compass, exact: true },
  { href: '/me/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/me/cohort', label: 'Cohort', icon: Users },
];

function initialsOf(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '—'
  );
}

export function TopbarMember() {
  const pathname = usePathname();
  const { data: retro } = useMeRetroCurrent();
  const { user, logout } = useAuth();
  const retroOpen = retro?.open === true;
  const retroLabel = retro?.retro ? 'Update retro' : 'Retro open';
  return (
    <header className="sticky top-0 z-40 hidden border-b border-border-token bg-surface md:block">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-6">
        <Link
          href="/me"
          className="flex min-h-11 shrink-0 items-center rounded-input text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <BrandLockup size="sm" />
        </Link>
        <nav aria-label="Main navigation" className="flex min-w-0 items-center gap-1 overflow-x-auto p-1 font-sans text-sm">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active =
              exact === true
                ? pathname === href
                : pathname === href || pathname?.startsWith(href + '/') === true;
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-input px-3 py-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                  active
                    ? 'bg-primary-soft text-primary dark:text-fg'
                    : 'text-fg-mute hover:bg-bg-subtle hover:text-fg',
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.5} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-2">
          {retroOpen && (
            <Link
              href="/me/retro"
              className="inline-flex min-h-11 items-center whitespace-nowrap rounded-input bg-reflect-soft px-2.5 font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-reflect hover:bg-reflect-soft/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-fg"
            >
              {retroLabel}
            </Link>
          )}
          <ThemeToggle />
          {user && (
            <>
              <Link
                href="/me/settings"
                aria-label="Settings"
                title={user.name}
                className="inline-grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full border border-border-token bg-bg-subtle font-sans text-[11px] font-semibold text-fg-soft transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                {user.pictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={user.pictureUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{initialsOf(user.name)}</span>
                )}
              </Link>
              <button
                type="button"
                onClick={() => void logout()}
                aria-label="Sign out"
                title="Sign out"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-input border border-transparent text-fg-mute transition-colors hover:bg-bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

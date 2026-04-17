'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, CalendarDays, Users, User } from 'lucide-react';
import { clsx } from 'clsx';
import { useMeRetroCurrent } from '../../lib/queries/me-retro';
import { ThemeToggle } from '../ui/theme-toggle';

type NavItem = {
  href: string;
  label: string;
  icon: typeof Compass;
  exact?: boolean;
};

const NAV: readonly NavItem[] = [
  { href: '/me', label: 'Today', icon: Compass, exact: true },
  { href: '/me/plan', label: 'Week', icon: CalendarDays },
  { href: '/me/cohort', label: 'Cohort', icon: Users },
];

export function TopbarMember() {
  const pathname = usePathname();
  const { data: retro } = useMeRetroCurrent();
  const retroOpen = retro?.open === true && !retro.retro;
  return (
    <header className="sticky top-0 z-40 hidden border-b border-border-token/60 bg-bg/80 backdrop-blur md:block">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link
          href="/me"
          className="flex items-center gap-2 font-sans text-sm font-semibold tracking-tight text-fg"
        >
          <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-fg text-[11px] font-bold tracking-tight text-bg">
            ICS
          </span>
          <span>Select</span>
        </Link>
        <nav className="flex items-center gap-1 font-sans text-sm">
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active =
              exact === true
                ? pathname === href
                : pathname === href || pathname?.startsWith(href + '/') === true;
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-input px-3 py-1.5 font-medium transition-colors',
                  active
                    ? 'bg-bg-subtle text-fg'
                    : 'text-fg-mute hover:bg-bg-subtle hover:text-fg',
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.5} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          {retroOpen && (
            <Link
              href="/me/retro"
              className="inline-flex h-[22px] items-center rounded-pill bg-reflect-soft px-2.5 font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-reflect hover:bg-reflect-soft/80"
            >
              Retro open
            </Link>
          )}
          <ThemeToggle />
          <Link
            href="/me/settings"
            className="grid h-8 w-8 place-items-center rounded-full border border-border-token text-fg-soft transition-colors hover:bg-bg-subtle hover:text-fg"
            aria-label="Settings"
          >
            <User className="h-4 w-4" strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    </header>
  );
}

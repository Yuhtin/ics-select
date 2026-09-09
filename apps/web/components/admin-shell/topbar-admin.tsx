'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  CircleDot,
  ClipboardList,
  ListChecks,
  LogOut,
  Presentation,
  Settings,
  Users,
} from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../../lib/auth/auth-context';
import { ThemeToggle } from '../ui/theme-toggle';
import { BrandLockup } from '../shell/brand-lockup';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

const NAV: readonly NavItem[] = [
  { href: '/admin/members', label: 'Members', icon: Users },
  { href: '/admin/cycles', label: 'Cycles', icon: CircleDot },
  { href: '/admin/plans', label: 'Plans', icon: ListChecks },
  { href: '/admin/library', label: 'Library', icon: BookOpen },
  { href: '/admin/waitlist', label: 'Waitlist', icon: ClipboardList },
  { href: '/admin/meetings', label: 'Meetings', icon: Presentation },
  { href: '/admin/config', label: 'Config', icon: Settings },
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

export function TopbarAdmin() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  return (
    <header className="sticky top-0 z-40 border-b border-border-token bg-surface">
      <div className="mx-auto grid max-w-[1400px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 pt-2 md:px-6 xl:flex xl:h-16 xl:justify-between xl:py-0">
        <Link
          href="/admin/cycle/active"
          className="flex min-w-0 shrink-0 items-center gap-2 rounded-input text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        >
          <BrandLockup size="sm" className="min-w-0" />
          <span className="rounded-input border border-border-token px-2 py-1 text-[10px] font-medium text-fg-mute">Admin</span>
        </Link>

        <nav aria-label="Admin navigation" className="order-last col-span-2 flex min-w-0 items-center gap-1 overflow-x-auto py-2 font-sans text-sm xl:order-none">
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
                  'inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-input px-3 py-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                  active
                    ? 'bg-primary-soft text-primary'
                    : 'text-fg-mute hover:bg-bg-subtle hover:text-fg',
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.5} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <ThemeToggle />
          {user && (
            <>
              <Link
                href="/admin/cycle/active"
                aria-label={user.name}
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

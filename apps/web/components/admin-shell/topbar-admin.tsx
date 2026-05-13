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
    <header className="sticky top-0 z-40 border-b border-border-token/60 bg-bg/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-6">
        <Link
          href="/admin/cycle/active"
          className="flex items-center gap-2 font-sans text-sm font-semibold tracking-tight text-fg"
        >
          <span className="grid h-7 w-7 place-items-center rounded-[8px] bg-fg text-[11px] font-bold tracking-tight text-bg">
            ICS
          </span>
          <span>Admin</span>
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
          <ThemeToggle />
          {user && (
            <>
              <Link
                href="/admin/cycle/active"
                aria-label={user.name}
                title={user.name}
                className="inline-grid h-8 w-8 place-items-center overflow-hidden rounded-full border border-border-token bg-bg-subtle font-sans text-[11px] font-semibold text-fg-soft transition-colors hover:text-fg"
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
                className="inline-flex h-8 w-8 items-center justify-center rounded-input border border-transparent text-fg-mute transition-colors hover:bg-bg-subtle hover:text-fg"
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

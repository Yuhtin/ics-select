'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  BookOpen,
  CircleDot,
  ListChecks,
  LogOut,
  Sparkles,
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
  { href: '/admin', label: 'Triage', icon: Bell, exact: true },
  { href: '/admin/members', label: 'Members', icon: Users },
  { href: '/admin/cycles', label: 'Cycles', icon: CircleDot },
  { href: '/admin/plans', label: 'Plans', icon: ListChecks },
  { href: '/admin/library', label: 'Library', icon: BookOpen },
  { href: '/admin/ai-usage', label: 'AI usage', icon: Sparkles },
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
    <header
      className="sticky top-0 z-40 grid items-center px-5 md:px-8 py-4 md:py-[18px]"
      style={{
        gridTemplateColumns: '1fr auto 1fr',
        background: 'hsl(var(--surface) / 0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <Link
        href="/admin"
        className="flex items-center gap-2.5 font-semibold tracking-[-0.01em] text-base text-fg"
      >
        <div className="relative w-[30px] h-[30px] rounded-[9px] bg-fg text-bg grid place-items-center font-bold text-[11px] overflow-hidden">
          <span className="relative z-10">ICS</span>
          <span
            className="absolute inset-[-10%] rounded-full"
            style={{
              background:
                'radial-gradient(circle at 30% 30%, hsl(var(--primary) / 0.6), transparent 50%)',
              mixBlendMode: 'screen',
            }}
          />
        </div>
        <span>ICS Admin</span>
      </Link>

      <nav
        className="hidden md:flex gap-1 p-[5px] rounded-full border border-border-token"
        style={{ background: 'hsl(var(--bg-subtle))' }}
      >
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
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium transition-colors',
                active
                  ? 'text-fg bg-surface'
                  : 'text-fg-mute hover:text-fg',
              )}
              style={
                active
                  ? { boxShadow: '0 1px 2px rgba(20,24,31,.06)' }
                  : undefined
              }
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="flex justify-end items-center gap-2">
        <ThemeToggle />
        {user && (
          <>
            {user.pictureUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.pictureUrl}
                alt=""
                className="h-8 w-8 rounded-full border border-border-token object-cover"
              />
            ) : (
              <span className="grid h-8 w-8 place-items-center rounded-full border border-border-token bg-bg-subtle font-sans text-[11px] font-semibold text-fg-soft">
                {initialsOf(user.name)}
              </span>
            )}
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
    </header>
  );
}

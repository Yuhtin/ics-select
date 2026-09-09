'use client';

import { clsx } from 'clsx';
import { LogOut, MessageSquareText, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../lib/auth/auth-context';
import { useMeRetroCurrent } from '../../lib/queries/me-retro';
import { BrandLockup } from '../shell/brand-lockup';
import { ThemeToggle } from '../ui/theme-toggle';
import { isMemberNavActive, MEMBER_NAV_ITEMS } from './member-nav';

function initialsOf(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('') || '—'
  );
}

const itemClass =
  'flex min-h-12 flex-col items-center justify-center gap-1 rounded-input px-1 font-sans text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary';

const inactiveClass =
  'text-[hsl(var(--member-rail-fg))] hover:bg-[hsl(var(--member-rail-hover))] hover:text-primary-fg';

export function MemberRail() {
  const pathname = usePathname();
  const { data: retro } = useMeRetroCurrent();
  const { user, logout } = useAuth();
  const showRetro = retro?.open === true || pathname === '/me/retro';

  return (
    <aside
      data-testid="member-rail"
      className="sticky top-0 hidden h-[100dvh] w-[94px] shrink-0 bg-[hsl(var(--member-rail-bg))] md:flex md:flex-col"
    >
      <nav
        aria-label="Main navigation"
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-3"
      >
        <Link
          href="/me"
          aria-label="Academy Fellow home"
          className="mb-3 grid min-h-11 place-items-center"
        >
          <BrandLockup size="sm" showWordmark={false} tone="inverse" />
        </Link>
        {MEMBER_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isMemberNavActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                itemClass,
                active ? 'bg-primary text-primary-fg' : inactiveClass,
              )}
            >
              <Icon aria-hidden className="h-4 w-4" strokeWidth={active ? 2 : 1.5} />
              <span>{item.label}</span>
            </Link>
          );
        })}
        {showRetro && (
          <Link
            href="/me/retro"
            aria-current={pathname === '/me/retro' ? 'page' : undefined}
            className={clsx(
              itemClass,
              pathname === '/me/retro' ? 'bg-primary text-primary-fg' : inactiveClass,
            )}
          >
            <MessageSquareText aria-hidden className="h-4 w-4" strokeWidth={1.5} />
            <span>{retro?.retro ? 'Update retro' : 'Retro'}</span>
            {retro?.open && <span className="sr-only">open</span>}
          </Link>
        )}
        <div className="mt-auto space-y-1">
          <ThemeToggle presentation="rail" className={itemClass} />
          <Link
            href="/me/settings"
            aria-current={pathname.startsWith('/me/settings') ? 'page' : undefined}
            className={clsx(
              itemClass,
              pathname.startsWith('/me/settings')
                ? 'bg-primary text-primary-fg'
                : inactiveClass,
            )}
          >
            <Settings2 aria-hidden className="h-4 w-4" strokeWidth={1.5} />
            <span>Settings</span>
          </Link>
          {user && (
            <Link
              href="/me/settings/profile"
              className={clsx(itemClass, inactiveClass)}
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-[hsl(var(--member-rail-hover))] text-[9px]">
                {initialsOf(user.name)}
              </span>
              <span>Profile</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            className={clsx(itemClass, inactiveClass, 'w-full')}
          >
            <LogOut aria-hidden className="h-4 w-4" strokeWidth={1.5} />
            <span>Sign out</span>
          </button>
        </div>
      </nav>
    </aside>
  );
}

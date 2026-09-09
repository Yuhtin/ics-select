'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Compass, User, Users } from 'lucide-react';
import { clsx } from 'clsx';
import { useAuth } from '../../lib/auth/auth-context';

type Tab = {
  href: string;
  label: string;
  icon: typeof Compass;
  exact?: boolean;
};

const TABS: readonly Tab[] = [
  { href: '/me', label: 'Today', icon: Compass, exact: true },
  { href: '/me/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/me/cohort', label: 'Cohort', icon: Users },
  { href: '/me/settings', label: 'Profile', icon: User },
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

export function BottomTabBar() {
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-token bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Main navigation"
    >
      <ul className="mx-auto flex max-w-xl">
        {TABS.map(({ href, label, icon: Icon, exact }) => {
          const active =
            exact === true
              ? pathname === href
              : pathname === href || pathname?.startsWith(href + '/') === true;
          const isProfile = href === '/me/settings';
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex h-16 flex-col items-center justify-center gap-1 border-t-2 font-sans text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                  active ? 'border-primary bg-primary-soft text-primary' : 'border-transparent text-fg-mute hover:bg-surface-hover hover:text-fg',
                )}
              >
                {isProfile && user ? (
                  <span
                    className={clsx(
                      'inline-grid h-5 w-5 place-items-center overflow-hidden rounded-full border bg-bg-subtle font-sans text-[9px] font-semibold text-fg-soft',
                      active ? 'border-primary' : 'border-border-token',
                    )}
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
                  </span>
                ) : (
                  <Icon
                    className="h-5 w-5"
                    strokeWidth={active ? 2 : 1.5}
                  />
                )}
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

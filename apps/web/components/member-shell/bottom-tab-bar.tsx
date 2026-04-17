'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CalendarDays, Compass, User, Users } from 'lucide-react';
import { clsx } from 'clsx';

type Tab = {
  href: string;
  label: string;
  icon: typeof Compass;
  exact?: boolean;
};

const TABS: readonly Tab[] = [
  { href: '/me', label: 'Today', icon: Compass, exact: true },
  { href: '/me/plan', label: 'Week', icon: CalendarDays },
  { href: '/me/cohort', label: 'Cohort', icon: Users },
  { href: '/me/settings', label: 'You', icon: User },
];

export function BottomTabBar() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border-token bg-bg/95 backdrop-blur md:hidden"
      aria-label="Main navigation"
    >
      <ul className="mx-auto flex max-w-xl">
        {TABS.map(({ href, label, icon: Icon, exact }) => {
          const active =
            exact === true
              ? pathname === href
              : pathname === href || pathname?.startsWith(href + '/') === true;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={clsx(
                  'flex h-14 flex-col items-center justify-center gap-0.5 font-mono text-[10px] uppercase tracking-eyebrow',
                  active ? 'text-fg' : 'text-fg-mute',
                )}
              >
                <Icon
                  className={clsx('h-5 w-5', active ? 'stroke-fg' : 'stroke-fg-mute')}
                  strokeWidth={active ? 2 : 1.5}
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Compass, User, Users } from 'lucide-react';
import { clsx } from 'clsx';

const TABS = [
  { href: '/me', label: 'Today', icon: Compass },
  { href: '/cohort', label: 'Cohort', icon: Users },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
  { href: '/settings', label: 'Settings', icon: User },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-paper/95 backdrop-blur md:hidden"
      aria-label="Main navigation"
    >
      <ul className="mx-auto flex max-w-xl">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname?.startsWith(href + '/') === true;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={clsx(
                  'flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-mono uppercase tracking-label',
                  active ? 'text-ink' : 'text-ink-mute',
                )}
              >
                <Icon
                  className={clsx('h-5 w-5', active ? 'stroke-ink' : 'stroke-ink-mute')}
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

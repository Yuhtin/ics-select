'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Calendar, Compass, User, Users } from 'lucide-react';
import { clsx } from 'clsx';

const NAV = [
  { href: '/home', label: 'Today', icon: Compass },
  { href: '/cohort', label: 'Cohort', icon: Users },
  { href: '/calendar', label: 'Calendar', icon: Calendar },
] as const;

export function TopbarMember() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 hidden border-b border-rule/60 bg-paper/80 backdrop-blur md:block">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/home" className="font-serif text-lg font-semibold tracking-tight">
          ICS Select
        </Link>
        <nav className="flex items-center gap-1 font-sans text-sm">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname?.startsWith(href + '/') === true;
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'inline-flex items-center gap-2 rounded-pill px-3 py-1.5 transition-colors',
                  active ? 'bg-ink text-paper' : 'text-ink-soft hover:bg-paper-warm',
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.5} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <Link
          href="/settings"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-rule text-ink hover:bg-paper-warm"
          aria-label="Settings"
        >
          <User className="h-4 w-4" strokeWidth={1.5} />
        </Link>
      </div>
    </header>
  );
}

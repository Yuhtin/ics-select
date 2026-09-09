'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Paintbrush, Clock, type LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

type Tab = { href: string; label: string; icon: LucideIcon };

const TABS: Tab[] = [
  { href: '/me/settings/profile', label: 'Profile', icon: User },
  { href: '/me/settings/appearance', label: 'Appearance', icon: Paintbrush },
  { href: '/me/settings/availability', label: 'Availability', icon: Clock },
];

export function SettingsNav() {
  const pathname = usePathname();
  const activeHref = TABS.find((t) => pathname.startsWith(t.href))?.href;

  return (
    <>
      {/* Desktop sidebar */}
      <nav
        aria-label="Settings sections"
        className="hidden md:flex md:w-52 md:flex-col md:gap-0.5 md:border-r md:border-border-token md:pr-4"
      >
        {TABS.map((t) => {
          const active = t.href === activeHref;
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'flex min-h-11 items-center gap-3 rounded-input px-3 font-sans text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                active
                  ? 'bg-primary-soft font-medium text-primary dark:text-primary-fg'
                  : 'text-fg-soft hover:bg-bg-subtle hover:text-fg',
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.5} />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Mobile pills */}
      <nav
        aria-label="Settings sections"
        className="flex gap-2 overflow-x-auto pb-1 md:hidden"
      >
        {TABS.map((t) => {
          const active = t.href === activeHref;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'inline-flex min-h-11 items-center whitespace-nowrap rounded-input border px-3 font-sans text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                active
                  ? 'border-primary bg-primary text-primary-fg'
                  : 'border-border-token bg-surface text-fg-soft hover:border-border-strong hover:text-fg',
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

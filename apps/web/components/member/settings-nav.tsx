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
        className="hidden md:flex md:w-52 md:flex-col md:gap-0.5 md:border-r md:border-rule md:pr-4"
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
                'flex h-10 items-center gap-3 rounded-input px-3 font-sans text-sm',
                active
                  ? 'bg-paper-warm text-fg'
                  : 'text-fg-soft hover:bg-paper-warm hover:text-fg',
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
        className="sticky top-0 z-10 -mx-6 mb-6 flex gap-2 overflow-x-auto border-b border-rule bg-paper px-6 py-3 md:hidden"
      >
        {TABS.map((t) => {
          const active = t.href === activeHref;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'whitespace-nowrap rounded-pill border px-4 py-1.5 font-sans text-sm transition-colors',
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

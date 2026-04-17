'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import { Bell, BookOpen, CalendarDays, CircleDot, Sparkles, Users } from 'lucide-react';
import { clsx } from 'clsx';

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
};

const NAV: readonly NavItem[] = [
  { href: '/admin', label: 'Triage', icon: Bell, exact: true },
  { href: '/admin/cohort', label: 'Cohort', icon: Users },
  { href: '/admin/plans', label: 'Plans', icon: CalendarDays },
  { href: '/admin/library', label: 'Library', icon: BookOpen },
  { href: '/admin/cycles', label: 'Cycles', icon: CircleDot },
  { href: '/admin/ai-usage', label: 'AI', icon: Sparkles },
];

export function SidebarAdmin() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col border-r border-rule bg-paper">
      <div className="px-6 py-8 border-b border-rule">
        <p className="font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute font-semibold">
          ICS Select
        </p>
        <p className="font-serif-tool text-xl font-semibold tracking-tight mt-1">Admin</p>
      </div>
      <nav className="flex-1 py-4">
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
                'group flex items-center gap-3 border-l-2 px-5 py-2.5 font-sans text-sm transition-colors',
                active
                  ? 'border-focus bg-paper-warm font-semibold text-ink'
                  : 'border-transparent text-ink-soft hover:bg-paper-warm hover:text-ink',
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.5} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

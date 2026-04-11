'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

interface SidebarItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

export function SidebarItem({ href, label, icon: Icon, exact = false }: SidebarItemProps) {
  const pathname = usePathname();
  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + '/');

  const base =
    'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors';
  const state = isActive
    ? 'bg-brand-soft text-brand-soft-foreground'
    : 'text-foreground-muted hover:text-foreground hover:bg-surface-subtle';

  return (
    <Link
      href={href}
      className={`${base} ${state}`}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon
        className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-brand' : ''}`}
        strokeWidth={2}
        aria-hidden="true"
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

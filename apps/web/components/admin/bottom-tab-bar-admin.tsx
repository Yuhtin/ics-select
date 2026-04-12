'use client';

import { BookOpen, Calendar, LayoutDashboard, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/cycles', label: 'Ciclos', icon: Calendar },
  { href: '/admin/members', label: 'Membros', icon: Users },
  { href: '/admin/library', label: 'Biblioteca', icon: BookOpen },
] as const;

export function BottomTabBarAdmin() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden flex items-center justify-around h-16 bg-surface/90 backdrop-blur-xl border-t border-border/40 pb-[env(safe-area-inset-bottom)]">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors ${
              active ? 'text-brand' : 'text-foreground-muted'
            }`}
          >
            <Icon className="h-5 w-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

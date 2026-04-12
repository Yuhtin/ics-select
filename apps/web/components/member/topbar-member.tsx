'use client';

import { Calendar, Compass, LogOut, Settings, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import { BrandLockup } from '../shell/brand-lockup';

interface TopbarMemberProps {
  userName: string;
  avatarUrl?: string | null;
  onLogout?: () => void;
}

const NAV_ITEMS = [
  { href: '/map', label: 'Mapa', icon: Compass },
  { href: '/calendar', label: 'Calendario', icon: Calendar },
  { href: '/members', label: 'Membros', icon: Users },
] as const;

export function TopbarMember({ userName, avatarUrl, onLogout }: TopbarMemberProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const initial = userName.charAt(0).toUpperCase();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 hidden lg:flex items-center justify-between h-14 px-6 backdrop-blur-xl bg-background/70 border-b border-border/40">
      <BrandLockup size="md" />

      <nav className="flex items-center gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                active
                  ? 'bg-brand/10 text-brand'
                  : 'text-foreground-muted hover:text-foreground hover:bg-surface-subtle'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="h-9 w-9 rounded-full bg-brand-soft text-brand flex items-center justify-center text-sm font-bold overflow-hidden"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={userName} className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-12 w-48 bg-surface border border-border rounded-xl shadow-md py-2 z-50">
            <Link
              href="/me/availability"
              className="flex items-center gap-2 px-4 py-2 text-sm text-foreground-muted hover:bg-surface-subtle"
              onClick={() => setMenuOpen(false)}
            >
              <Settings className="h-4 w-4" />
              Disponibilidade
            </Link>
            {onLogout && (
              <button
                type="button"
                onClick={onLogout}
                className="flex items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-danger-soft w-full text-left"
              >
                <LogOut className="h-4 w-4" />
                Sair
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

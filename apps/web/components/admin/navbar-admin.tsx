'use client';

import { BookOpen, Calendar, LayoutDashboard, LogOut, Users } from 'lucide-react';
import { Avatar, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from '@heroui/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandLockup } from '../shell/brand-lockup';

interface NavbarAdminProps {
  userName: string;
  email: string;
  avatarUrl?: string | null;
  onLogout?: () => void;
}

const NAV_ITEMS = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/cycles', label: 'Ciclos', icon: Calendar },
  { href: '/admin/members', label: 'Membros', icon: Users },
  { href: '/admin/library', label: 'Biblioteca', icon: BookOpen },
] as const;

export function NavbarAdmin({ userName, email, avatarUrl, onLogout }: NavbarAdminProps) {
  const pathname = usePathname();
  const initial = userName.charAt(0).toUpperCase();

  return (
    <header className="fixed top-0 left-0 right-0 z-40 hidden lg:flex items-center justify-between h-14 px-8 backdrop-blur-xl bg-surface/80 border-b border-border/30">
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

      <Dropdown placement="bottom-end">
        <DropdownTrigger>
          <button type="button" className="flex items-center gap-2 outline-none">
            <Avatar
              src={avatarUrl ?? undefined}
              name={initial}
              size="sm"
              className="cursor-pointer"
            />
          </button>
        </DropdownTrigger>
        <DropdownMenu aria-label="Menu do usuario">
          <DropdownItem key="profile" isReadOnly className="opacity-100">
            <p className="text-sm font-semibold">{userName}</p>
            <p className="text-xs text-foreground-muted">{email}</p>
          </DropdownItem>
          <DropdownItem
            key="logout"
            color="danger"
            startContent={<LogOut className="h-4 w-4" />}
            onPress={onLogout}
          >
            Sair
          </DropdownItem>
        </DropdownMenu>
      </Dropdown>
    </header>
  );
}

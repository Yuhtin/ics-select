'use client';

import {
  BookOpen,
  Calendar,
  Clock,
  LayoutDashboard,
  ListTodo,
  LogOut,
  type LucideIcon,
  Sparkles,
  Users,
} from 'lucide-react';
import { BrandLockup } from './brand-lockup';
import { SidebarItem } from './sidebar-item';

type Role = 'ADMIN' | 'MEMBER';

export interface SidebarUser {
  name: string;
  email: string;
  role: Role;
  avatarUrl?: string | null;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
}

const adminItems: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/cycles', label: 'Ciclos', icon: Calendar },
  { href: '/admin/members', label: 'Membros', icon: Users },
  { href: '/admin/library', label: 'Acervo', icon: BookOpen },
  { href: '/admin/ai-usage', label: 'Uso de IA', icon: Sparkles },
];

const memberItems: NavItem[] = [
  { href: '/me', label: 'Meu plano', icon: ListTodo, exact: true },
  { href: '/me/availability', label: 'Disponibilidade', icon: Clock },
];

interface SidebarProps {
  user: SidebarUser;
  onLogout?: () => void;
}

export function Sidebar({ user, onLogout }: SidebarProps) {
  const items = user.role === 'ADMIN' ? adminItems : memberItems;
  const initial = user.name.charAt(0).toUpperCase() || 'U';

  return (
    <aside className="h-screen w-60 border-r border-border bg-surface-muted flex flex-col">
      <div className="h-14 px-5 flex items-center border-b border-border flex-shrink-0">
        <BrandLockup size="md" />
      </div>

      <nav className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
        {items.map((item) => (
          <SidebarItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            exact={item.exact}
          />
        ))}
      </nav>

      <div className="p-3 border-t border-border flex-shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 rounded-md">
          <div className="h-8 w-8 rounded-full bg-brand-soft text-brand flex items-center justify-center text-xs font-bold flex-shrink-0">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
            <p className="text-[10px] text-foreground-muted truncate">{user.email}</p>
          </div>
          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              aria-label="Sair"
              className="h-8 w-8 flex items-center justify-center rounded-md text-foreground-muted hover:bg-surface-subtle hover:text-foreground transition-colors flex-shrink-0"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

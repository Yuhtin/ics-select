'use client';

import Link from 'next/link';
import { useEffect, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/auth-context';
import { BtgLogin, useBtgLogout } from '../auth';
import { Avatar, BTG_LOGO_WHITE, Icon, Loading } from '../ui';

export const BTG_ADMIN_BASE = '/btgadmin-poc';

const NAV = [
  { href: BTG_ADMIN_BASE, label: 'Ciclo ativo', icon: 'monitoring', match: (p: string) => p === BTG_ADMIN_BASE || (p.startsWith(`${BTG_ADMIN_BASE}/cycle/`) && !p.endsWith('/resumo')) },
  { href: `${BTG_ADMIN_BASE}/ciclos`, label: 'Ciclos', icon: 'event_repeat', match: (p: string) => p.startsWith(`${BTG_ADMIN_BASE}/ciclos`) },
  { href: `${BTG_ADMIN_BASE}/membros`, label: 'Membros', icon: 'group', match: (p: string) => p.startsWith(`${BTG_ADMIN_BASE}/membros`) || (p.startsWith(`${BTG_ADMIN_BASE}/member/`) && !p.includes('/plan/')) },
  { href: `${BTG_ADMIN_BASE}/planos`, label: 'Planos', icon: 'checklist', match: (p: string) => p.startsWith(`${BTG_ADMIN_BASE}/planos`) || p.includes('/plan/') },
  { href: `${BTG_ADMIN_BASE}/acervo`, label: 'Acervo', icon: 'library_books', match: (p: string) => p.startsWith(`${BTG_ADMIN_BASE}/acervo`) },
  { href: `${BTG_ADMIN_BASE}/aulas`, label: 'Aulas', icon: 'school', match: (p: string) => p.startsWith(`${BTG_ADMIN_BASE}/aulas`) },
  { href: `${BTG_ADMIN_BASE}/uso-ia`, label: 'Uso de IA', icon: 'smart_toy', match: (p: string) => p.startsWith(`${BTG_ADMIN_BASE}/uso-ia`) },
  { href: `${BTG_ADMIN_BASE}/lista-espera`, label: 'Lista de espera', icon: 'hourglass_top', match: (p: string) => p.startsWith(`${BTG_ADMIN_BASE}/lista-espera`) },
  { href: `${BTG_ADMIN_BASE}/configuracoes`, label: 'Configurações', icon: 'settings', match: (p: string) => p.startsWith(`${BTG_ADMIN_BASE}/configuracoes`) },
];

export function BtgAdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const logout = useBtgLogout(BTG_ADMIN_BASE);

  useEffect(() => {
    if (isLoading) return;
    if (!user) return;
    if (user.role === 'MEMBER') {
      router.replace('/btg-poc');
    }
  }, [isLoading, user, router]);

  if (!isLoading && !user) return <BtgLogin area="admin" />;
  if (isLoading || !user || user.role === 'MEMBER') return <Loading />;

  return (
    <div className="btg-admin">
      <aside className="btg-sidebar">
        <div className="btg-sidebar-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={BTG_LOGO_WHITE} alt="BTG Pactual" />
          <span>ICS Select · Diretor Educacional</span>
        </div>
        <nav aria-label="Admin">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={n.match?.(pathname) ? 'page' : undefined}>
              <Icon name={n.icon} />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="btg-sidebar-foot">
          <Avatar name={user.name} pictureUrl={user.pictureUrl} size="sm" />
          <span>{user.name}</span>
          <button type="button" aria-label="Sair" onClick={() => void logout()}>
            <Icon name="logout" />
          </button>
        </div>
      </aside>
      <div className="btg-admin-body">
        {/* Phones: the sidebar hides, so the same links become a scrollable strip. */}
        <nav className="btg-admin-mobilenav" aria-label="Admin">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={n.match?.(pathname) ? 'page' : undefined}>
              <Icon name={n.icon} />
              {n.label}
            </Link>
          ))}
          <button type="button" aria-label="Sair" onClick={() => void logout()}>
            <Icon name="logout" />
          </button>
        </nav>
        {children}
      </div>
    </div>
  );
}

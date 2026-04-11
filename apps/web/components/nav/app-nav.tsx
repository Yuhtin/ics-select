'use client';

import Link from 'next/link';
import { Avatar, Button } from '@heroui/react';
import { useAuth } from '../../lib/auth/auth-context';

export function AppNav() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <nav className="flex items-center justify-between border-b border-foreground/10 px-6 py-3">
      <Link href="/" className="text-lg font-semibold">
        ICS Select
      </Link>
      <div className="flex items-center gap-4 text-sm">
        {user.role === 'ADMIN' ? (
          <>
            <Link href="/admin/dashboard" className="text-foreground/80 hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/admin/cycles" className="text-foreground/80 hover:text-foreground">
              Ciclos
            </Link>
            <Link href="/admin/members" className="text-foreground/80 hover:text-foreground">
              Membros
            </Link>
            <Link href="/admin/library" className="text-foreground/80 hover:text-foreground">
              Acervo
            </Link>
            <Link href="/admin/ai-usage" className="text-foreground/80 hover:text-foreground">
              Uso de IA
            </Link>
          </>
        ) : (
          <>
            <Link href="/me" className="text-foreground/80 hover:text-foreground">
              Meu plano
            </Link>
            <Link href="/me/availability" className="text-foreground/80 hover:text-foreground">
              Disponibilidade
            </Link>
          </>
        )}
        <div className="flex items-center gap-2">
          <Avatar src={user.pictureUrl ?? undefined} name={user.name} size="sm" />
          <span className="hidden sm:inline">{user.name}</span>
        </div>
        <Button size="sm" variant="flat" onPress={logout}>
          Sair
        </Button>
      </div>
    </nav>
  );
}

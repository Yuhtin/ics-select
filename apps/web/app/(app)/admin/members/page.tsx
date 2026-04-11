'use client';

import { Avatar, Card, CardBody, Chip } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiFetch } from '../../../../lib/api/client';

type Member = {
  id: string;
  email: string;
  name: string;
  pictureUrl: string | null;
  role: 'ADMIN' | 'MEMBER';
};

export default function AdminMembersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => apiFetch<Member[]>('/members'),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-2xl font-semibold">Membros</h1>
      <Card>
        <CardBody>
          {isLoading ? (
            <p>Carregando...</p>
          ) : (data ?? []).length === 0 ? (
            <p className="text-foreground-muted">Nenhum membro cadastrado.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {(data ?? []).map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/admin/plans/${m.id}`}
                    className="flex flex-col items-center gap-2 rounded-md border border-border p-4 hover:border-border-strong"
                  >
                    <Avatar src={m.pictureUrl ?? undefined} name={m.name} size="lg" />
                    <span className="text-sm font-medium">{m.name}</span>
                    <span className="text-xs text-foreground-muted">{m.email}</span>
                    <Chip size="sm" variant="flat" color={m.role === 'ADMIN' ? 'primary' : 'default'}>
                      {m.role}
                    </Chip>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

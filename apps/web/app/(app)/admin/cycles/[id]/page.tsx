'use client';

import { Avatar, Card, CardBody, CardHeader } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import { use } from 'react';
import { apiFetch } from '../../../../../lib/api/client';

type CycleDetail = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: string;
  memberships: Array<{
    id: string;
    user: { id: string; name: string; email: string; pictureUrl: string | null };
  }>;
};

export default function AdminCycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading } = useQuery({
    queryKey: ['cycle', id],
    queryFn: () => apiFetch<CycleDetail>(`/cycles/${id}`),
  });

  if (isLoading) return <p>Carregando...</p>;
  if (!data) return <p>Ciclo não encontrado.</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-semibold">{data.name}</h1>
        </CardHeader>
        <CardBody className="space-y-1 text-sm text-foreground/70">
          <p>
            {new Date(data.startsAt).toLocaleDateString('pt-BR')} —{' '}
            {new Date(data.endsAt).toLocaleDateString('pt-BR')}
          </p>
          <p>Status: {data.status}</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Membros ({data.memberships.length})</h2>
        </CardHeader>
        <CardBody>
          {data.memberships.length === 0 ? (
            <p className="text-foreground/60">Nenhum membro neste ciclo ainda.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {data.memberships.map((m) => (
                <li key={m.id} className="flex flex-col items-center gap-2 rounded-md border border-foreground/10 p-3">
                  <Avatar src={m.user.pictureUrl ?? undefined} name={m.user.name} size="lg" />
                  <span className="text-sm font-medium">{m.user.name}</span>
                  <span className="text-xs text-foreground/60">{m.user.email}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

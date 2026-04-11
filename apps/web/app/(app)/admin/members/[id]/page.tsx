'use client';

import { Avatar, Card, CardBody, CardHeader, Chip } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import { use } from 'react';
import { apiFetch } from '../../../../../lib/api/client';

type Overview = {
  user: { id: string; name: string; email: string; pictureUrl: string | null };
  plans: Array<{ id: string; weekStart: string; weekEnd: string; status: string; doneCount: number; totalCount: number }>;
  topicCoverage: Array<{ tag: string; done: number; total: number }>;
};

export default function AdminMemberDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading } = useQuery({
    queryKey: ['admin-member', id],
    queryFn: () => apiFetch<Overview>(`/admin/members/${id}/overview`),
  });

  if (isLoading || !data) return <p>Carregando...</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Card>
        <CardBody className="flex flex-row items-center gap-4">
          <Avatar src={data.user.pictureUrl ?? undefined} name={data.user.name} size="lg" />
          <div>
            <h1 className="text-2xl font-semibold">{data.user.name}</h1>
            <p className="text-sm text-foreground/60">{data.user.email}</p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Histórico de planos</h2></CardHeader>
        <CardBody className="space-y-2">
          {data.plans.length === 0 ? (
            <p className="text-foreground/60">Nenhum plano ainda.</p>
          ) : (
            data.plans.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-md border border-foreground/10 p-3">
                <div>
                  <p className="text-sm font-medium">
                    {new Date(p.weekStart).toLocaleDateString('pt-BR')} —{' '}
                    {new Date(p.weekEnd).toLocaleDateString('pt-BR')}
                  </p>
                  <p className="text-xs text-foreground/60">{p.doneCount}/{p.totalCount} concluídos</p>
                </div>
                <Chip size="sm" variant="flat">{p.status}</Chip>
              </div>
            ))
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Cobertura de tópicos</h2></CardHeader>
        <CardBody>
          {data.topicCoverage.length === 0 ? (
            <p className="text-foreground/60">Sem dados ainda.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {data.topicCoverage.map((t) => {
                const pct = t.total === 0 ? 0 : Math.round((t.done / t.total) * 100);
                const color = pct >= 75 ? 'success' : pct >= 40 ? 'warning' : 'default';
                return (
                  <div key={t.tag} className="rounded-md border border-foreground/10 p-3">
                    <p className="text-sm font-medium">{t.tag}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-foreground/60">{t.done}/{t.total}</span>
                      <Chip size="sm" variant="flat" color={color}>{pct}%</Chip>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

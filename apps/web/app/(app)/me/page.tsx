'use client';

import { Card, CardBody, CardHeader, Chip, Progress } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api/client';

type Plan = {
  id: string;
  status: string;
  weekStart: string;
  weekEnd: string;
  items: Array<{
    id: string;
    status: 'PENDING' | 'DONE';
    order: number;
    stuck: boolean;
    libraryItem: {
      id: string;
      title: string;
      estimatedMinutes: number;
      url: string | null;
      format: string;
    };
    sessions: Array<{ id: string; scheduledAt: string; durationMinutes: number }>;
  }>;
};

export default function MeHomePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['me-week'],
    queryFn: () => apiFetch<Plan[]>('/me/week'),
  });

  if (isLoading) return <p>Carregando...</p>;
  const current = data?.[0];

  if (!current) {
    return (
      <Card>
        <CardBody>
          <p className="text-foreground/70">Nenhum plano ainda. Aguarde o admin montar.</p>
        </CardBody>
      </Card>
    );
  }

  const done = current.items.filter((i) => i.status === 'DONE').length;
  const total = current.items.length;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <div className="flex w-full items-center justify-between">
            <h1 className="text-2xl font-semibold">Esta semana</h1>
            <Chip size="sm" variant="flat">{current.status}</Chip>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          <Progress label={`Progresso: ${done}/${total}`} value={progress} />
          <div className="space-y-2">
            {current.items.map((item) => (
              <Link
                key={item.id}
                href={`/me/plan/${current.id}/item/${item.id}`}
                className="flex items-center justify-between rounded-md border border-foreground/10 p-3 hover:border-foreground/30"
              >
                <div>
                  <p className="text-sm font-medium">
                    {item.order + 1}. {item.libraryItem.title}
                  </p>
                  <p className="text-xs text-foreground/60">
                    {item.libraryItem.format} · {item.libraryItem.estimatedMinutes}min
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {item.stuck && <Chip size="sm" color="warning">Travei</Chip>}
                  <Chip size="sm" variant="flat" color={item.status === 'DONE' ? 'success' : 'default'}>
                    {item.status === 'DONE' ? 'Feito' : 'Pendente'}
                  </Chip>
                </div>
              </Link>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

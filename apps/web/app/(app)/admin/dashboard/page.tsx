'use client';

import { Avatar, Card, CardBody, Chip } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiFetch } from '../../../../lib/api/client';

type Member = {
  id: string;
  name: string;
  email: string;
  pictureUrl: string | null;
  role: 'ADMIN' | 'MEMBER';
  stats: { plansCount: number; doneItems: number; stuckItems: number };
};

export default function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin-dashboard'],
    queryFn: () => apiFetch<Member[]>('/admin/dashboard'),
  });

  if (isLoading) return <p>Carregando...</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(data ?? [])
          .filter((m) => m.role === 'MEMBER')
          .map((m) => (
            <Card key={m.id} as={Link} href={`/admin/members/${m.id}`} isPressable>
              <CardBody className="space-y-2">
                <div className="flex items-center gap-3">
                  <Avatar src={m.pictureUrl ?? undefined} name={m.name} size="md" />
                  <div>
                    <p className="text-sm font-semibold">{m.name}</p>
                    <p className="text-xs text-foreground/60">{m.email}</p>
                  </div>
                </div>
                <div className="flex gap-2 text-xs">
                  <Chip size="sm" variant="flat">{m.stats.plansCount} planos</Chip>
                  <Chip size="sm" variant="flat" color="success">
                    {m.stats.doneItems} feitos
                  </Chip>
                  {m.stats.stuckItems > 0 && (
                    <Chip size="sm" color="warning">
                      {m.stats.stuckItems} travei
                    </Chip>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
      </div>
    </div>
  );
}

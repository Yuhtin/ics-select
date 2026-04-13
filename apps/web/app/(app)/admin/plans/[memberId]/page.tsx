'use client';

import { use } from 'react';
import { Chip } from '@heroui/react';
import { Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PlanEditor } from '../../../../../components/plans/plan-editor';
import { apiFetch } from '../../../../../lib/api/client';

type Cycle = { id: string; name: string; startsAt: string; endsAt: string; status: string; memberships?: Array<{ userId: string }> };

export default function AdminPlanEditorPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = use(params);
  const { data: cycles } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => apiFetch<Cycle[]>('/cycles'),
  });
  const now = new Date();

  // First: cycles this member belongs to
  const memberCycles = cycles?.filter((c) => c.memberships?.some((m) => m.userId === memberId)) ?? [];

  // Pick the active cycle for this member: prefer one whose dates contain today, fallback to any ACTIVE membership
  const activeCycle = memberCycles.find((c) => {
    if (c.status !== 'ACTIVE') return false;
    return new Date(c.startsAt) <= now && new Date(c.endsAt) >= now;
  }) ?? memberCycles.find((c) => c.status === 'ACTIVE')
    // Last resort: any active cycle (member might not have membership yet)
    ?? cycles?.find((c) => {
      if (c.status !== 'ACTIVE') return false;
      return new Date(c.startsAt) <= now && new Date(c.endsAt) >= now;
    }) ?? cycles?.find((c) => c.status === 'ACTIVE');

  if (!cycles) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-8 w-64 skeleton-pulse rounded-lg" />
          <div className="h-4 w-48 skeleton-pulse rounded-lg mt-2" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 glass rounded-xl h-96 skeleton-pulse" />
          <div className="lg:col-span-3 space-y-4">
            <div className="glass rounded-xl h-32 skeleton-pulse" />
            <div className="glass rounded-xl h-64 skeleton-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!activeCycle) {
    return (
      <div className="glass rounded-xl text-center py-16 px-8">
        <div className="h-12 w-12 rounded-xl bg-brand-soft flex items-center justify-center mx-auto mb-4">
          <Calendar className="h-6 w-6 text-brand" />
        </div>
        <p className="text-foreground-muted font-medium">Nenhum ciclo ativo encontrado.</p>
        <p className="text-foreground-subtle text-sm mt-1">Crie um ciclo antes de montar um plano semanal.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Editor de plano semanal</h1>
        <p className="text-sm text-foreground-muted mt-1 flex items-center gap-2">
          Ciclo ativo: <Chip size="sm" color="primary" variant="flat">{activeCycle.name}</Chip>
        </p>
      </div>
      <PlanEditor memberId={memberId} cycleId={activeCycle.id} />
    </div>
  );
}

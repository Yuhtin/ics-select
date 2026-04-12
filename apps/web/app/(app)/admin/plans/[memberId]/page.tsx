'use client';

import { use } from 'react';
import { Chip } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import { PlanEditor } from '../../../../../components/plans/plan-editor';
import { apiFetch } from '../../../../../lib/api/client';

type Cycle = { id: string; name: string; status: string };

export default function AdminPlanEditorPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = use(params);
  const { data: cycles } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => apiFetch<Cycle[]>('/cycles'),
  });
  const activeCycle = cycles?.find((c) => c.status === 'ACTIVE');

  if (!activeCycle) {
    return (
      <div className="text-center py-12">
        <p className="text-foreground-muted">Crie um ciclo antes de montar um plano.</p>
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

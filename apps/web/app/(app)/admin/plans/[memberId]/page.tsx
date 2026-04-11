'use client';

import { use } from 'react';
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
    return <p className="text-foreground/60">Crie um ciclo antes de montar um plano.</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-2xl font-semibold">Editor de plano semanal</h1>
      <p className="text-sm text-foreground/60">Ciclo ativo: {activeCycle.name}</p>
      <PlanEditor memberId={memberId} cycleId={activeCycle.id} />
    </div>
  );
}

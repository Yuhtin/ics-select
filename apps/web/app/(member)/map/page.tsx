'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addToast } from '@heroui/react';
import { CalendarPlus, Map as MapIcon } from 'lucide-react';
import { apiFetch } from '../../../lib/api/client';
import { MapViewport } from '../../../components/member/map-viewport';
import { PlanDock, type PlanSummary } from '../../../components/member/plan-dock';
import { StatsSidebar } from '../../../components/member/stats-sidebar';
import { StatsBannerMobile } from '../../../components/member/stats-banner-mobile';
import { usePlan, type Plan } from '../../../lib/queries/plan';

function formatDateRange(weekStart: string, weekEnd: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
    return `${fmt.format(new Date(weekStart))} a ${fmt.format(new Date(weekEnd))}`;
  } catch {
    return '';
  }
}

export default function MapPage() {
  const [loadedPlanId, setLoadedPlanId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: weekPlans, isLoading: loadingWeek } = useQuery({
    queryKey: ['me-week'],
    queryFn: () => apiFetch<Plan[]>('/me/week'),
  });

  const { data: allPlans } = useQuery({
    queryKey: ['me-plans'],
    queryFn: () => apiFetch<PlanSummary[]>('/me/plans'),
  });

  const activePlanId = weekPlans?.[0]?.id ?? null;

  useEffect(() => {
    if (loadedPlanId === null && activePlanId !== null) {
      setLoadedPlanId(activePlanId);
    }
  }, [activePlanId, loadedPlanId]);

  const isLoadedActive = loadedPlanId === activePlanId;
  const { data: loadedPlanFull } = usePlan(isLoadedActive ? null : loadedPlanId);
  const displayPlan: Plan | undefined = isLoadedActive ? weekPlans?.[0] : loadedPlanFull;

  const autoSchedule = useMutation({
    mutationFn: (planId: string) =>
      apiFetch<{ sessionsCreated: number; overflow: Array<unknown> }>(
        `/plans/${planId}/auto-schedule`,
        { method: 'POST' },
      ),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['me-week'] });
      queryClient.invalidateQueries({ queryKey: ['plan'] });
      addToast({
        title: 'Sessões agendadas',
        description: `${data.sessionsCreated} sessão${data.sessionsCreated === 1 ? '' : 'ões'} criada${data.sessionsCreated === 1 ? '' : 's'} na sua agenda.`,
        color: 'success',
      });
    },
    onError: (err: Error) => {
      addToast({ title: 'Erro ao alocar', description: err.message, color: 'danger' });
    },
  });

  if (loadingWeek) {
    return <p className="text-sm text-foreground-muted p-8">Carregando seu mapa...</p>;
  }

  if (!activePlanId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <MapIcon className="h-16 w-16 text-foreground-subtle mb-4" />
        <h2 className="text-lg font-bold text-foreground">Nenhum plano ativo</h2>
        <p className="text-sm text-foreground-muted mt-2">
          Aguarde o administrador publicar o próximo plano semanal.
        </p>
      </div>
    );
  }

  if (!displayPlan) {
    return <p className="text-sm text-foreground-muted p-8">Carregando mundo...</p>;
  }

  const done = displayPlan.items.filter((i) => i.status === 'DONE').length;
  const total = displayPlan.items.length;
  const daysRemaining = Math.max(
    0,
    Math.ceil((new Date(displayPlan.weekEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[hsl(var(--map-bg-start))] to-[hsl(var(--map-bg-end))]">
      <StatsBannerMobile done={done} total={total} daysRemaining={daysRemaining} streak={0} />

      {allPlans && (
        <div className="hidden lg:block">
          <PlanDock
            plans={allPlans}
            loadedPlanId={loadedPlanId}
            activePlanId={activePlanId}
            onSelect={setLoadedPlanId}
            orientation="vertical"
          />
        </div>
      )}

      <div className="flex gap-6 px-4 lg:pl-28 lg:pr-8 py-6">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
            <div>
              <h1 className="text-lg font-bold text-foreground">Mapa de Estudo</h1>
              <p className="text-sm text-foreground-muted">
                {formatDateRange(displayPlan.weekStart, displayPlan.weekEnd)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => autoSchedule.mutate(displayPlan.id)}
              disabled={autoSchedule.isPending}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand text-white text-sm font-medium px-4 py-2 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-glow-primary"
            >
              <CalendarPlus className="h-4 w-4" />
              {autoSchedule.isPending ? 'Alocando...' : 'Alocar Automaticamente'}
            </button>
          </div>

          {allPlans && (
            <div className="lg:hidden mb-4">
              <PlanDock
                plans={allPlans}
                loadedPlanId={loadedPlanId}
                activePlanId={activePlanId}
                onSelect={setLoadedPlanId}
                orientation="horizontal"
              />
            </div>
          )}

          <MapViewport plan={displayPlan} />
        </div>
        <StatsSidebar done={done} total={total} daysRemaining={daysRemaining} streak={0} />
      </div>
    </div>
  );
}

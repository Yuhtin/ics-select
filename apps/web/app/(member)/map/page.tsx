'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { Map } from 'lucide-react';
import { apiFetch } from '../../../lib/api/client';
import { NodeMap } from '../../../components/member/node-map';
import { WorldSelect } from '../../../components/member/world-select';
import { StatsSidebar } from '../../../components/member/stats-sidebar';
import { StatsBannerMobile } from '../../../components/member/stats-banner-mobile';

type PlanItem = {
  id: string;
  status: 'PENDING' | 'DONE';
  stuck: boolean;
  completionStatus?: 'DONE' | 'STUCK' | 'DOUBTS' | null;
  feedback?: string | null;
  order: number;
  libraryItem: {
    id: string;
    title: string;
    description?: string | null;
    estimatedMinutes: number;
    url: string | null;
    format: string;
  };
  sessions: Array<{ id: string; scheduledAt: string; durationMinutes: number }>;
};

type Plan = {
  id: string;
  status: string;
  weekStart: string;
  weekEnd: string;
  items: PlanItem[];
};

type PlanSummary = {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: string;
  cycle: { name: string };
  items: Array<{ id: string; status: string }>;
};

function formatDateRange(weekStart: string, weekEnd: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
    return `${fmt.format(new Date(weekStart))} a ${fmt.format(new Date(weekEnd))}`;
  } catch {
    return '';
  }
}

export default function MapPage() {
  const [view, setView] = useState<'map' | 'worlds'>('map');
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  const { data: currentPlans, isLoading: loadingCurrent } = useQuery({
    queryKey: ['me-week'],
    queryFn: () => apiFetch<Plan[]>('/me/week'),
  });

  const { data: allPlans } = useQuery({
    queryKey: ['me-plans'],
    queryFn: () => apiFetch<PlanSummary[]>('/me/plans'),
  });

  if (loadingCurrent) {
    return <p className="text-sm text-foreground-muted p-8">Carregando seu mapa...</p>;
  }

  const activePlan = currentPlans?.[0];
  const displayPlanId = selectedPlanId ?? activePlan?.id;
  const displayPlan = displayPlanId === activePlan?.id ? activePlan : null;

  if (!activePlan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <Map className="h-16 w-16 text-foreground-subtle mb-4" />
        <h2 className="text-lg font-bold text-foreground">Nenhum plano ativo</h2>
        <p className="text-sm text-foreground-muted mt-2">
          Aguarde o administrador publicar o proximo plano semanal.
        </p>
      </div>
    );
  }

  const done = displayPlan ? displayPlan.items.filter((i) => i.status === 'DONE').length : 0;
  const total = displayPlan?.items.length ?? 0;
  const daysRemaining = displayPlan
    ? Math.max(0, Math.ceil((new Date(displayPlan.weekEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-[hsl(var(--map-bg-start))] to-[hsl(var(--map-bg-end))]">
      <StatsBannerMobile done={done} total={total} daysRemaining={daysRemaining} streak={0} />

      <AnimatePresence mode="wait">
        {view === 'worlds' && allPlans ? (
          <WorldSelect
            key="worlds"
            plans={allPlans}
            activePlanId={activePlan.id}
            onSelectWorld={(id) => { setSelectedPlanId(id); setView('map'); }}
            onBack={() => setView('map')}
          />
        ) : displayPlan ? (
          <div key="map" className="flex gap-6 px-4 lg:px-8 py-6">
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-lg font-bold text-foreground">Mapa de Estudo</h1>
                  <p className="text-sm text-foreground-muted">
                    {formatDateRange(displayPlan.weekStart, displayPlan.weekEnd)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setView('worlds')}
                  className="text-sm text-brand font-medium hover:underline"
                >
                  Ver todos os mundos
                </button>
              </div>
              <NodeMap planId={displayPlan.id} items={displayPlan.items} />
            </div>
            <StatsSidebar done={done} total={total} daysRemaining={daysRemaining} streak={0} />
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

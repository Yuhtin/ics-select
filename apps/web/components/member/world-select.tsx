'use client';

import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { WorldCard } from './world-card';

interface PlanSummary {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: string;
  cycle: { name: string };
  items: Array<{ id: string; status: string }>;
}

interface WorldSelectProps {
  plans: PlanSummary[];
  activePlanId: string | null;
  onSelectWorld: (planId: string) => void;
  onBack: () => void;
}

function formatWeekRange(start: string, end: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
    return `${fmt.format(new Date(start))} — ${fmt.format(new Date(end))}`;
  } catch {
    return '';
  }
}

export function WorldSelect({ plans, activePlanId, onSelectWorld, onBack }: WorldSelectProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="p-6 lg:p-8"
    >
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-foreground-muted hover:text-foreground mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar ao mapa
      </button>

      <h2 className="text-xl font-bold text-foreground mb-6">Todos os Mundos</h2>

      <div className="flex gap-4 overflow-x-auto pb-4 lg:flex-wrap">
        {plans.map((plan) => {
          const done = plan.items.filter((i) => i.status === 'DONE').length;
          const total = plan.items.length;
          const percent = total === 0 ? 0 : Math.round((done / total) * 100);
          const isActive = plan.id === activePlanId;
          const isCompleted = plan.status === 'COMPLETED' || plan.status === 'ARCHIVED';

          let status: 'completed' | 'active' | 'locked' = 'locked';
          if (isCompleted) status = 'completed';
          else if (isActive) status = 'active';
          else if (plan.status === 'PUBLISHED') status = 'completed';

          return (
            <WorldCard
              key={plan.id}
              label={plan.cycle.name}
              weekRange={formatWeekRange(plan.weekStart, plan.weekEnd)}
              status={status}
              percent={percent}
              onClick={() => onSelectWorld(plan.id)}
            />
          );
        })}
      </div>
    </motion.div>
  );
}

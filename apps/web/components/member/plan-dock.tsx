'use client';

import { useMemo } from 'react';
import { usePrefetchPlan } from '../../lib/queries/plan';

export type PlanSummary = {
  id: string;
  weekStart: string;
  weekEnd: string;
  status: string;
  cycle: { name: string };
  items: Array<{ id: string; status: string }>;
};

interface PlanDockProps {
  plans: PlanSummary[];
  loadedPlanId: string | null;
  activePlanId: string | null;
  onSelect: (planId: string) => void;
  orientation?: 'vertical' | 'horizontal';
}

function statusOf(plan: PlanSummary, activePlanId: string | null): 'done' | 'active' | 'upcoming' | 'available' {
  const now = Date.now();
  const start = new Date(plan.weekStart).getTime();
  if (start > now) return 'upcoming';
  if (plan.id === activePlanId) return 'active';
  const done = plan.items.filter((i) => i.status === 'DONE').length;
  if (done === plan.items.length && plan.items.length > 0) return 'done';
  return 'available';
}

export function PlanDock({
  plans, loadedPlanId, activePlanId, onSelect, orientation = 'vertical',
}: PlanDockProps) {
  const prefetch = usePrefetchPlan();

  const sorted = useMemo(
    () => [...plans].sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    [plans],
  );

  const numberByPlan = useMemo(() => {
    const map = new Map<string, number>();
    const byCycle = new Map<string, PlanSummary[]>();
    for (const p of sorted) {
      const arr = byCycle.get(p.cycle.name) ?? [];
      arr.push(p);
      byCycle.set(p.cycle.name, arr);
    }
    for (const [, arr] of byCycle) arr.forEach((p, i) => map.set(p.id, i + 1));
    return map;
  }, [sorted]);

  const isVertical = orientation === 'vertical';

  return (
    <div
      className={
        isVertical
          ? 'fixed left-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2'
          : 'w-full overflow-x-auto py-2 flex gap-2 snap-x'
      }
    >
      {isVertical && (
        <div className="text-[9px] font-bold text-foreground-muted tracking-widest uppercase text-center mb-1">
          Mundos
        </div>
      )}
      {sorted.map((p) => {
        const s = statusOf(p, activePlanId);
        const isLoaded = p.id === loadedPlanId;
        const done = p.items.filter((i) => i.status === 'DONE').length;
        const total = p.items.length;
        const pct = total === 0 ? 0 : Math.round((done / total) * 100);
        const weekNum = numberByPlan.get(p.id) ?? 0;
        const clickable = s !== 'upcoming';

        return (
          <button
            key={p.id}
            type="button"
            onClick={() => clickable && onSelect(p.id)}
            onMouseEnter={() => clickable && prefetch(p.id)}
            disabled={!clickable}
            className={[
              'w-[76px] min-w-[76px] rounded-xl px-[6px] py-2 text-center transition-all snap-center',
              'bg-white/90 backdrop-blur shadow-sm border-2',
              isLoaded ? 'border-brand scale-[1.04] translate-x-[6px] shadow-glow-primary' : 'border-transparent',
              clickable && !isLoaded ? 'hover:translate-x-1 hover:shadow-md cursor-pointer' : '',
              s === 'upcoming' ? 'opacity-55 cursor-not-allowed' : '',
            ].join(' ')}
          >
            <div className="text-[10px] font-semibold text-foreground-muted">Semana</div>
            <div className={[
              'text-[13px] font-extrabold mt-0.5',
              s === 'done' && !isLoaded ? 'text-success' : '',
              isLoaded ? 'text-brand' : '',
              s === 'upcoming' ? 'text-foreground-muted' : 'text-foreground',
            ].join(' ')}>{weekNum}</div>
            <div className="h-1 bg-stone-200 rounded-full mt-1.5 overflow-hidden">
              <div
                className={['h-full rounded-full transition-all', isLoaded ? 'bg-brand' : 'bg-success'].join(' ')}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className={[
              'text-[9px] mt-1 font-semibold tracking-wide',
              isLoaded ? 'text-brand' : s === 'done' ? 'text-success' : 'text-foreground-muted',
            ].join(' ')}>
              {s === 'done' ? 'Concluído' : s === 'active' ? 'Atual' : s === 'upcoming' ? 'Em breve' : 'Disponível'}
            </div>
          </button>
        );
      })}
    </div>
  );
}

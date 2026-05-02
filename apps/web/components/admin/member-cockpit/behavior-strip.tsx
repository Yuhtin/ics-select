import { KpiCell } from './kpi-cell';
import type { CockpitResponse } from '../../../lib/queries/admin-cockpit';

function fmtRel(occurredAt: string | null): string {
  if (!occurredAt) return '—';
  const days = Math.floor((Date.now() - new Date(occurredAt).getTime()) / 86400000);
  return days === 0 ? 'today' : `${days}d`;
}

function deltaTxt(
  value: number,
  cohort: number,
  unit = '',
): { kind: 'up' | 'down' | 'mute'; text: string } {
  const diff = value - cohort;
  if (diff === 0) return { kind: 'mute', text: `= cohort ${cohort}${unit}` };
  return {
    kind: diff < 0 ? 'down' : 'up',
    text: `${diff < 0 ? '↓' : '↑'} ${Math.abs(diff)}${unit} vs cohort ${cohort}${unit}`,
  };
}

export function BehaviorStrip({ behavior }: { behavior: CockpitResponse['behavior'] }) {
  return (
    <section className="bg-surface border border-rule rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 border-b border-rule">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium">
          Behavior · this cycle
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">
          vs cohort median
        </p>
      </div>
      <div className="grid grid-cols-7 divide-x divide-rule">
        <KpiCell
          label="Sessions"
          value={String(behavior.sessions.value)}
          bars={behavior.sessions.perWeek}
          delta={deltaTxt(behavior.sessions.value, behavior.sessions.cohortMedian)}
        />
        <KpiCell
          label="Days active"
          value={String(behavior.daysActive.value)}
          fraction={`/ ${behavior.daysActive.cycleDays}`}
          bars={behavior.daysActive.perWeek}
          delta={deltaTxt(behavior.daysActive.value, behavior.daysActive.cohortMedian)}
        />
        <KpiCell
          label="Days studying"
          value={String(behavior.daysStudying.value)}
          fraction={`/ ${behavior.daysStudying.cycleDays}`}
          bars={behavior.daysStudying.perWeek}
          delta={deltaTxt(behavior.daysStudying.value, behavior.daysStudying.cohortMedian)}
        />
        <KpiCell
          label="TTFv plan"
          value={`${behavior.timeToFirstView.medianHours}h`}
          delta={deltaTxt(behavior.timeToFirstView.medianHours, behavior.timeToFirstView.cohortMedianHours, 'h')}
        />
        <KpiCell
          label="Retros"
          value={String(behavior.retros.submitted)}
          fraction={`/ ${behavior.retros.expected}`}
          delta={
            behavior.retros.submitted < behavior.retros.expected
              ? { kind: 'down', text: `↓ ${behavior.retros.expected - behavior.retros.submitted} missing` }
              : { kind: 'up', text: 'on time' }
          }
        />
        <KpiCell
          label="Carry-over"
          value={String(behavior.carryOver.value)}
          bars={behavior.carryOver.perWeek}
          delta={deltaTxt(behavior.carryOver.value, behavior.carryOver.cohortMedian)}
        />
        <KpiCell
          label="Last seen"
          value={fmtRel(behavior.lastSeen.occurredAt)}
          delta={{ kind: 'mute', text: behavior.lastSeen.surface ?? '—' }}
        />
      </div>
    </section>
  );
}

'use client';
import { AreaChart } from '@tremor/react';
import type { CockpitResponse } from '../../../lib/queries/admin-cockpit';

export function SessionPatternCard({ behavior }: { behavior: CockpitResponse['behavior'] }) {
  const data = behavior.sessions.perWeek.map((v, i) => ({ week: `W${i + 1}`, sessions: v }));
  const daysSince = behavior.lastSeen.occurredAt
    ? Math.floor((Date.now() - new Date(behavior.lastSeen.occurredAt).getTime()) / 86400000)
    : null;
  const isCold = daysSince !== null && daysSince >= 7;

  return (
    <section className="min-w-0 bg-surface border border-border-token rounded-card p-5 flex flex-col">
      <div className="flex items-baseline justify-between">
        <p className="font-sans text-xs text-fg-mute font-medium">
          Session pattern
        </p>
        {isCold && (
          <p className="font-sans text-xs text-outcome-stuck font-semibold border border-outcome-stuck/40 bg-outcome-stuck/[0.04] rounded-pill px-2 py-0.5">
            {daysSince}d cold
          </p>
        )}
      </div>
      <p className="font-sans text-base text-fg mt-4">
        <span className="font-semibold tabular-nums text-xl">{behavior.sessions.value}</span>{' '}
        <span className="text-fg-mute text-sm">sessions across</span>{' '}
        <span className="font-semibold tabular-nums text-xl">{behavior.daysActive.value}</span>{' '}
        <span className="text-fg-mute text-sm">days</span>
      </p>
      {data.length > 0 && (
        <>
          <AreaChart
            data={data}
            index="week"
            categories={['sessions']}
            colors={['gray']}
            showLegend={false}
            showTooltip={false}
            className="h-20 mt-4"
          />
          <div className="flex items-baseline justify-between mt-2 font-sans text-xs text-fg-mute">
            <span>cycle start</span>
            {behavior.lastSeen.occurredAt && (
              <span className={isCold ? 'text-outcome-stuck' : ''}>last seen {daysSince}d ago</span>
            )}
            <span>now</span>
          </div>
        </>
      )}
    </section>
  );
}

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
    <section className="col-span-4 bg-surface border border-rule rounded-lg p-6 flex flex-col">
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium">
          Session pattern
        </p>
        {isCold && (
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-outcome-stuck font-semibold border border-outcome-stuck/40 bg-outcome-stuck/[0.04] rounded-pill px-2 py-0.5">
            {daysSince}d cold
          </p>
        )}
      </div>
      <p className="font-serif-tool text-base text-ink mt-4">
        <span className="font-semibold tabular-nums text-xl">{behavior.sessions.value}</span>{' '}
        <span className="text-ink-mute text-sm">sessions across</span>{' '}
        <span className="font-semibold tabular-nums text-xl">{behavior.daysActive.value}</span>{' '}
        <span className="text-ink-mute text-sm">days</span>
      </p>
      {data.length > 0 && (
        <>
          <AreaChart
            data={data}
            index="week"
            categories={['sessions']}
            colors={['gray']}
            showLegend={false}
            className="h-20 mt-4"
          />
          <div className="flex items-baseline justify-between mt-2 font-mono text-[10px] text-ink-faint">
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

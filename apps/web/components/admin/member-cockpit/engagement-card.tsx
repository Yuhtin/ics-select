'use client';
import { SparkAreaChart } from '@tremor/react';
import { clsx } from 'clsx';
import type { CockpitResponse } from '../../../lib/queries/admin-cockpit';

type Props = {
  engagement: CockpitResponse['engagement'];
  status: CockpitResponse['risk']['status'];
};

const PILL_BY_STATUS = {
  AT_RISK:  { label: 'AT RISK',  cls: 'text-outcome-stuck border-outcome-stuck/40 bg-outcome-stuck/[0.04]' },
  WATCH:    { label: 'WATCH',    cls: 'text-accent border-accent/40 bg-accent/[0.04]' },
  ON_TRACK: { label: 'ON TRACK', cls: 'text-outcome-done-easy border-outcome-done-easy/40 bg-outcome-done-easy/[0.04]' },
} as const;

export function EngagementCard({ engagement, status }: Props) {
  const pct =
    engagement.cohortMedian === 0
      ? 0
      : Math.round(((engagement.score - engagement.cohortMedian) / engagement.cohortMedian) * 100);
  const pill = PILL_BY_STATUS[status];

  return (
    <section className="col-span-3 bg-surface border border-rule rounded-lg p-6 flex flex-col">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium">
          Engagement
        </p>
        <span
          className={clsx(
            'font-mono text-[10px] uppercase tracking-[0.14em] font-semibold border rounded-pill px-2 py-0.5',
            pill.cls,
          )}
        >
          {pill.label}
        </span>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span
          className="font-serif-tool font-semibold tabular-nums text-ink leading-none"
          style={{ fontSize: 72 }}
        >
          {engagement.score}
        </span>
        <span className="font-serif-tool tabular-nums text-ink-faint text-2xl">/100</span>
      </div>

      <p
        className={clsx(
          'font-mono text-[11px] font-semibold tracking-[0.08em] mt-2',
          pct < 0 ? 'text-outcome-stuck' : 'text-outcome-done-easy',
        )}
      >
        {pct < 0 ? '▼' : '▲'} {Math.abs(pct)}% vs cohort median {engagement.cohortMedian}
      </p>

      <div className="mt-4 space-y-2">
        {engagement.breakdown.slice(0, 4).map((b) => (
          <div key={b.label} className="flex items-center gap-2 text-[12px]">
            <span
              className={clsx(
                'w-1 h-1 rounded-full',
                b.status === 'bad' ? 'bg-outcome-stuck' : b.status === 'warn' ? 'bg-accent' : 'bg-outcome-done-easy',
              )}
            />
            <span className="text-ink-soft">{b.label}</span>
            <span className="ml-auto text-ink tabular-nums font-mono text-[11px]">
              {b.value} / {b.weight}
            </span>
          </div>
        ))}
      </div>

      {engagement.scoreByWeek.length > 0 && (
        <div className="mt-auto pt-4 border-t border-rule">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute mb-1.5">
            Score by week
          </p>
          <SparkAreaChart
            data={engagement.scoreByWeek.map((v, i) => ({ week: `W${i + 1}`, score: v }))}
            categories={['score']}
            index="week"
            colors={['red']}
            className="h-8 w-full"
          />
        </div>
      )}
    </section>
  );
}

'use client';
import { SparkAreaChart } from '@tremor/react';
import { clsx } from 'clsx';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { CockpitResponse } from '../../../lib/queries/admin-cockpit';

type Props = {
  /** Non-null by construction: the parent unmounts this card when range === 'all'. */
  engagement: NonNullable<CockpitResponse['engagement']>;
  status: CockpitResponse['risk']['status'];
};

const PILL_BY_STATUS = {
  AT_RISK:  { label: 'AT RISK', cls: 'border-danger/30 bg-danger-soft', icon: 'text-danger' },
  WATCH:    { label: 'WATCH', cls: 'border-warn/30 bg-warn-soft', icon: 'text-warn' },
  ON_TRACK: { label: 'ON TRACK', cls: 'border-success/30 bg-success-soft', icon: 'text-success' },
} as const;

export function EngagementCard({ engagement, status }: Props) {
  const pct =
    engagement.cohortMedian === 0
      ? 0
      : Math.round(((engagement.score - engagement.cohortMedian) / engagement.cohortMedian) * 100);
  const pill = PILL_BY_STATUS[status];
  const RiskIcon = status === 'ON_TRACK' ? CheckCircle2 : AlertTriangle;

  return (
    <section className="min-w-0 lg:col-span-3 bg-surface border border-border-token rounded-card p-5 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-sans text-xs text-fg-mute font-medium">
          Engagement
        </p>
        <span
          role="status"
          aria-label="Engagement risk"
          className={clsx(
            'inline-flex items-center gap-1.5 font-sans text-xs font-semibold text-fg border rounded-pill px-2 py-1',
            pill.cls,
          )}
        >
          <RiskIcon aria-hidden="true" className={clsx('h-3.5 w-3.5', pill.icon)} strokeWidth={2} />
          {pill.label}
        </span>
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span
          className="font-sans font-semibold tabular-nums text-fg leading-none"
          style={{ fontSize: 52 }}
        >
          {engagement.score}
        </span>
        <span className="font-sans tabular-nums text-fg-mute text-2xl">/100</span>
      </div>

      <p
        className={clsx(
          'font-sans text-xs font-semibold tracking-normal mt-2',
          pct < 0 ? 'text-outcome-stuck' : 'text-outcome-done-easy',
        )}
      >
        {pct < 0 ? '▼' : '▲'} {Math.abs(pct)}% vs cohort median {engagement.cohortMedian}
      </p>

      <div className="mt-4 space-y-2">
        {engagement.breakdown.map((b) => (
          <div key={b.label} className="flex items-center gap-2 text-[12px]">
            <span
              className={clsx(
                'w-1 h-1 rounded-full',
                b.status === 'bad' ? 'bg-outcome-stuck' : b.status === 'warn' ? 'bg-warn' : 'bg-outcome-done-easy',
              )}
            />
            <span className="text-fg-soft">{b.label}</span>
            <span className="ml-auto text-fg tabular-nums font-sans text-xs">
              {b.value} / {b.weight}
            </span>
          </div>
        ))}
      </div>

      {engagement.scoreByWeek.length >= 2 && (
        <div className="mt-auto pt-4 border-t border-border-token">
          <p className="font-sans text-xs text-fg-mute mb-1.5">
            Score by week
          </p>
          <SparkAreaChart
            data={engagement.scoreByWeek.map((v, i) => ({ week: `W${i + 1}`, score: v }))}
            categories={['score']}
            index="week"
            colors={[status === 'AT_RISK' ? 'red' : status === 'WATCH' ? 'amber' : 'emerald']}
            className="h-8 w-full"
          />
        </div>
      )}
    </section>
  );
}

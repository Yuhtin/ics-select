import { BarChart } from '@tremor/react';
import type { CockpitResponse } from '../../../lib/queries/admin-cockpit';

type Props = { itemsCompleted: CockpitResponse['itemsCompleted'] };

const OUTCOME_COLORS = ['emerald', 'amber', 'violet', 'red'] as const;

export function ItemsCompletedCard({ itemsCompleted }: Props) {
  const data = itemsCompleted.perWeek.map((bucket, i) => ({
    week: `W${i + 1}`,
    'Nailed it':     bucket.byOutcome.DONE_EASY ?? 0,
    'Got it (hard)': bucket.byOutcome.DONE_HARD ?? 0,
    'Had doubts':    bucket.byOutcome.DOUBTS ?? 0,
    Stuck:           bucket.byOutcome.STUCK ?? 0,
  }));
  const deltaCohort = itemsCompleted.total - itemsCompleted.cohortMedian;
  // The engagement score's "Plan completion" criterion uses
  //   max(personalRate, itemsDone / cohortMedianPlanned)
  // so members assigned more items than the cohort median aren't punished
  // for the bigger denominator. We surface that here too — when their plan
  // is larger than typical, show the protected (cohort-relative) credit so
  // the admin doesn't read a low personal % as underperformance.
  const oversizedPlan =
    itemsCompleted.cohortMedianPlanned > 0 &&
    itemsCompleted.planned > itemsCompleted.cohortMedianPlanned;

  return (
    <section className="col-span-6 bg-surface border border-rule rounded-lg p-6">
      <div className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium">
            Items completed
          </p>
          <p className="mt-1.5 flex items-baseline gap-3">
            <span
              className="font-serif-tool tabular-nums font-semibold text-ink"
              style={{ fontSize: 48 }}
            >
              {itemsCompleted.total}
            </span>
            <span className="font-serif-tool tabular-nums text-ink-mute text-base">
              of {itemsCompleted.planned} planned
            </span>
          </p>
          {deltaCohort !== 0 && (
            <p className={`font-mono text-[11px] mt-1 ${deltaCohort < 0 ? 'text-outcome-stuck' : 'text-outcome-done-easy'}`}>
              {deltaCohort < 0 ? '↓' : '↑'} {Math.abs(deltaCohort)} items vs cohort median {itemsCompleted.cohortMedian}
            </p>
          )}
          {oversizedPlan && (
            <p className="font-mono text-[11px] mt-1 text-ink-mute">
              Plan size above cohort norm ({itemsCompleted.cohortMedianPlanned}) — engagement score uses cohort-relative rate, not raw %.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_180px] gap-6 mt-4">
        <BarChart
          data={data}
          index="week"
          categories={['Nailed it', 'Got it (hard)', 'Had doubts', 'Stuck']}
          colors={[...OUTCOME_COLORS]}
          stack
          className="h-[200px]"
          showLegend={false}
          showTooltip={false}
        />
        <div className="border-l border-rule pl-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute mb-3">By outcome</p>
          <ul className="space-y-2.5">
            {[
              { label: 'Nailed it',     count: itemsCompleted.byOutcome.DONE_EASY ?? 0, color: 'bg-outcome-done-easy' },
              { label: 'Got it (hard)', count: itemsCompleted.byOutcome.DONE_HARD ?? 0, color: 'bg-outcome-done-hard' },
              { label: 'Had doubts',    count: itemsCompleted.byOutcome.DOUBTS ?? 0,    color: 'bg-outcome-doubts' },
              { label: 'Stuck',         count: itemsCompleted.byOutcome.STUCK ?? 0,     color: 'bg-outcome-stuck' },
            ].map((row) => (
              <li key={row.label} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-sm shrink-0 ${row.color}`} />
                <span className="font-mono text-[11px] text-ink-soft">{row.label}</span>
                <span className="ml-auto font-serif-tool tabular-nums text-ink text-base">{row.count}</span>
              </li>
            ))}
            <li className="border-t border-rule pt-2.5 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-sm bg-outcome-pending shrink-0" />
              <span className="font-mono text-[11px] text-ink-mute">Pending</span>
              <span className="ml-auto font-serif-tool tabular-nums text-ink-mute text-base">
                {itemsCompleted.byOutcome.PENDING ?? 0}
              </span>
            </li>
          </ul>
          {itemsCompleted.needsAttention.total > 0 && (
            <div className="mt-4 pt-3 border-t border-rule">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">Needs attention</p>
              <p className="font-mono text-[11px] text-outcome-stuck font-semibold mt-1">
                {itemsCompleted.needsAttention.total} items · {itemsCompleted.needsAttention.stuck} stuck, {itemsCompleted.needsAttention.doubts} doubts
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

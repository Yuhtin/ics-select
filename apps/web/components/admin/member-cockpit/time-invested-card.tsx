import type { CockpitResponse } from '../../../lib/queries/admin-cockpit';
import { clsx } from 'clsx';

type Props = { timeInvested: CockpitResponse['timeInvested'] };

export function TimeInvestedCard({ timeInvested }: Props) {
  const hours = Math.round(timeInvested.actualMinutes / 60);
  const cohortHours = Math.round(timeInvested.cohortMedianMinutes / 60);
  const scheduledHours = Math.round(timeInvested.scheduledMinutes / 60);
  const completionVsScheduled =
    timeInvested.scheduledMinutes === 0
      ? 0
      : Math.round((timeInvested.actualMinutes / timeInvested.scheduledMinutes) * 100);
  const cohortMarkerPct =
    timeInvested.scheduledMinutes === 0
      ? 0
      : Math.min(100, (timeInvested.cohortMedianMinutes / timeInvested.scheduledMinutes) * 100);
  const deltaPct =
    cohortHours === 0 ? 0 : Math.round(((hours - cohortHours) / cohortHours) * 100);
  // Use 360 minutes (6h) as a sensible weekly target for relative bar heights.
  const target = Math.max(...timeInvested.perWeekMinutes, 360);

  return (
    <section className="col-span-3 bg-surface border border-rule rounded-lg p-6 flex flex-col">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium">
          Time invested
        </p>
        {deltaPct < 0 && (
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-outcome-stuck font-semibold border border-outcome-stuck/40 bg-outcome-stuck/[0.04] rounded-pill px-2 py-0.5">
            Below plan
          </span>
        )}
      </div>

      <div className="mt-4 flex items-baseline gap-1">
        <span
          className="font-serif-tool tabular-nums font-semibold text-ink leading-none"
          style={{ fontSize: 72 }}
        >
          {hours}
        </span>
        <span className="font-serif-tool tabular-nums text-ink-faint text-2xl">h</span>
      </div>
      <p
        className={clsx(
          'mt-2 tracking-[0.08em] uppercase font-semibold text-[11px]',
          deltaPct < 0 ? 'text-outcome-stuck' : 'text-outcome-done-easy',
        )}
      >
        {deltaPct < 0 ? '▼' : '▲'} {Math.abs(deltaPct)}% · cohort {cohortHours}h
      </p>

      <div className="mt-5">
        <div className="flex items-baseline justify-between text-[11px] font-mono mb-2">
          <span className="text-ink-mute uppercase tracking-[0.1em]">Actual / Scheduled</span>
          <span className="text-ink tabular-nums">
            {hours}h / {scheduledHours}h <span className="text-ink-faint">({completionVsScheduled}%)</span>
          </span>
        </div>
        <div className="relative h-3 bg-paper-warm rounded-sm overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-ink"
            style={{ width: `${completionVsScheduled}%` }}
          />
          <div
            className="absolute inset-y-0 w-px bg-ink-mute"
            style={{ left: `${cohortMarkerPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 font-mono text-[10px] text-ink-faint">
          <span>0h</span>
          <span className="tabular-nums">cohort {cohortHours}h →</span>
          <span>scheduled {scheduledHours}h</span>
        </div>
      </div>

      <div className="mt-auto pt-5 border-t border-rule">
        <div className="flex items-center justify-between mb-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-mute">
            Hours per week
          </p>
          <p className="font-mono text-[10px] text-ink-faint">target 6h/wk</p>
        </div>
        <div className="flex items-end gap-1.5 h-12">
          {timeInvested.perWeekMinutes.map((m, i) => {
            const pct = target === 0 ? 0 : (m / target) * 100;
            return (
              <div key={i} className="flex-1 relative h-full">
                <div
                  className={clsx(
                    'absolute bottom-0 inset-x-0 rounded-sm',
                    m === 0 ? 'bg-paper-warm border border-rule' : 'bg-ink-soft',
                  )}
                  style={{ height: `${Math.max(8, pct)}%` }}
                />
              </div>
            );
          })}
        </div>
        {timeInvested.naoSeiCount > 0 && (
          <p className="font-mono text-[10px] text-ink-faint mt-3">
            &ldquo;Não sei&rdquo; marked on {timeInvested.naoSeiCount} item{timeInvested.naoSeiCount === 1 ? '' : 's'}
          </p>
        )}
      </div>
    </section>
  );
}

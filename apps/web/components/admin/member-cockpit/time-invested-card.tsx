import type { CockpitResponse } from '../../../lib/queries/admin-cockpit';
import { clsx } from 'clsx';

type Props = {
  timeInvested: CockpitResponse['timeInvested'];
  weeksTotal: number;
};

// Hero display: just the integer hours. Companion unit shown below ("min" or "h").
function heroValue(min: number): { value: string; unit: string } {
  if (min < 60) return { value: String(min), unit: 'min' };
  return { value: String(Math.round(min / 60)), unit: 'h' };
}

// Compact label for inline use ("12min" / "1h 30m" / "4h").
function fmtCompact(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function TimeInvestedCard({ timeInvested, weeksTotal }: Props) {
  const hero = heroValue(timeInvested.actualMinutes);
  const cohortHours = Math.round(timeInvested.cohortMedianMinutes / 60);
  const scheduledHours = Math.round(timeInvested.scheduledMinutes / 60);
  const hours = Math.round(timeInvested.actualMinutes / 60);
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
    <section className="min-w-0 lg:col-span-3 bg-surface border border-border-token rounded-card p-5 flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-sans text-xs text-fg-mute font-medium">
          Time invested
        </p>
        {deltaPct < 0 && (
          <span className="font-sans text-xs text-outcome-stuck font-semibold border border-outcome-stuck/40 bg-outcome-stuck/[0.04] rounded-pill px-2 py-0.5">
            Below plan
          </span>
        )}
      </div>

      <div className="mt-4 flex items-baseline gap-1">
        <span
          className="font-sans tabular-nums font-semibold text-fg leading-none"
          style={{ fontSize: 52 }}
        >
          {hero.value}
        </span>
        <span className="font-sans tabular-nums text-fg-mute text-2xl">{hero.unit}</span>
      </div>
      <p
        className={clsx(
          'mt-2 tracking-normal font-semibold text-xs',
          deltaPct < 0 ? 'text-outcome-stuck' : 'text-outcome-done-easy',
        )}
      >
        {deltaPct < 0 ? '▼' : '▲'} {Math.abs(deltaPct)}% · cohort {cohortHours}h
      </p>

      <div className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-1 text-xs font-sans mb-2">
          <span className="text-fg-mute ">Actual / Scheduled</span>
          <span className="text-fg tabular-nums">
            {fmtCompact(timeInvested.actualMinutes)} / {fmtCompact(timeInvested.scheduledMinutes)} <span className="text-fg-mute">({completionVsScheduled}%)</span>
          </span>
        </div>
        <div className="relative h-3 bg-bg-subtle rounded-sm overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-ink"
            style={{ width: `${completionVsScheduled}%` }}
          />
          <div
            className="absolute inset-y-0 w-px bg-fg-mute"
            style={{ left: `${cohortMarkerPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 font-sans text-xs text-fg-mute">
          <span>0h</span>
          <span className="tabular-nums">cohort {cohortHours}h →</span>
          <span>scheduled {scheduledHours}h</span>
        </div>
      </div>

      <div className="mt-auto pt-5 border-t border-border-token">
        <div className="flex items-center justify-between mb-2">
          <p className="font-sans text-xs text-fg-mute">
            Hours per week
          </p>
          <p className="font-sans text-xs text-fg-mute">target 6h/wk</p>
        </div>
        <div className="flex items-end gap-1.5 h-12">
          {Array.from({ length: weeksTotal }).map((_, i) => {
            const m = timeInvested.perWeekMinutes[i] ?? 0;
            const elapsed = i < timeInvested.perWeekMinutes.length;
            const pct = target === 0 ? 0 : (m / target) * 100;
            return (
              <div key={i} className="flex-1 relative h-full">
                <div
                  className={clsx(
                    'absolute bottom-0 inset-x-0 rounded-sm',
                    !elapsed
                      ? 'bg-bg-subtle border border-border-token border-dashed opacity-40'
                      : m === 0
                        ? 'bg-bg-subtle border border-border-token'
                        : 'bg-fg-soft',
                  )}
                  style={{ height: `${Math.max(8, pct)}%` }}
                />
              </div>
            );
          })}
        </div>
        {timeInvested.naoSeiCount > 0 && (
          <p className="font-sans text-xs text-fg-mute mt-3">
            &ldquo;Não sei&rdquo; marked on {timeInvested.naoSeiCount} item{timeInvested.naoSeiCount === 1 ? '' : 's'}
          </p>
        )}
      </div>
    </section>
  );
}

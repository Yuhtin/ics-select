import type { CockpitResponse } from '../../../lib/queries/admin-cockpit';
import { clsx } from 'clsx';

function fmtH(min: number): string {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function fmtTotal(min: number): string {
  if (min < 60) return `${min}min`;
  return `${Math.floor(min / 60)}h`;
}

export function TopicEngagementTable({ topics }: { topics: CockpitResponse['topicEngagement'] }) {
  const totalMin = topics.reduce((s, t) => s + t.minutes, 0);
  const totalHours = fmtTotal(totalMin);
  const touched = topics.filter((t) => t.minutes > 0).length;
  const untouched = topics.length - touched;
  const strongest = [...topics].sort((a, b) => b.minutes - a.minutes)[0];
  const concentrationPct =
    strongest && totalMin > 0 ? Math.round((strongest.minutes / totalMin) * 100) : 0;

  return (
    <section className="min-w-0 lg:col-span-8 bg-surface border border-border-token rounded-card p-5 flex flex-col">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <p className="font-sans text-xs text-fg-mute font-medium">
            Topic engagement
          </p>
          <p className="font-sans text-base text-fg mt-0.5">
            <span className="font-semibold tabular-nums text-xl">{totalHours}</span>
            <span className="text-fg-mute text-sm"> across </span>
            <span className="font-semibold tabular-nums text-xl">{touched}</span>
            <span className="text-fg-mute text-sm"> of </span>
            <span className="font-semibold tabular-nums text-xl">{topics.length}</span>
            <span className="text-fg-mute text-sm">
              {' '}active topics{untouched > 0 && <> · </>}
            </span>
            {untouched > 0 && (
              <span className="text-outcome-stuck text-sm font-medium">{untouched} untouched</span>
            )}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[600px] grid grid-cols-[160px_1fr_72px_72px_72px] items-center gap-4 pb-2 border-b border-border-token">
          <span className="font-sans text-xs text-fg-mute">
            Topic
          </span>
          <span className="font-sans text-xs text-fg-mute">
            Time invested
          </span>
          <span className="font-sans text-xs text-fg-mute text-right">
            Hours
          </span>
          <span className="font-sans text-xs text-fg-mute text-right">
            Items
          </span>
          <span className="font-sans text-xs text-fg-mute text-right">
            vs cohort
          </span>
        </div>

        <div className="min-w-[600px] divide-y divide-border-token">
          {topics.filter((t) => t.minutes > 0).map((t) => {
            const isUntouched = t.minutes === 0;
            const pct = totalMin === 0 ? 0 : Math.round((t.minutes / totalMin) * 100);
            const cohortDeltaMin = t.minutes - t.cohortMedianMinutes;
            return (
              <div
                key={t.topicId}
                className={clsx(
                  'grid grid-cols-[160px_1fr_72px_72px_72px] items-center gap-4 py-3',
                  isUntouched && 'bg-outcome-stuck/[0.025] -mx-2 px-2 rounded',
                )}
              >
                <span
                  className={clsx(
                    'font-sans text-[12px] truncate',
                    isUntouched ? 'text-fg-mute' : 'text-fg-soft',
                  )}
                >
                  {t.label}
                </span>
                <div
                  className={clsx(
                    'h-5 bg-bg-subtle rounded-sm overflow-hidden relative',
                    isUntouched && 'border border-outcome-stuck/20 border-dashed',
                  )}
                >
                  {!isUntouched && (
                    <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
                  )}
                  {isUntouched && (
                    <span className="absolute top-1/2 -translate-y-1/2 left-2 font-sans text-xs text-outcome-stuck/80 font-semibold">
                      Never opened
                    </span>
                  )}
                  {!isUntouched && (
                    <span
                      className={clsx(
                        'absolute top-1/2 -translate-y-1/2 font-sans text-xs font-semibold',
                        pct > 30 ? 'text-paper' : 'text-fg-soft',
                      )}
                      style={pct > 30 ? { left: '0.5rem' } : { left: `calc(${pct}% + 6px)` }}
                    >
                      {pct}%
                    </span>
                  )}
                </div>
                <span className="font-sans tabular-nums text-fg text-sm text-right">
                  {isUntouched ? '—' : fmtH(t.minutes)}
                </span>
                <span
                  className={clsx(
                    'font-sans tabular-nums text-sm text-right',
                    isUntouched ? 'text-outcome-stuck' : 'text-fg',
                  )}
                >
                  {t.itemsDone} / {t.itemsPlanned}
                </span>
                <span
                  className={clsx(
                    'font-sans text-xs tabular-nums text-right',
                    cohortDeltaMin < 0 ? 'text-outcome-stuck' : 'text-fg-mute',
                  )}
                >
                  {cohortDeltaMin === 0
                    ? 'par'
                    : `${cohortDeltaMin < 0 ? '↓' : '↑'} ${Math.abs(Math.round(cohortDeltaMin / 60))}h`}
                </span>
              </div>
            );
          })}
        </div>

      </div>
      {strongest && (
        <div className="mt-5 pt-4 border-t border-border-token grid grid-cols-1 sm:grid-cols-3 gap-4 font-sans text-xs">
          <div>
            <p className="font-sans text-xs text-fg-mute font-medium">
              Strongest
            </p>
            <p className="text-fg mt-1">
              <span className="font-sans tabular-nums text-base">{fmtH(strongest.minutes)}</span> on {strongest.label}
            </p>
          </div>
          <div>
            <p className="font-sans text-xs text-fg-mute font-medium">
              Concentration risk
            </p>
            <p className={clsx('mt-1', concentrationPct >= 50 ? 'text-outcome-stuck' : 'text-fg')}>
              <span className="font-sans tabular-nums text-base">{concentrationPct}%</span> on 1 topic
            </p>
          </div>
          <div>
            <p className="font-sans text-xs text-fg-mute font-medium">
              Cohort baseline
            </p>
            <p className="text-fg-mute mt-1">spreads across 5–6</p>
          </div>
        </div>
      )}
    </section>
  );
}

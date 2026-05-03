import type { CockpitResponse } from '../../../lib/queries/admin-cockpit';
import { clsx } from 'clsx';

function fmtH(min: number): string {
  return `${Math.floor(min / 60)}h`;
}

export function TopicEngagementTable({ topics }: { topics: CockpitResponse['topicEngagement'] }) {
  const totalMin = topics.reduce((s, t) => s + t.minutes, 0);
  const totalHours = Math.floor(totalMin / 60);
  const touched = topics.filter((t) => t.minutes > 0).length;
  const untouched = topics.length - touched;
  const strongest = [...topics].sort((a, b) => b.minutes - a.minutes)[0];
  const concentrationPct =
    strongest && totalMin > 0 ? Math.round((strongest.minutes / totalMin) * 100) : 0;

  return (
    <section className="col-span-8 bg-surface border border-rule rounded-lg p-6 flex flex-col">
      <div className="flex items-baseline justify-between mb-5">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium">
            Topic engagement
          </p>
          <p className="font-serif-tool text-base text-ink mt-0.5">
            <span className="font-semibold tabular-nums text-xl">{totalHours}h</span>
            <span className="text-ink-mute text-sm"> across </span>
            <span className="font-semibold tabular-nums text-xl">{touched}</span>
            <span className="text-ink-mute text-sm"> of </span>
            <span className="font-semibold tabular-nums text-xl">{topics.length}</span>
            <span className="text-ink-mute text-sm">
              {' '}active topics{untouched > 0 && <> · </>}
            </span>
            {untouched > 0 && (
              <span className="text-stuck text-sm font-medium">{untouched} untouched</span>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[160px_1fr_72px_72px_72px] items-center gap-4 pb-2 border-b border-rule">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
          Topic
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute">
          Time invested
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute text-right">
          Hours
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute text-right">
          Items
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-mute text-right">
          vs cohort
        </span>
      </div>

      <div className="divide-y divide-rule">
        {topics.map((t) => {
          const isUntouched = t.minutes === 0;
          const pct = totalMin === 0 ? 0 : Math.round((t.minutes / totalMin) * 100);
          const cohortDeltaMin = t.minutes - t.cohortMedianMinutes;
          return (
            <div
              key={t.topicId}
              className={clsx(
                'grid grid-cols-[160px_1fr_72px_72px_72px] items-center gap-4 py-3',
                isUntouched && 'bg-stuck/[0.025] -mx-2 px-2 rounded',
              )}
            >
              <span
                className={clsx(
                  'font-mono text-[12px] uppercase tracking-[0.06em] truncate',
                  isUntouched ? 'text-ink-faint' : 'text-ink-soft',
                )}
              >
                {t.label}
              </span>
              <div
                className={clsx(
                  'h-5 bg-paper-warm rounded-sm overflow-hidden relative',
                  isUntouched && 'border border-stuck/20 border-dashed',
                )}
              >
                {!isUntouched && (
                  <div className="h-full bg-ink" style={{ width: `${pct}%` }} />
                )}
                {isUntouched && (
                  <span className="absolute top-1/2 -translate-y-1/2 left-2 font-mono text-[10px] text-stuck/80 uppercase tracking-[0.1em] font-semibold">
                    Never opened
                  </span>
                )}
                {!isUntouched && (
                  <span
                    className={clsx(
                      'absolute top-1/2 -translate-y-1/2 font-mono text-[10px] font-semibold',
                      pct > 30 ? 'text-paper' : 'text-ink-soft',
                    )}
                    style={pct > 30 ? { left: '0.5rem' } : { left: `calc(${pct}% + 6px)` }}
                  >
                    {pct}%
                  </span>
                )}
              </div>
              <span className="font-serif-tool tabular-nums text-ink text-sm text-right">
                {isUntouched ? '—' : fmtH(t.minutes)}
              </span>
              <span
                className={clsx(
                  'font-serif-tool tabular-nums text-sm text-right',
                  isUntouched ? 'text-stuck' : 'text-ink',
                )}
              >
                {t.itemsDone} / {t.itemsPlanned}
              </span>
              <span
                className={clsx(
                  'font-mono text-[11px] tabular-nums text-right',
                  cohortDeltaMin < 0 ? 'text-stuck' : 'text-ink-mute',
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

      {strongest && (
        <div className="mt-auto pt-4 border-t border-rule grid grid-cols-3 gap-4 font-mono text-[11px]">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium">
              Strongest
            </p>
            <p className="text-ink mt-1">
              <span className="font-serif-tool tabular-nums text-base">{fmtH(strongest.minutes)}</span> on {strongest.label}
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium">
              Concentration risk
            </p>
            <p className={clsx('mt-1', concentrationPct >= 50 ? 'text-stuck' : 'text-ink')}>
              <span className="font-serif-tool tabular-nums text-base">{concentrationPct}%</span> on 1 topic
            </p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-mute font-medium">
              Cohort baseline
            </p>
            <p className="text-ink-mute mt-1">spreads across 5–6</p>
          </div>
        </div>
      )}
    </section>
  );
}

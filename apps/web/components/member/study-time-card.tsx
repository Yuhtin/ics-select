import { clsx } from 'clsx';
import type { StudyTimeSummary } from '../../lib/queries/me-home';
import { formatMinutes } from '../../lib/format/time';

interface StudyTimeCardProps {
  studyTime: StudyTimeSummary;
  className?: string;
}

const OVERRUN_RATIO = 1.2;

export function StudyTimeCard({ studyTime, className }: StudyTimeCardProps) {
  const { actualMinutes, estimatedMinutes, itemsWithTime, itemsTotal } = studyTime;

  const pct =
    estimatedMinutes === 0
      ? 0
      : Math.min(150, Math.round((actualMinutes / estimatedMinutes) * 100));
  const overrun = estimatedMinutes > 0 && actualMinutes > estimatedMinutes * OVERRUN_RATIO;
  const barWidth = Math.min(100, pct);

  return (
    <section className={clsx('rounded-tile border border-border-token bg-surface p-6', className)}>
      <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute">
        Study time this week
      </p>

      <p className="mt-2 font-sans text-[42px] font-semibold leading-none tracking-tight tabular-nums text-fg">
        {formatMinutes(actualMinutes) || '0 min'}
      </p>
      <p className="mt-1 font-mono text-[11px] tabular-nums text-fg-mute">
        of {formatMinutes(estimatedMinutes) || '—'} estimated
      </p>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-sm bg-bg-subtle">
        <div
          className={clsx(
            'h-full transition-[width]',
            overrun ? 'bg-reflect' : 'bg-fg',
          )}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute tabular-nums">
        {pct}% · {itemsWithTime}/{itemsTotal} item{itemsTotal === 1 ? '' : 's'} tracked
      </p>

      {overrun && (
        <p className="mt-3 font-sans text-[11px] text-reflect">
          Taking longer than estimated. The program director sees this.
        </p>
      )}
    </section>
  );
}

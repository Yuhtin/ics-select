import { clsx } from 'clsx';
import type { StudyTimeSummary } from '../../lib/queries/me-home';
import { formatMinutes } from '../../lib/format/time';

interface StudyTimeCardProps {
  studyTime: StudyTimeSummary;
  presentation?: 'card' | 'context';
  className?: string;
}

const OVERRUN_RATIO = 1.2;

const PRESENTATION = {
  card: 'rounded-tile border border-border-token bg-surface p-6',
  context: 'py-5 first:pt-0 last:pb-0',
} as const;

export function StudyTimeCard({ studyTime, presentation = 'card', className }: StudyTimeCardProps) {
  const { actualMinutes, estimatedMinutes, itemsWithTime, itemsTotal } = studyTime;

  const pct =
    estimatedMinutes === 0
      ? 0
      : Math.min(150, Math.round((actualMinutes / estimatedMinutes) * 100));
  const overrun = estimatedMinutes > 0 && actualMinutes > estimatedMinutes * OVERRUN_RATIO;
  const barWidth = Math.min(100, pct);

  return (
    <section className={clsx(PRESENTATION[presentation], className)}>
      <p className="font-sans text-xs font-medium text-fg-mute">
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
            overrun ? 'bg-reflect' : 'bg-primary',
          )}
          style={{ width: `${barWidth}%` }}
        />
      </div>
      <p className="mt-2 font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute tabular-nums">
        {pct}% · {itemsWithTime}/{itemsTotal} item{itemsTotal === 1 ? '' : 's'} tracked
      </p>

      {overrun && (
        <p className="mt-3 font-sans text-xs leading-relaxed text-fg-soft">
          Taking longer than estimated. The program director sees this.
        </p>
      )}
    </section>
  );
}

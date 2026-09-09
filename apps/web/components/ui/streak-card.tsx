import { clsx } from 'clsx';

interface StreakCardProps {
  /** Current streak in days. */
  current: number;
  /** Last 7 days — true if the day had a positive outcome. Oldest first. */
  last7: boolean[];
  className?: string;
}

function milestone(current: number): string | null {
  if (current >= 30) return 'Milestone · 30d';
  if (current >= 14) return '2-week milestone';
  if (current >= 7) return '1-week streak';
  return null;
}

export function StreakCard({ current, last7, className }: StreakCardProps) {
  const milestoneLabel = milestone(current);
  const todayIdx = last7.length - 1;
  return (
    <section className={clsx('rounded-card border border-border-token bg-surface p-6', className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-sans text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute">
          Streak
        </p>
        {milestoneLabel && (
          <span className="inline-flex min-h-5 items-center rounded-pill bg-success-soft px-2 font-sans text-[10px] font-medium text-fg">
            {milestoneLabel}
          </span>
        )}
      </div>
      <p className="mt-2 font-mono text-[42px] font-semibold leading-none tracking-tight tabular-nums text-fg">
        {current} <span className="font-sans text-sm font-medium text-fg-mute">days</span>
      </p>
      <div className="mt-4 flex gap-1.5" aria-label="last 7 days">
        {last7.map((on, i) => {
          const isToday = i === todayIdx;
          return (
            <span
              key={i}
              className={clsx(
                'h-[6px] w-[22px] rounded-sm',
                isToday
                  ? 'bg-primary ring-2 ring-primary/35 ring-offset-2 ring-offset-bg'
                  : on
                    ? 'bg-success'
                    : 'bg-surface-strong',
              )}
            />
          );
        })}
      </div>
      <p className="mt-3 font-sans text-[10px] uppercase tracking-eyebrow text-fg-mute">
        S · M · T · W · T · F · S
      </p>
    </section>
  );
}

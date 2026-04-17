import { clsx } from 'clsx';

interface StreakCardProps {
  /** Current streak in days. */
  current: number;
  /** Last 7 days — true if the day had a positive outcome. Oldest first. */
  last7: boolean[];
  className?: string;
}

function milestone(current: number): { label: string | null; tone: 'neutral' | 'success' | 'reflect' | 'primary' } {
  if (current >= 30) return { label: 'Milestone · 30d', tone: 'primary' };
  if (current >= 14) return { label: '2-week milestone', tone: 'reflect' };
  if (current >= 7) return { label: '1-week streak', tone: 'success' };
  return { label: null, tone: 'neutral' };
}

const TONE_LABEL_CLASS: Record<'success' | 'reflect' | 'primary' | 'neutral', string> = {
  success: 'bg-success-soft text-success',
  reflect: 'bg-reflect-soft text-reflect',
  primary: 'bg-primary-soft text-primary',
  neutral: 'bg-bg-subtle text-fg-mute',
};

const TONE_NUM_CLASS: Record<'success' | 'reflect' | 'primary' | 'neutral', string> = {
  success: 'text-success',
  reflect: 'text-reflect',
  primary: 'text-primary',
  neutral: 'text-fg',
};

export function StreakCard({ current, last7, className }: StreakCardProps) {
  const tone = milestone(current);
  const todayIdx = last7.length - 1;
  return (
    <section className={clsx('rounded-tile border border-border-token bg-surface p-6', className)}>
      <div className="flex items-baseline justify-between">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute">
          Streak
        </p>
        {tone.label && (
          <span
            className={clsx(
              'inline-flex h-[18px] items-center rounded-pill px-2 font-mono text-[10px] font-medium',
              TONE_LABEL_CLASS[tone.tone],
            )}
          >
            {tone.label}
          </span>
        )}
      </div>
      <p
        className={clsx(
          'mt-2 font-sans text-[42px] font-semibold leading-none tracking-tight tabular-nums',
          TONE_NUM_CLASS[tone.tone],
        )}
      >
        {current} <span className="text-sm font-medium text-fg-faint">days</span>
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
                  ? 'bg-primary shadow-[0_0_0_2px_hsl(var(--primary)/0.25)]'
                  : on
                    ? 'bg-success'
                    : 'bg-bg-subtle',
              )}
            />
          );
        })}
      </div>
      <p className="mt-3 font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">
        S · M · T · W · T · F · S
      </p>
    </section>
  );
}

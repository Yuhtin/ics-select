import { clsx } from 'clsx';
import { Card } from './card';
import { SectionLabel } from './section-label';

interface StreakCardProps {
  /** Current streak in days. */
  current: number;
  /** Last 7 days — true if the day had a positive outcome. Oldest first. */
  last7: boolean[];
  className?: string;
}

export function StreakCard({ current, last7, className }: StreakCardProps) {
  return (
    <Card tone="surface" className={clsx('p-5', className)}>
      <SectionLabel>Day streak</SectionLabel>
      <p className="font-serif text-[56px] font-medium leading-none tabular-nums">{current}</p>
      <div className="mt-4 flex items-center gap-1.5" aria-label="last 7 days">
        {last7.map((on, i) => (
          <span
            key={i}
            className={clsx(
              'h-2 w-2 rounded-full',
              on ? 'bg-ink' : 'bg-rule',
            )}
          />
        ))}
      </div>
    </Card>
  );
}

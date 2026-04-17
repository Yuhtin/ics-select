import { clsx } from 'clsx';

export type SegmentState = 'pending' | 'done' | 'hard' | 'now' | 'stuck' | 'doubts';

interface SegmentedProgressProps {
  segments: SegmentState[];
  className?: string;
}

const SEG_CLASS: Record<SegmentState, string> = {
  pending: 'bg-bg-subtle',
  done: 'bg-success',
  hard: 'bg-warn',
  now: 'bg-primary ring-2 ring-primary/35 ring-offset-2 ring-offset-surface',
  stuck: 'bg-danger',
  doubts: 'bg-outcome-doubts',
};

export function SegmentedProgress({ segments, className }: SegmentedProgressProps) {
  if (segments.length === 0) {
    return null;
  }
  return (
    <div className={clsx('flex gap-1', className)}>
      {segments.map((state, idx) => (
        <span
          key={idx}
          className={clsx('h-1.5 flex-1 rounded-sm transition-colors', SEG_CLASS[state])}
        />
      ))}
    </div>
  );
}

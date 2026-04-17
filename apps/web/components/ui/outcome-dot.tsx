import { clsx } from 'clsx';
import type { ItemOutcome } from '@ics-select/shared';

interface OutcomeDotProps {
  outcome: ItemOutcome;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Pulse ring around the dot (for "now" / active). */
  active?: boolean;
}

const SIZE_CLASS: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'w-2 h-2',
  md: 'w-2.5 h-2.5',
  lg: 'w-3 h-3',
};

const OUTCOME_CLASS: Record<ItemOutcome, string> = {
  PENDING: 'bg-outcome-pending',
  DONE_EASY: 'bg-outcome-done-easy',
  DONE_HARD: 'bg-outcome-done-hard',
  DOUBTS: 'bg-outcome-doubts',
  STUCK: 'bg-outcome-stuck',
};

export function OutcomeDot({ outcome, size = 'md', active, className }: OutcomeDotProps) {
  return (
    <span
      className={clsx(
        'inline-block rounded-full',
        SIZE_CLASS[size],
        OUTCOME_CLASS[outcome],
        active && 'ring-2 ring-rule ring-offset-1 ring-offset-paper',
        className,
      )}
      aria-label={`outcome ${outcome.toLowerCase()}`}
    />
  );
}

'use client';

import { clsx } from 'clsx';
import type { ItemOutcome } from '@ics-select/shared';
import { OutcomeDot } from './outcome-dot';

interface OutcomePickerProps {
  value: ItemOutcome | null;
  onChange: (outcome: ItemOutcome) => void;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
  showSkip?: boolean;
}

const OPTIONS: Array<{ outcome: ItemOutcome; label: string }> = [
  { outcome: 'DONE_EASY', label: 'Nailed it' },
  { outcome: 'DONE_HARD', label: 'Got it (hard)' },
  { outcome: 'DOUBTS', label: 'Had doubts' },
  { outcome: 'STUCK', label: 'Stuck' },
  { outcome: 'PENDING', label: 'Not yet' },
];

export function OutcomePicker({
  value,
  onChange,
  disabled,
  disabledReason,
  className,
  showSkip = false,
}: OutcomePickerProps) {
  return (
    <div className={clsx('space-y-2', className)}>
      <div className="flex flex-wrap gap-2 p-1 md:flex-nowrap md:overflow-x-auto">
        {OPTIONS.map(({ outcome, label }) => {
          const selected = value === outcome;
          return (
            <button
              key={outcome}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onChange(outcome)}
              className={clsx(
                'inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-pill border px-3 py-2 font-sans text-xs font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
                selected
                  ? 'bg-primary-soft text-fg border-primary'
                  : 'bg-surface text-fg border-border-token hover:bg-surface-hover',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <OutcomeDot outcome={outcome} size="sm" />
              <span>{label}</span>
            </button>
          );
        })}
        {showSkip && (
          <button
            type="button"
            disabled={disabled}
            aria-pressed={value === 'SKIPPED'}
            onClick={() => onChange('SKIPPED')}
            className={clsx(
              'inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-pill border px-3 py-2 font-sans text-xs font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
              value === 'SKIPPED'
                ? 'bg-primary-soft text-fg border-primary'
                : 'bg-surface text-fg-soft border-border-token hover:bg-surface-hover',
              disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <OutcomeDot outcome="SKIPPED" size="sm" />
            <span>Already known</span>
          </button>
        )}
      </div>
      {disabled && disabledReason && (
        <p className="text-xs text-fg-mute">{disabledReason}</p>
      )}
    </div>
  );
}

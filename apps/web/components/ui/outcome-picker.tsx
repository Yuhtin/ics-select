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
      <div className="flex flex-wrap gap-2 md:flex-nowrap md:overflow-x-auto">
        {OPTIONS.map(({ outcome, label }) => {
          const selected = value === outcome;
          return (
            <button
              key={outcome}
              type="button"
              disabled={disabled}
              onClick={() => onChange(outcome)}
              className={clsx(
                'inline-flex items-center gap-2 rounded-pill border px-3 py-2 text-xs font-semibold transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
                selected
                  ? 'bg-ink text-paper border-ink'
                  : 'bg-paper text-ink border-rule hover:bg-paper-warm',
                disabled && 'opacity-50 cursor-not-allowed hover:bg-paper',
              )}
            >
              <OutcomeDot outcome={outcome} size="sm" className={clsx(selected && 'ring-paper')} />
              <span>{label}</span>
            </button>
          );
        })}
        {showSkip && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange('SKIPPED')}
            className={clsx(
              'inline-flex items-center gap-2 rounded-pill border px-3 py-2 text-xs font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper',
              value === 'SKIPPED'
                ? 'bg-ink text-paper border-ink'
                : 'bg-paper text-ink-soft border-rule hover:bg-paper-warm',
              disabled && 'opacity-50 cursor-not-allowed hover:bg-paper',
            )}
          >
            <OutcomeDot outcome="SKIPPED" size="sm" className={clsx(value === 'SKIPPED' && 'ring-paper')} />
            <span>Already known</span>
          </button>
        )}
      </div>
      {disabled && disabledReason && (
        <p className="text-xs text-ink-mute">{disabledReason}</p>
      )}
    </div>
  );
}

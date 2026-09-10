'use client';

import { clsx } from 'clsx';
import { Check } from 'lucide-react';
import type { ItemOutcome } from '@ics-select/shared';
import { OutcomeDot } from './outcome-dot';

interface OutcomePickerProps {
  value: ItemOutcome | null;
  onChange: (outcome: ItemOutcome) => void;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
  showSkip?: boolean;
  presentation?: 'compact' | 'guided';
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
  presentation = 'compact',
}: OutcomePickerProps) {
  if (presentation === 'guided') {
    const options = showSkip ? [...OPTIONS, { outcome: 'SKIPPED' as const, label: 'Already known' }] : OPTIONS;
    return (
      <div className={className}>
        <div className="divide-y divide-border-token border-y border-border-token">
          {options.map(({ outcome, label }) => {
            const selected = value === outcome;
            return (
              <button
                key={outcome}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => onChange(outcome)}
                className={clsx(
                  'flex min-h-14 w-full items-center gap-3 px-3 py-3 text-left font-sans text-base outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                  selected ? 'bg-primary-soft font-semibold text-fg' : 'text-fg-soft hover:bg-surface-hover',
                  disabled && 'cursor-not-allowed opacity-50',
                )}
              >
                <span aria-hidden><OutcomeDot outcome={outcome} size="sm" /></span>
                <span className="flex-1">{label}</span>
                {selected && <Check aria-hidden className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.5} />}
              </button>
            );
          })}
        </div>
        {disabled && disabledReason && <p className="mt-2 text-xs text-fg-mute">{disabledReason}</p>}
      </div>
    );
  }
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

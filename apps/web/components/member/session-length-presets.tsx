'use client';
import { clsx } from 'clsx';

const SESSION_PRESETS = [15, 30, 45, 60, 90];

interface Props {
  value: number;
  onChange: (next: number) => void;
}

export function SessionLengthPresets({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {SESSION_PRESETS.map((mins) => {
        const active = value === mins;
        return (
          <button
            key={mins}
            type="button"
            onClick={() => onChange(mins)}
            className={clsx(
              'rounded-pill border px-3 py-1.5 font-mono text-[12px] font-semibold transition-colors',
              active
                ? 'border-primary bg-primary text-primary-fg'
                : 'border-border-token bg-surface text-fg-soft hover:border-border-strong hover:text-fg',
            )}
          >
            {mins} min
          </button>
        );
      })}
    </div>
  );
}

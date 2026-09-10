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
            aria-pressed={active}
            className={clsx(
              'min-h-11 rounded-input border px-3 font-mono text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
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

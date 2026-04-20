'use client';
import { clsx } from 'clsx';

export type DayKey =
  | 'mondayMinutes'
  | 'tuesdayMinutes'
  | 'wednesdayMinutes'
  | 'thursdayMinutes'
  | 'fridayMinutes'
  | 'saturdayMinutes'
  | 'sundayMinutes';

export type AvailabilityMinutes = Record<DayKey, number>;

const DAYS: Array<{ key: DayKey; short: string }> = [
  { key: 'mondayMinutes', short: 'Mon' },
  { key: 'tuesdayMinutes', short: 'Tue' },
  { key: 'wednesdayMinutes', short: 'Wed' },
  { key: 'thursdayMinutes', short: 'Thu' },
  { key: 'fridayMinutes', short: 'Fri' },
  { key: 'saturdayMinutes', short: 'Sat' },
  { key: 'sundayMinutes', short: 'Sun' },
];

const MINUTE_PRESETS = [0, 30, 60, 90, 120, 180];

interface Props {
  value: AvailabilityMinutes;
  onChange: (next: AvailabilityMinutes) => void;
}

export function AvailabilityPresets({ value, onChange }: Props) {
  return (
    <div className="space-y-2.5">
      {DAYS.map((d) => (
        <div
          key={d.key}
          className="flex items-center gap-3 rounded-input border border-border-token bg-surface px-3 py-2"
        >
          <span className="w-14 font-mono text-[11px] font-semibold uppercase tracking-eyebrow text-fg-mute">
            {d.short}
          </span>
          <div className="flex flex-1 flex-wrap gap-1.5">
            {MINUTE_PRESETS.map((mins) => {
              const active = value[d.key] === mins;
              return (
                <button
                  key={mins}
                  type="button"
                  onClick={() => onChange({ ...value, [d.key]: mins })}
                  className={clsx(
                    'rounded-pill border px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-fg'
                      : 'border-border-token bg-surface text-fg-soft hover:border-border-strong hover:text-fg',
                  )}
                >
                  {mins === 0 ? 'off' : `${mins}m`}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

'use client';
import { clsx } from 'clsx';
import { Check } from 'lucide-react';
import { TRACKS } from '@ics-select/shared';

const TRACK_LABELS: Record<string, string> = {
  BIG_TECH: 'Big Tech',
  CONSULTING_TECH: 'Consulting Tech',
  COMPETITIVE_PROGRAMMING: 'Competitive Programming',
  STARTUP: 'Startup',
  OTHER: 'Other',
};

const TRACK_DESCRIPTIONS: Record<string, string> = {
  BIG_TECH: 'Google, Meta, Amazon, Microsoft. Algorithms and system design.',
  CONSULTING_TECH: 'McKinsey Tech, BCG GAMMA. Case-style technical interviews.',
  COMPETITIVE_PROGRAMMING: 'ACM ICPC, IOI. Competitive patterns, tight problem sets.',
  STARTUP: 'High-agency engineering. Ship fast, reason from first principles.',
  OTHER: "I'll sort the specifics with the director.",
};

interface TrackPickerProps {
  value: string;
  onChange: (next: string) => void;
}

export function TrackPicker({ value, onChange }: TrackPickerProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {TRACKS.map((t) => {
        const active = value === t;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={clsx(
              'group relative flex h-full flex-col items-start gap-1.5 rounded-tile border px-4 py-3.5 text-left transition-all',
              active
                ? 'border-primary bg-primary-soft ring-2 ring-primary/30'
                : 'border-border-token bg-surface hover:-translate-y-[1px] hover:border-border-strong',
            )}
          >
            <span
              className={clsx(
                'font-sans text-sm font-semibold',
                active ? 'text-primary' : 'text-fg',
              )}
            >
              {TRACK_LABELS[t] ?? t}
            </span>
            <span className="font-sans text-[13px] leading-relaxed text-fg-soft">
              {TRACK_DESCRIPTIONS[t]}
            </span>
            {active && (
              <span
                className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-fg"
                aria-hidden
              >
                <Check className="h-3 w-3" strokeWidth={2.5} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

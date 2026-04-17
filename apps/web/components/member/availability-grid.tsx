'use client';

import { useState } from 'react';
import type { AvailabilityResponse } from '../../lib/queries/me-settings';
import { useUpdateAvailability } from '../../lib/queries/me-settings';
import { SectionLabel } from '../ui/section-label';
import { Button } from '../ui/button';

const DAYS: { key: keyof AvailabilityResponse; label: string }[] = [
  { key: 'mondayMinutes', label: 'Monday' },
  { key: 'tuesdayMinutes', label: 'Tuesday' },
  { key: 'wednesdayMinutes', label: 'Wednesday' },
  { key: 'thursdayMinutes', label: 'Thursday' },
  { key: 'fridayMinutes', label: 'Friday' },
  { key: 'saturdayMinutes', label: 'Saturday' },
  { key: 'sundayMinutes', label: 'Sunday' },
];

const DEFAULTS: AvailabilityResponse = {
  mondayMinutes: 0,
  tuesdayMinutes: 0,
  wednesdayMinutes: 0,
  thursdayMinutes: 0,
  fridayMinutes: 0,
  saturdayMinutes: 0,
  sundayMinutes: 0,
  preferredSessionMinutes: 30,
  timezone: 'America/Sao_Paulo',
};

interface AvailabilityGridProps {
  initial: AvailabilityResponse | null | undefined;
}

export function AvailabilityGrid({ initial }: AvailabilityGridProps) {
  const data = initial ?? DEFAULTS;
  const [form, setForm] = useState<AvailabilityResponse>({ ...DEFAULTS, ...data });
  const update = useUpdateAvailability();

  function setField(key: keyof AvailabilityResponse, value: number | string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync(form);
  }

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      <div>
        <SectionLabel>Daily availability (minutes)</SectionLabel>
        <p className="mt-1 font-sans text-sm text-ink-soft">
          How many minutes per day you can study. Used to build your weekly plan.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {DAYS.map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between gap-4">
              <span className="font-sans text-sm text-ink">{label}</span>
              <input
                type="number"
                min={0}
                max={1440}
                step={15}
                value={form[key] as number}
                onChange={(e) => setField(key, Math.max(0, Number(e.target.value)))}
                className="w-24 rounded-input border border-rule bg-surface px-3 py-1.5 font-mono text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink"
              />
            </label>
          ))}
        </div>
      </div>

      <div>
        <SectionLabel>Preferred session length (minutes)</SectionLabel>
        <p className="mt-1 font-sans text-sm text-ink-soft">
          Ideal uninterrupted block. The scheduler splits items into chunks of this size.
        </p>
        <input
          type="number"
          min={15}
          max={240}
          step={5}
          value={form.preferredSessionMinutes}
          onChange={(e) => setField('preferredSessionMinutes', Math.max(15, Number(e.target.value)))}
          className="mt-3 w-32 rounded-input border border-rule bg-surface px-3 py-1.5 font-mono text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink"
        />
        <p className="mt-1 font-mono text-xs text-ink-mute">
          {form.preferredSessionMinutes} min per session
        </p>
      </div>

      <div>
        <SectionLabel>Timezone</SectionLabel>
        <input
          type="text"
          value={form.timezone}
          onChange={(e) => setField('timezone', e.target.value)}
          placeholder="America/Sao_Paulo"
          className="mt-2 w-full max-w-xs rounded-input border border-rule bg-surface px-3 py-1.5 font-sans text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-ink"
        />
      </div>

      {update.isError && (
        <p className="font-mono text-xs text-outcome-stuck">
          Failed to save. Please try again.
        </p>
      )}
      {update.isSuccess && (
        <p className="font-mono text-xs text-outcome-done-easy">
          Saved.
        </p>
      )}

      <Button type="submit" disabled={update.isPending}>
        {update.isPending ? 'Saving…' : 'Save availability'}
      </Button>
    </form>
  );
}

'use client';

import { useEffect, useState } from 'react';
import type { AvailabilityResponse } from '../../lib/queries/me-settings';
import { useUpdateAvailability } from '../../lib/queries/me-settings';
import { useAutoSaveField } from '../../lib/forms/use-auto-save-field';
import { useSettingsError } from './settings-error-context';
import { SectionLabel } from '../ui/section-label';
import {
  AvailabilityPresets,
  type AvailabilityMinutes,
} from './availability-presets';
import { SessionLengthPresets } from './session-length-presets';
import { AvailabilitySlotEditor, hasAnyOverlap } from './availability-slot-editor';
import { AvailabilitySlotPresets } from './availability-slot-presets';

const DEFAULTS: AvailabilityResponse = {
  mondayMinutes: null,
  tuesdayMinutes: null,
  wednesdayMinutes: null,
  thursdayMinutes: null,
  fridayMinutes: null,
  saturdayMinutes: null,
  sundayMinutes: null,
  preferredSessionMinutes: 30,
  timezone: 'America/Sao_Paulo',
  slots: [],
};

interface Props {
  initial: AvailabilityResponse | null | undefined;
}

export function AvailabilityGrid({ initial }: Props) {
  const data: AvailabilityResponse = { ...DEFAULTS, ...(initial ?? {}) };
  const [form, setForm] = useState<AvailabilityResponse>(data);
  const update = useUpdateAvailability();
  const { setError } = useSettingsError();

  const overlap = hasAnyOverlap(form.slots);

  useEffect(() => {
    setError({ hasOverlap: overlap });
    return () => setError({ hasOverlap: false });
  }, [overlap, setError]);

  function commit(nextForm: AvailabilityResponse) {
    if (hasAnyOverlap(nextForm.slots)) return;
    void update.mutateAsync({
      mondayMinutes: nextForm.mondayMinutes,
      tuesdayMinutes: nextForm.tuesdayMinutes,
      wednesdayMinutes: nextForm.wednesdayMinutes,
      thursdayMinutes: nextForm.thursdayMinutes,
      fridayMinutes: nextForm.fridayMinutes,
      saturdayMinutes: nextForm.saturdayMinutes,
      sundayMinutes: nextForm.sundayMinutes,
      preferredSessionMinutes: nextForm.preferredSessionMinutes,
      timezone: nextForm.timezone,
      slots: nextForm.slots.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startMinute: s.startMinute,
        endMinute: s.endMinute,
      })),
      clearDays: [0, 1, 2, 3, 4, 5, 6],
    });
  }

  function setAndCommit<K extends keyof AvailabilityResponse>(key: K, value: AvailabilityResponse[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      commit(next);
      return next;
    });
  }

  function setSlotsAndCommit(next: AvailabilityResponse['slots']) {
    setForm((prev) => {
      const nextForm = { ...prev, slots: next };
      commit(nextForm);
      return nextForm;
    });
  }

  function setCapsAndCommit(next: Partial<AvailabilityResponse>) {
    setForm((prev) => {
      const nextForm = { ...prev, ...next };
      commit(nextForm);
      return nextForm;
    });
  }

  const timezoneField = useAutoSaveField<string>({
    initial: data.timezone,
    debounceMs: 800,
    validate: (v) => v.trim().length > 0,
    save: (v) => {
      setForm((prev) => {
        const nextForm = { ...prev, timezone: v };
        commit(nextForm);
        return nextForm;
      });
    },
  });

  const dayMinutes: AvailabilityMinutes = {
    mondayMinutes: form.mondayMinutes,
    tuesdayMinutes: form.tuesdayMinutes,
    wednesdayMinutes: form.wednesdayMinutes,
    thursdayMinutes: form.thursdayMinutes,
    fridayMinutes: form.fridayMinutes,
    saturdayMinutes: form.saturdayMinutes,
    sundayMinutes: form.sundayMinutes,
  };

  return (
    <div className="space-y-8">
      <div>
        <SectionLabel>Available time slots</SectionLabel>
        <p className="mt-1 font-sans text-sm text-fg-soft">
          When you can study each day of the week. Empty day = no study scheduled.
          Cross-midnight? Split into two — e.g.{' '}
          <span className="font-mono text-xs">Mon 22:00–24:00</span> +{' '}
          <span className="font-mono text-xs">Tue 00:00–05:00</span>.
        </p>
        <div className="mt-3">
          <AvailabilitySlotPresets
            slots={form.slots}
            onChange={setSlotsAndCommit}
          />
        </div>
        <div className="mt-3">
          <AvailabilitySlotEditor
            slots={form.slots}
            onChange={setSlotsAndCommit}
          />
        </div>
      </div>

      <div>
        <SectionLabel>Daily cap (optional)</SectionLabel>
        <p className="mt-1 font-sans text-sm text-fg-soft">
          Upper bound on study minutes per day. Pick <span className="font-mono">—</span> to use all of the day's declared slots.
        </p>
        <div className="mt-4">
          <AvailabilityPresets
            value={dayMinutes}
            onChange={(next) => setCapsAndCommit(next)}
          />
        </div>
      </div>

      <div>
        <SectionLabel>Preferred session length</SectionLabel>
        <p className="mt-1 font-sans text-sm text-fg-soft">
          Ideal uninterrupted block. The scheduler splits items into chunks of this size.
        </p>
        <div className="mt-3">
          <SessionLengthPresets
            value={form.preferredSessionMinutes}
            onChange={(next) => setAndCommit('preferredSessionMinutes', next)}
          />
        </div>
      </div>

      <div>
        <SectionLabel>Timezone</SectionLabel>
        <input
          type="text"
          value={timezoneField.value}
          onChange={(e) => timezoneField.onChange(e.target.value)}
          onBlur={timezoneField.onBlur}
          placeholder="America/Sao_Paulo"
          className="mt-2 w-full max-w-xs rounded-input border border-border-token bg-surface px-3 py-1.5 font-sans text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { AvailabilityResponse } from '../../lib/queries/me-settings';
import { useUpdateAvailability } from '../../lib/queries/me-settings';
import { SectionLabel } from '../ui/section-label';
import { Button } from '../ui/button';
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

  const dayMinutes: AvailabilityMinutes = {
    mondayMinutes: form.mondayMinutes,
    tuesdayMinutes: form.tuesdayMinutes,
    wednesdayMinutes: form.wednesdayMinutes,
    thursdayMinutes: form.thursdayMinutes,
    fridayMinutes: form.fridayMinutes,
    saturdayMinutes: form.saturdayMinutes,
    sundayMinutes: form.sundayMinutes,
  };

  const overlap = hasAnyOverlap(form.slots);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (overlap) return;
    await update.mutateAsync({
      mondayMinutes: form.mondayMinutes,
      tuesdayMinutes: form.tuesdayMinutes,
      wednesdayMinutes: form.wednesdayMinutes,
      thursdayMinutes: form.thursdayMinutes,
      fridayMinutes: form.fridayMinutes,
      saturdayMinutes: form.saturdayMinutes,
      sundayMinutes: form.sundayMinutes,
      preferredSessionMinutes: form.preferredSessionMinutes,
      timezone: form.timezone,
      slots: form.slots.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startMinute: s.startMinute,
        endMinute: s.endMinute,
      })),
      clearDays: [0, 1, 2, 3, 4, 5, 6],
    });
  }

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      <div>
        <SectionLabel>Available time slots</SectionLabel>
        <p className="mt-1 font-sans text-sm text-fg-soft">
          When you can study each day of the week. Empty day = no study scheduled.
        </p>
        <div className="mt-3">
          <AvailabilitySlotPresets
            slots={form.slots}
            onChange={(slots) => setForm((prev) => ({ ...prev, slots }))}
          />
        </div>
        <div className="mt-3">
          <AvailabilitySlotEditor
            slots={form.slots}
            onChange={(slots) => setForm((prev) => ({ ...prev, slots }))}
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
            onChange={(next) => setForm((prev) => ({ ...prev, ...next }))}
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
            onChange={(next) =>
              setForm((prev) => ({ ...prev, preferredSessionMinutes: next }))
            }
          />
        </div>
      </div>

      <div>
        <SectionLabel>Timezone</SectionLabel>
        <input
          type="text"
          value={form.timezone}
          onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
          placeholder="America/Sao_Paulo"
          className="mt-2 w-full max-w-xs rounded-input border border-border-token bg-surface px-3 py-1.5 font-sans text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {overlap && (
        <p className="font-mono text-xs text-outcome-stuck">
          Ajuste as faixas sobrepostas antes de salvar.
        </p>
      )}
      {update.isError && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="font-mono text-xs text-danger"
        >
          Failed to save. Please try again.
        </motion.p>
      )}
      {update.isSuccess && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="font-mono text-xs text-success"
        >
          Saved.
        </motion.p>
      )}

      <Button type="submit" disabled={update.isPending || overlap}>
        {update.isPending ? 'Saving…' : 'Save availability'}
      </Button>
    </form>
  );
}

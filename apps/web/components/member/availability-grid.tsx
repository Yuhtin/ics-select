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

interface Props {
  initial: AvailabilityResponse | null | undefined;
}

export function AvailabilityGrid({ initial }: Props) {
  const data = initial ?? DEFAULTS;
  const [form, setForm] = useState<AvailabilityResponse>({ ...DEFAULTS, ...data });
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync(form);
  }

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      <div>
        <SectionLabel>Daily availability</SectionLabel>
        <p className="mt-1 font-sans text-sm text-fg-soft">
          How many minutes per day you can study. Used to build your weekly plan.
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

      <Button type="submit" disabled={update.isPending}>
        {update.isPending ? 'Saving…' : 'Save availability'}
      </Button>
    </form>
  );
}

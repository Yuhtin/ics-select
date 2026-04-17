'use client';

import { useState } from 'react';
import { TRACKS } from '@ics-select/shared';
import { useUpdateProfile } from '../../lib/queries/me-settings';
import { SectionLabel } from '../ui/section-label';
import { Button } from '../ui/button';

const TRACK_LABELS: Record<string, string> = {
  BIG_TECH: 'Big Tech',
  CONSULTING_TECH: 'Consulting Tech',
  COMPETITIVE_PROGRAMMING: 'Competitive Programming',
  STARTUP: 'Startup',
  OTHER: 'Other',
};

interface ProfileFieldsProps {
  initialPhone: string | null;
  initialTrack: string | null;
}

export function ProfileFields({ initialPhone, initialTrack }: ProfileFieldsProps) {
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [track, setTrack] = useState<string>(initialTrack ?? '');
  const update = useUpdateProfile();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({
      whatsappPhone: phone.trim() || null,
      targetTrack: (track as (typeof TRACKS)[number]) || null,
    });
  }

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      <div>
        <SectionLabel>WhatsApp phone</SectionLabel>
        <p className="mt-1 font-sans text-sm text-ink-soft">
          Used for program notifications. Include country code (e.g. +5511999999999).
        </p>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+5511999999999"
          className="mt-3 w-full max-w-xs rounded-input border border-rule bg-surface px-3 py-1.5 font-sans text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-ink"
        />
      </div>

      <div>
        <SectionLabel>Career track</SectionLabel>
        <p className="mt-1 font-sans text-sm text-ink-soft">
          Informs the study plan focus for this cycle.
        </p>
        <select
          value={track}
          onChange={(e) => setTrack(e.target.value)}
          className="mt-3 w-full max-w-xs rounded-input border border-rule bg-surface px-3 py-2 font-sans text-sm text-ink focus:outline-none focus:ring-2 focus:ring-ink"
        >
          <option value="">Select a track</option>
          {TRACKS.map((t) => (
            <option key={t} value={t}>
              {TRACK_LABELS[t] ?? t}
            </option>
          ))}
        </select>
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
        {update.isPending ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { TRACKS } from '@ics-select/shared';
import { useUpdateProfile } from '../../lib/queries/me-settings';
import { SectionLabel } from '../ui/section-label';
import { Button } from '../ui/button';
import { PhoneInput } from './phone-input';
import { TrackPicker } from './track-picker';

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
        <p className="mt-1 font-sans text-sm text-fg-soft">
          Used for program notifications. Include country code (e.g. +5511999999999).
        </p>
        <div className="mt-3 max-w-xs">
          <PhoneInput value={phone} onChange={setPhone} />
        </div>
      </div>

      <div>
        <SectionLabel>Career track</SectionLabel>
        <p className="mt-1 font-sans text-sm text-fg-soft">
          Informs the study plan focus for this cycle.
        </p>
        <div className="mt-3">
          <TrackPicker value={track} onChange={setTrack} />
        </div>
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
        {update.isPending ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  );
}

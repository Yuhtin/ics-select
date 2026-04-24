'use client';

import { useMemo } from 'react';
import { TRACKS } from '@ics-select/shared';
import { useUpdateProfile } from '../../lib/queries/me-settings';
import { useAutoSaveField } from '../../lib/forms/use-auto-save-field';
import { SectionLabel } from '../ui/section-label';
import { PhoneInput } from './phone-input';
import { TrackPicker } from './track-picker';

interface ProfileFieldsProps {
  initialPhone: string | null;
  initialTrack: string | null;
}

const PHONE_REGEX = /^\+\d{8,15}$/;

export function ProfileFields({ initialPhone, initialTrack }: ProfileFieldsProps) {
  const update = useUpdateProfile();

  const phoneField = useAutoSaveField<string>({
    initial: initialPhone ?? '',
    debounceMs: 800,
    validate: (v) => v === '' || PHONE_REGEX.test(v),
    save: (v) => update.mutateAsync({ whatsappPhone: v.trim() || null }),
  });

  const track = initialTrack ?? '';
  const handleTrackChange = (next: string) => {
    if (next === track) return;
    void update.mutateAsync({
      targetTrack: (next as (typeof TRACKS)[number]) || null,
    });
  };

  const phoneInvalidDisplay = useMemo(
    () => phoneField.invalid && phoneField.value.length > 0,
    [phoneField.invalid, phoneField.value],
  );

  return (
    <div className="space-y-8">
      <div>
        <SectionLabel>WhatsApp phone</SectionLabel>
        <p className="mt-1 font-sans text-sm text-fg-soft">
          Used for program notifications. Include country code (e.g. +5511999999999).
        </p>
        <div className="mt-3 max-w-xs">
          <PhoneInput
            value={phoneField.value}
            onChange={phoneField.onChange}
            onBlur={phoneField.onBlur}
            invalid={phoneInvalidDisplay}
          />
        </div>
        {phoneInvalidDisplay && (
          <p className="mt-2 font-mono text-[11px] text-danger">
            Formato inválido. Inclua o código do país (ex: +5511999999999).
          </p>
        )}
      </div>

      <div>
        <SectionLabel>Career track</SectionLabel>
        <p className="mt-1 font-sans text-sm text-fg-soft">
          Informs the study plan focus for this cycle.
        </p>
        <div className="mt-3">
          <TrackPicker value={track} onChange={handleTrackChange} />
        </div>
      </div>
    </div>
  );
}

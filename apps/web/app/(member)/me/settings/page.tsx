'use client';

import { useAuth } from '../../../../lib/auth/auth-context';
import { useMeAvailability } from '../../../../lib/queries/me-settings';
import { AvailabilityGrid } from '../../../../components/member/availability-grid';
import { ProfileFields } from '../../../../components/member/profile-fields';
import { GoogleStatusCard } from '../../../../components/member/google-status-card';
import { Eyebrow } from '../../../../components/ui/eyebrow';

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: availability, isLoading } = useMeAvailability();

  if (!user) {
    return (
      <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Loading…</p>
    );
  }

  return (
    <div className="max-w-2xl space-y-14">
      <div>
        <Eyebrow>Settings</Eyebrow>
        <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight">
          Your preferences.
        </h1>
      </div>

      <section className="space-y-4">
        <h2 className="font-sans text-base font-semibold text-ink">Google Calendar</h2>
        <GoogleStatusCard connected={user.googleConnected} />
      </section>

      <hr className="border-rule" />

      <section className="space-y-4">
        <h2 className="font-sans text-base font-semibold text-ink">Profile</h2>
        <ProfileFields
          initialPhone={user.whatsappPhone}
          initialTrack={user.targetTrack}
        />
      </section>

      <hr className="border-rule" />

      <section className="space-y-4">
        <h2 className="font-sans text-base font-semibold text-ink">Availability</h2>
        {isLoading ? (
          <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Loading…</p>
        ) : (
          <AvailabilityGrid initial={availability} />
        )}
      </section>
    </div>
  );
}

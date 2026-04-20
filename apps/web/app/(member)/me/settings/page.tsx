'use client';

import { useAuth } from '../../../../lib/auth/auth-context';
import { useMeAvailability } from '../../../../lib/queries/me-settings';
import { useThemeWithSync } from '../../../../lib/theme/use-theme-sync';
import { AvailabilityGrid } from '../../../../components/member/availability-grid';
import { ProfileFields } from '../../../../components/member/profile-fields';
import { GoogleStatusCard } from '../../../../components/member/google-status-card';
import { ThemePicker } from '../../../../components/member/theme-picker';
import { Eyebrow } from '../../../../components/ui/eyebrow';
import { SectionLabel } from '../../../../components/ui/section-label';

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: availability, isLoading } = useMeAvailability();
  const { resolvedTheme, setTheme, mounted } = useThemeWithSync();

  if (!user) {
    return (
      <p className="font-mono text-xs uppercase tracking-eyebrow text-fg-mute">Loading…</p>
    );
  }

  const currentTheme = mounted ? (resolvedTheme === 'dark' ? 'dark' : 'light') : undefined;

  return (
    <div className="max-w-2xl space-y-14">
      <div>
        <Eyebrow>Settings</Eyebrow>
        <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight text-fg">
          Your preferences.
        </h1>
      </div>

      <section>
        <SectionLabel>Appearance</SectionLabel>
        <ThemePicker value={currentTheme} onChange={setTheme} size="settings" />
        <p className="mt-3 font-sans text-sm text-fg-soft">
          Your choice syncs across devices.
        </p>
      </section>

      <section>
        <SectionLabel>Google Calendar</SectionLabel>
        <GoogleStatusCard connected={user.googleConnected} email={user.email} />
      </section>

      <section>
        <SectionLabel>Profile</SectionLabel>
        <ProfileFields
          initialPhone={user.whatsappPhone}
          initialTrack={user.targetTrack}
        />
      </section>

      <section>
        <SectionLabel>Availability</SectionLabel>
        {isLoading ? (
          <p className="font-mono text-xs uppercase tracking-eyebrow text-fg-mute">Loading…</p>
        ) : (
          <AvailabilityGrid initial={availability} />
        )}
      </section>
    </div>
  );
}

'use client';

import { useAuth } from '../../../../../lib/auth/auth-context';
import { ProfileFields } from '../../../../../components/member/profile-fields';
import { GoogleStatusCard } from '../../../../../components/member/google-status-card';
import { SectionLabel } from '../../../../../components/ui/section-label';

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <p className="font-sans text-sm text-fg-mute">
        Loading…
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <ProfileFields
        initialPhone={user.whatsappPhone}
        initialTrack={user.targetTrack}
      />
      <div className="border-t border-border-token pt-8">
        <SectionLabel>Google Calendar</SectionLabel>
        <div className="mt-3">
          <GoogleStatusCard connected={user.googleConnected} email={user.email} />
        </div>
      </div>
    </div>
  );
}

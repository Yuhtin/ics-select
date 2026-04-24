'use client';

import { useMeAvailability } from '../../../../../lib/queries/me-settings';
import { AvailabilityGrid } from '../../../../../components/member/availability-grid';

export default function AvailabilityPage() {
  const { data: availability, isLoading } = useMeAvailability();

  if (isLoading) {
    return (
      <p className="font-mono text-xs uppercase tracking-eyebrow text-fg-mute">
        Loading…
      </p>
    );
  }

  return (
    <div className="max-w-2xl">
      <AvailabilityGrid initial={availability} />
    </div>
  );
}

'use client';

import { useMeAvailability } from '../../../../../lib/queries/me-settings';
import { AvailabilityGrid } from '../../../../../components/member/availability-grid';

export default function AvailabilityPage() {
  const { data: availability, isLoading, isError } = useMeAvailability();

  if (isLoading) {
    return (
      <p className="font-sans text-sm text-fg-mute">
        Loading…
      </p>
    );
  }

  if (isError && !availability) {
    return <p role="alert" className="font-sans text-sm text-danger">Could not load availability.</p>;
  }

  return (
    <div>
      <AvailabilityGrid initial={availability} />
    </div>
  );
}

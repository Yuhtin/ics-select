'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminActiveCycleOverview } from '../../../../../lib/queries/admin-cycle';
import { CycleOverviewView } from '../../../../../components/admin/cycle/cycle-overview-view';
import { ApiErrorResponse } from '../../../../../lib/api/client';

export default function AdminActiveCyclePage() {
  const router = useRouter();
  const { data, isLoading, error } = useAdminActiveCycleOverview();

  // No ACTIVE cycle (404) → bounce to the cycle list so the admin can pick one
  // or create one. Anything else surfaces in the loading branch.
  useEffect(() => {
    if (error instanceof ApiErrorResponse && error.status === 404) {
      router.replace('/admin/cycles');
    }
  }, [error, router]);

  if (isLoading || !data) {
    return (
      <p className="font-mono text-xs uppercase tracking-label text-ink-mute">
        Loading…
      </p>
    );
  }

  return <CycleOverviewView data={data} />;
}

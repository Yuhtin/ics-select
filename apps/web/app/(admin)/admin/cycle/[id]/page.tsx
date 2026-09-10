'use client';
import { use } from 'react';
import { useAdminCycleOverview } from '../../../../../lib/queries/admin-cycle';
import { CycleOverviewView } from '../../../../../components/admin/cycle/cycle-overview-view';

export default function AdminCyclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading } = useAdminCycleOverview(id);

  if (isLoading || !data) {
    return (
      <p className="font-sans text-xs font-medium text-fg-mute">
        Loading…
      </p>
    );
  }

  return <CycleOverviewView data={data} />;
}

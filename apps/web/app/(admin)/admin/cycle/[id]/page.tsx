'use client';
import { use } from 'react';
import { useAdminCycleOverview } from '../../../../../lib/queries/admin-cycle';
import { RankingToggle } from '../../../../../components/admin/ranking-toggle';
import { CycleMembersGrid } from '../../../../../components/admin/cycle-members-grid';
import { CohortHeatmap } from '../../../../../components/admin/cohort-heatmap';
import { Eyebrow } from '../../../../../components/ui/eyebrow';
import { SectionLabel } from '../../../../../components/ui/section-label';

export default function AdminCyclePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data, isLoading } = useAdminCycleOverview(id);

  if (isLoading || !data) {
    return (
      <p className="font-mono text-xs uppercase tracking-label text-ink-mute">
        Loading…
      </p>
    );
  }

  return (
    <div className="max-w-6xl space-y-10">
      <header className="flex flex-wrap items-start gap-x-8 gap-y-4">
        <div className="flex-1 min-w-0">
          <Eyebrow>Cycle · {data.cycle.status}</Eyebrow>
          <h1 className="mt-3 font-serif-tool text-4xl font-semibold tracking-tight leading-tight">
            {data.cycle.name} · week {data.cycle.weekNumber} of{' '}
            {data.cycle.weeksTotal}
          </h1>
          <p className="mt-2 font-mono text-xs text-ink-mute">
            {data.members.length} members
          </p>
        </div>
        <RankingToggle
          cycleId={data.cycle.id}
          checked={data.cycle.rankingVisibleToMembers}
        />
      </header>

      <section>
        <SectionLabel>Members</SectionLabel>
        <CycleMembersGrid members={data.members} />
      </section>

      <section>
        <SectionLabel>Cohort heatmap · last 6 weeks</SectionLabel>
        <CohortHeatmap weeks={data.heatmap.weeks} rows={data.heatmap.rows} />
      </section>
    </div>
  );
}

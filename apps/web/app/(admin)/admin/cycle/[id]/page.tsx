'use client';
import { use } from 'react';
import Link from 'next/link';
import { useAdminCycleOverview } from '../../../../../lib/queries/admin-cycle';
import { RankingToggle } from '../../../../../components/admin/ranking-toggle';
import { CycleMembersGrid } from '../../../../../components/admin/cycle-members-grid';
import { CohortHeatmap } from '../../../../../components/admin/cohort-heatmap';
import { ClassesSection } from '../../../../../components/admin/cycles/classes-section';
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
            {data.cycle.name}
            {data.cycle.weekNumber > 0 ? (
              <> · week {data.cycle.weekNumber} of {data.cycle.weeksTotal}</>
            ) : (
              <> · upcoming · {data.cycle.weeksTotal} weeks</>
            )}
          </h1>
          <p className="mt-2 font-mono text-xs text-ink-mute">
            {data.members.length} members
            {data.cycle.weekNumber === 0 && (
              <>
                {' · starts '}
                {new Date(data.cycle.startsAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={`/admin/plans?cycleId=${data.cycle.id}`}
            className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-label text-ink-soft hover:text-ink"
          >
            All plans →
          </Link>
          <RankingToggle
            cycleId={data.cycle.id}
            checked={data.cycle.rankingVisibleToMembers}
          />
        </div>
      </header>

      <section>
        <SectionLabel>Members</SectionLabel>
        <CycleMembersGrid members={data.members} />
      </section>

      <section>
        <SectionLabel>Cohort heatmap · last 6 weeks</SectionLabel>
        <CohortHeatmap weeks={data.heatmap.weeks} rows={data.heatmap.rows} />
      </section>

      <ClassesSection
        cycleId={data.cycle.id}
        members={data.members.map((m) => ({
          userId: m.userId,
          name: m.name,
          pictureUrl: m.pictureUrl,
        }))}
      />
    </div>
  );
}

'use client';
import { useMeCohort } from '../../../../lib/queries/me-cohort';
import { CohortFeed } from '../../../../components/member/cohort-feed';
import { CohortRoster } from '../../../../components/member/cohort-roster';
import { Eyebrow } from '../../../../components/ui/eyebrow';
import { SectionLabel } from '../../../../components/ui/section-label';

export default function MeCohortPage() {
  const { data, isLoading } = useMeCohort();
  if (isLoading || !data) {
    return (
      <p className="font-mono text-xs uppercase tracking-eyebrow text-fg-mute">
        Loading…
      </p>
    );
  }
  const hasMembers = data.members.length > 0;

  return (
    <div className="max-w-6xl space-y-10">
      <div>
        <Eyebrow>{`Cohort · ${data.cycleName || 'active cycle'}`}</Eyebrow>
        <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight">
          {data.memberCount === 0
            ? 'No cohort yet.'
            : `${data.memberCount} classmates this cycle`}
        </h1>
      </div>

      {hasMembers && (
        <section>
          <CohortRoster members={data.members} ranking={data.ranking} />
        </section>
      )}

      <section className="space-y-4">
        <SectionLabel>Activity · last 7d</SectionLabel>
        <CohortFeed feed={data.feed} />
      </section>
    </div>
  );
}

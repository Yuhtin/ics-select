'use client';
import { clsx } from 'clsx';
import { useMeCohort } from '../../../../lib/queries/me-cohort';
import { CohortFeed } from '../../../../components/member/cohort-feed';
import { CohortRanking } from '../../../../components/member/cohort-ranking';
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
  const hasRanking = Array.isArray(data.ranking) && data.ranking.length > 0;
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

      <div
        className={clsx(
          'gap-10',
          hasMembers ? 'flex flex-col md:grid md:grid-cols-[minmax(0,1fr)_340px]' : '',
        )}
      >
        <div className="min-w-0 space-y-10 md:order-1">
          <section className="space-y-4">
            <SectionLabel>Activity · last 7d</SectionLabel>
            <CohortFeed feed={data.feed} />
          </section>

          {hasRanking && (
            <section>
              <CohortRanking ranking={data.ranking!} weekEndsAt={data.weekEndsAt} />
            </section>
          )}
        </div>

        {hasMembers && (
          <aside className="md:order-2 md:sticky md:top-6 md:max-h-[calc(100vh-3rem)] md:overflow-y-auto">
            <CohortRoster members={data.members} />
          </aside>
        )}
      </div>
    </div>
  );
}

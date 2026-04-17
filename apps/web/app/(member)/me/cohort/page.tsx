'use client';
import { useMeCohort } from '../../../../lib/queries/me-cohort';
import { CohortFeed } from '../../../../components/member/cohort-feed';
import { CohortRanking } from '../../../../components/member/cohort-ranking';
import { Eyebrow } from '../../../../components/ui/eyebrow';
import { SectionLabel } from '../../../../components/ui/section-label';

export default function MeCohortPage() {
  const { data, isLoading } = useMeCohort();
  if (isLoading || !data) {
    return <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Loading…</p>;
  }
  const hasRanking = Array.isArray(data.ranking) && data.ranking.length > 0;

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <Eyebrow>{`Cohort · ${data.cycleName || 'active cycle'}`}</Eyebrow>
        <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight">
          {data.memberCount === 0
            ? 'No cohort yet.'
            : `${data.memberCount} classmates this cycle`}
        </h1>
      </div>
      <div className={hasRanking ? 'grid gap-10 md:grid-cols-[minmax(0,1fr)_280px]' : ''}>
        <div className="min-w-0 space-y-4">
          <SectionLabel>Activity · last 24h</SectionLabel>
          <CohortFeed feed={data.feed} />
        </div>
        {hasRanking && (
          <aside>
            <CohortRanking ranking={data.ranking!} weekEndsAt={data.weekEndsAt} />
          </aside>
        )}
      </div>
    </div>
  );
}

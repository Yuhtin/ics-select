'use client';
import { useMeCohort } from '../../../../lib/queries/me-cohort';
import { CohortFeed } from '../../../../components/member/cohort-feed';
import { CohortRoster } from '../../../../components/member/cohort-roster';
import { StudioContextRail } from '../../../../components/member/studio-context-rail';
import { StudioPageHeader } from '../../../../components/member/studio-page-header';
import { SectionLabel } from '../../../../components/ui/section-label';

export default function MeCohortPage() {
  const { data, isLoading, error } = useMeCohort();

  if (isLoading || error || !data) {
    return (
      <div className="max-w-[1180px]">
        <section className="border-t border-border-token py-6">
          <p role={isLoading ? 'status' : 'alert'} className="font-sans text-sm text-fg-mute">
            {isLoading ? 'Loading…' : 'Could not load your cohort.'}
          </p>
        </section>
      </div>
    );
  }

  const hasMembers = data.members.length > 0;

  return (
    <div className="max-w-[1180px] space-y-9">
      <StudioPageHeader
        eyebrow={`Cohort · ${data.cycleName || 'active cycle'}`}
        title={data.memberCount === 0 ? 'No cohort yet.' : `${data.memberCount} classmates this cycle`}
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,.85fr)]">
        {hasMembers ? (
          <CohortRoster members={data.members} ranking={data.ranking} />
        ) : (
          <p className="border-t border-border-token py-6 text-sm text-fg-mute">
            No classmates to show.
          </p>
        )}
        <StudioContextRail className="lg:pl-8">
          <section data-testid="cohort-activity">
            <SectionLabel>Activity · last 7d</SectionLabel>
            <CohortFeed feed={data.feed} />
          </section>
        </StudioContextRail>
      </div>
    </div>
  );
}

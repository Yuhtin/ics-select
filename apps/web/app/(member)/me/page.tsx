'use client';

import { isPositiveOutcome } from '@ics-select/shared';
import { useMeHome } from '../../../lib/queries/me-home';
import { useMeCohort } from '../../../lib/queries/me-cohort';
import { HeroScene } from '../../../components/member/hero-scene';
import { DayList } from '../../../components/member/day-list';
import { CarryOverReflectionCard } from '../../../components/member/carry-over-reflection-card';
import { TopicCoverageHeatmap } from '../../../components/member/topic-coverage-heatmap';
import { TopRankingCard } from '../../../components/member/top-ranking-card';
import { StreakCard } from '../../../components/ui/streak-card';
import { StudyTimeCard } from '../../../components/member/study-time-card';
import { useAuth } from '../../../lib/auth/auth-context';
import { StudioPageHeader } from '../../../components/member/studio-page-header';
import { StudioContextRail } from '../../../components/member/studio-context-rail';
import { formatMinutes } from '../../../lib/format/time';

export default function MeHomePage() {
  const { data, isLoading, error } = useMeHome();
  const { data: cohort } = useMeCohort();

  const { user } = useAuth();
  const now = new Date();
  const firstName = user?.name.split(' ')[0];
  const partOfDay = now.getHours() < 12 ? 'morning' : now.getHours() < 18 ? 'afternoon' : 'evening';
  const greeting = firstName ? `Good ${partOfDay}, ${firstName}.` : `Good ${partOfDay}.`;
  const todayLabel = new Intl.DateTimeFormat('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  }).format(now);

  if (isLoading || error || !data) {
    return (
      <div data-testid="studio-home" className="space-y-8">
        <StudioPageHeader eyebrow={todayLabel} title={greeting} />
        <div className="grid gap-9 lg:grid-cols-[minmax(0,1.7fr)_minmax(240px,0.62fr)]">
          <section aria-labelledby="today-status-heading" className="min-w-0 border-b border-border-token pb-6">
            <h2 id="today-status-heading" className="text-sm font-semibold text-fg">Today</h2>
            <p role={isLoading ? 'status' : 'alert'} className="mt-3 font-sans text-sm text-fg-mute">
              {isLoading ? 'Loading…' : 'Could not load your home.'}
            </p>
          </section>
        </div>
      </div>
    );
  }

  const activeItemId = data.hero && 'item' in data.hero ? data.hero.item.id : null;
  const lateItems = data.late ?? [];
  // The day-ring + Today total combine carry-over and today: from the
  // member's perspective they're all "what I need to do today".
  const ringItems = [...lateItems, ...data.today];
  const todayMinutes = ringItems.reduce(
    (sum, i) => sum + (i.scheduledMinutes ?? i.estimatedMinutes),
    0,
  );
  const doneCount = ringItems.filter((i) => isPositiveOutcome(i.outcome)).length;
  const todayHint =
    ringItems.length > 0
      ? `${doneCount}/${ringItems.length} done · ${formatMinutes(todayMinutes)} total`
      : undefined;
  const lateMinutes = lateItems.reduce(
    (sum, i) => sum + (i.scheduledMinutes ?? i.estimatedMinutes),
    0,
  );

  return (
    <div data-testid="studio-home" className="space-y-8">
      <StudioPageHeader eyebrow={todayLabel} title={greeting} />
      <div className="grid gap-9 lg:grid-cols-[minmax(0,1.7fr)_minmax(240px,0.62fr)]">
        <div className="min-w-0 space-y-7">
          <HeroScene hero={data.hero} />
          {lateItems.length > 0 && (
            <section>
              <DayList label="Earlier this week" hint={`${lateItems.length} pending · ${formatMinutes(lateMinutes)} total`} items={lateItems} activeItemId={activeItemId} />
            </section>
          )}
          <section>
            <DayList label="Today" hint={todayHint} items={data.today} activeItemId={activeItemId} />
          </section>
          {data.days.map((day) => <DayList key={day.date} label={day.label} items={day.items} />)}
          {(data.unscheduled?.length ?? 0) > 0 && (
            <DayList label="Unscheduled" hint="Sem horário no calendário" items={data.unscheduled ?? []} />
          )}
          {data.carryOverReflection && <CarryOverReflectionCard reflection={data.carryOverReflection} />}
        </div>
        <StudioContextRail>
          {cohort?.ranking && cohort.ranking.length > 0 && <TopRankingCard ranking={cohort.ranking} presentation="context" />}
          <StreakCard current={data.streak.current} last7={data.streak.last7} presentation="context" />
          {data.studyTime && data.studyTime.itemsWithTime > 0 && <StudyTimeCard studyTime={data.studyTime} presentation="context" />}
          {data.topicCoverage.length > 0 && (
            <section className="py-5">
              <p className="text-xs text-fg-mute">Topic coverage</p>
              <div className="mt-4"><TopicCoverageHeatmap topics={data.topicCoverage} tileSize={18} /></div>
            </section>
          )}
        </StudioContextRail>
      </div>
    </div>
  );
}

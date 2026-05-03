'use client';

import { useMeHome } from '../../../lib/queries/me-home';
import { HeroScene } from '../../../components/member/hero-scene';
import { DayList } from '../../../components/member/day-list';
import { DayRingCard } from '../../../components/member/day-ring-card';
import { CarryOverReflectionCard } from '../../../components/member/carry-over-reflection-card';
import { TopicCoverageHeatmap } from '../../../components/member/topic-coverage-heatmap';
import { StreakCard } from '../../../components/ui/streak-card';
import { formatMinutes } from '../../../lib/format/time';

export default function MeHomePage() {
  const { data, isLoading, error } = useMeHome();

  if (isLoading) {
    return (
      <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute">
        Loading…
      </p>
    );
  }
  if (error || !data) {
    return (
      <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute">
        Could not load your home.
      </p>
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
  const doneCount = ringItems.filter(
    (i) => i.outcome === 'DONE_EASY' || i.outcome === 'DONE_HARD',
  ).length;
  const todayHint =
    ringItems.length > 0
      ? `${doneCount}/${ringItems.length} done · ${formatMinutes(todayMinutes)} total`
      : undefined;
  const lateMinutes = lateItems.reduce(
    (sum, i) => sum + (i.scheduledMinutes ?? i.estimatedMinutes),
    0,
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-6">
        <HeroScene hero={data.hero} />
        {lateItems.length > 0 && (
          <section>
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 className="font-sans text-sm font-semibold tracking-tight text-fg">
                Earlier this week
              </h2>
              <span className="font-mono text-[11px] tabular-nums text-fg-mute">
                {`${lateItems.length} pending · ${formatMinutes(lateMinutes)} total`}
              </span>
            </div>
            <DayList items={lateItems} activeItemId={activeItemId} />
          </section>
        )}
        <section>
          <div className="mb-2 flex items-baseline justify-between px-1">
            <h2 className="font-sans text-sm font-semibold tracking-tight text-fg">
              Today
            </h2>
            {todayHint && (
              <span className="font-mono text-[11px] tabular-nums text-fg-mute">
                {todayHint}
              </span>
            )}
          </div>
          <DayList items={data.today} activeItemId={activeItemId} />
        </section>
        {data.days.length > 0 && (
          <section className="space-y-4">
            {data.days.map((day) => (
              <DayList key={day.date} label={day.label} items={day.items} />
            ))}
          </section>
        )}
        {(data.unscheduled?.length ?? 0) > 0 && (
          <section>
            <div className="mb-2 flex items-baseline justify-between px-1">
              <h2 className="font-sans text-sm font-semibold tracking-tight text-fg">
                Unscheduled
              </h2>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute">
                Sem horário no calendário
              </span>
            </div>
            <DayList items={data.unscheduled ?? []} />
          </section>
        )}
        {data.carryOverReflection && (
          <CarryOverReflectionCard reflection={data.carryOverReflection} />
        )}
      </div>

      <aside className="flex flex-col gap-5">
        <DayRingCard items={ringItems} nowItemId={activeItemId} />
        <StreakCard current={data.streak.current} last7={data.streak.last7} />
        {data.topicCoverage.length > 0 && (
          <section className="rounded-tile border border-border-token bg-surface p-6">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute">
              Topic coverage
            </p>
            <div className="mt-4">
              <TopicCoverageHeatmap
                topics={data.topicCoverage}
                tileSize={18}
              />
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}

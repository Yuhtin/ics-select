'use client';

import { useMeHome } from '../../../lib/queries/me-home';
import { HomeHero } from '../../../components/member/home-hero';
import { DayList } from '../../../components/member/day-list';
import { StreakCard } from '../../../components/ui/streak-card';
import { formatMinutes } from '../../../lib/format/time';

export default function MeHomePage() {
  const { data, isLoading, error } = useMeHome();

  if (isLoading) {
    return <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Loading…</p>;
  }
  if (error || !data) {
    return <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Could not load your home.</p>;
  }

  const activeItemId = data.hero && 'item' in data.hero ? data.hero.item.id : null;

  const todayMinutes = data.today.reduce((sum, i) => sum + (i.scheduledMinutes ?? i.estimatedMinutes), 0);
  const todayHint = data.today.length > 0
    ? `${data.today.length} items · ${formatMinutes(todayMinutes)}`
    : undefined;

  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_260px]">
      <div className="space-y-10 min-w-0">
        <HomeHero hero={data.hero} />
        <hr className="border-rule" />
        <DayList label="Today" hint={todayHint} items={data.today} activeItemId={activeItemId} />
        {data.days.map((day) => (
          <DayList key={day.date} label={day.label} items={day.items} />
        ))}
      </div>
      <aside className="space-y-6">
        <StreakCard current={data.streak.current} last7={data.streak.last7} />
      </aside>
    </div>
  );
}

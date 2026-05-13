'use client';
import type { CycleReceiptResponse } from '../../../lib/queries/admin-cycle-receipt';
import { WrappedBlock } from './wrapped-block';
import { CohortKnowledgeGrid } from '../cohort-knowledge-grid';

const fmtHours = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

export function WrappedView({ data }: { data: CycleReceiptResponse }) {
  const topTopic = [...data.byTopic].sort(
    (a, b) => b.membersReached - a.membersReached || b.itemsCompleted - a.itemsCompleted,
  )[0];

  return (
    <div id="receipt-capture-root">
      <WrappedBlock gradient="cover">
        <div className="font-mono text-xs uppercase tracking-label opacity-70">
          {data.cycle.weeksTotal} weeks · {data.totals.members} minds
        </div>
        <h1 className="font-serif mt-6 text-[64px] leading-none font-semibold">
          {data.cycle.name}
        </h1>
        <div className="mt-4 font-mono text-xs uppercase tracking-label opacity-80">
          ended {fmtDate(data.cycle.endsAt)}
        </div>
      </WrappedBlock>

      <WrappedBlock gradient="hours">
        <div className="font-mono text-xs uppercase tracking-label opacity-80">
          together you studied
        </div>
        <div className="font-serif mt-6 text-[112px] leading-none font-semibold">
          {fmtHours(data.totals.totalMinutes)}
        </div>
        <div className="mt-6 font-mono text-sm opacity-90">
          that's roughly an entire work month each.
        </div>
      </WrappedBlock>

      {topTopic && (
        <WrappedBlock gradient="topic">
          <div className="font-mono text-xs uppercase tracking-label opacity-80">
            most-grokked topic
          </div>
          <div className="font-serif mt-6 text-[80px] leading-none font-semibold">
            {topTopic.label}
          </div>
          <div className="mt-6 font-mono text-sm opacity-90">
            {topTopic.membersReached} of {data.totals.members} reached it ·{' '}
            {topTopic.itemsCompleted} items completed
          </div>
        </WrappedBlock>
      )}

      {data.cycleTopMover && (
        <WrappedBlock gradient="mover">
          <div className="font-mono text-xs uppercase tracking-label opacity-80">
            this cycle's mover
          </div>
          <div className="font-serif mt-6 text-[64px] leading-none font-semibold">
            {data.cycleTopMover.name}
          </div>
          <div className="mt-6 font-mono text-sm opacity-90">
            +{data.cycleTopMover.deltaItems} items ·{' '}
            {data.cycleTopMover.topTopics.join(', ').toLowerCase()}
          </div>
        </WrappedBlock>
      )}

      <WrappedBlock gradient="grid">
        <div className="mb-4 font-mono text-xs uppercase tracking-label opacity-80">
          the cohort
        </div>
        <div className="flex justify-center">
          <CohortKnowledgeGrid
            members={data.knowledgeGrid.members}
            topics={data.knowledgeGrid.topics}
            cells={data.knowledgeGrid.cells}
            variant="inverted"
          />
        </div>
      </WrappedBlock>

      <WrappedBlock gradient="fame">
        <div className="font-mono text-xs uppercase tracking-label opacity-80 mb-8">
          hall of fame
        </div>
        <div className="space-y-6 text-left">
          {(
            [
              data.engagementLeader && {
                k: 'engagement',
                eyebrow: 'top engagement',
                name: data.engagementLeader.name,
                detail: `score ${data.engagementLeader.score}`,
              },
              data.streakChampion && {
                k: 'streak',
                eyebrow: 'streak',
                name: data.streakChampion.name,
                detail: `${data.streakChampion.streakDays} days`,
              },
              data.mostHoursStudied && {
                k: 'hours',
                eyebrow: 'most hours',
                name: data.mostHoursStudied.name,
                detail: fmtHours(data.mostHoursStudied.minutes),
              },
              data.mostItemsCompleted && {
                k: 'items',
                eyebrow: 'most items done',
                name: data.mostItemsCompleted.name,
                detail: `${data.mostItemsCompleted.items} items`,
              },
              data.polymath && {
                k: 'polymath',
                eyebrow: 'polymath',
                name: data.polymath.name,
                detail: `${data.polymath.topics} topics`,
              },
              data.mostActiveDays && {
                k: 'active',
                eyebrow: 'most active days',
                name: data.mostActiveDays.name,
                detail: `${data.mostActiveDays.days} days`,
              },
              data.marathonDay && {
                k: 'marathon',
                eyebrow: 'marathon day',
                name: data.marathonDay.name,
                detail: `${data.marathonDay.items} items in one day`,
              },
              data.longestItem && {
                k: 'longform',
                eyebrow: 'long-form',
                name: data.longestItem.name,
                detail: `finished ${fmtHours(data.longestItem.minutes)} item`,
              },
            ].filter(Boolean) as Array<{ k: string; eyebrow: string; name: string; detail: string }>
          ).map((row) => (
            <div key={row.k}>
              <div className="font-mono text-[11px] uppercase tracking-label opacity-70">
                {row.eyebrow}
              </div>
              <div className="font-serif text-[40px] leading-none font-semibold">
                {row.name}
              </div>
              <div className="font-mono text-xs opacity-80">{row.detail}</div>
            </div>
          ))}
          {data.perfectAttendance.length > 0 && (
            <div>
              <div className="font-mono text-[11px] uppercase tracking-label opacity-70">
                perfect attendance
              </div>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm opacity-90">
                {data.perfectAttendance.map((m) => (
                  <span key={m.userId} className="whitespace-nowrap">
                    {m.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </WrappedBlock>

      <WrappedBlock gradient="close">
        <div className="font-mono text-xs uppercase tracking-label opacity-70">
          {data.cycle.name}
        </div>
        <div className="font-serif mt-6 text-[64px] leading-none font-semibold">
          closed
        </div>
        <div className="mt-8 text-2xl">★ ★ ★ ★ ★</div>
        <div className="mt-8 font-mono text-xs uppercase tracking-label opacity-70">
          see you in the next cycle
        </div>
        <div className="mt-12 font-mono text-[10px] uppercase tracking-label opacity-50">
          by davi duarte · github.com/Yuhtin
        </div>
      </WrappedBlock>
    </div>
  );
}

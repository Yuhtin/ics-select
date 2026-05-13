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
          {data.engagementLeader && (
            <div>
              <div className="font-mono text-[11px] uppercase tracking-label opacity-70">
                top engagement
              </div>
              <div className="font-serif text-[40px] leading-none font-semibold">
                {data.engagementLeader.name}
              </div>
              <div className="font-mono text-xs opacity-80">
                score {data.engagementLeader.score}
              </div>
            </div>
          )}
          {data.streakChampion && (
            <div>
              <div className="font-mono text-[11px] uppercase tracking-label opacity-70">
                streak
              </div>
              <div className="font-serif text-[40px] leading-none font-semibold">
                {data.streakChampion.name}
              </div>
              <div className="font-mono text-xs opacity-80">
                {data.streakChampion.streakDays} days
              </div>
            </div>
          )}
          {data.mostHoursStudied && (
            <div>
              <div className="font-mono text-[11px] uppercase tracking-label opacity-70">
                most hours
              </div>
              <div className="font-serif text-[40px] leading-none font-semibold">
                {data.mostHoursStudied.name}
              </div>
              <div className="font-mono text-xs opacity-80">
                {fmtHours(data.mostHoursStudied.minutes)}
              </div>
            </div>
          )}
          {data.mostItemsCompleted && (
            <div>
              <div className="font-mono text-[11px] uppercase tracking-label opacity-70">
                most items done
              </div>
              <div className="font-serif text-[40px] leading-none font-semibold">
                {data.mostItemsCompleted.name}
              </div>
              <div className="font-mono text-xs opacity-80">
                {data.mostItemsCompleted.items} items
              </div>
            </div>
          )}
          {data.perfectAttendance.length > 0 && (
            <div>
              <div className="font-mono text-[11px] uppercase tracking-label opacity-70">
                perfect attendance
              </div>
              <div className="font-serif text-[28px] leading-tight font-semibold">
                {data.perfectAttendance.map((m) => m.name).join(', ')}
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
      </WrappedBlock>
    </div>
  );
}

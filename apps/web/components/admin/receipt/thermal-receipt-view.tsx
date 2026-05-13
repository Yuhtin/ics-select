'use client';
import type { CycleReceiptResponse } from '../../../lib/queries/admin-cycle-receipt';
import { ThermalPaper } from './thermal-paper';
import { ThermalRow } from './thermal-row';
import { ThermalBar } from './thermal-bar';
import { CohortKnowledgeGrid } from '../cohort-knowledge-grid';

const fmtHours = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
};
const fmtPct = (p: number) => `${Math.round(p * 100)}%`;
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  });

const divider = '═══════════════════════════════════════════════════';
const dashed = '───────────────────────────────────────────────────';

const truncateTopic = (s: string) => (s.length > 22 ? `${s.slice(0, 21)}…` : s);

export function ThermalReceiptView({ data }: { data: CycleReceiptResponse }) {
  const t = data.totals;
  const topByTopic = data.byTopic.slice(0, 12);
  const remainingTopics = data.byTopic.length - topByTopic.length;
  const earlyInCycle = data.cycle.weekNumber <= 1 && data.totals.itemsCompleted < 5;

  return (
    <ThermalPaper>
      {earlyInCycle && (
        <div className="mb-4 border border-dashed border-ink-faint p-3 text-[11px] uppercase tracking-label text-ink-mute">
          early in the cycle — numbers will grow
        </div>
      )}

      <div className="text-center">
        <div className="text-2xl font-semibold tracking-wide">ICS · SELECT</div>
        <div className="mb-2 text-[11px] text-ink-soft">───────────────</div>
        <div className="text-sm uppercase tracking-wider">
          COHORT RECEIPT · {data.cycle.name.toUpperCase()}
        </div>
        <div className="mt-1 text-[11px] uppercase tracking-label text-ink-mute">
          {fmtDate(data.asOf)} · WK {data.cycle.weekNumber} of {data.cycle.weeksTotal} ·{' '}
          {fmtTime(data.asOf)} BRT
        </div>
      </div>

      <div className="my-5 text-center text-ink-faint">{divider}</div>

      <ThermalRow label="members in cohort" value={String(t.members)} />
      <ThermalRow label="total hours studied" value={fmtHours(t.totalMinutes)} />
      <ThermalRow label="avg per member" value={fmtHours(t.avgMinutesPerMember)} />
      <ThermalRow label="items completed" value={String(t.itemsCompleted)} />
      <ThermalRow label="retros submitted" value={String(t.retros)} />
      <ThermalRow label="classes held" value={`${t.classesHeld} / ${t.classesTotal}`} />
      <ThermalRow label="attendance rate" value={fmtPct(t.attendanceRate)} />

      <div className="my-5 text-center text-ink-faint">{divider}</div>

      <div className="mb-1 text-sm uppercase tracking-wider">By topic</div>
      <div className="mb-3 text-ink-faint">{dashed}</div>
      {data.byTopic.length === 0 && (
        <div className="text-[12px] text-ink-mute">nothing studied yet</div>
      )}
      {topByTopic.map((b) => (
        <div
          key={b.topicId}
          className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-[13px] leading-6"
        >
          <span>{truncateTopic(b.label.toLowerCase())}</span>
          <ThermalBar pct={b.coveragePct} />
          <span className="w-10 text-right">{fmtPct(b.coveragePct)}</span>
        </div>
      ))}
      {remainingTopics > 0 && (
        <div className="mt-1 text-[12px] text-ink-mute">+{remainingTopics} more topics</div>
      )}

      <div className="my-5 text-center text-ink-faint">{divider}</div>

      <div className="mb-1 text-sm uppercase tracking-wider">Knowledge grid</div>
      <div className="mb-3 text-ink-faint">{dashed}</div>
      <CohortKnowledgeGrid
        members={data.knowledgeGrid.members}
        topics={data.knowledgeGrid.topics}
        cells={data.knowledgeGrid.cells}
        variant="thermal"
      />

      {data.topMovers.length > 0 && (
        <>
          <div className="my-5 text-center text-ink-faint">{divider}</div>
          <div className="mb-1 text-sm uppercase tracking-wider">Top movers · last 7 days</div>
          <div className="mb-3 text-ink-faint">{dashed}</div>
          {data.topMovers.map((m) => (
            <div key={m.userId} className="mb-2 text-[13px] leading-5">
              <div>
                ▸ {m.name}     +{m.deltaItems} items
              </div>
              {m.topTopics.length > 0 && (
                <div className="pl-3 text-ink-mute">
                  {m.topTopics.join(', ').toLowerCase()}
                </div>
              )}
            </div>
          ))}
        </>
      )}

      <div className="my-5 text-center text-ink-faint">{divider}</div>

      <div className="mb-1 text-sm uppercase tracking-wider">Hall of fame</div>
      <div className="mb-3 text-ink-faint">{dashed}</div>
      {data.engagementLeader && (
        <div className="text-[13px] leading-5">
          top engagement    ▸ {data.engagementLeader.name} · score {data.engagementLeader.score}
        </div>
      )}
      {data.streakChampion && (
        <div className="text-[13px] leading-5">
          streak champion   ▸ {data.streakChampion.name} · {data.streakChampion.streakDays}d
        </div>
      )}
      {data.mostHoursStudied && (
        <div className="text-[13px] leading-5">
          most hours        ▸ {data.mostHoursStudied.name} · {fmtHours(data.mostHoursStudied.minutes)}
        </div>
      )}
      {data.mostItemsCompleted && (
        <div className="text-[13px] leading-5">
          most items done   ▸ {data.mostItemsCompleted.name} · {data.mostItemsCompleted.items}
        </div>
      )}
      {data.perfectAttendance.length > 0 && (
        <div className="text-[13px] leading-5">
          perfect attend.   ▸ {data.perfectAttendance.map((m) => m.name).join(', ')}
        </div>
      )}

      <div className="my-5 text-center text-ink-faint">{divider}</div>

      <div className="text-center text-[13px]">
        <div className="uppercase tracking-wider">Thank you for studying</div>
        <div className="mt-1 text-base">★ ★ ★ ★ ★</div>
        <div className="mt-3 text-ink-mute">─ keep going ─</div>
      </div>
    </ThermalPaper>
  );
}

'use client';
import { SectionLabel } from '../../ui/section-label';
import { Eyebrow } from '../../ui/eyebrow';
import type { PlanContextResponse } from '../../../lib/queries/admin-plan-context';
import { TopicCoverageMini } from './topic-coverage-mini';
import { CarryOverList } from './carry-over-list';

const TRACK_LABEL: Record<string, string> = {
  BIG_TECH: 'Big Tech',
  CONSULTING_TECH: 'Consulting Tech',
  COMPETITIVE_PROGRAMMING: 'Competitive',
  STARTUP: 'Startup',
  OTHER: 'Other',
};

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface ContextPanelProps {
  data: PlanContextResponse;
  carryOverIds: string[];
  onCarryOverChange: (ids: string[]) => void;
}

export function ContextPanel({ data, carryOverIds, onCarryOverChange }: ContextPanelProps) {
  const outcomes = data.lastWeek.outcomes;
  const totalOutcomes =
    outcomes.done_easy + outcomes.done_hard + outcomes.doubts + outcomes.stuck + outcomes.pending;

  return (
    <div className="space-y-10">
      <header>
        <Eyebrow>Context · Read-only</Eyebrow>
        <h2 className="mt-2 font-serif-tool text-2xl font-semibold tracking-tight text-ink">
          {data.member.name}
        </h2>
        <p className="mt-1 font-mono text-xs text-ink-mute">
          {data.member.track ? TRACK_LABEL[data.member.track] ?? data.member.track : 'No track'}
          {' · '}
          {data.cycle.name} · week {data.cycle.weekNumber} of {data.cycle.weeksTotal}
        </p>
      </header>

      <section className="pt-8 border-t border-rule">
        <SectionLabel>Last week · {totalOutcomes} outcomes</SectionLabel>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <OutcomeCell dotClass="bg-outcome-done-easy" label="Nailed it" count={outcomes.done_easy} />
          <OutcomeCell dotClass="bg-outcome-done-hard" label="Got it · hard" count={outcomes.done_hard} />
          <OutcomeCell dotClass="bg-outcome-doubts" label="Had doubts" count={outcomes.doubts} />
          <OutcomeCell dotClass="bg-outcome-stuck" label="Stuck" count={outcomes.stuck} />
          <OutcomeCell dotClass="bg-outcome-pending" label="Pending" count={outcomes.pending} />
        </div>
      </section>

      <section className="pt-8 border-t border-rule">
        <SectionLabel>Carry-over candidates</SectionLabel>
        <div className="mt-3">
          <CarryOverList
            candidates={data.carryOverCandidates}
            value={carryOverIds}
            onChange={onCarryOverChange}
          />
        </div>
      </section>

      <section className="pt-8 border-t border-rule">
        <SectionLabel>
          {data.retro
            ? `Retro · submitted ${formatDate(data.retro.submittedAt)}`
            : 'Retro'}
        </SectionLabel>
        <div className="mt-3 space-y-4">
          {data.retro ? (
            <>
              {data.retro.whatClicked && (
                <RetroBlock label="What clicked" text={data.retro.whatClicked} />
              )}
              {data.retro.whatStuck && (
                <RetroBlock label="What stuck" text={data.retro.whatStuck} />
              )}
              {data.retro.nextWeekWish && (
                <RetroBlock label="Next week wish" text={data.retro.nextWeekWish} />
              )}
            </>
          ) : (
            <p className="font-mono text-xs text-ink-mute">No retro submitted last week.</p>
          )}
        </div>
      </section>

      <section className="pt-8 border-t border-rule">
        <SectionLabel>Topic coverage · this cycle</SectionLabel>
        <div className="mt-3">
          <TopicCoverageMini topics={data.topicCoverage} />
        </div>
      </section>

      <section className="pt-8 border-t border-rule">
        <details className="group">
          <summary className="cursor-pointer list-none font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute font-semibold flex items-center gap-2 hover:text-ink">
            <span className="inline-block transition-transform group-open:rotate-90">▸</span>
            AI diagnose
          </summary>
          <p className="mt-3 font-mono text-xs text-ink-mute">
            Diagnose will be wired in a future iteration. Click regenerate to trigger.
          </p>
        </details>
      </section>
    </div>
  );
}

function OutcomeCell({
  dotClass,
  label,
  count,
}: {
  dotClass: string;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass}`} />
      <div className="flex-1 min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute font-semibold">
          {label}
        </p>
      </div>
      <span className="font-mono text-xl tabular-nums font-semibold text-ink">{count}</span>
    </div>
  );
}

function RetroBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="border-l-2 border-accent pl-4 py-2 bg-paper-warm/40">
      <p className="font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute font-semibold">
        {label}
      </p>
      <p className="mt-1 font-serif-tool text-sm italic text-ink leading-relaxed">&ldquo;{text}&rdquo;</p>
    </div>
  );
}

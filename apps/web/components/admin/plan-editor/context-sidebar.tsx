'use client';
import { SectionLabel } from '../../ui/section-label';
import type { PlanContextResponse } from '../../../lib/queries/admin-plan-context';
import { CarryOverList } from './carry-over-list';
import { TopicCoverageMini } from './topic-coverage-mini';

interface ContextSidebarProps {
  data: PlanContextResponse;
  carryOverIds: string[];
  onCarryOverChange: (ids: string[]) => void;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function ContextSidebar({
  data,
  carryOverIds,
  onCarryOverChange,
}: ContextSidebarProps) {
  const o = data.lastWeek.outcomes;
  const totalOutcomes =
    o.done_easy + o.done_hard + o.doubts + o.stuck + o.skipped + o.pending;

  return (
    <div className="space-y-8 rounded-card border border-rule bg-surface p-4">
      <section>
        <SectionLabel>Last week · {totalOutcomes} outcomes</SectionLabel>
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
          <OutcomeRow dot="bg-outcome-done-easy" label="Nailed it" count={o.done_easy} />
          <OutcomeRow dot="bg-outcome-skipped" label="Skipped" count={o.skipped} />
          <OutcomeRow dot="bg-outcome-done-hard" label="Got it · hard" count={o.done_hard} />
          <OutcomeRow dot="bg-outcome-doubts" label="Had doubts" count={o.doubts} />
          <OutcomeRow dot="bg-outcome-stuck" label="Stuck" count={o.stuck} />
          <OutcomeRow dot="bg-outcome-pending" label="Pending" count={o.pending} />
        </div>
      </section>

      <section className="border-t border-rule pt-6">
        <SectionLabel>Carry-over candidates</SectionLabel>
        <div className="mt-3">
          <CarryOverList
            candidates={data.carryOverCandidates}
            value={carryOverIds}
            onChange={onCarryOverChange}
          />
        </div>
      </section>

      <section className="border-t border-rule pt-6">
        <SectionLabel>
          {data.retro
            ? `Retro · submitted ${formatDate(data.retro.submittedAt)}`
            : 'Retro'}
        </SectionLabel>
        <div className="mt-3 space-y-3">
          {data.retro ? (
            <>
              {data.retro.whatClicked && (
                <RetroBlock
                  label="What clicked"
                  text={data.retro.whatClicked}
                  linkedItem={data.retro.valuedItem}
                />
              )}
              {data.retro.whatStuck && (
                <RetroBlock
                  label="What stuck"
                  text={data.retro.whatStuck}
                  linkedItem={data.retro.stuckItem}
                />
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

      <section className="border-t border-rule pt-6">
        <SectionLabel>Topic coverage · this cycle</SectionLabel>
        <div className="mt-3">
          <TopicCoverageMini topics={data.topicCoverage} />
        </div>
      </section>
    </div>
  );
}

function OutcomeRow({
  dot,
  label,
  count,
}: {
  dot: string;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
      <p className="flex-1 truncate font-mono text-[10px] uppercase tracking-label text-ink-mute">
        {label}
      </p>
      <span className="font-mono text-sm tabular-nums font-semibold text-ink">{count}</span>
    </div>
  );
}

function RetroBlock({
  label,
  text,
  linkedItem,
}: {
  label: string;
  text: string;
  linkedItem?: { id: string; title: string; outcome: string } | null;
}) {
  return (
    <div className="border-l-2 border-accent bg-paper-warm/40 py-2 pl-3">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-ink-mute">
        {label}
      </p>
      {linkedItem && (
        <p className="mt-1 font-mono text-[11px] text-ink-mute">
          → {linkedItem.title}
          <span className="ml-2 text-ink-faint">[{linkedItem.outcome}]</span>
        </p>
      )}
      <p className="mt-1 font-serif-tool text-sm italic leading-relaxed text-ink">
        &ldquo;{text}&rdquo;
      </p>
    </div>
  );
}

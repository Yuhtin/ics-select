'use client';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { TopicCoverageHeatmap, type CoverageTopic } from '../../member/topic-coverage-heatmap';
import type { PlanContextResponse } from '../../../lib/queries/admin-plan-context';

type Chip = 'retro' | 'coverage' | null;
const LS_KEY = 'plan-editor-context-open';

const WEEKDAY_KEYS = [
  ['mondayMinutes', 'Mon'],
  ['tuesdayMinutes', 'Tue'],
  ['wednesdayMinutes', 'Wed'],
  ['thursdayMinutes', 'Thu'],
  ['fridayMinutes', 'Fri'],
  ['saturdayMinutes', 'Sat'],
  ['sundayMinutes', 'Sun'],
] as const;

export type ContextStripProps = {
  data: PlanContextResponse;
};

export function ContextStrip({ data }: ContextStripProps) {
  const [open, setOpen] = useState<Chip>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(LS_KEY);
    if (stored === 'retro' || stored === 'coverage') setOpen(stored);
  }, []);

  function toggle(chip: Exclude<Chip, null>) {
    const next = open === chip ? null : chip;
    setOpen(next);
    if (typeof window !== 'undefined') {
      if (next) window.localStorage.setItem(LS_KEY, next);
      else window.localStorage.removeItem(LS_KEY);
    }
  }

  const cycleLabel = data.cycle
    ? `Cycle wk ${data.cycle.weekNumber}/${data.cycle.weeksTotal}${
        data.availability ? ` · ${data.availability.daysRemaining}d left` : ''
      }`
    : null;

  const budgetSummary = useMemo(() => {
    if (!data.availability) return 'Budget — · sem availability';
    const active: number[] = [];
    const activeDays: string[] = [];
    for (const [key, label] of WEEKDAY_KEYS) {
      const minutes = (data.availability as any)[key] as number;
      if (minutes > 0) {
        active.push(minutes);
        activeDays.push(label);
      }
    }
    if (active.length === 0) return 'Budget 0m/day · sem dias ativos';
    const avg = Math.round(active.reduce((sum, m) => sum + m, 0) / active.length);
    return `Budget ${avg}m/day · ${activeDays.join('/')}`;
  }, [data.availability]);

  const retroLabel = data.retro ? 'Last retro' : 'No retro yet';
  const retroDisabled = !data.retro;
  const coverageLabel = `Topic coverage · ${data.topicCoverage?.length ?? 0} topics`;
  const coverageDisabled = (data.topicCoverage?.length ?? 0) === 0;

  const coverageTopics: CoverageTopic[] = useMemo(
    () =>
      (data.topicCoverage ?? []).map((t) => ({
        topicId: t.topicId,
        slug: t.topicSlug,
        label: t.topicLabel,
        order: t.order,
        itemsPlanned: t.itemsPlanned,
        itemsDone: t.itemsDone,
      })),
    [data.topicCoverage],
  );

  return (
    <section className="mb-4">
      <div className="flex flex-wrap items-center gap-2 px-1">
        <Chip
          active={open === 'retro'}
          clickable={!retroDisabled}
          onClick={() => toggle('retro')}
        >
          {retroLabel}
        </Chip>
        <Chip
          active={open === 'coverage'}
          clickable={!coverageDisabled}
          onClick={() => toggle('coverage')}
        >
          {coverageLabel}
        </Chip>
        {cycleLabel && <Chip>{cycleLabel}</Chip>}
        <Chip>{budgetSummary}</Chip>
      </div>

      {open === 'retro' && data.retro && (
        <div className="mt-3 space-y-3 rounded-card border border-rule bg-paper-warm p-4">
          <p className="font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute">
            Retro · submitted {new Date(data.retro.submittedAt).toLocaleDateString('pt-BR')}
          </p>
          {data.retro.whatClicked && (
            <RetroField label="What clicked" value={data.retro.whatClicked} />
          )}
          {data.retro.whatStuck && (
            <RetroField label="What stuck" value={data.retro.whatStuck} />
          )}
          {data.retro.nextWeekWish && (
            <RetroField label="Wish for next week" value={data.retro.nextWeekWish} />
          )}
        </div>
      )}

      {open === 'coverage' && coverageTopics.length > 0 && (
        <div className="mt-3 rounded-card border border-rule bg-paper-warm p-4">
          <TopicCoverageHeatmap topics={coverageTopics} tileSize={18} showLegend={false} />
        </div>
      )}
    </section>
  );
}

function RetroField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute">{label}</p>
      <blockquote className="mt-1 border-l-2 border-accent pl-3 font-serif-tool text-sm italic text-ink-soft">
        {value}
      </blockquote>
    </div>
  );
}

function Chip(props: {
  children: React.ReactNode;
  clickable?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  if (props.clickable) {
    return (
      <button
        type="button"
        onClick={props.onClick}
        className={clsx(
          'inline-flex items-center gap-1 rounded-pill border px-3 py-1 font-mono text-[10px] uppercase tracking-label transition-colors',
          props.active
            ? 'border-ink bg-ink text-paper'
            : 'border-rule bg-surface text-ink-soft hover:border-ink-soft hover:bg-paper-warm',
        )}
      >
        {props.children}
        <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
      </button>
    );
  }
  return (
    <span className="inline-flex cursor-default items-center gap-1 rounded-pill border border-rule bg-surface px-3 py-1 font-mono text-[10px] uppercase tracking-label text-ink-mute">
      {props.children}
    </span>
  );
}

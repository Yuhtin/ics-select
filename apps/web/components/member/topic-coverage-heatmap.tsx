'use client';

import { clsx } from 'clsx';
import { useMemo } from 'react';
import { PHASES, topicPhase, type PhaseKey } from '../../lib/topics/phase';

export type CoverageTopic = {
  topicId: string;
  slug: string;
  label: string;
  order: number;
  itemsPlanned: number;
  itemsDone: number;
};

function cellTone(planned: number, done: number): string {
  if (planned === 0) return 'bg-paper-warm';
  const pct = done / planned;
  if (pct === 0) return 'bg-ink/10';
  if (pct <= 0.25) return 'bg-ink/25';
  if (pct <= 0.5) return 'bg-ink/45';
  if (pct < 1) return 'bg-ink/70';
  return 'bg-ink';
}

function cellTextTone(planned: number, done: number): string {
  if (planned === 0) return 'text-ink-faint';
  const pct = done / planned;
  return pct > 0.5 ? 'text-paper' : 'text-ink-soft';
}

interface Props {
  topics: CoverageTopic[];
  selectedId?: string | null;
  onSelect?: (topicId: string | null) => void;
  density?: 'compact' | 'comfortable';
}

export function TopicCoverageHeatmap({
  topics,
  selectedId,
  onSelect,
  density = 'comfortable',
}: Props) {
  const grouped = useMemo(() => {
    const byPhase = new Map<PhaseKey, CoverageTopic[]>();
    for (const t of topics) {
      const phase = topicPhase(t.order);
      const bucket = byPhase.get(phase);
      if (bucket) bucket.push(t);
      else byPhase.set(phase, [t]);
    }
    for (const arr of byPhase.values()) arr.sort((a, b) => a.order - b.order);
    return PHASES
      .map((p) => ({ ...p, topics: byPhase.get(p.key) ?? [] }))
      .filter((p) => p.topics.length > 0);
  }, [topics]);

  const cellClass =
    density === 'compact'
      ? 'h-6 min-w-0 flex-1 px-1.5'
      : 'h-7 min-w-[84px] px-2';

  const labelSize = density === 'compact' ? 'text-[9px]' : 'text-[10px]';

  return (
    <div className="space-y-4">
      {grouped.map((phase) => {
        const phasePlanned = phase.topics.reduce((s, t) => s + t.itemsPlanned, 0);
        const phaseDone = phase.topics.reduce((s, t) => s + t.itemsDone, 0);
        return (
          <div key={phase.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-ink-mute">
                {phase.label}
              </p>
              <p className="font-mono text-[10px] tabular-nums text-ink-faint">
                {phaseDone}/{phasePlanned}
              </p>
            </div>
            <div className="flex flex-wrap gap-1">
              {phase.topics.map((t) => {
                const tone = cellTone(t.itemsPlanned, t.itemsDone);
                const textTone = cellTextTone(t.itemsPlanned, t.itemsDone);
                const isSelected = selectedId === t.topicId;
                return (
                  <div
                    key={t.topicId}
                    onMouseEnter={onSelect ? () => onSelect(t.topicId) : undefined}
                    onMouseLeave={onSelect ? () => onSelect(null) : undefined}
                    title={`${t.label} — ${t.itemsDone}/${t.itemsPlanned}`}
                    className={clsx(
                      'flex items-center gap-1.5 rounded-sm border transition-colors',
                      cellClass,
                      tone,
                      textTone,
                      isSelected ? 'border-ink ring-1 ring-ink' : 'border-transparent',
                      onSelect && 'cursor-default',
                    )}
                  >
                    <span
                      className={clsx(
                        'font-mono uppercase tracking-label truncate',
                        labelSize,
                      )}
                    >
                      {t.label}
                    </span>
                    <span
                      className={clsx(
                        'ml-auto font-mono tabular-nums opacity-80',
                        density === 'compact' ? 'text-[9px]' : 'text-[9px]',
                      )}
                    >
                      {t.itemsDone}/{t.itemsPlanned}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
  /**
   * Materials in the library for this topic. When given it replaces
   * itemsPlanned as the denominator, so "done everything assigned" stops
   * looking like "done the whole topic" once the acervo grows.
   */
  itemsAvailable?: number;
};

function denominatorOf(t: CoverageTopic): number {
  return t.itemsAvailable ?? t.itemsPlanned;
}

type MasteryTier = 'none' | 'started' | 'on-track' | 'complete';

function tierOf(planned: number, done: number): MasteryTier {
  if (planned === 0) return 'none';
  const pct = done / planned;
  if (pct >= 1) return 'complete';
  if (pct >= 0.5) return 'on-track';
  return 'started';
}

const TIER_BG: Record<MasteryTier, string> = {
  none: 'bg-paper-warm',
  started: 'bg-ink/20',
  'on-track': 'bg-ink/60',
  complete: 'bg-ink',
};

interface Props {
  topics: CoverageTopic[];
  selectedId?: string | null;
  onSelect?: (topicId: string | null) => void;
  tileSize?: number;
  showLegend?: boolean;
}

export function TopicCoverageHeatmap({
  topics,
  selectedId,
  onSelect,
  tileSize = 22,
  showLegend = true,
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
    return PHASES.map((p) => ({
      ...p,
      topics: byPhase.get(p.key) ?? [],
    })).filter((p) => p.topics.length > 0);
  }, [topics]);

  const dim = { width: tileSize, height: tileSize };

  return (
    <div className="space-y-3">
      <div className="space-y-3">
        {grouped.map((phase) => {
          const phasePlanned = phase.topics.reduce(
            (s, t) => s + denominatorOf(t),
            0,
          );
          const phaseDone = phase.topics.reduce((s, t) => s + t.itemsDone, 0);
          const phaseCovered = phase.topics.filter(
            (t) => t.itemsPlanned > 0,
          ).length;
          return (
            <div key={phase.key}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-ink-mute">
                  {phase.label}
                </p>
                <p className="font-mono text-[10px] tabular-nums text-ink-faint">
                  <span className="text-ink-mute">{phaseCovered}</span>
                  <span>/{phase.topics.length} covered · </span>
                  <span className="text-ink-mute">{phaseDone}</span>
                  <span>/{phasePlanned}</span>
                </p>
              </div>
              <div className="flex flex-wrap gap-[3px]">
                {phase.topics.map((t) => {
                  const tier = tierOf(denominatorOf(t), t.itemsDone);
                  const isSelected = selectedId === t.topicId;
                  return (
                    <div
                      key={t.topicId}
                      onMouseEnter={
                        onSelect ? () => onSelect(t.topicId) : undefined
                      }
                      onMouseLeave={
                        onSelect ? () => onSelect(null) : undefined
                      }
                      title={`${t.label} — ${t.itemsDone}/${denominatorOf(t)}`}
                      style={dim}
                      className={clsx(
                        'rounded-[3px] border transition-all',
                        TIER_BG[tier],
                        isSelected
                          ? 'scale-110 border-ink shadow-sm'
                          : 'border-transparent',
                      )}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {showLegend && (
        <div className="flex items-center gap-2 pt-1">
          <span className="font-mono text-[9px] uppercase tracking-label text-ink-faint">
            less
          </span>
          <div className="flex gap-[3px]">
            {(['none', 'started', 'on-track', 'complete'] as const).map(
              (tier) => (
                <div
                  key={tier}
                  className={clsx(
                    'h-2.5 w-2.5 rounded-[2px]',
                    TIER_BG[tier],
                  )}
                />
              ),
            )}
          </div>
          <span className="font-mono text-[9px] uppercase tracking-label text-ink-faint">
            more
          </span>
        </div>
      )}
    </div>
  );
}

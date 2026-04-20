'use client';

import { clsx } from 'clsx';
import { useMemo, useState } from 'react';
import {
  TopicCoverageHeatmap,
  type CoverageTopic,
} from '../../member/topic-coverage-heatmap';
import { PhaseSummaryStrip } from './phase-summary-strip';

interface Props {
  topics: CoverageTopic[];
}

export function TopicCoverageMatrix({ topics }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const active = useMemo(
    () =>
      topics
        .filter((t) => t.itemsPlanned > 0 || t.itemsDone > 0)
        .sort(
          (a, b) =>
            b.itemsDone - a.itemsDone || b.itemsPlanned - a.itemsPlanned,
        ),
    [topics],
  );

  return (
    <div className="space-y-6">
      <PhaseSummaryStrip topics={topics} />

      <div className="grid gap-8 lg:grid-cols-[3fr_2fr]">
        <div className="min-w-0">
          <TopicCoverageHeatmap
            topics={topics}
            selectedId={selectedId}
            onSelect={setSelectedId}
            tileSize={24}
          />
        </div>

        <div className="min-w-0">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-ink-mute">
              Active topics · by effort
            </p>
            <p className="font-mono text-[10px] tabular-nums text-ink-faint">
              {active.length}
            </p>
          </div>
          {active.length === 0 ? (
            <p className="font-mono text-xs text-ink-mute">
              No activity yet this cycle.
            </p>
          ) : (
            <ul className="max-h-[360px] space-y-0.5 overflow-y-auto pr-1">
              {active.map((t) => {
                const pct =
                  t.itemsPlanned === 0 ? 0 : t.itemsDone / t.itemsPlanned;
                const isSelected = selectedId === t.topicId;
                return (
                  <li
                    key={t.topicId}
                    onMouseEnter={() => setSelectedId(t.topicId)}
                    onMouseLeave={() => setSelectedId(null)}
                    className={clsx(
                      'flex items-center gap-3 rounded border border-transparent px-2 py-1.5 transition-colors',
                      isSelected
                        ? 'border-rule bg-paper-warm'
                        : 'hover:bg-paper-warm',
                    )}
                  >
                    <span className="flex-1 truncate font-mono text-[11px] uppercase tracking-label text-ink-soft">
                      {t.label}
                    </span>
                    <div className="relative h-1.5 w-16 overflow-hidden rounded-sm bg-rule">
                      <div
                        className="absolute left-0 top-0 h-full bg-ink transition-all"
                        style={{ width: `${pct * 100}%` }}
                      />
                    </div>
                    <span className="w-10 text-right font-mono text-[10px] tabular-nums text-ink-mute">
                      {t.itemsDone}/{t.itemsPlanned}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useMemo } from 'react';
import { clsx } from 'clsx';
import {
  PHASES,
  topicPhase,
  type PhaseKey,
} from '../../../lib/topics/phase';
import type { CoverageTopic } from '../../member/topic-coverage-heatmap';

interface Props {
  topics: CoverageTopic[];
}

type PhaseStat = {
  key: PhaseKey;
  label: string;
  topicCount: number;
  topicsWithActivity: number;
  planned: number;
  done: number;
  pct: number;
};

export function PhaseSummaryStrip({ topics }: Props) {
  const phases = useMemo<PhaseStat[]>(() => {
    const byPhase = new Map<PhaseKey, CoverageTopic[]>();
    for (const t of topics) {
      const phase = topicPhase(t.order);
      const bucket = byPhase.get(phase);
      if (bucket) bucket.push(t);
      else byPhase.set(phase, [t]);
    }
    return PHASES.map((p) => {
      const arr = byPhase.get(p.key) ?? [];
      const planned = arr.reduce((s, t) => s + t.itemsPlanned, 0);
      const done = arr.reduce((s, t) => s + t.itemsDone, 0);
      return {
        key: p.key,
        label: p.label,
        topicCount: arr.length,
        topicsWithActivity: arr.filter((t) => t.itemsPlanned > 0).length,
        planned,
        done,
        pct: planned === 0 ? 0 : done / planned,
      };
    }).filter((p) => p.topicCount > 0);
  }, [topics]);

  if (phases.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {phases.map((p) => (
        <PhaseDonut key={p.key} stat={p} />
      ))}
    </div>
  );
}

function PhaseDonut({ stat }: { stat: PhaseStat }) {
  const size = 44;
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const hasAny = stat.planned > 0;
  const pct = Math.max(0, Math.min(1, stat.pct));
  const dash = hasAny ? c * pct : 0;
  return (
    <div className="flex items-center gap-3 border border-rule rounded-card p-3 bg-surface">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-rule"
        />
        {hasAny && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${c}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="stroke-ink transition-[stroke-dasharray]"
          />
        )}
        <text
          x="50%"
          y="50%"
          textAnchor="middle"
          dominantBaseline="central"
          className={clsx(
            'font-mono tabular-nums',
            hasAny ? 'fill-ink' : 'fill-ink-faint',
          )}
          style={{ fontSize: 10, fontWeight: 600 }}
        >
          {hasAny ? `${Math.round(pct * 100)}` : '—'}
        </text>
      </svg>
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-ink-mute">
          {stat.label}
        </p>
        <p className="mt-0.5 font-mono text-[10px] tabular-nums text-ink-faint">
          <span className="text-ink-soft">{stat.done}</span>
          <span>/{stat.planned} done</span>
        </p>
      </div>
    </div>
  );
}

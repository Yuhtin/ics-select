'use client';
import { clsx } from 'clsx';
import type { PlanContextResponse } from '../../../lib/queries/admin-plan-context';

type Candidate = PlanContextResponse['carryOverCandidates'][number];
const DOT_BY_OUTCOME: Record<Candidate['outcome'], string> = {
  PENDING: 'bg-outcome-pending',
  DOUBTS: 'bg-outcome-doubts',
  STUCK: 'bg-outcome-stuck',
};

export function CarryOverList({
  candidates,
  value,
  onChange,
}: {
  candidates: Candidate[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  if (candidates.length === 0) {
    return <p className="font-mono text-xs text-ink-mute">No unfinished items to carry over.</p>;
  }
  const toggle = (id: string) => {
    const next = value.includes(id) ? value.filter((x) => x !== id) : [...value, id];
    onChange(next);
  };
  return (
    <ul className="space-y-2">
      {candidates.map((c) => {
        const checked = value.includes(c.id);
        return (
          <li key={c.id}>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                className="mt-1 accent-ink"
                checked={checked}
                onChange={() => toggle(c.id)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={clsx('inline-block h-2 w-2 rounded-full', DOT_BY_OUTCOME[c.outcome])} />
                  <span className="font-serif-tool text-sm font-semibold text-ink">
                    {c.title}
                  </span>
                </div>
                {c.reflection && (
                  <p className="mt-1 font-sans text-xs text-ink-soft italic line-clamp-2">
                    &ldquo;{c.reflection}&rdquo;
                  </p>
                )}
                <div className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-label text-ink-mute">
                  {c.topicLabel && <span>{c.topicLabel}</span>}
                  {c.topicLabel && <span>·</span>}
                  <span>{c.estimatedMinutes}m</span>
                </div>
              </div>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

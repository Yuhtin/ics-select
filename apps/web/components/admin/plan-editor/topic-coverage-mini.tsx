import { clsx } from 'clsx';
import type { PlanContextResponse } from '../../../lib/queries/admin-plan-context';

type Topic = PlanContextResponse['topicCoverage'][number];

function shade(pct: number): string {
  if (pct === 0) return 'bg-rule';
  if (pct <= 25) return 'bg-ink/20';
  if (pct <= 50) return 'bg-ink/40';
  if (pct <= 80) return 'bg-ink/70';
  return 'bg-ink';
}

export function TopicCoverageMini({ topics }: { topics: Topic[] }) {
  if (topics.length === 0) {
    return <p className="font-mono text-xs text-ink-mute">No topics defined.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {topics.map((t) => (
        <li key={t.topicId} className="flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-label text-ink-soft w-24 truncate">
            {t.topicLabel}
          </span>
          <div className="relative flex-1 h-2 bg-paper-warm rounded-sm overflow-hidden">
            <div
              className={clsx('absolute left-0 top-0 h-full transition-all', shade(t.coveragePct))}
              style={{ width: `${t.coveragePct}%` }}
            />
          </div>
          <span className="font-mono text-[11px] tabular-nums text-ink-mute">
            {t.itemsDone}/{t.itemsPlanned}
          </span>
        </li>
      ))}
    </ul>
  );
}

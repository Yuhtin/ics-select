'use client';
import { clsx } from 'clsx';
import type { MemberRank } from '../../lib/queries/me-cohort';

interface CohortRankingProps {
  ranking: MemberRank[];
  weekEndsAt: string | null;
  className?: string;
}

export function CohortRanking({ ranking, weekEndsAt, className }: CohortRankingProps) {
  return (
    <div className={clsx('space-y-4', className)}>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute font-semibold">
          This week
        </p>
        <h2 className="mt-1 font-serif text-lg font-medium">Who&apos;s firm</h2>
        {weekEndsAt && (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-label text-ink-mute">
            Ends {new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(weekEndsAt))}
          </p>
        )}
      </div>
      <ol className="space-y-0.5">
        {ranking.map((r, i) => (
          <li
            key={r.userId}
            className={clsx(
              'flex items-center gap-3 rounded-card px-2 py-2',
              r.isMe && 'bg-paper-warm border border-ink',
            )}
          >
            <span className="w-6 font-serif-tool text-sm tabular-nums font-semibold text-ink-mute">
              {String(i + 1).padStart(2, '0')}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={clsx(
                  'truncate font-sans text-sm',
                  r.isMe ? 'font-semibold text-ink' : 'text-ink-soft',
                )}
              >
                {r.name}
                {r.isMe && <span className="ml-1 text-ink-mute">(you)</span>}
              </p>
              <div className="mt-1 h-1 w-full rounded-full bg-rule">
                <div className="h-full rounded-full bg-ink" style={{ width: `${r.percent}%` }} />
              </div>
            </div>
            <span className="font-mono text-[11px] tabular-nums text-ink">{r.percent}%</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

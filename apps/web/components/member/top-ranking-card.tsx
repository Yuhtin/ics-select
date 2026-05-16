'use client';

import { clsx } from 'clsx';
import type { MemberRank } from '../../lib/queries/me-cohort';

interface Props {
  ranking: MemberRank[];
  className?: string;
}

export function TopRankingCard({ ranking, className }: Props) {
  const top3 = ranking.slice(0, 3);
  if (top3.length === 0) return null;

  return (
    <section
      className={clsx(
        'rounded-tile border border-border-token bg-surface p-6',
        className,
      )}
    >
      <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute">
        Top 3 · Cohort
      </p>
      <ol className="mt-3 flex flex-col gap-2.5">
        {top3.map((m, idx) => {
          const place = idx + 1;
          return (
            <li
              key={m.userId}
              className={clsx(
                'flex items-baseline gap-2.5',
                m.isMe && 'rounded-md -mx-2 px-2 py-1 bg-primary-soft',
              )}
            >
              <span className="w-5 flex-none font-mono text-[11px] font-semibold tabular-nums text-fg-mute">
                {place}º
              </span>
              <span
                className={clsx(
                  'min-w-0 flex-1 truncate font-sans text-[14px] font-semibold tracking-tight',
                  m.isMe ? 'text-primary' : 'text-ink',
                )}
                title={m.name}
              >
                {m.name}
              </span>
              <span className="flex-none font-mono text-[12px] font-semibold tabular-nums text-ink">
                {m.score}
                <span className="text-fg-mute">/100</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

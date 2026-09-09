'use client';
import { clsx } from 'clsx';
import type { CohortMember, MemberRank } from '../../lib/queries/me-cohort';

interface Props {
  members: CohortMember[];
  ranking?: MemberRank[];
}

function Initials({
  name,
  pictureUrl,
  size = 44,
}: {
  name: string;
  pictureUrl: string | null;
  size?: number;
}) {
  if (pictureUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={pictureUrl}
        alt=""
        className="rounded-full border border-border-token object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      className="inline-flex items-center justify-center rounded-full border border-border-token bg-bg-subtle font-sans text-sm font-semibold text-fg-soft"
      style={{ width: size, height: size }}
    >
      {initials || '—'}
    </span>
  );
}

function scoreColor(score: number): string {
  if (score >= 66) return 'text-fg';
  if (score >= 33) return 'text-fg-soft';
  return 'text-outcome-stuck';
}

export function CohortRoster({ members, ranking }: Props) {
  if (members.length === 0) {
    return <p className="font-mono text-xs text-fg-mute">No classmates to show.</p>;
  }

  // When ranking present, use it (already sorted by score desc).
  // When absent, fall back to alphabetical members list with no score column.
  const useRanking = Boolean(ranking && ranking.length > 0);

  const rows = useRanking
    ? ranking!.map((r) => {
        const m = members.find((x) => x.userId === r.userId);
        return {
          userId: r.userId,
          name: r.name,
          pictureUrl: r.pictureUrl,
          isMe: r.isMe,
          email: m?.email ?? null,
          score: r.score,
        };
      })
    : [...members]
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
        .map((m) => ({ ...m, score: null as number | null }));

  return (
    <ol data-testid="cohort-roster" role="list" className="border-t border-border-token">
      {rows.map((row, idx) => (
        <li
          key={row.userId}
          data-testid={row.isMe ? 'cohort-member-me' : undefined}
          className={clsx(
            'grid min-h-16 items-center gap-3 border-b border-border-token py-3 last:border-b-0',
            useRanking
              ? 'grid-cols-[32px_44px_minmax(0,1fr)_auto]'
              : 'grid-cols-[44px_minmax(0,1fr)]',
            row.isMe && 'border-l-[3px] border-l-primary bg-primary-soft/60 pl-3',
          )}
        >
          {useRanking && (
            <span className="w-8 font-mono text-xs tabular-nums text-fg-mute">
              {String(idx + 1).padStart(2, '0')}
            </span>
          )}
          <Initials name={row.name} pictureUrl={row.pictureUrl} />
          <p className="min-w-0 truncate text-sm font-semibold text-fg">
            {row.name}
            {row.isMe && <span className="ml-2 text-xs text-primary dark:text-primary-fg">You</span>}
          </p>
          {useRanking && row.score !== null && (
            <span className={clsx('font-mono text-sm tabular-nums', scoreColor(row.score))}>
              {row.score}/100
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

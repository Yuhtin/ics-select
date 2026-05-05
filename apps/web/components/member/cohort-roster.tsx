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
  if (score >= 66) return 'text-outcome-done-easy';
  if (score >= 33) return 'text-outcome-done-hard';
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
    <section className="rounded-tile border border-border-token bg-surface">
      <header className="border-b border-border-token px-5 py-4">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute">
          {useRanking ? 'Cohort ranking' : 'Classmates'}
        </p>
        <p className="mt-0.5 font-sans text-sm text-fg-soft">
          {members.length} {members.length === 1 ? 'classmate' : 'classmates'} this cycle
        </p>
      </header>
      <ol role="list" className="divide-y divide-border-token">
        {rows.map((row, idx) => (
          <li
            key={row.userId}
            className={clsx(
              'flex items-center gap-4 px-5 py-3',
              row.isMe && 'bg-primary-soft',
            )}
          >
            {useRanking && (
              <span className="w-6 font-mono text-xs tabular-nums font-semibold text-fg-mute">
                {String(idx + 1).padStart(2, '0')}
              </span>
            )}
            <Initials name={row.name} pictureUrl={row.pictureUrl} />
            <div className="flex-1 min-w-0">
              <p className="flex items-center gap-2 font-sans text-sm font-medium text-fg">
                {row.name}
                {row.isMe && (
                  <span className="inline-flex h-[18px] items-center rounded-pill bg-primary px-2 font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-primary-fg">
                    You
                  </span>
                )}
              </p>
            </div>
            {useRanking && row.score !== null && (
              <span className={clsx('font-mono text-sm tabular-nums', scoreColor(row.score))}>
                {row.score}/100
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

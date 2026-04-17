'use client';
import Link from 'next/link';
import { clsx } from 'clsx';
import type { CohortStripEntry } from '../../lib/queries/admin-triage';

function Initials({
  name,
  pictureUrl,
  size = 28,
}: {
  name: string;
  pictureUrl: string | null;
  size?: number;
}) {
  if (pictureUrl) {
    return (
      <img
        src={pictureUrl}
        alt=""
        className="rounded-full object-cover border border-rule"
        style={{ width: size, height: size }}
      />
    );
  }
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-paper-warm border border-rule font-serif text-ink text-xs font-semibold"
      style={{ width: size, height: size }}
    >
      {initials || '—'}
    </span>
  );
}

export function CohortStrip({ entries }: { entries: CohortStripEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div className="flex gap-5 overflow-x-auto pb-2">
      {entries.map((e) => (
        <Link
          key={e.userId}
          href={`/admin/member/${e.userId}`}
          className="flex min-w-[86px] flex-col items-center gap-1.5 text-center hover:opacity-90"
        >
          <div className="relative">
            <Initials name={e.name} pictureUrl={e.pictureUrl} size={40} />
            <span
              className={clsx(
                'absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-paper',
                e.hasAlert ? 'bg-outcome-stuck' : 'bg-ink-faint',
              )}
            />
          </div>
          <span className="font-sans text-xs text-ink-soft truncate max-w-[86px]">
            {e.name.split(' ')[0]}
          </span>
          <span className="font-mono text-[10px] text-ink-mute">{e.percentThisWeek}%</span>
        </Link>
      ))}
    </div>
  );
}

'use client';
import Link from 'next/link';
import { clsx } from 'clsx';
import type { CycleOverviewMember } from '../../lib/queries/admin-cycle';

function Initials({
  name,
  pictureUrl,
  size = 40,
}: {
  name: string;
  pictureUrl: string | null;
  size?: number;
}) {
  if (pictureUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
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
      className="inline-flex items-center justify-center rounded-full bg-paper-warm border border-rule font-serif text-ink text-sm font-semibold"
      style={{ width: size, height: size }}
    >
      {initials || '—'}
    </span>
  );
}

function AvailabilityLine({
  availability,
}: {
  availability: CycleOverviewMember['availability'];
}) {
  const { itemsCount, plannedMinutes, budgetMinutes } = availability;
  if (itemsCount === 0) return null;
  if (budgetMinutes === 0) {
    return (
      <span className="font-mono text-[11px] text-ink-mute">
        No availability declared yet.
      </span>
    );
  }
  const pct = Math.round((plannedMinutes / budgetMinutes) * 100);
  const tone =
    pct <= 80
      ? 'text-outcome-done-easy'
      : pct <= 100
        ? 'text-outcome-done-hard'
        : 'text-outcome-stuck';
  return (
    <span className={clsx('font-mono text-[11px] tabular-nums', tone)}>
      {itemsCount} items · {plannedMinutes} / {budgetMinutes} min ({pct}%)
    </span>
  );
}

const TRACK_LABELS: Record<string, string> = {
  BIG_TECH: 'Big Tech',
  CONSULTING_TECH: 'Consulting Tech',
  COMPETITIVE_PROGRAMMING: 'Competitive',
  STARTUP: 'Startup',
  OTHER: 'Other',
};

export function CycleMembersGrid({ members }: { members: CycleOverviewMember[] }) {
  if (members.length === 0) {
    return <p className="font-mono text-xs text-ink-mute">No members yet.</p>;
  }
  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
      {members.map((m) => (
        <Link
          key={m.userId}
          href={`/admin/member/${m.userId}`}
          className="group flex flex-col gap-3 border border-rule rounded-card bg-surface p-4 transition-colors hover:bg-paper-warm"
        >
          <div className="flex items-start gap-3">
            <Initials name={m.name} pictureUrl={m.pictureUrl} />
            <div className="flex-1 min-w-0">
              <p className="font-serif-tool text-base font-semibold text-ink leading-tight truncate">
                {m.name}
              </p>
              {m.track && (
                <span className="mt-1 inline-block font-mono text-[10px] uppercase tracking-label text-ink-mute">
                  {TRACK_LABELS[m.track] ?? m.track}
                </span>
              )}
            </div>
            {m.hasAlert && (
              <span
                className="h-2 w-2 rounded-full bg-outcome-stuck"
                aria-label="Has alert"
              />
            )}
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={clsx(
                'font-mono text-xl tabular-nums',
                m.percentThisWeek >= 80 ? 'text-ink' : 'text-ink-soft',
              )}
            >
              {m.percentThisWeek}
              <span className="text-ink-mute text-xs">%</span>
            </span>
            <span className="font-mono text-[11px] text-ink-mute">
              {m.done}/{m.total} this week
            </span>
          </div>
          <AvailabilityLine availability={m.availability} />
        </Link>
      ))}
    </div>
  );
}

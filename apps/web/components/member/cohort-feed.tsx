'use client';
import { clsx } from 'clsx';
import type { CohortEvent } from '../../lib/queries/me-cohort';

function initials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');
}

function verb(kind: CohortEvent['kind']): string {
  return {
    finished: 'finished',
    got_stuck: 'got stuck on',
    had_doubts: 'had doubts on',
    posted_retro: 'posted the weekly retro',
    started_week: 'started the week',
  }[kind];
}

function relative(iso: string, now: Date = new Date()): string {
  const diffMin = Math.round((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

interface CohortFeedProps {
  feed: CohortEvent[];
  className?: string;
}

export function CohortFeed({ feed, className }: CohortFeedProps) {
  if (feed.length === 0) {
    return <p className={clsx('font-sans text-sm text-ink-mute', className)}>No activity in the last 24 hours.</p>;
  }
  return (
    <ul className={clsx('divide-y divide-rule', className)}>
      {feed.map((event) => (
        <li key={event.id} className="flex items-start gap-3 py-3">
          <div
            aria-hidden
            className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-paper-warm font-serif text-xs font-semibold text-ink"
          >
            {initials(event.member.name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-sans text-sm leading-snug">
              <span className="font-semibold text-ink">{event.member.name}</span>
              <span className="text-ink-soft"> {verb(event.kind)} </span>
              {event.itemTitle && (
                <span className="font-serif italic text-ink">{event.itemTitle}</span>
              )}
            </p>
            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-label text-ink-mute">
              {relative(event.at)}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

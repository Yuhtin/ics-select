'use client';

import Link from 'next/link';
import type { CalendarEvent } from '../../../lib/queries/me-calendar';
import { detectPlatform } from '../../../lib/format/platform';
import { Eyebrow } from '../../ui/eyebrow';

interface CalendarSidebarProps {
  events: CalendarEvent[];
  timezone: string;
}

const OUTCOME_CLASS: Record<string, string> = {
  PENDING: 'bg-outcome-pending',
  DONE_EASY: 'bg-outcome-done-easy',
  DONE_HARD: 'bg-outcome-done-hard',
  DOUBTS: 'bg-outcome-doubts',
  STUCK: 'bg-outcome-stuck',
};

const PLATFORM_CLASS: Record<string, string> = {
  leetcode: 'bg-platform-leetcode',
  youtube: 'bg-platform-youtube',
  medium: 'bg-platform-medium',
  github: 'bg-platform-github',
  article: 'bg-platform-article',
  book: 'bg-platform-book',
};

function formatTime(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(new Date(iso));
}

function formatDayKey(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: timezone,
  }).format(new Date(iso)).toUpperCase();
}

export function CalendarSidebar({ events, timezone }: CalendarSidebarProps) {
  const ics = events.filter((e) => e.kind === 'ICS');
  if (ics.length === 0) {
    return (
      <aside className="space-y-4">
        <Eyebrow>This week · 0 ICS</Eyebrow>
        <p className="font-sans text-sm text-fg-mute">No study blocks this week.</p>
      </aside>
    );
  }

  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of ics) {
    const key = formatDayKey(e.start, timezone);
    const arr = byDay.get(key) ?? [];
    arr.push(e);
    byDay.set(key, arr);
  }

  return (
    <aside className="space-y-6">
      <Eyebrow>This week · {ics.length} ICS</Eyebrow>
      {[...byDay.entries()].map(([day, items]) => (
        <div key={day} className="space-y-2">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute">
            {day}
          </p>
          <ul className="space-y-1">
            {items.map((item) => {
              const platform = detectPlatform(item.ics?.url, item.ics?.format);
              const outcome = item.ics?.outcome ?? 'PENDING';
              return (
                <li key={item.id}>
                  <Link
                    href={`/me/item/${item.ics?.itemId}`}
                    className="group flex items-center gap-2 rounded-input py-1.5 pl-0 pr-2 transition-colors hover:bg-bg-subtle"
                  >
                    <span className={`h-[28px] w-[3px] rounded-sm ${PLATFORM_CLASS[platform]}`} />
                    <span className={`h-2 w-2 rounded-full ${OUTCOME_CLASS[outcome]}`} />
                    <span className="flex-1 truncate font-serif text-[13px] text-fg">
                      {item.title}
                    </span>
                    <span className="font-sans text-[10px] tabular-nums text-fg-mute">
                      {formatTime(item.start, timezone)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </aside>
  );
}

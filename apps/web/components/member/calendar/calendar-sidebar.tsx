'use client';

import Link from 'next/link';
import { ExternalLink, Video } from 'lucide-react';
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

function groupByDay(events: CalendarEvent[], timezone: string) {
  const byDay = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = formatDayKey(e.start, timezone);
    const arr = byDay.get(key) ?? [];
    arr.push(e);
    byDay.set(key, arr);
  }
  return byDay;
}

export function CalendarSidebar({ events, timezone }: CalendarSidebarProps) {
  const ics = events.filter((e) => e.kind === 'ICS');
  const byDay = groupByDay(ics, timezone);
  const external = events
    .filter((event) => event.kind === 'EXTERNAL' && (event.meetLink ?? event.htmlLink))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const externalByDay = groupByDay(external, timezone);

  return (
    <aside className={ics.length === 0 && external.length === 0 ? 'space-y-4' : 'space-y-6'}>
      <Eyebrow>This week · {ics.length} Academy Fellow</Eyebrow>
      {ics.length === 0 && <p className="font-sans text-sm text-fg-mute">No study blocks this week.</p>}
      {[...byDay.entries()].map(([day, items]) => (
        <div key={day} className="space-y-2">
          <p className="font-sans text-xs font-medium text-fg-mute">
            {day}
          </p>
          <ul className="divide-y divide-border-token">
            {items.map((item) => {
              const platform = detectPlatform(item.ics?.url, item.ics?.format);
              const outcome = item.ics?.outcome ?? 'PENDING';
              return (
                <li key={item.id}>
                  <Link
                    href={`/me/item/${item.ics?.itemId}`}
                    className="group flex min-h-11 items-center gap-2 rounded-input py-3 pl-0 pr-1 transition-colors hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                  >
                    <span aria-hidden className={`h-7 w-[3px] shrink-0 rounded-sm ${PLATFORM_CLASS[platform]}`} />
                    <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${OUTCOME_CLASS[outcome]}`} />
                    <span className="min-w-0 flex-1 font-sans text-[13px] leading-relaxed text-fg">
                      {item.title}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-fg-mute">
                      {formatTime(item.start, timezone)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {external.length > 0 && (
        <section aria-labelledby="external-event-links" className="space-y-4 border-t border-border-token pt-5">
          <div>
            <h2 id="external-event-links" className="text-xs font-medium text-fg">External events</h2>
            <p className="mt-1 text-xs leading-relaxed text-fg-mute">Open the external events shown in the time grid here.</p>
          </div>
          {[...externalByDay.entries()].map(([day, items]) => (
            <div key={day}>
              <p className="text-xs font-medium text-fg-mute">{day}</p>
              <ul className="mt-2 divide-y divide-border-token">
                {items.map((event) => {
                  const Icon = event.meetLink ? Video : ExternalLink;
                  return (
                    <li key={event.id}>
                      <a href={event.meetLink ?? event.htmlLink ?? undefined} target="_blank" rel="noreferrer"
                        aria-label={`Open external link: ${event.title}`}
                        className="flex min-h-11 min-w-11 items-center gap-3 py-3 text-fg-soft hover:bg-bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg">
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] leading-relaxed">{event.title}</span>
                          <span className="mt-1 block font-mono text-[10px] tabular-nums text-fg-mute">{event.allDay ? 'all-day' : `${formatTime(event.start, timezone)}–${formatTime(event.end, timezone)}`}</span>
                        </span>
                        <Icon aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      )}
    </aside>
  );
}

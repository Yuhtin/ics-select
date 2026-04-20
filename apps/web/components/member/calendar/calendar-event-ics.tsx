'use client';

import type { CalendarEvent } from '../../../lib/queries/me-calendar';
import { detectPlatform, platformLabel } from '../../../lib/format/platform';

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

interface CalendarEventIcsProps {
  event: CalendarEvent;
  timeLabel: string;
}

export function CalendarEventIcs({ event, timeLabel }: CalendarEventIcsProps) {
  const platform = detectPlatform(event.ics?.url, event.ics?.format);
  const outcome = event.ics?.outcome ?? 'PENDING';
  return (
    <div className="relative flex h-full overflow-hidden rounded-input border border-border-token bg-surface cursor-grab">
      <span className={`w-[3px] flex-shrink-0 ${PLATFORM_CLASS[platform]}`} />
      <div className="flex min-w-0 flex-1 flex-col px-2 py-1">
        <span className="truncate font-serif text-[12px] leading-tight text-fg">
          {event.title}
        </span>
        <span className="font-sans text-[10px] tabular-nums text-fg-mute">
          {timeLabel} · {platformLabel(platform)}
        </span>
      </div>
      <span
        className={`absolute right-1 top-1 h-2 w-2 rounded-full ${OUTCOME_CLASS[outcome]}`}
        aria-label={`Outcome: ${outcome}`}
      />
    </div>
  );
}

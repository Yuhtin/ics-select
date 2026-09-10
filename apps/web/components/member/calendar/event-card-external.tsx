'use client';

import { MapPin } from 'lucide-react';
import type { CalendarEvent } from '../../../lib/queries/me-calendar';

interface EventCardExternalProps {
  event: CalendarEvent;
  timeLabel: string;
}

export function EventCardExternal({ event, timeLabel }: EventCardExternalProps) {
  return (
    // External destinations are full-height links in the agenda. Temporal blocks
    // can be shorter than 44px, so they show chronology without overlapping actions.
    <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-border-token border-l-[3px] border-l-fg-faint bg-bg-subtle/60 px-2 py-1">
      <span className="shrink-0 truncate font-sans text-xs font-medium leading-tight text-fg-soft">
        {event.title}
      </span>
      <span className="shrink-0 truncate font-mono text-[10px] tabular-nums text-fg-mute">
        {timeLabel}
      </span>
      {event.location && (
        <span className="inline-flex min-w-0 items-center gap-0.5 font-sans text-[10px] text-fg-mute">
          <MapPin aria-hidden className="h-2.5 w-2.5 shrink-0" strokeWidth={1.5} />
          <span className="truncate">{event.location}</span>
        </span>
      )}
    </div>
  );
}

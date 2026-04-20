'use client';

import { ExternalLink, MapPin, Video } from 'lucide-react';
import type { CalendarEvent } from '../../../lib/queries/me-calendar';

interface EventCardExternalProps {
  event: CalendarEvent;
  timeLabel: string;
}

export function EventCardExternal({ event, timeLabel }: EventCardExternalProps) {
  const link = event.meetLink ?? event.htmlLink;
  const LinkIcon = event.meetLink ? Video : event.htmlLink ? ExternalLink : null;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-input border border-dashed border-border-token px-2 py-1">
      <span className="truncate font-sans text-[11px] font-medium text-fg-soft">
        {event.title}
      </span>
      <div className="flex items-center gap-2 font-sans text-[10px] tabular-nums text-fg-mute">
        <span>{timeLabel}</span>
        {event.location && (
          <span className="inline-flex items-center gap-0.5">
            <MapPin className="h-2.5 w-2.5" strokeWidth={1.5} />
            <span className="max-w-[80px] truncate">{event.location}</span>
          </span>
        )}
        {LinkIcon && link && (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="ml-auto text-fg-mute hover:text-fg"
            onClick={(e) => e.stopPropagation()}
            aria-label="Open external link"
          >
            <LinkIcon className="h-2.5 w-2.5" strokeWidth={1.5} />
          </a>
        )}
      </div>
    </div>
  );
}

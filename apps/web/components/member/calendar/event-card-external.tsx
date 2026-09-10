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
    <div className="relative h-full w-full">
      {/* Clip event copy to its temporal block, but keep the 44px link and its
          inset focus ring outside that clipping boundary. Grid timing is unchanged. */}
      <div className="flex h-full w-full flex-col overflow-hidden rounded-md border border-border-token border-l-[3px] border-l-fg-faint bg-bg-subtle/60 px-2 py-1">
        <span className="shrink-0 truncate font-sans text-xs font-medium leading-tight text-fg-soft">
          {event.title}
        </span>
        <span className="shrink-0 truncate font-mono text-[10px] tabular-nums text-fg-mute">
          {timeLabel}
        </span>
        {event.location && (
          <span className="inline-flex min-w-0 items-center gap-0.5 pr-5 font-sans text-[10px] text-fg-mute">
            <MapPin aria-hidden className="h-2.5 w-2.5 shrink-0" strokeWidth={1.5} />
            <span className="truncate">{event.location}</span>
          </span>
        )}
      </div>
      {LinkIcon && link && (
        <a
          href={link}
          target="_blank"
          rel="noreferrer"
          className="absolute bottom-0 right-0 flex h-11 w-11 items-end justify-end rounded-md px-2 py-1 text-fg-mute hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
          onClick={(e) => e.stopPropagation()}
          aria-label="Open external link"
        >
          <LinkIcon aria-hidden className="h-3.5 w-3.5" strokeWidth={1.5} />
        </a>
      )}
    </div>
  );
}

'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@heroui/react';
import { ExternalLink, MapPin, Video } from 'lucide-react';
import type { CalendarEvent } from '../../../lib/queries/me-calendar';

interface CalendarEventPopoverProps {
  event: CalendarEvent;
  timeLabel: string;
  children: React.ReactNode;
}

export function CalendarEventPopover({ event, timeLabel, children }: CalendarEventPopoverProps) {
  return (
    <Popover placement="right">
      <PopoverTrigger>
        <div className="h-full w-full">{children}</div>
      </PopoverTrigger>
      <PopoverContent className="max-w-[280px] rounded-card border border-border-token bg-surface p-4">
        <div className="space-y-2">
          <p className="font-serif text-base font-medium text-fg">{event.title}</p>
          <p className="font-sans text-sm text-fg-soft">{timeLabel}</p>
          {event.location && (
            <p className="flex items-center gap-1.5 font-sans text-sm text-fg-soft">
              <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} />
              {event.location}
            </p>
          )}
          {event.meetLink && (
            <a
              href={event.meetLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-sans text-sm text-fg underline underline-offset-2"
            >
              <Video className="h-3.5 w-3.5" strokeWidth={1.5} />
              Join Meet
            </a>
          )}
          {event.htmlLink && (
            <a
              href={event.htmlLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-sans text-sm text-fg-soft underline underline-offset-2"
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
              Open in Google Calendar
            </a>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

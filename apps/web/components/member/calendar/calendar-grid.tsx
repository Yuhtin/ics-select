'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg, EventDropArg } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import type { CalendarEvent } from '../../../lib/queries/me-calendar';
import { CalendarEventIcs } from './calendar-event-ics';
import { CalendarEventExternal } from './calendar-event-external';
import { CalendarEventPopover } from './calendar-event-popover';

interface CalendarGridProps {
  weekStart: Date;
  weekEnd: Date;
  timezone: string;
  events: CalendarEvent[];
  onReschedule: (input: { eventId: string; start: string; end: string }) => void;
}

function computeSlotBounds(events: CalendarEvent[]): { min: string; max: string } {
  if (events.length === 0) return { min: '06:00:00', max: '23:00:00' };
  let minHour = 6;
  let maxHour = 23;
  for (const e of events) {
    if (e.allDay) continue;
    const s = new Date(e.start);
    const eEnd = new Date(e.end);
    minHour = Math.min(minHour, Math.max(0, s.getHours()));
    maxHour = Math.max(maxHour, Math.min(23, eEnd.getHours() + 1));
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return { min: `${pad(minHour)}:00:00`, max: `${pad(maxHour)}:00:00` };
}

function formatTimeRange(start: string, end: string, timezone: string): string {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timezone,
    }).format(new Date(iso));
  return `${fmt(start)}–${fmt(end)}`;
}

export function CalendarGrid({
  weekStart,
  weekEnd,
  timezone,
  events,
  onReschedule,
}: CalendarGridProps) {
  const router = useRouter();

  const fcEvents = useMemo(
    () =>
      events.map((e) => ({
        id: e.id,
        title: e.title,
        start: e.start,
        end: e.end,
        allDay: e.allDay,
        editable: e.kind === 'ICS',
        extendedProps: {
          kind: e.kind,
          data: e,
        },
      })),
    [events],
  );

  const slotBounds = useMemo(() => computeSlotBounds(events), [events]);

  const handleDrop = (arg: EventDropArg | EventResizeDoneArg) => {
    if (arg.event.extendedProps.kind !== 'ICS') {
      arg.revert();
      return;
    }
    const start = arg.event.start?.toISOString();
    const end = arg.event.end?.toISOString();
    if (!start || !end) {
      arg.revert();
      return;
    }
    onReschedule({ eventId: arg.event.id, start, end });
  };

  const handleClick = (arg: EventClickArg) => {
    const data = arg.event.extendedProps.data as CalendarEvent;
    if (data.kind === 'ICS' && data.ics?.itemId) {
      router.push(`/me/item/${data.ics.itemId}`);
    }
  };

  return (
    <div className="ics-calendar-grid">
      <FullCalendar
        plugins={[timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        initialDate={weekStart}
        headerToolbar={false}
        allDaySlot
        firstDay={0}
        locale="en"
        nowIndicator
        timeZone={timezone}
        slotMinTime={slotBounds.min}
        slotMaxTime={slotBounds.max}
        expandRows
        height="70vh"
        editable
        eventConstraint={{
          start: weekStart.toISOString(),
          end: weekEnd.toISOString(),
        }}
        events={fcEvents}
        eventClick={handleClick}
        eventDrop={handleDrop}
        eventResize={handleDrop}
        eventContent={(arg) => {
          const data = arg.event.extendedProps.data as CalendarEvent;
          const timeLabel = formatTimeRange(data.start, data.end, timezone);
          if (data.kind === 'ICS') {
            return <CalendarEventIcs event={data} timeLabel={timeLabel} />;
          }
          return (
            <CalendarEventPopover event={data} timeLabel={timeLabel}>
              <CalendarEventExternal event={data} timeLabel={timeLabel} />
            </CalendarEventPopover>
          );
        }}
      />
    </div>
  );
}

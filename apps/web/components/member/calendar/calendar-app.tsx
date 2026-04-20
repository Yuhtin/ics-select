'use client';

/// <reference types="temporal-polyfill/global" />

import { useEffect, useMemo } from 'react';
import { ScheduleXCalendar, useCalendarApp } from '@schedule-x/react';
import { createViewWeek } from '@schedule-x/calendar';
import { createEventsServicePlugin } from '@schedule-x/events-service';
import { createCurrentTimePlugin } from '@schedule-x/current-time';
import type { CalendarEvent as SxCalendarEvent } from '@schedule-x/calendar';
import '@schedule-x/theme-default/dist/index.css';
import 'temporal-polyfill/global';

import type { CalendarEvent } from '../../../lib/queries/me-calendar';
import { isoToSxLocal } from '../../../lib/calendar/sx-time';
import { EventCardIcs } from './event-card-ics';
import { EventCardExternal } from './event-card-external';

interface CalendarAppProps {
  weekStart: Date;
  timezone: string;
  events: CalendarEvent[];
  onRescheduleClick: (event: CalendarEvent) => void;
}

type SxEvent = SxCalendarEvent & {
  calendarId: 'ics' | 'external';
  _ics: CalendarEvent;
};

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

function TimeGridEventComponent({
  calendarEvent,
  timezone,
  onRescheduleClick,
}: {
  calendarEvent: Record<string, unknown>;
  timezone: string;
  onRescheduleClick: (event: CalendarEvent) => void;
}) {
  const ev = calendarEvent._ics as CalendarEvent | undefined;
  if (!ev) return null;
  const timeLabel = formatTimeRange(ev.start, ev.end, timezone);
  return ev.kind === 'ICS' ? (
    <EventCardIcs event={ev} timeLabel={timeLabel} />
  ) : (
    <EventCardExternal event={ev} timeLabel={timeLabel} />
  );
}

export function CalendarApp({
  weekStart,
  timezone,
  events,
  onRescheduleClick,
}: CalendarAppProps) {
  const eventsService = useMemo(() => createEventsServicePlugin(), []);
  const currentTime = useMemo(() => createCurrentTimePlugin({ fullWeekWidth: true }), []);

  const sxEvents = useMemo<SxEvent[]>(
    () =>
      events
        .filter((e) => !e.allDay)
        .map((e) => ({
          id: e.id,
          title: e.title,
          // Schedule-X accepts 'YYYY-MM-DD HH:mm' strings at runtime even though
          // the TS types declare Temporal.ZonedDateTime | Temporal.PlainDate.
          // We cast here; the library coerces these strings internally.
          start: isoToSxLocal(e.start, timezone) as unknown as Temporal.ZonedDateTime,
          end: isoToSxLocal(e.end, timezone) as unknown as Temporal.ZonedDateTime,
          calendarId: (e.kind === 'ICS' ? 'ics' : 'external') as 'ics' | 'external',
          _ics: e,
        })),
    [events, timezone],
  );

  const selectedDate = useMemo(() => {
    const y = weekStart.getFullYear();
    const m = String(weekStart.getMonth() + 1).padStart(2, '0');
    const d = String(weekStart.getDate()).padStart(2, '0');
    return Temporal.PlainDate.from(`${y}-${m}-${d}`);
  }, [weekStart]);

  const calendar = useCalendarApp(
    {
      views: [createViewWeek()],
      events: sxEvents as unknown as SxCalendarEvent[],
      timezone,
      firstDayOfWeek: 7, // WeekDay.SUNDAY = 7
      selectedDate,
      weekOptions: {
        gridStep: 30,
        timeAxisFormatOptions: { hour: '2-digit', minute: '2-digit' },
      },
      callbacks: {
        onEventClick(sxEvent, _e) {
          const raw = sxEvent as unknown as Record<string, unknown>;
          const original = raw._ics as CalendarEvent | undefined;
          if (original?.kind === 'ICS') onRescheduleClick(original);
        },
      },
    },
    [eventsService, currentTime],
  );

  // Keep the Schedule-X event list in sync when our React events prop changes
  // (reschedule, navigation, cache hydration).
  useEffect(() => {
    eventsService.set(sxEvents as unknown as Parameters<typeof eventsService.set>[0]);
  }, [eventsService, sxEvents]);

  // Bind the timezone+reschedule callback into the custom component via a closure
  // (Schedule-X's React wrapper passes props via its own mechanism).
  const TimeGridEvent = useMemo(
    () =>
      function TimeGridEvent(props: Record<string, unknown>) {
        return (
          <TimeGridEventComponent
            calendarEvent={props.calendarEvent as Record<string, unknown>}
            timezone={timezone}
            onRescheduleClick={onRescheduleClick}
          />
        );
      },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [timezone, onRescheduleClick],
  );

  return (
    <div className="sx-react-calendar-wrapper">
      <ScheduleXCalendar
        calendarApp={calendar}
        customComponents={{
          timeGridEvent: TimeGridEvent,
        }}
      />
    </div>
  );
}

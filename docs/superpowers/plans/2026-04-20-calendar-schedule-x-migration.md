# Calendar Schedule-X Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace FullCalendar with Schedule-X's free core on `/me/calendar`, preserving the SWR cache, lazy-loading, and reschedule flow (now via click-to-open modal instead of drag).

**Architecture:** Single React component `CalendarApp` wraps `@schedule-x/react`'s `ScheduleXCalendar`, configured for a Sunday-start week view with a 30-minute grid step in the user's availability timezone. Custom `timeGridEvent` template routes to `event-card-ics` / `event-card-external` based on `calendarId`. Click callback opens a HeroUI `RescheduleModal` whose submit dispatches the existing `useRescheduleEvent` mutation. Time conversion (ISO UTC ↔ Schedule-X's `'YYYY-MM-DD HH:mm'` local strings) goes through a small adapter using `temporal-polyfill`'s `Temporal` API.

**Tech Stack:** Next.js 15 App Router · `@schedule-x/react` + `@schedule-x/calendar` + `@schedule-x/events-service` + `@schedule-x/current-time` + `@schedule-x/theme-default` · `temporal-polyfill` · HeroUI · TanStack Query · TypeScript.

**Spec:** `docs/superpowers/specs/2026-04-20-calendar-schedule-x-migration-design.md`

---

## File map

**Create:**
- `apps/web/lib/calendar/sx-time.ts` — ISO↔sx-string time adapter (uses `Temporal`).
- `apps/web/components/member/calendar/event-card-ics.tsx` — Schedule-X custom template for ICS events.
- `apps/web/components/member/calendar/event-card-external.tsx` — Schedule-X custom template for EXTERNAL events.
- `apps/web/components/member/calendar/reschedule-modal.tsx` — HeroUI Modal with datetime-local inputs.
- `apps/web/components/member/calendar/calendar-app.tsx` — main wrapper around `ScheduleXCalendar`.

**Modify:**
- `apps/web/package.json` — swap dependencies.
- `apps/web/app/(member)/me/calendar/page.tsx` — swap `next/dynamic` target to `CalendarApp`; host reschedule modal state.
- `apps/web/app/globals.css` — replace `.ics-calendar-grid` rules with `.sx-react-calendar-wrapper` rules.

**Delete:**
- `apps/web/components/member/calendar/calendar-grid.tsx`
- `apps/web/components/member/calendar/calendar-event-ics.tsx`
- `apps/web/components/member/calendar/calendar-event-external.tsx`
- `apps/web/components/member/calendar/calendar-event-popover.tsx`

**Unchanged:**
- Entire `apps/api/`.
- `apps/web/lib/cache/calendar-cache.ts`
- `apps/web/lib/queries/me-calendar.ts`
- `apps/web/components/member/calendar/{calendar-header,calendar-sidebar,calendar-legend,calendar-connect-banner,calendar-skeleton,calendar-grid-skeleton}.tsx`

No backend work. No database work.

---

## Task 1: Swap dependencies + install `temporal-polyfill`

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Remove FullCalendar**

```bash
pnpm --filter @ics-select/web remove \
  @fullcalendar/core \
  @fullcalendar/interaction \
  @fullcalendar/react \
  @fullcalendar/timegrid
```

- [ ] **Step 2: Add Schedule-X core + plugins + polyfill**

```bash
pnpm --filter @ics-select/web add \
  @schedule-x/react \
  @schedule-x/calendar \
  @schedule-x/events-service \
  @schedule-x/current-time \
  @schedule-x/theme-default \
  temporal-polyfill
```

- [ ] **Step 3: Sanity-typecheck the workspace**

```bash
pnpm --filter @ics-select/web typecheck
```

Expected: **fails** — `calendar-grid.tsx` still imports `@fullcalendar/*`, which we just removed. That's fine; the component will be deleted in Task 8. For now, note the failure set so you know the typecheck regresses to green as later tasks land.

If the typecheck fails for unrelated reasons (e.g., Schedule-X types missing), stop and investigate before proceeding.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): swap FullCalendar for Schedule-X + temporal-polyfill

Drops the four @fullcalendar/* packages and adds @schedule-x/* core +
plugins along with temporal-polyfill. The calendar page does not build
cleanly between this commit and Task 8 — the next tasks build up the
Schedule-X replacement before deleting FullCalendar-dependent files."
```

---

## Task 2: Time adapter (`sx-time.ts`)

Converts ISO UTC strings (API) ↔ Schedule-X local strings (`'YYYY-MM-DD HH:mm'`) in a given timezone. Uses `Temporal` from the polyfill installed in Task 1.

**Files:**
- Create: `apps/web/lib/calendar/sx-time.ts`

- [ ] **Step 1: Write the module**

```ts
// apps/web/lib/calendar/sx-time.ts
import 'temporal-polyfill/global';

/**
 * Schedule-X expects start/end as 'YYYY-MM-DD HH:mm' strings, interpreted
 * in the calendar's configured timezone. Our API returns ISO UTC strings.
 * These helpers bridge the two formats using the Temporal API.
 */

const pad = (n: number): string => String(n).padStart(2, '0');

export function isoToSxLocal(iso: string, timezone: string): string {
  const instant = Temporal.Instant.from(iso);
  const zoned = instant.toZonedDateTimeISO(timezone);
  return `${zoned.year}-${pad(zoned.month)}-${pad(zoned.day)} ${pad(zoned.hour)}:${pad(zoned.minute)}`;
}

export function sxLocalToIso(local: string, timezone: string): string {
  const [date, time] = local.split(' ');
  if (!date || !time) throw new Error(`invalid sx local string: ${local}`);
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const zoned = Temporal.ZonedDateTime.from({
    year: y,
    month: m,
    day: d,
    hour: h,
    minute: min,
    timeZone: timezone,
  });
  return zoned.toInstant().toString();
}

/**
 * Converts the value of an <input type="datetime-local"> ('YYYY-MM-DDTHH:mm')
 * to a Schedule-X local string ('YYYY-MM-DD HH:mm'). Does not touch timezones —
 * the caller is responsible for interpreting the result in the correct tz.
 */
export function datetimeLocalToSx(value: string): string {
  return value.replace('T', ' ');
}

/**
 * Converts a Schedule-X local string ('YYYY-MM-DD HH:mm') to the value format
 * of <input type="datetime-local"> ('YYYY-MM-DDTHH:mm').
 */
export function sxToDatetimeLocal(sx: string): string {
  return sx.replace(' ', 'T');
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @ics-select/web typecheck
```

The `calendar-grid.tsx` error from Task 1 still exists — ignore it. The new file should type-check cleanly against `Temporal` (the polyfill's global `.d.ts` ships with the package).

If TypeScript can't find `Temporal`, add a triple-slash directive at the top of the file: `/// <reference types="temporal-polyfill/global" />`. Try without first — recent versions of the polyfill wire globals automatically.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/calendar/sx-time.ts
git commit -m "feat(web): sx-time adapter — ISO UTC ⇄ Schedule-X local strings

Uses temporal-polyfill's Temporal API to convert between the API's ISO
UTC format and Schedule-X's YYYY-MM-DD HH:mm local-string format for
a given timezone. Also provides datetime-local ⇄ sx string shims for
the reschedule modal's native input."
```

---

## Task 3: Event card components

Two small presentational components that render inside Schedule-X's `timeGridEvent` slot. Ported from the current `calendar-event-ics.tsx` / `calendar-event-external.tsx` so the visual language stays identical.

**Files:**
- Create: `apps/web/components/member/calendar/event-card-ics.tsx`
- Create: `apps/web/components/member/calendar/event-card-external.tsx`

- [ ] **Step 1: Create `event-card-ics.tsx`**

```tsx
// apps/web/components/member/calendar/event-card-ics.tsx
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

interface EventCardIcsProps {
  event: CalendarEvent;
  timeLabel: string;
}

export function EventCardIcs({ event, timeLabel }: EventCardIcsProps) {
  const platform = detectPlatform(event.ics?.url, event.ics?.format);
  const outcome = event.ics?.outcome ?? 'PENDING';
  return (
    <div className="relative flex h-full w-full overflow-hidden rounded-input border border-border-token bg-surface">
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
```

Note: the only difference versus the old `CalendarEventIcs` is `cursor-grab` is removed (no drag in Schedule-X free core).

- [ ] **Step 2: Create `event-card-external.tsx`**

```tsx
// apps/web/components/member/calendar/event-card-external.tsx
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
```

Note: the old `CalendarEventExternal` relied on the separate `CalendarEventPopover` for links. The new card inlines the external link icon at the end of the meta row, with `stopPropagation` to avoid triggering the calendar's event-click handler — external events don't have a reschedule flow, so clicking the card itself should be a no-op (or open the htmlLink in a popover if we ever add one back). For now: click-the-card is a no-op; click-the-icon opens the external link.

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @ics-select/web typecheck
```

(Still failing on the old `calendar-grid.tsx` — the two new files should be clean.)

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/member/calendar/event-card-ics.tsx apps/web/components/member/calendar/event-card-external.tsx
git commit -m "feat(web): event cards for Schedule-X custom template

EventCardIcs and EventCardExternal port the existing FullCalendar-era
renderers to a shape compatible with Schedule-X's timeGridEvent slot.
External card inlines the Meet/Calendar link icon and stops click
propagation so clicking it doesn't bubble into the calendar's event
handler."
```

---

## Task 4: Reschedule modal

HeroUI `Modal` with two `<input type="datetime-local">` fields and validation. Receives the event + timezone as props and calls an `onSubmit` with `{ eventId, start (ISO), end (ISO) }`.

**Files:**
- Create: `apps/web/components/member/calendar/reschedule-modal.tsx`

- [ ] **Step 1: Create the file**

```tsx
// apps/web/components/member/calendar/reschedule-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Button,
} from '@heroui/react';
import type { CalendarEvent } from '../../../lib/queries/me-calendar';
import {
  isoToSxLocal,
  sxLocalToIso,
  sxToDatetimeLocal,
  datetimeLocalToSx,
} from '../../../lib/calendar/sx-time';

interface RescheduleModalProps {
  event: CalendarEvent | null;
  timezone: string;
  onClose: () => void;
  onSubmit: (input: { eventId: string; start: string; end: string }) => void;
}

export function RescheduleModal({
  event,
  timezone,
  onClose,
  onSubmit,
}: RescheduleModalProps) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!event) return;
    setStart(sxToDatetimeLocal(isoToSxLocal(event.start, timezone)));
    setEnd(sxToDatetimeLocal(isoToSxLocal(event.end, timezone)));
    setError(null);
  }, [event, timezone]);

  const handleSubmit = () => {
    if (!event) return;
    if (!start || !end) {
      setError('Preencha os dois horários.');
      return;
    }
    const startIso = sxLocalToIso(datetimeLocalToSx(start), timezone);
    const endIso = sxLocalToIso(datetimeLocalToSx(end), timezone);
    if (new Date(endIso) <= new Date(startIso)) {
      setError('O fim precisa ser depois do início.');
      return;
    }
    onSubmit({ eventId: event.id, start: startIso, end: endIso });
    onClose();
  };

  return (
    <Modal isOpen={!!event} onClose={onClose} placement="center">
      <ModalContent className="rounded-card border border-border-token bg-surface">
        <ModalHeader className="font-serif text-lg text-fg">
          Reagendar
        </ModalHeader>
        <ModalBody className="space-y-4">
          <p className="font-sans text-sm text-fg-soft">{event?.title}</p>
          <label className="block space-y-1">
            <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">
              Início
            </span>
            <input
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="w-full rounded-input border border-border-token bg-surface px-3 py-2 font-sans text-sm text-fg"
            />
          </label>
          <label className="block space-y-1">
            <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">
              Fim
            </span>
            <input
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="w-full rounded-input border border-border-token bg-surface px-3 py-2 font-sans text-sm text-fg"
            />
          </label>
          {error && (
            <p className="font-sans text-sm text-outcome-stuck" role="alert">
              {error}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            Cancelar
          </Button>
          <Button color="primary" onPress={handleSubmit}>
            Reagendar
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @ics-select/web typecheck
```

(Still failing on `calendar-grid.tsx`; new file should be clean.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/member/calendar/reschedule-modal.tsx
git commit -m "feat(web): reschedule modal for ICS events

HeroUI Modal with two datetime-local inputs (pre-filled with the event's
current start/end in the user's timezone). Submit converts back to ISO
UTC and invokes the passed onSubmit callback — caller wires it to
useRescheduleEvent.mutate. Validates end > start client-side."
```

---

## Task 5: `CalendarApp` wrapper

The main integration component. Hosts the Schedule-X calendar, adapts our events, and fires the parent-provided `onRescheduleClick` when an ICS event is clicked (the parent page opens the modal).

**Files:**
- Create: `apps/web/components/member/calendar/calendar-app.tsx`

- [ ] **Step 1: Create the file**

```tsx
// apps/web/components/member/calendar/calendar-app.tsx
'use client';

import { useEffect, useMemo } from 'react';
import { ScheduleXCalendar, useCalendarApp } from '@schedule-x/react';
import { createViewWeek } from '@schedule-x/calendar';
import { createEventsServicePlugin } from '@schedule-x/events-service';
import { createCurrentTimePlugin } from '@schedule-x/current-time';
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

type SxEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
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
          start: isoToSxLocal(e.start, timezone),
          end: isoToSxLocal(e.end, timezone),
          calendarId: e.kind === 'ICS' ? 'ics' : 'external',
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

  const calendar = useCalendarApp({
    views: [createViewWeek()],
    events: sxEvents,
    timezone,
    firstDayOfWeek: 7, // Sunday
    selectedDate,
    weekOptions: {
      gridStep: 30,
      timeAxisFormatOptions: { hour: '2-digit', minute: '2-digit' },
    },
    plugins: [eventsService, currentTime],
    callbacks: {
      onEventClick(sxEvent) {
        const original = (sxEvent as unknown as SxEvent)._ics;
        if (original?.kind === 'ICS') onRescheduleClick(original);
      },
    },
  });

  // Keep the Schedule-X event list in sync when our React events prop changes
  // (reschedule, navigation, cache hydration).
  useEffect(() => {
    eventsService.set(sxEvents);
  }, [eventsService, sxEvents]);

  return (
    <div className="sx-react-calendar-wrapper">
      <ScheduleXCalendar
        calendarApp={calendar}
        customComponents={{
          timeGridEvent: (props: { calendarEvent: SxEvent }) => {
            const ev = props.calendarEvent._ics;
            const timeLabel = formatTimeRange(ev.start, ev.end, timezone);
            return ev.kind === 'ICS' ? (
              <EventCardIcs event={ev} timeLabel={timeLabel} />
            ) : (
              <EventCardExternal event={ev} timeLabel={timeLabel} />
            );
          },
        }}
      />
    </div>
  );
}
```

Key choices:
- We pass `timezone` to Schedule-X so its internal day columns align with the user's availability tz.
- `selectedDate` comes from the page's `weekStart`, converted to `Temporal.PlainDate`.
- `eventsService.set(sxEvents)` is called in a `useEffect` so that optimistic updates (reschedule) and week navigation flow through the imperative service — that's how Schedule-X re-renders without remounting the calendar.
- The `_ics` extension property on each event survives the Schedule-X round-trip and is the bridge back to our rich `CalendarEvent` type inside the custom template.
- All-day events are filtered out for this iteration (week view timed grid only); all-day support can be re-added later with `createViewWeekAgenda` or Schedule-X's all-day slot — both behind a follow-up.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @ics-select/web typecheck
```

(Still failing on old `calendar-grid.tsx`; new file should be clean.)

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/member/calendar/calendar-app.tsx
git commit -m "feat(web): CalendarApp — Schedule-X week-view wrapper

Wraps @schedule-x/react with the events-service + current-time plugins,
a Sunday-start week view with a 30-minute grid, and a custom
timeGridEvent template that routes to EventCardIcs / EventCardExternal
based on the event kind. Emits onRescheduleClick(CalendarEvent) for ICS
clicks — the parent page opens the reschedule modal."
```

---

## Task 6: Wire `CalendarApp` into the page

Swap the `next/dynamic` target from `calendar-grid` to `calendar-app`; host the reschedule modal's open/close state at the page level; wire submit to `useRescheduleEvent`.

**Files:**
- Modify: `apps/web/app/(member)/me/calendar/page.tsx`

- [ ] **Step 1: Replace the page**

Open `apps/web/app/(member)/me/calendar/page.tsx` and replace its contents with:

```tsx
'use client';

import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useMeCalendarWeek, useRescheduleEvent } from '../../../../lib/queries/me-calendar';
import type { CalendarEvent } from '../../../../lib/queries/me-calendar';
import { CalendarHeader } from '../../../../components/member/calendar/calendar-header';
import { CalendarSidebar } from '../../../../components/member/calendar/calendar-sidebar';
import { CalendarLegend } from '../../../../components/member/calendar/calendar-legend';
import { CalendarSkeleton } from '../../../../components/member/calendar/calendar-skeleton';
import { CalendarGridSkeleton } from '../../../../components/member/calendar/calendar-grid-skeleton';
import { CalendarConnectBanner } from '../../../../components/member/calendar/calendar-connect-banner';
import { RescheduleModal } from '../../../../components/member/calendar/reschedule-modal';

const CalendarApp = dynamic(
  () =>
    import('../../../../components/member/calendar/calendar-app').then(
      (m) => m.CalendarApp,
    ),
  { ssr: false, loading: () => <CalendarGridSkeleton /> },
);

function startOfSundayWeek(d: Date): Date {
  const copy = new Date(d);
  const dayIdx = copy.getDay(); // 0 = Sunday
  copy.setDate(copy.getDate() - dayIdx);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export default function MeCalendarPage() {
  const [weekStart, setWeekStart] = useState<Date>(() => startOfSundayWeek(new Date()));
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);

  const { data, isLoading, isFetching } = useMeCalendarWeek(weekStart);
  const reschedule = useRescheduleEvent(weekStart);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);

  const handlePrev = useCallback(() => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }, []);
  const handleNext = useCallback(() => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }, []);
  const handleToday = useCallback(() => setWeekStart(startOfSundayWeek(new Date())), []);

  return (
    <div className="space-y-4">
      <CalendarHeader
        weekStart={weekStart}
        weekEnd={weekEnd}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        isRefreshing={isFetching && !isLoading}
      />
      {!data ? (
        <CalendarSkeleton />
      ) : (
        <>
          {!data.hasGoogleConnection && <CalendarConnectBanner variant="not_connected" />}
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <CalendarSidebar events={data.events} timezone={data.timezone} />
            <div className="space-y-4">
              <CalendarApp
                weekStart={weekStart}
                timezone={data.timezone}
                events={data.events}
                onRescheduleClick={setEditing}
              />
              <CalendarLegend />
            </div>
          </div>
        </>
      )}
      <RescheduleModal
        event={editing}
        timezone={data?.timezone ?? 'America/Sao_Paulo'}
        onClose={() => setEditing(null)}
        onSubmit={(input) => reschedule.mutate(input)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @ics-select/web typecheck
```

Still failing on the old `calendar-grid.tsx` which is no longer imported — the file itself still references removed `@fullcalendar/*` packages. Task 8 deletes it.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(member\)/me/calendar/page.tsx
git commit -m "feat(web): wire CalendarApp + reschedule modal into /me/calendar page

Replaces the FullCalendar dynamic import target with CalendarApp. Hosts
the reschedule modal state at page level so it survives the calendar's
internal re-renders. Clicking an ICS event opens the modal pre-filled
with its times; submitting runs the existing useRescheduleEvent mutation."
```

---

## Task 7: CSS theming — map design tokens to Schedule-X vars

Replace the now-dead `.ics-calendar-grid` block in `globals.css` with a `.sx-react-calendar-wrapper` block that shadows Schedule-X's `--sx-color-*` defaults with our tokens.

**Files:**
- Modify: `apps/web/app/globals.css`

- [ ] **Step 1: Locate and replace the block**

In `apps/web/app/globals.css`, find the block starting at the comment `/* ============================================================  FullCalendar — Magazine Editorial adaption` and ending at the last `.ics-calendar-grid` rule (the `.fc-timegrid-now-indicator-line::before` pseudo-element). Replace that entire block (comment included) with:

```css
/* ============================================================
   Schedule-X — Magazine Editorial adaption
   Wraps @schedule-x/react in .sx-react-calendar-wrapper and maps
   --sx-color-* variables onto our design-system tokens.
   ============================================================ */

.sx-react-calendar-wrapper {
  --sx-color-primary: hsl(var(--primary));
  --sx-color-on-primary: hsl(var(--primary-fg));
  --sx-color-primary-container: hsl(var(--primary-soft));
  --sx-color-on-primary-container: hsl(var(--fg));

  --sx-color-surface: hsl(var(--surface));
  --sx-color-on-surface: hsl(var(--fg));
  --sx-color-surface-dim: hsl(var(--bg-subtle));
  --sx-color-surface-bright: hsl(var(--surface));
  --sx-color-surface-container: hsl(var(--bg));
  --sx-color-surface-container-low: hsl(var(--bg));
  --sx-color-surface-container-high: hsl(var(--bg-subtle));

  --sx-color-background: hsl(var(--bg));
  --sx-color-on-background: hsl(var(--fg));

  --sx-color-outline: hsl(var(--border));
  --sx-color-outline-variant: hsl(var(--border));
  --sx-color-shadow: transparent;
  --sx-color-surface-tint: hsl(var(--primary));
  --sx-color-neutral: hsl(var(--fg-mute));
  --sx-color-neutral-variant: hsl(var(--fg-faint));

  --sx-internal-color-gray-ripple-background: hsl(var(--bg-subtle));
  --sx-internal-color-light-gray: hsl(var(--bg-subtle));
  --sx-internal-color-text: hsl(var(--fg));

  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
  border: 1px solid hsl(var(--border));
  border-radius: 12px;
  overflow: hidden;
}

/* Schedule-X paints its own event borders; we want the event card
   components to own the look. Kill the library's backgrounds so our
   EventCardIcs / EventCardExternal render cleanly. */
.sx-react-calendar-wrapper .sx__event {
  background: transparent;
  border: none;
  padding: 0;
}

/* Day-header separator uses our stronger border token for anchoring. */
.sx-react-calendar-wrapper .sx__week-grid__day-name,
.sx-react-calendar-wrapper .sx__week-grid__date {
  border-bottom: 1px solid hsl(var(--border-strong));
}
```

- [ ] **Step 2: Build to verify no CSS is broken**

```bash
pnpm --filter @ics-select/web build
```

The build should succeed. If it fails with CSS parse errors, recheck the copy-paste.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "style(web): theme Schedule-X with our design tokens

Replaces the .ics-calendar-grid (FullCalendar) block with a
.sx-react-calendar-wrapper block that shadows --sx-color-* defaults
with our design-system tokens. Dark mode inherits automatically through
the :root / [data-theme='dark'] cascade. Event backgrounds are killed
so the EventCardIcs / EventCardExternal components own the look."
```

---

## Task 8: Delete obsolete FullCalendar components

Now that nothing imports them, delete the four old wrapper files.

**Files:**
- Delete: `apps/web/components/member/calendar/calendar-grid.tsx`
- Delete: `apps/web/components/member/calendar/calendar-event-ics.tsx`
- Delete: `apps/web/components/member/calendar/calendar-event-external.tsx`
- Delete: `apps/web/components/member/calendar/calendar-event-popover.tsx`

- [ ] **Step 1: Confirm none are imported**

```bash
grep -r "calendar-grid\b\|calendar-event-ics\|calendar-event-external\|calendar-event-popover" apps/web/ --include='*.ts*' --exclude-dir=node_modules
```

Expected: no matches outside the four files themselves. If `page.tsx` still imports any of them, Task 6 didn't land properly — go back and fix that before proceeding.

- [ ] **Step 2: Delete**

```bash
rm \
  apps/web/components/member/calendar/calendar-grid.tsx \
  apps/web/components/member/calendar/calendar-event-ics.tsx \
  apps/web/components/member/calendar/calendar-event-external.tsx \
  apps/web/components/member/calendar/calendar-event-popover.tsx
```

- [ ] **Step 3: Typecheck — should now be fully green**

```bash
pnpm --filter @ics-select/web typecheck
```

Expected: clean pass. If anything still fails, trace the remaining reference and either delete the orphan or restore the import path.

- [ ] **Step 4: Build**

```bash
pnpm --filter @ics-select/web build
```

Expected: success. Compare `/me/calendar`'s First Load JS against the pre-migration baseline (~221 KB). Schedule-X is lighter than FullCalendar so the number should hold or drop.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/member/calendar/
git commit -m "chore(web): delete FullCalendar-era calendar wrappers

calendar-grid, calendar-event-ics, calendar-event-external, and
calendar-event-popover are no longer referenced. Workspace typecheck is
now fully green after the migration."
```

---

## Task 9: Manual smoke + final verification

No unit tests on the web workspace — the verification is a hands-on session in the browser against a running API.

- [ ] **Step 1: Run lint + typecheck + tests at the monorepo root**

```bash
pnpm lint
pnpm typecheck
pnpm test
```

All three must be green.

- [ ] **Step 2: Start the dev server**

```bash
pnpm dev
```

- [ ] **Step 3: Smoke — golden path**

Open `/me/calendar` in Chrome (logged in as a member with at least one ICS event scheduled this week):

1. Page renders with the Sunday-start week view, time axis on the left in 30-min steps, now-indicator line present.
2. ICS event renders with the platform stripe, outcome dot, and title. External event renders with the dashed outline.
3. Click an ICS event → RescheduleModal opens with Início and Fim pre-filled in the user's tz. Current time displayed matches the grid position.
4. Change the Fim input to one hour later → click "Reagendar". Modal closes. The event on the grid shifts immediately (optimistic). The server-authoritative refetch lands silently and the block stays where it should.
5. Reload the page (Cmd+R). The grid paints instantly from localStorage cache. Header shows the pulsing refreshing dot briefly.
6. Click an external event → no modal opens. Click the Meet/Calendar icon on the card → new tab opens Google.
7. Toggle dark mode via Settings. Grid and event cards all read cleanly; today column is still visibly tinted; now-indicator is visible.

- [ ] **Step 4: Smoke — edge cases**

1. Click an ICS event at 11:30pm and set the new Fim to 00:30 the following day (crosses midnight). Modal accepts (end > start ISO-wise). Event moves — if Schedule-X clips at the day boundary visually, note it in the follow-ups list below (not a blocker).
2. Validate the modal rejects `end <= start` with the "o fim precisa ser depois do início" message.
3. Clear localStorage and reload → skeleton appears briefly → grid paints once the fetch lands.
4. Disconnect the internet, try to reschedule → optimistic update shows, request fails, ICS event visually reverts (thanks to `onError` in `useRescheduleEvent`).

- [ ] **Step 5: Fix anything that broke**

If the smoke surfaces a bug, open a targeted fix commit (not a rewrite). Common likely issues and their fixes:

- **All-day events disappear**: this iteration filters them out (see Task 5 Step 1 note). Not a regression for timed study blocks. Leave as follow-up.
- **Timezone drift** (event shows 1h off): verify `timezone` is being passed to `useCalendarApp` and that `isoToSxLocal` uses the same tz. If the Schedule-X free core ignores `timezone` config, the fallback is to render in browser-local and document it — commit a `style(web): note timezone limitation` README chunk under `components/member/calendar/` if that happens.
- **Custom event template doesn't receive `_ics`**: Schedule-X may strip unknown properties. In that case attach a `_customContent` key instead — check the library's current type for `CalendarEventExternal` and adjust the `SxEvent` type + the `customComponents` prop lookup.

Each fix commits separately with a `fix(web): ...` message describing the root cause.

- [ ] **Step 6: No extra commit unless Step 5 produced one**

The 8 commits from Tasks 1–8 (+ any Step 5 fixes) are the full change set.

---

## Follow-ups (out of scope for this plan)

- All-day events in the week view (Schedule-X exposes an all-day slot; reintroduce once timed events are stable).
- External event popover (today the external card inlines a single icon — if users ask for richer external-event detail, re-add a HeroUI Popover or route clicks through a read-only variant of the reschedule modal).
- Drag-to-reschedule via `@sx-premium/drag-and-drop` if a license is purchased.
- Playwright coverage for the calendar page (currently no e2e setup in `apps/web/tests`).

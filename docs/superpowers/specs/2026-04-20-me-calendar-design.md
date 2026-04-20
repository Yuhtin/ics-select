# `/me/calendar` — Week-grid calendar synced with Google Calendar

**Status:** design approved, ready for planning
**Date:** 2026-04-20
**Author:** brainstormed with Claude

## Problem

Today `/me/plan` renders `WeekList` — a day-grouped list of study items. Members already have their study blocks mirrored to Google Calendar (source of truth, since `StudySession` was removed), but the ICS UI shows a parallel list instead of the actual calendar. We want members to see their whole week — study blocks **and** every other Google Calendar event (classes, meetings, personal) — in a single time-grid view, with clear visual distinction between ICS-created blocks and external events, and the ability to reschedule ICS blocks without leaving the page.

CLAUDE.md already anticipates this: the intended member topbar reads `Today · Cohort · Calendar · avatar` (line 145). The current `Week` label is the leftover.

## Goals

1. Replace `/me/plan` with `/me/calendar`, a time-grid week view synced with the member's Google Calendar.
2. Distinguish ICS study blocks from external Google events via fundo + platform stripe (ICS) vs. paper-warm neutral (external).
3. Show current outcome of each ICS block inline (dot in the corner) so the member reads progress at a glance.
4. Let the member drag an ICS block within the visible week to reschedule it — with the change pushed back to Google Calendar.
5. Use every useful piece of metadata Google returns for external events (title, time, location, Meet link, htmlLink).

## Non-goals

- Creating or deleting events from this page. `StudySession` is gone; inventing a new concept for "manual study sessions" is out of scope.
- Moving external (non-ICS) events. We never mutate events we didn't create.
- Dragging across weeks.
- Other views (day, month, agenda). Week view only, as the product requires.
- Teaching the AI scheduler to respect all-day GCal events (OOF, trips). Noted as a future hook; separate ticket.

## Stack decision

**FullCalendar (`@fullcalendar/react` + `@fullcalendar/timegrid` + `@fullcalendar/interaction`)**, not HeroUI. HeroUI's `@heroui/calendar` is a date-picker (react-aria `CalendarDate`), not an event grid — it cannot render time-slotted events, so it's the wrong tool. FullCalendar is the standard React library for this exact pattern; ~100KB gzip is acceptable given the page's role.

Styling the FullCalendar primitives to match the Magazine Editorial design system requires CSS overrides via the library's documented CSS variables (`--fc-*`). The border-heavy, shadow-less aesthetic maps well to FullCalendar's default cell/border primitives.

## Architecture

### Routing

- New page: `apps/web/app/(member)/me/calendar/page.tsx`.
- `apps/web/app/(member)/me/plan/page.tsx` → converted to a client redirect to `/me/calendar` (preserves bookmarks; can be removed after a release).
- Topbar nav in `apps/web/components/member-shell/topbar-member.tsx`: change `{ href: '/me/plan', label: 'Week' }` → `{ href: '/me/calendar', label: 'Calendar' }`. Same for the mobile bottom tab bar.
- Delete `apps/web/components/member/week-list.tsx` — only consumer is `/me/plan/page.tsx`. `day-list.tsx` stays (reused by `/me` and `/me-preview`).

### Backend: new module `me/calendar`

New files under `apps/api/src/me/calendar/`:

- `calendar.controller.ts` — routes
- `calendar.service.ts` — logic
- `calendar.service.spec.ts` — unit tests

Registered in `apps/api/src/me/me.module.ts` alongside Home, Item, Cohort, Retro.

**`GET /me/calendar?weekStart=YYYY-MM-DD`**

Returns the full week's events, classified and enriched, in a single payload:

```ts
type MeCalendarResponse = {
  weekStart: string;          // ISO date (Sunday 00:00 in member timezone)
  weekEnd: string;            // ISO date (Saturday 23:59 in member timezone)
  timezone: string;           // MemberAvailability.timezone
  hasGoogleConnection: boolean;
  events: CalendarEvent[];
};

type CalendarEvent = {
  id: string;                 // Google Calendar event id
  kind: 'ICS' | 'EXTERNAL';
  title: string;
  start: string;              // ISO datetime, event timezone
  end: string;                // ISO datetime
  allDay: boolean;
  location?: string;
  meetLink?: string;          // conferenceData.entryPoints[].uri where type=video
  htmlLink?: string;
  ics?: {
    planId: string;
    itemId: string;           // WeeklyPlanItem.id
    url: string | null;       // libraryItem.url — web derives platform via detectPlatform()
    format: ItemFormat;
    topic: { slug: string; label: string } | null;
    outcome: ItemOutcome;
  };
};
```

**Service flow:**

1. Resolve `weekStart` + `weekEnd` (Sunday-start, 7-day span) in the member's `MemberAvailability.timezone` (default `America/Sao_Paulo`).
2. Call `GoogleCalendarService.listEventsInRange(userId, weekStart, weekEnd)` — note the existing implementation filters out all-day events; we relax this for the calendar use case (extend the service to accept an `includeAllDay: boolean` option, default `false` for backward compat). Update `GoogleCalendarService.listEventsInRange` return type to include `allDay: boolean`, `location`, `htmlLink`, `conferenceData`.
3. For each event, run `extractIcsId(description)`:
   - returns `{ planId, itemId }` → `kind = 'ICS'`
   - returns `null` → `kind = 'EXTERNAL'`
4. Batch-fetch `WeeklyPlanItem.findMany({ where: { id: { in: extractedItemIds } }, include: { libraryItem: { include: { topics: { include: { topic: {...} } } } } } })` in a single query. Build a map `itemId → {url, format, topic, outcome, planId}`.
5. Assemble the payload. If an ICS event's itemId can't be resolved (orphan — item was deleted), downgrade it to `EXTERNAL` (still shows, user isn't blocked) and log a warning.
6. If the Google API throws `invalid_grant` / 401: catch, return `{ hasGoogleConnection: false, events: [] }` instead of crashing.
7. If the user has no `GoogleAccount` row: same — return `hasGoogleConnection: false`.

**`PATCH /me/calendar/events/:eventId`**

Body: `{ start: ISODateTime, end: ISODateTime }`.

1. Load the event via `client.events.get({ calendarId: 'primary', eventId })`.
2. Run `extractIcsId(event.description)`:
   - null → throw `ForbiddenException('Cannot reschedule non-ICS events')`. Protects the member's personal calendar from mutation through our API.
3. Call `GoogleCalendarService.updateEvent(userId, eventId, { summary, description, start, end })` with the original summary/description preserved. Add an overload or new method `GoogleCalendarService.rescheduleEvent(userId, eventId, start, end)` that patches only `start`/`end` — cleaner than synthesizing full `CreateEventInput`.
4. Return `204 No Content`.

Ownership: the JWT gives us `userId`; `GoogleCalendarService.clientFor(userId)` already constrains calls to that user's OAuth client, so the user can only touch their own primary calendar. We don't need an extra ownership check beyond "event exists in their primary calendar" (the `get` call enforces this).

### Frontend

**Query layer** (`apps/web/lib/queries/me-calendar.ts`):

- `useMeCalendarWeek(weekStart: Date)` — TanStack `useQuery`, key `['me', 'calendar', isoDate(weekStart)]`, fetch `/me/calendar?weekStart=...`. `staleTime: 60_000`, `refetchOnWindowFocus: true`.
- `useRescheduleEvent()` — `useMutation` → `PATCH /me/calendar/events/:id`. `onMutate` patches cache optimistically; `onError` rolls back + toast; `onSuccess` invalidates query key.

**Page** (`apps/web/app/(member)/me/calendar/page.tsx`):

Two-column grid on desktop (`lg:grid-cols-[320px_1fr]`), stacked on mobile. Contents assembled from small components under `apps/web/components/member/calendar/`:

- `calendar-header.tsx` — `< Apr 20 – Apr 27 >` with left/right arrows + `[Today]` button. Source Serif 4 for the date range, tabular-nums, `--ink`. Arrows are `lucide-react` `ChevronLeft`/`ChevronRight`, stroke 1.5. Updates local `weekStart` state, which drives the query.
- `calendar-sidebar.tsx` — heading "THIS WEEK · N ICS" (eyebrow style, `font-mono`), then list of ICS events grouped by day. Each row: outcome dot 8px + 3px platform stripe + title (Source Serif 4 13px) + time (Inter 10px `--ink-mute`). Click → `router.push('/me/item/' + itemId)`. Empty state: "No study blocks this week."
- `calendar-grid.tsx` — the FullCalendar instance.
- `calendar-legend.tsx` — horizontal row below the grid: `● NOT YET  ● NAILED IT  ● GOT IT (HARD)  ● HAD DOUBTS  ● STUCK`. `font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute`, dots 8px using outcome tokens. Aligned to grid left (editorial magazine look).
- `calendar-skeleton.tsx` — 7-col grey-bar pulse while `isLoading`.
- `calendar-connect-banner.tsx` — "Connect your Google Calendar to see your week here." + CTA → `/auth/google`. Shown when `hasGoogleConnection === false`.
- `calendar-event-ics.tsx` — block renderer for ICS events (passed to FullCalendar `eventContent`).
- `calendar-event-external.tsx` — block renderer for external events.
- `calendar-event-popover.tsx` — HeroUI Popover content for external-event clicks.

**FullCalendar config:**

```ts
{
  plugins: [timeGridPlugin, interactionPlugin],
  initialView: 'timeGridWeek',
  headerToolbar: false,               // we own the nav
  allDaySlot: true,
  firstDay: 0,                        // Sunday
  locale: 'en',
  nowIndicator: true,
  timeZone: data.timezone,            // from API response
  slotMinTime: computedMin,           // min(06:00, earliestEvent-30min)
  slotMaxTime: computedMax,           // max(23:00, latestEvent+30min)
  expandRows: true,
  height: '70vh',
  editable: true,                     // overridden per-event via `editable` flag
  eventConstraint: { start: weekStartISO, end: weekEndISO },
  eventContent: (arg) => arg.event.extendedProps.kind === 'ICS'
    ? <ICSBlock .../>
    : <ExternalBlock .../>,
  eventDrop: handleReschedule,
  eventResize: handleReschedule,
  eventClick: (arg) => arg.event.extendedProps.kind === 'ICS'
    ? router.push('/me/item/' + arg.event.extendedProps.ics.itemId)
    : openPopover(arg.event),
}
```

Each event is mapped from the API:

```ts
{
  id: e.id,
  title: e.title,
  start: e.start,
  end: e.end,
  allDay: e.allDay,
  editable: e.kind === 'ICS',          // only ICS is draggable
  extendedProps: { kind: e.kind, ics: e.ics, location: e.location, meetLink: e.meetLink, htmlLink: e.htmlLink },
}
```

## Event rendering

### ICS block

- Background `--surface` (white), border `1px solid --rule`.
- Left stripe: 3px solid, color derived via `detectPlatform(url, format)` → `--platform-{youtube|leetcode|medium|github|article|book}`. Falls back to `--ink-mute` for `other`.
- Title row: `font-serif` Source Serif 4, 12–13px, `--ink`, truncates with ellipsis.
- Time row: `font-sans text-[10px] tabular-nums text-ink-mute`, format `HH:MM–HH:MM` in member timezone.
- Outcome dot: 8px solid circle, top-right, color = `--outcome-{pending|done-easy|done-hard|doubts|stuck}`.
- `cursor: grab` when `editable`.

### External block

- Background `--paper-warm`, no left stripe, no border.
- Title: Inter 11px `--ink-soft`, pulled straight from `event.summary`.
- Time: 10px `--ink-mute` tabular-nums.
- If `location`: inline `MapPin` lucide icon 10px + first 20 chars of location.
- If `meetLink`: inline `Video` lucide icon 10px.
- `cursor: default` (click opens popover, doesn't drag).

### Popover (external events only)

HeroUI `Popover` triggered on click. Content:

- Title (Newsreader 16px `--ink`)
- Time range + timezone
- Location (if set)
- "Join Meet" button (if `meetLink`)
- "Open in Google Calendar" link (opens `htmlLink` in new tab)

### All-day events

Rendered in FullCalendar's `allDaySlot` at the top. Same ICS/external distinction applies. ICS all-day events are not expected (scheduler only produces timed events) but would render correctly as a degenerate case — title + stripe, no time row.

## Drag-to-reschedule

- Only ICS events are `editable`; external events are not draggable or resizable.
- `eventConstraint` pins dragging inside the visible week — the member can't accidentally drag into next week and trigger a second week's refetch.
- `eventDrop` and `eventResize` share one handler that calls `useRescheduleEvent()` with the new start/end.
- Optimistic UI: `onMutate` patches the query cache so the block renders at the new position immediately.
- On error: rollback via TanStack `onError(context)` restoring previous cache; toast "Couldn't reschedule — try again." No special handling for overlap with other events; GCal itself allows overlap and so do we for MVP.

## States

| State | Detection | UI |
|---|---|---|
| Loading | `isLoading` | `calendar-skeleton.tsx`: 7 vertical grey columns with pulse animation; sidebar shows 4 placeholder rows |
| Empty week (no events) | `events.length === 0` and `hasGoogleConnection` | Grid renders with no blocks; sidebar shows "No study blocks this week." |
| No ICS but has external | `events.filter(e => e.kind === 'ICS').length === 0` | Sidebar shows "No study blocks this week."; grid shows external events |
| Google not connected | `hasGoogleConnection === false` | `calendar-connect-banner` above the grid with CTA `/auth/google` |
| Google token expired | API throws `invalid_grant`, service catches and returns `hasGoogleConnection: false` | Same banner, wording "Reconnect Google Calendar" |
| Reschedule failed | Mutation `onError` | Toast "Couldn't reschedule — try again." + cache rollback |

## Testing

**API — `calendar.service.spec.ts`:**

- `getWeek` classifies events correctly based on `ICS ID:` presence
- Enriches ICS events with `{url, format, topic, outcome}` via batched Prisma query
- Orphan ICS events (itemId not in DB) are downgraded to `EXTERNAL`
- Returns `hasGoogleConnection: false` when `GoogleAccount` row missing
- Returns `hasGoogleConnection: false` when `listEventsInRange` throws `invalid_grant`
- `reschedule` rejects with 403 when target event has no `ICS ID:`
- `reschedule` calls `updateEvent` with new start/end when target event is ICS
- `getWeek` respects `MemberAvailability.timezone` in week-boundary math

**Web — `tests/me-calendar.spec.ts` (Playwright):**

- Page renders calendar + sidebar when API returns a mocked week
- Clicking right arrow updates the header range and triggers a new API call (mocked route with different payload)
- Clicking an ICS block navigates to `/me/item/<id>`
- Clicking an external block opens the popover with title/time
- Banner renders when mocked API returns `hasGoogleConnection: false`

## Files to create / modify / delete

**Create:**
- `apps/api/src/me/calendar/calendar.controller.ts`
- `apps/api/src/me/calendar/calendar.service.ts`
- `apps/api/src/me/calendar/calendar.service.spec.ts`
- `apps/api/src/me/calendar/calendar.module.ts` (or register in `me.module.ts` directly)
- `apps/web/app/(member)/me/calendar/page.tsx`
- `apps/web/lib/queries/me-calendar.ts`
- `apps/web/components/member/calendar/calendar-header.tsx`
- `apps/web/components/member/calendar/calendar-sidebar.tsx`
- `apps/web/components/member/calendar/calendar-grid.tsx`
- `apps/web/components/member/calendar/calendar-legend.tsx`
- `apps/web/components/member/calendar/calendar-skeleton.tsx`
- `apps/web/components/member/calendar/calendar-connect-banner.tsx`
- `apps/web/components/member/calendar/calendar-event-ics.tsx`
- `apps/web/components/member/calendar/calendar-event-external.tsx`
- `apps/web/components/member/calendar/calendar-event-popover.tsx`
- `apps/web/app/globals.css` — add FullCalendar `--fc-*` variable overrides
- `apps/web/tests/me-calendar.spec.ts`

**Modify:**
- `apps/api/src/google-calendar/google-calendar.service.ts` — extend `listEventsInRange` to (a) accept `includeAllDay: boolean`, (b) include `location`, `htmlLink`, `conferenceData` in the return; add `rescheduleEvent(userId, eventId, start, end)` helper
- `apps/api/src/me/me.module.ts` — register CalendarModule
- `apps/web/components/member-shell/topbar-member.tsx` — `/me/plan` → `/me/calendar`, `Week` → `Calendar`
- `apps/web/components/member-shell/bottom-tab-bar.tsx` — same label/href change
- `apps/web/package.json` — add `@fullcalendar/react`, `@fullcalendar/timegrid`, `@fullcalendar/interaction`

**Delete:**
- `apps/web/components/member/week-list.tsx`
- `apps/web/app/(member)/me/plan/page.tsx` — replaced by a redirect client component (one-line `redirect('/me/calendar')`). Can be removed entirely in a follow-up release.

## Future hooks (not in this PR)

1. **AI scheduler respects all-day GCal events.** `SchedulerService.plan` currently only reads `MemberAvailability.*Minutes` and ignores the member's calendar. When drafting a plan, the AI should call `listEventsInRange` for the target week, find days with all-day events (OOF, trip, conference, holiday), and zero out `minutesBudget` for those days so study chunks don't get packed on top. Requires passing the member's GCal context into `DraftPlanService` and the scheduler's budget resolver.

2. **Dragging across weeks.** Constraint is explicitly scoped to the visible week for MVP; future iteration could lift this and auto-paginate on drag.

3. **Reschedule + outcome reconciliation.** Currently the API only updates the GCal event. If we decide `WeeklyPlanItem.scheduledAt` should mirror the GCal time for admin reports, that becomes a second write here.

## Open questions / flagged risks

- **FullCalendar CSS in a strict design system.** The library is opinionated; bending its default borders/slot heights to match the paper-warm + 1px-rule aesthetic will need careful override work. Risk: inconsistent borders between calendar cells and the rest of the app. Mitigation: do this override pass as its own PR task, compare visually against Figma / reference screenshots.

- **Timezone drift.** Member's `MemberAvailability.timezone` is trusted by the API for week boundaries, but FullCalendar also needs the same string. If the DB value is stale (member moved), week boundaries will look "off by one day". Accepting for now; timezone editing is in `/me/settings`.

- **Mobile week view legibility.** 7 columns on a phone is tight. We mitigate with `min-width: 640px` + horizontal scroll, but this breaks the "natural" feel of a mobile page. Acceptable tradeoff given the "week only" product constraint; revisit if feedback is painful.

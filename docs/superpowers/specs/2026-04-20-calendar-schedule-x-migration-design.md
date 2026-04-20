# Calendar — Migrate from FullCalendar to Schedule-X

**Date:** 2026-04-20
**Scope:** `/me/calendar` — the member weekly calendar view.
**Goals:** Replace FullCalendar with Schedule-X's free core to get a cleaner default aesthetic (light and dark), themeable via CSS variables, without the visual restrictions the previous polish pass couldn't overcome. Keep backend, cache, and lazy-loading work already shipped.

Non-goals: redesigning the calendar page layout, changing the backend response shape, building a custom grid from scratch.

---

## Why

The FullCalendar polish pass (shipped on `main` as of commit `021815e`) closed the most critical defects — dark-mode card contrast, now indicator, day-header anchoring — but the user is still unhappy with the default aesthetic. Pushing the polish further would mean fighting the library's internal styles node-by-node.

Schedule-X was evaluated as the alternative. Its free core supports the week view, custom event rendering, current-time indicator, events service plugin, and a clean CSS-variable-based theming model. The only feature gap is drag-to-reschedule, which is a premium plugin in their model. We accept that gap: rescheduling shifts from drag-and-drop to a click-to-open modal with start/end inputs.

No change to `GET /me/calendar`, no change to the localStorage SWR cache, no change to the lazy-loading wrapper. This is a **front-end component swap** constrained to the calendar component tree.

---

## Architecture

### Library boundary

The calendar becomes a single React component, `CalendarApp`, that wraps `@schedule-x/react`'s `ScheduleXCalendar`. It accepts the same `CalendarEvent[]` shape the page already fetches and the same `onReschedule` callback. The page file (`apps/web/app/(member)/me/calendar/page.tsx`) barely changes — the `next/dynamic` import keeps pointing at the calendar component, just at the new module path.

```
page.tsx
  ├─ useMeCalendarWeek ——— unchanged
  ├─ useRescheduleEvent —— unchanged
  ├─ <CalendarHeader />    unchanged
  ├─ <CalendarSidebar />   unchanged
  ├─ <CalendarApp />       NEW — wraps Schedule-X
  ├─ <CalendarLegend />    unchanged
  └─ reschedule modal ——— NEW
```

### Event model

Schedule-X's event shape expects `{ id, title, start, end, calendarId, ... }` where `start`/`end` are strings in `'YYYY-MM-DD HH:mm'` format in the calendar's configured timezone. Our API returns ISO strings (UTC). The adapter in `CalendarApp` converts:

```ts
function toSxTime(iso: string, tz: string): string {
  // formats iso in the calendar's timezone as 'YYYY-MM-DD HH:mm'
}
```

We use `calendarId` to carry `'ics'` vs `'external'` so theming rules can target each class via Schedule-X's built-in `.sx__event-calendar-ics` / `.sx__event-calendar-external` selectors.

Everything our consumers care about (the `ics` metadata, location, meetLink, htmlLink) rides on the event object via Schedule-X's typed extension (`_options` or a custom property — the adapter picks the pattern that survives the library's round-trips without stripping fields).

### Reschedule flow

Drag-to-reschedule is gone. The replacement:

1. User clicks an ICS event → Schedule-X fires the `onEventClick` callback.
2. `CalendarApp` sets local state `editing = event` and opens `RescheduleModal`.
3. Modal renders: title (read-only), two `<input type="datetime-local">` fields pre-filled with the event's current start/end (in the calendar timezone), a Cancel button, a primary "Reagendar" button.
4. Submit validates `end > start`. On success: dispatches the existing `onReschedule` callback (which is wired to `useRescheduleEvent.mutate` at the page level) and closes the modal.
5. Optimistic update, cache write, and server PATCH are unchanged — they all hang off `useRescheduleEvent`, which the modal talks to indirectly via `onReschedule`.

External events still open a popover/link to the original Google Calendar entry. Same behaviour as today.

### Event rendering

Schedule-X supports custom event content via a per-event `_customContent` slot or via a React event template override on the `ScheduleXCalendar` wrapper. We use the React template path:

- `event-card-ics.tsx` — port of the current `CalendarEventIcs` (platform stripe, outcome dot, truncated title + time row).
- `event-card-external.tsx` — port of the current `CalendarEventExternal` (transparent background, dashed outline, location/meet icons).

These drop in place via:

```tsx
<ScheduleXCalendar
  calendarApp={calendar}
  customComponents={{ eventModal, timeGridEvent: EventCardRouter }}
/>
```

`EventCardRouter` is a 5-line function that picks between `event-card-ics` and `event-card-external` based on `calendarId`.

### Theming

Schedule-X is themed entirely through CSS variables prefixed `--sx-*`. We scope a remap inside `.sx-react-calendar-wrapper` (the library's root selector) so the tokens shadow Schedule-X's Material-inspired defaults with our design-system ones. Dark mode inherits automatically because our tokens already flip under `[data-theme='dark']`.

Replaces the existing `.ics-calendar-grid` block in `globals.css`.

### Timezone handling

The API sends ISO UTC strings. Schedule-X wants local-time strings for the configured timezone. The adapter converts once on the way in; the reschedule callback converts once on the way out. Timezone source stays `data.timezone` from `GET /me/calendar`.

**Known unknown:** Schedule-X's `timezone` config field behaviour for the free core isn't fully documented in the sources we've read. If the conversion boundary is fuzzier than the adapter approach assumes, fix the adapter in-flight — do not redesign. If it turns out Schedule-X forces browser-local regardless of config, we render in the browser's timezone and document it; our users are all in São Paulo for now.

---

## File changes

**Dependencies (`apps/web/package.json`):**
- Add: `@schedule-x/react`, `@schedule-x/calendar`, `@schedule-x/events-service`, `@schedule-x/theme-default`, `@schedule-x/current-time`, `temporal-polyfill`.
- Remove: `@fullcalendar/core`, `@fullcalendar/interaction`, `@fullcalendar/react`, `@fullcalendar/timegrid`.

**Create:**
- `apps/web/components/member/calendar/calendar-app.tsx`
- `apps/web/components/member/calendar/event-card-ics.tsx`
- `apps/web/components/member/calendar/event-card-external.tsx`
- `apps/web/components/member/calendar/reschedule-modal.tsx`

**Modify:**
- `apps/web/app/(member)/me/calendar/page.tsx` — `next/dynamic` now imports `CalendarApp`; reschedule modal state lives here (open/close is page-level so it survives `CalendarApp` internal re-renders).
- `apps/web/app/globals.css` — replace the `.ics-calendar-grid` block with `.sx-react-calendar-wrapper` rules.
- `apps/web/components/member/calendar/calendar-grid-skeleton.tsx` — retain but visually tune if the Schedule-X grid dimensions diverge meaningfully.

**Delete:**
- `apps/web/components/member/calendar/calendar-grid.tsx` (FullCalendar wrapper — obsolete).
- `apps/web/components/member/calendar/calendar-event-ics.tsx` (superseded by `event-card-ics.tsx`).
- `apps/web/components/member/calendar/calendar-event-external.tsx` (superseded).
- `apps/web/components/member/calendar/calendar-event-popover.tsx` (external-event popover becomes a simple button + link inside the new external card; if needed, inline it).

**Unchanged:**
- `apps/web/lib/cache/calendar-cache.ts`
- `apps/web/lib/queries/me-calendar.ts`
- `apps/web/components/member/calendar/calendar-header.tsx`
- `apps/web/components/member/calendar/calendar-sidebar.tsx`
- `apps/web/components/member/calendar/calendar-legend.tsx`
- `apps/web/components/member/calendar/calendar-connect-banner.tsx`
- `apps/web/components/member/calendar/calendar-skeleton.tsx`
- Anything in `apps/api/`.

---

## UX decisions

- **Click behaviour on ICS events:** opens the reschedule modal (not the item detail page). Rationale: the calendar is the place the user goes when they want to reschedule; the item page is reached from the sidebar list or `/me/plan`. Previous behaviour (click → navigate to `/me/item/[id]`) moves to the sidebar link only — which already exists.
- **Click behaviour on EXTERNAL events:** opens a lightweight popover with location / Meet link / "Open in Google Calendar" — same content as today's popover, rendered inline from `event-card-external.tsx`.
- **Reschedule modal copy:** labels in pt-BR ("Reagendar", "Início", "Fim", "Cancelar"), per CLAUDE.md convention for user-generated-adjacent content; the chrome (Today button, week nav) stays in English.
- **Time inputs:** `<input type="datetime-local">` native control. Matches the admin plan editor's existing pattern and avoids pulling a date-picker dependency.

---

## Acceptance criteria

- [ ] `/me/calendar` renders the current week through Schedule-X in both light and dark modes; default aesthetic reads as modern and clean without additional CSS battles.
- [ ] ICS events render with the platform stripe + outcome dot (same visual tokens as today).
- [ ] External events render as dashed outlines (same visual language as today's Task 9 pass).
- [ ] Clicking an ICS event opens the reschedule modal pre-filled with the event's current times.
- [ ] Submitting the modal with valid times updates the event server-side (existing `useRescheduleEvent` path) and immediately reflects on the grid.
- [ ] Clicking an external event shows location / Meet / Google Calendar links.
- [ ] The now-indicator renders in the week view.
- [ ] `pnpm --filter @ics-select/web typecheck` and `pnpm --filter @ics-select/web build` both succeed.
- [ ] `/me/calendar`'s First Load JS is comparable to or smaller than the FullCalendar version (~221 KB pre-migration).
- [ ] No FullCalendar code or dependency remains in the repo.

---

## Out of scope / follow-ups

- Drag-to-reschedule (premium plugin). Revisit if user demand justifies buying a license, or if Schedule-X opens it up.
- Schedule-X sidebar plugin (premium).
- Recurring events UI.
- Mobile-specific calendar layout — today the grid is usable but tight under 640px; separate effort.

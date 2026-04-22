# Calendar week-grid — own renderer, drop Schedule-X

**Status:** draft · 2026-04-22
**Owner:** Davi Duarte
**Scope:** `/me/calendar` page renderer only. No changes to API, reschedule modal, header, sidebar, legend, or event-card components.

## Why

Schedule-X 4.5 carries heavy library chrome (day-name borders, ripple effects, Material-ish defaults) that fights our "Focus room" design system no matter how many `--sx-*` variables we override. The rendered grid looks nothing like the rest of the app, and the runtime-check on `Temporal.ZonedDateTime` already bit us once. The member-facing calendar is a trust surface — if it looks cheap, the whole product feels cheap.

Replace the renderer with a small, purpose-built week grid that styles from our tokens directly.

## What's in scope

- New `WeekGrid` component at `apps/web/components/member/calendar/week-grid.tsx`.
- Remove `calendar-app.tsx` and its Schedule-X dependencies.
- Remove the `.sx-react-calendar-wrapper` block from `apps/web/app/globals.css`.
- Remove `@schedule-x/calendar`, `@schedule-x/react`, `@schedule-x/current-time`, `@schedule-x/events-service`, `@schedule-x/theme-default` from `apps/web/package.json`.

## What's out of scope

- Drag-to-reschedule. Click an ICS event → existing `RescheduleModal` opens. Confirmed with user.
- Month view, day view, agenda view. Week view only.
- Creating events from empty slots.
- `temporal-polyfill` dependency stays. `sx-time.ts` helpers are still used by the reschedule modal and we're not touching them.
- `me-calendar.ts` queries, `calendar-header.tsx`, `calendar-sidebar.tsx`, `calendar-legend.tsx`, `calendar-connect-banner.tsx`, `reschedule-modal.tsx`, `event-card-ics.tsx`, `event-card-external.tsx` — untouched.

## Design

### Layout

The grid renders **07:00 → 24:00 local** (17 hours visible). On mount, `scrollTop` jumps to 10:00 local so the member lands mid-morning without seeing empty dawn slots.

CSS grid with explicit columns:

```
grid-template-columns: [time] 56px repeat(7, minmax(0, 1fr));
```

Vertical unit: `HOUR_PX = 56`. One hour = 56px, one 30-min slot = 28px, one pixel = ~1.07 min. The grid container has `overflow-y: auto` and a fixed `max-height` (probably `calc(100vh - 220px)` to leave room for the page header + calendar header). The page wrapper keeps `display: grid` with the sidebar on the left as today.

Three stacked sections:

1. **Day header** — sticky `top: 0`. 8 cells: empty spacer under the time axis, then 7 day cells with `Sun · 20` / `Mon · 21` / ... Today's number is a filled circle, `bg-primary text-primary-fg`.
2. **All-day row** — sticky right under the day header. One 32px row across the 7 day columns. Today's API already returns `allDay` events; the current renderer filters them out (`.filter(!e.allDay)`). They come back in as small pill-shaped chips of the external-event variety (never ICS since we don't create all-day study sessions).
3. **Time grid** — the scrollable body. Absolute-positioned events live inside each day column.

### Time axis

Left column, one label per hour at the hour's **top edge**. Format: `font-mono text-[10px] text-fg-mute`, labels `07`, `08`, ..., `23`, `00`. No label on `00` if it's the midnight terminator (style call — decide at build, keep consistent).

Hour dividers: `border-t` with `border-border-token`. Half-hour markers: lighter `border-t border-border-token/40`.

### Current-time indicator

A single absolutely-positioned element in **today's column only** (not across the full grid — matches Google Calendar behavior). Updates via `setInterval(60_000)` to advance the line. Red: `border-t-2 border-danger` with a `h-2 w-2 rounded-full bg-danger` dot on the left edge. Hidden on weeks that aren't the current week (decide by comparing `weekStart` to `startOfSundayWeek(now)`).

### Events

Two concerns: **positioning** (layout) and **rendering** (content).

**Positioning algorithm.** For each day column, run a simple interval-graph coloring pass:

1. Sort events in that day by `start` ascending.
2. Walk through them; assign each to the lowest-indexed "lane" whose current event has already ended.
3. After the walk, for each event, count the number of concurrent events in its overlap-cluster (group of events that transitively overlap).
4. Render each event with:
   - `top = (startMinuteInWindow) * HOUR_PX / 60`
   - `height = max(durationMinutes * HOUR_PX / 60, MIN_EVENT_PX=22)`
   - `left = lane * (100% / clusterSize)` within the column
   - `width = calc(100% / clusterSize - 2px)` (2px gap between lanes)
   - Events that cross the 07:00 floor or the 24:00 ceiling get clamped.

**Rendering.** Keep `EventCardIcs` and `EventCardExternal` as-is. The grid wraps each one in an `<div style={{ position: 'absolute', top, height, left, width }}>` with `onClick` delegated to the existing `onRescheduleClick` prop (only ICS kind triggers it).

### Colors and density

- Today's column body: subtle `bg-primary-soft/40` underlay so the eye finds today without a loud highlight.
- Weekend columns: no special treatment. Keep parity with weekdays.
- Card borders are owned by `EventCardIcs` / `EventCardExternal` — no change.
- No box-shadows anywhere in the grid. Plane separation via `bg-bg → bg-surface → rule border` only, matching the design system.

### Timezone

All date math goes through the `timezone` prop (member's IANA tz). The `getMinuteOfLocalDay(iso, tz)` and `getLocalWeekdayIndex(iso, tz)` helpers use `Intl.DateTimeFormat` with `timeZone`. No `Temporal` in this component.

### States

- **Empty week** (no events, Google connected): grid still renders with just the current-time line on today. No empty-state placeholder needed — the grid itself shows availability.
- **Google not connected**: `CalendarConnectBanner` handles this above the grid (existing behavior).
- **Loading**: `CalendarGridSkeleton` handles this above the grid (existing behavior, dynamic-imported loading state).

## Testing

Unit-testable pieces in isolation:

- `layoutEventsForDay(events) → Array<{ event, lane, clusterSize }>` — the interval-coloring function. Add a vitest/jest spec with overlap cases (2 concurrent, 3 concurrent, chain of overlapping triples, fully disjoint).
- `getMinuteOfLocalDay(iso, tz)` — timezone arithmetic. Spot-check `2026-04-22T14:30:00Z` in `America/Sao_Paulo` returns `11*60 + 30`.

Visual verification: Playwright snapshot on `/me/calendar` with a seeded week. Not adding this in v1 — existing Playwright suite covers other flows; this page currently has no snapshot test.

## Rollout

Single PR. No feature flag. Ship or revert.

## Risks

- **All-day events**: previously hidden, now visible. If a member's calendar has a noisy all-day event on every day of the week, the 32px all-day row becomes a flat band of chips. Acceptable — that's how Google Calendar behaves too. If it gets noisy in practice, collapse to "+3 more" after the first two.
- **Tall events that cross the 07:00 floor or 24:00 ceiling** (e.g., a study session from 06:30–08:00). The clamp hides the out-of-window portion; the card still renders with correct duration text. Acceptable.
- **Performance**: reconcile-on-minute for the current-time line is one `setState` per minute. Negligible.

## Open questions

None.

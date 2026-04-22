# Calendar week-grid implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Schedule-X with a purpose-built `WeekGrid` that styles from our design tokens and renders `/me/calendar` in a Google-Calendar-like week view.

**Architecture:** One new component `WeekGrid` with two colocated pure helpers (`layout.ts` for overlap-lane math, `time.ts` for tz-aware minute extraction). The page (`/me/calendar/page.tsx`) swaps its dynamic import from `CalendarApp` to `WeekGrid`. Schedule-X dependencies, the old component, and the CSS variable-mapping block are deleted in the last task once the new renderer is live.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind 3, HeroUI (Modal via existing `RescheduleModal`), `Intl.DateTimeFormat` for timezone math (no Temporal in this component). No unit-test runner exists in `apps/web`, so verification is typecheck + dev-server smoke.

---

## Spec

Read the design spec before starting any task: `docs/superpowers/specs/2026-04-22-calendar-week-grid-design.md`. Key constants it fixes:

- Visible window: **07:00 → 24:00 local** (17 hours). Last axis label is `00` (midnight of next day).
- Initial `scrollTop` anchors at **10:00 local**.
- `HOUR_PX = 56`. Half-hour = 28px. Pixel-per-minute = `56/60`.
- `MIN_EVENT_PX = 22`.
- Current-time line only renders on today's column, only when the week being viewed contains today.
- All-day events appear in a dedicated 32px row between the day header and the time grid.

---

## File structure

**Create:**
- `apps/web/components/member/calendar/week-grid/index.tsx` — the component, default-exported as `WeekGrid`.
- `apps/web/components/member/calendar/week-grid/layout.ts` — pure `layoutEventsForDay(events)` that assigns each event a lane + cluster size.
- `apps/web/components/member/calendar/week-grid/time.ts` — pure tz helpers (`getMinuteOfLocalDay`, `getLocalWeekdayIndex`, `formatLocalDay`).

**Modify:**
- `apps/web/app/(member)/me/calendar/page.tsx` — change the dynamic import target.
- `apps/web/app/globals.css` — delete the `.sx-react-calendar-wrapper` block (lines ~373–427).
- `apps/web/package.json` — drop five `@schedule-x/*` packages.

**Delete:**
- `apps/web/components/member/calendar/calendar-app.tsx`.

**Untouched:**
- `apps/web/components/member/calendar/calendar-header.tsx`, `calendar-sidebar.tsx`, `calendar-legend.tsx`, `calendar-connect-banner.tsx`, `calendar-skeleton.tsx`, `calendar-grid-skeleton.tsx`, `event-card-ics.tsx`, `event-card-external.tsx`, `reschedule-modal.tsx`.
- `apps/web/lib/queries/me-calendar.ts`, `apps/web/lib/calendar/sx-time.ts` (still used by the reschedule modal).

---

## Task 1 — Pure tz helpers

**Files:**
- Create: `apps/web/components/member/calendar/week-grid/time.ts`

- [ ] **Step 1: Create the file with the three helpers**

```ts
// Pure timezone helpers for the week grid. Uses Intl.DateTimeFormat so we
// don't pull Temporal into this component.

type Parts = {
  year: number;
  month: number; // 1..12
  day: number;
  hour: number; // 0..23
  minute: number;
  weekday: number; // 0 = Sunday .. 6 = Saturday
};

function partsOf(iso: string, timezone: string): Parts {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== 'literal') map[p.type] = p.value;
  }
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
    map.weekday ?? 'Sun',
  );
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    weekday: weekdayIndex,
  };
}

/** Minute-of-day (0..1439) for an ISO instant in the given IANA tz. */
export function getMinuteOfLocalDay(iso: string, timezone: string): number {
  const p = partsOf(iso, timezone);
  return p.hour * 60 + p.minute;
}

/** 0 = Sunday .. 6 = Saturday in the given IANA tz. */
export function getLocalWeekdayIndex(iso: string, timezone: string): number {
  return partsOf(iso, timezone).weekday;
}

/** { y, m, d } calendar date in tz. Used to bucket events by column. */
export function getLocalDateKey(iso: string, timezone: string): string {
  const p = partsOf(iso, timezone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Calendar-date key for a Date object already in its own local sense.
 * weekStart from /me/calendar/page.tsx is built via new Date() with local
 * setters, so use local getters here — not UTC, not tz-aware. */
export function localDateKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/member/calendar/week-grid/time.ts
git commit -m "feat(calendar): tz-aware minute/weekday helpers for week grid"
```

---

## Task 2 — Pure overlap-lane layout

**Files:**
- Create: `apps/web/components/member/calendar/week-grid/layout.ts`

- [ ] **Step 1: Create the file**

```ts
import type { CalendarEvent } from '../../../../lib/queries/me-calendar';

export type LaidOutEvent = {
  event: CalendarEvent;
  startMin: number; // 0..1439 minute-of-local-day
  endMin: number;
  lane: number; // 0-indexed
  clusterSize: number; // total lanes in this overlap cluster
};

export type LayoutInput = {
  event: CalendarEvent;
  startMin: number;
  endMin: number;
};

/**
 * Assign each event a lane (column within the day) and a cluster size, so
 * overlapping events render side-by-side Google Calendar style.
 *
 * Algorithm:
 *  1. Sort by startMin asc, then by endMin desc (longer events first on ties).
 *  2. Walk through, assigning each event to the lowest lane whose last event
 *     ended at or before the new event's start. Grow lanes as needed.
 *  3. A "cluster" is a transitive overlap group. Two events are in the same
 *     cluster iff they overlap, or if they both overlap a common third event.
 *     ClusterSize = the maximum lane-index + 1 observed inside the cluster.
 */
export function layoutEventsForDay(input: LayoutInput[]): LaidOutEvent[] {
  if (input.length === 0) return [];

  const sorted = [...input].sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    return b.endMin - a.endMin;
  });

  type Placed = LayoutInput & { lane: number; clusterId: number };
  const placed: Placed[] = [];
  const laneEnds: number[] = []; // laneEnds[lane] = latest endMin in that lane
  const clusterEnd: number[] = []; // clusterEnd[id] = max endMin inside cluster
  let currentClusterId = -1;

  for (const ev of sorted) {
    // Assign to the lowest lane whose last event has ended.
    let lane = laneEnds.findIndex((end) => end <= ev.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(ev.endMin);
    } else {
      laneEnds[lane] = ev.endMin;
    }

    // Cluster: if this event overlaps the current cluster's outer bound,
    // keep the same cluster id. Otherwise start a fresh one.
    if (
      currentClusterId === -1 ||
      ev.startMin >= clusterEnd[currentClusterId]!
    ) {
      currentClusterId = clusterEnd.length;
      clusterEnd.push(ev.endMin);
    } else {
      clusterEnd[currentClusterId] = Math.max(
        clusterEnd[currentClusterId]!,
        ev.endMin,
      );
    }

    placed.push({ ...ev, lane, clusterId: currentClusterId });
  }

  // For each cluster, clusterSize = 1 + max(lane) among its events.
  const maxLaneByCluster = new Map<number, number>();
  for (const p of placed) {
    const prev = maxLaneByCluster.get(p.clusterId) ?? -1;
    if (p.lane > prev) maxLaneByCluster.set(p.clusterId, p.lane);
  }

  return placed.map((p) => ({
    event: p.event,
    startMin: p.startMin,
    endMin: p.endMin,
    lane: p.lane,
    clusterSize: (maxLaneByCluster.get(p.clusterId) ?? 0) + 1,
  }));
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/member/calendar/week-grid/layout.ts
git commit -m "feat(calendar): pure overlap-lane layout for week grid"
```

---

## Task 3 — WeekGrid scaffolding (no events yet)

**Files:**
- Create: `apps/web/components/member/calendar/week-grid/index.tsx`
- Modify: `apps/web/app/(member)/me/calendar/page.tsx`

Goal: the page renders the new empty grid (day header, time axis, seven columns, today highlight, initial scroll at 10:00) but no events yet. `calendar-app.tsx` stays in place for fallback; just nobody imports it after this task.

- [ ] **Step 1: Create the WeekGrid component**

```tsx
'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { clsx } from 'clsx';
import type { CalendarEvent } from '../../../../lib/queries/me-calendar';
import { localDateKeyFromDate } from './time';

export const WEEK_GRID_START_HOUR = 7;
export const WEEK_GRID_END_HOUR = 24; // exclusive upper — axis shows 24 labels 07..23,00
export const HOUR_PX = 56;
const HOURS_VISIBLE = WEEK_GRID_END_HOUR - WEEK_GRID_START_HOUR;
const INITIAL_SCROLL_HOUR = 10;

interface WeekGridProps {
  weekStart: Date; // Sunday 00:00 local (as built in page.tsx)
  timezone: string;
  events: CalendarEvent[];
  onRescheduleClick: (event: CalendarEvent) => void;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function hourLabel(h: number): string {
  const shown = h % 24;
  return String(shown).padStart(2, '0');
}

export function WeekGrid({ weekStart, timezone, events: _events, onRescheduleClick: _onRescheduleClick }: WeekGridProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const today = useMemo(() => new Date(), []);
  const todayKey = localDateKeyFromDate(today);

  // Jump to initial hour exactly once on mount.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = (INITIAL_SCROLL_HOUR - WEEK_GRID_START_HOUR) * HOUR_PX;
  }, []);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  return (
    <div className="rounded-[12px] border border-border-token bg-surface overflow-hidden">
      {/* Day header (sticky). Mounted outside the scroll container so it never scrolls. */}
      <div
        className="grid border-b border-border-token bg-surface"
        style={{ gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))' }}
      >
        <div />
        {days.map((d) => {
          const isToday = localDateKeyFromDate(d) === todayKey;
          return (
            <div
              key={d.toISOString()}
              className="flex items-center justify-center gap-2 py-2 font-mono text-[11px] uppercase tracking-label text-fg-mute"
            >
              <span>{WEEKDAY_LABELS[d.getDay()]}</span>
              <span
                className={clsx(
                  'inline-flex h-6 w-6 items-center justify-center rounded-full font-sans text-[13px] tabular-nums',
                  isToday
                    ? 'bg-primary text-primary-fg font-semibold'
                    : 'text-fg',
                )}
              >
                {d.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* All-day row placeholder — filled in Task 6. */}
      <div
        className="grid border-b border-border-token bg-bg-subtle"
        style={{
          gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))',
          minHeight: '32px',
        }}
      >
        <div className="flex items-center justify-end pr-2 font-mono text-[9px] uppercase tracking-label text-fg-faint">
          all-day
        </div>
        {days.map((d) => (
          <div key={d.toISOString()} className="border-l border-border-token/60" />
        ))}
      </div>

      {/* Scrollable body. */}
      <div
        ref={scrollRef}
        className="overflow-y-auto"
        style={{ maxHeight: 'calc(100vh - 240px)' }}
      >
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: '56px repeat(7, minmax(0, 1fr))',
            height: `${HOURS_VISIBLE * HOUR_PX}px`,
          }}
        >
          {/* Time axis column. */}
          <div className="relative">
            {Array.from({ length: HOURS_VISIBLE + 1 }, (_, i) => {
              const h = WEEK_GRID_START_HOUR + i;
              return (
                <div
                  key={h}
                  className="absolute right-2 -translate-y-1/2 font-mono text-[10px] text-fg-mute tabular-nums"
                  style={{ top: `${i * HOUR_PX}px` }}
                >
                  {hourLabel(h)}
                </div>
              );
            })}
          </div>

          {/* Day columns. */}
          {days.map((d, colIdx) => {
            const isToday = localDateKeyFromDate(d) === todayKey;
            return (
              <div
                key={d.toISOString()}
                className={clsx(
                  'relative border-l border-border-token/60',
                  isToday && 'bg-primary-soft/30',
                )}
              >
                {/* Hour grid lines. */}
                {Array.from({ length: HOURS_VISIBLE }, (_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-border-token/40"
                    style={{ top: `${i * HOUR_PX}px` }}
                  />
                ))}
                {/* Events will go here (Task 4). */}
                {/* Suppress unused warnings until events land. */}
                <div style={{ display: 'none' }} data-col-idx={colIdx} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Swap the dynamic import in the page**

In `apps/web/app/(member)/me/calendar/page.tsx`, change:

```tsx
const CalendarApp = dynamic(
  () =>
    import('../../../../components/member/calendar/calendar-app').then(
      (m) => m.CalendarApp,
    ),
  { ssr: false, loading: () => <CalendarGridSkeleton /> },
);
```

to:

```tsx
const CalendarApp = dynamic(
  () =>
    import('../../../../components/member/calendar/week-grid').then(
      (m) => m.WeekGrid,
    ),
  { ssr: false, loading: () => <CalendarGridSkeleton /> },
);
```

(The local variable name `CalendarApp` can stay — it's just a dynamic ref.)

- [ ] **Step 3: Typecheck + visual smoke**

Run: `pnpm --filter @ics-select/web typecheck`
Expected: no errors.

Run the dev server (`pnpm --filter @ics-select/web dev`), open `/me/calendar`, confirm the empty grid renders: day header, today's number highlighted, seven columns with hourly grid lines, hours axis `07..23,00`, scroll starts at 10:00. Events are not yet rendered — expected.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/member/calendar/week-grid/index.tsx apps/web/app/\(member\)/me/calendar/page.tsx
git commit -m "feat(calendar): week-grid scaffolding — header, axis, columns, initial scroll"
```

---

## Task 4 — Positioned events

**Files:**
- Modify: `apps/web/components/member/calendar/week-grid/index.tsx`

Use the pure helpers from Tasks 1–2 to bucket timed (non-all-day) events by day, run `layoutEventsForDay`, and render them absolutely positioned with lane-based side-by-side layout. Clicking an ICS event calls `onRescheduleClick`.

- [ ] **Step 1: Import helpers + EventCards at the top**

```tsx
import { EventCardIcs } from '../event-card-ics';
import { EventCardExternal } from '../event-card-external';
import {
  getLocalDateKey,
  getMinuteOfLocalDay,
  localDateKeyFromDate,
} from './time';
import { layoutEventsForDay, type LaidOutEvent } from './layout';
```

(`localDateKeyFromDate` is already imported from Task 3.)

- [ ] **Step 2: Compute a per-day layout map**

Inside the component, after `const days = useMemo(...)`, add:

```tsx
const MIN_EVENT_PX = 22;
const START_MIN = WEEK_GRID_START_HOUR * 60;
const END_MIN = WEEK_GRID_END_HOUR * 60;

const layoutByDayKey = useMemo(() => {
  const timed = _events.filter((e) => !e.allDay);
  const byKey = new Map<string, Array<{ event: CalendarEvent; startMin: number; endMin: number }>>();
  for (const e of timed) {
    const key = getLocalDateKey(e.start, timezone);
    const startMin = getMinuteOfLocalDay(e.start, timezone);
    let endMin = getMinuteOfLocalDay(e.end, timezone);
    if (endMin <= startMin) endMin = startMin + 15; // defensive for zero-length
    const list = byKey.get(key) ?? [];
    list.push({ event: e, startMin, endMin });
    byKey.set(key, list);
  }
  const out = new Map<string, LaidOutEvent[]>();
  for (const [k, list] of byKey) out.set(k, layoutEventsForDay(list));
  return out;
}, [_events, timezone]);
```

Rename `_events` to `events` and `_onRescheduleClick` to `onRescheduleClick` in the destructure and in the return — they're used now.

- [ ] **Step 3: Render the events inside each day column**

Replace the placeholder `<div style={{ display: 'none' }} data-col-idx={colIdx} />` inside the day column with:

```tsx
{(layoutByDayKey.get(localDateKeyFromDate(d)) ?? []).map((le) => {
  const clamped = {
    startMin: Math.max(le.startMin, START_MIN),
    endMin: Math.min(le.endMin, END_MIN),
  };
  if (clamped.endMin <= clamped.startMin) return null;
  const topPx = ((clamped.startMin - START_MIN) * HOUR_PX) / 60;
  const heightPx = Math.max(
    ((clamped.endMin - clamped.startMin) * HOUR_PX) / 60,
    MIN_EVENT_PX,
  );
  const widthPct = 100 / le.clusterSize;
  const leftPct = le.lane * widthPct;
  const timeLabel = formatTimeRange(le.event.start, le.event.end, timezone);
  const handleClick =
    le.event.kind === 'ICS' ? () => onRescheduleClick(le.event) : undefined;
  return (
    <div
      key={le.event.id}
      className={clsx(
        'absolute px-[2px]',
        handleClick && 'cursor-pointer',
      )}
      style={{
        top: `${topPx}px`,
        height: `${heightPx}px`,
        left: `${leftPct}%`,
        width: `calc(${widthPct}% - 2px)`,
      }}
      onClick={handleClick}
    >
      {le.event.kind === 'ICS' ? (
        <EventCardIcs event={le.event} timeLabel={timeLabel} />
      ) : (
        <EventCardExternal event={le.event} timeLabel={timeLabel} />
      )}
    </div>
  );
})}
```

- [ ] **Step 4: Add the local `formatTimeRange` helper**

Near the other module-scope helpers (above `export function WeekGrid(...)`):

```tsx
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
```

(Same signature the old `calendar-app.tsx` used.)

- [ ] **Step 5: Typecheck + visual**

Run: `pnpm --filter @ics-select/web typecheck`. Then dev-server-smoke: an existing user with published ICS events should see them positioned at the correct times; overlapping events should render side-by-side.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/member/calendar/week-grid/index.tsx
git commit -m "feat(calendar): events positioned with overlap lanes in week grid"
```

---

## Task 5 — Current-time line

**Files:**
- Modify: `apps/web/components/member/calendar/week-grid/index.tsx`

- [ ] **Step 1: Add a ticking `now` state**

Near the top of the component, under the `today` memo:

```tsx
const [now, setNow] = useState(() => new Date());
useEffect(() => {
  const id = window.setInterval(() => setNow(new Date()), 60_000);
  return () => window.clearInterval(id);
}, []);
```

Add `useState` to the React imports at the top.

- [ ] **Step 2: Compute whether today is within the visible week**

Below the `days` memo:

```tsx
const todayColumnIndex = useMemo(() => {
  const tKey = localDateKeyFromDate(now);
  return days.findIndex((d) => localDateKeyFromDate(d) === tKey);
}, [days, now]);
```

- [ ] **Step 3: Render the line inside today's column only**

Inside the day-column map, after the hour grid lines and before the positioned events, add:

```tsx
{todayColumnIndex === colIdx && (() => {
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (nowMin < START_MIN || nowMin > END_MIN) return null;
  const topPx = ((nowMin - START_MIN) * HOUR_PX) / 60;
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-10"
      style={{ top: `${topPx}px` }}
    >
      <div className="relative h-0 border-t-2 border-danger">
        <span className="absolute -left-[5px] -top-[5px] h-[10px] w-[10px] rounded-full bg-danger" />
      </div>
    </div>
  );
})()}
```

- [ ] **Step 4: Typecheck + visual**

Dev-server: the red line should be visible on today's column at the correct minute. Navigate to another week — the line disappears.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/member/calendar/week-grid/index.tsx
git commit -m "feat(calendar): current-time line on today column"
```

---

## Task 6 — All-day row

**Files:**
- Modify: `apps/web/components/member/calendar/week-grid/index.tsx`

- [ ] **Step 1: Compute per-day all-day lists**

Next to `layoutByDayKey`:

```tsx
const allDayByDayKey = useMemo(() => {
  const m = new Map<string, CalendarEvent[]>();
  for (const e of events.filter((ev) => ev.allDay)) {
    const key = getLocalDateKey(e.start, timezone);
    const list = m.get(key) ?? [];
    list.push(e);
    m.set(key, list);
  }
  return m;
}, [events, timezone]);
```

- [ ] **Step 2: Render the all-day cells**

Replace the placeholder all-day row body:

```tsx
{days.map((d) => (
  <div key={d.toISOString()} className="border-l border-border-token/60" />
))}
```

with:

```tsx
{days.map((d) => {
  const list = allDayByDayKey.get(localDateKeyFromDate(d)) ?? [];
  return (
    <div
      key={d.toISOString()}
      className="flex flex-wrap items-center gap-1 border-l border-border-token/60 px-1 py-1"
    >
      {list.map((e) => (
        <span
          key={e.id}
          className="truncate rounded-pill border border-border-token/60 bg-surface px-2 py-[1px] font-sans text-[10px] text-fg-soft"
          title={e.title}
          style={{ maxWidth: '100%' }}
        >
          {e.title}
        </span>
      ))}
    </div>
  );
})}
```

- [ ] **Step 3: Visual smoke**

A user with a multi-day all-day Google Calendar event (e.g., "Férias") should see pills in the all-day row across the affected days.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/member/calendar/week-grid/index.tsx
git commit -m "feat(calendar): all-day row chips in week grid"
```

---

## Task 7 — Drop Schedule-X

**Files:**
- Delete: `apps/web/components/member/calendar/calendar-app.tsx`
- Modify: `apps/web/app/globals.css` — remove the `.sx-react-calendar-wrapper` block (and the surrounding comment banner).
- Modify: `apps/web/package.json` — drop `@schedule-x/calendar`, `@schedule-x/current-time`, `@schedule-x/events-service`, `@schedule-x/react`, `@schedule-x/theme-default`.

- [ ] **Step 1: Delete the old renderer**

```bash
rm apps/web/components/member/calendar/calendar-app.tsx
```

- [ ] **Step 2: Strip the CSS block**

Open `apps/web/app/globals.css` and delete from the banner comment starting with `Schedule-X — Magazine Editorial adaption` through the closing `}` of the `.sx-react-calendar-wrapper .sx__week-grid__date` rule. Verify nothing references `.sx-` after the edit: `grep -n "sx-" apps/web/app/globals.css` should return nothing.

- [ ] **Step 3: Drop the deps**

Edit `apps/web/package.json` to remove the five `@schedule-x/*` lines from `dependencies`. Then:

```bash
pnpm install
```

Expected: lockfile updates, no errors.

- [ ] **Step 4: Full typecheck + dev smoke**

Run: `pnpm --filter @ics-select/web typecheck`
Expected: no errors.

Also run a grep to make sure no file still imports `@schedule-x`:

```bash
grep -rn "@schedule-x\|calendar-app" apps/web/app apps/web/components apps/web/lib
```

Expected: no matches.

Dev server: `/me/calendar` renders the new grid with events, current-time line, all-day row; switching weeks and clicking an ICS event still opens the reschedule modal.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/member/calendar/calendar-app.tsx apps/web/app/globals.css apps/web/package.json pnpm-lock.yaml
git commit -m "chore(calendar): remove Schedule-X — week grid replaces it"
```

---

## Task 8 — Final push

- [ ] **Step 1: Run build to catch any prod-only issue**

```bash
pnpm --filter @ics-select/web build
```

Expected: build succeeds. Next.js 15 + Turbopack will surface any lingering import problem.

- [ ] **Step 2: Push**

```bash
git push
```

---

## Self-review notes

- Spec coverage: tasks 1–6 map 1:1 to the spec's "Design" subsections (layout, time axis, current-time indicator, events, all-day row, colors/density handled in-situ). Tz handling is covered in Task 1. Dropping Schedule-X is Task 7. No gap.
- Placeholder scan: every step has concrete code or an exact command; no TBDs, no "handle edge cases", no "similar to Task N".
- Type consistency: `LaidOutEvent` fields (`event`, `startMin`, `endMin`, `lane`, `clusterSize`) are used identically in Task 4. `CalendarEvent` from `me-calendar.ts` is the single event type end-to-end. `HOUR_PX` / `WEEK_GRID_START_HOUR` / `WEEK_GRID_END_HOUR` are exported once and reused.
- Scope: single component rewrite, single PR, one deps cleanup. Appropriate.

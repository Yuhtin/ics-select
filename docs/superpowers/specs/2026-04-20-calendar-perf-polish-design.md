# Calendar — Perf + Visual Polish

**Date:** 2026-04-20
**Scope:** `/me/calendar` (member weekly calendar view)
**Goals:** (1) fix dark-mode visual defects, (2) make the page feel instant on revisits, (3) cut backend latency on fresh fetches, (4) stop the FullCalendar bundle from blocking first paint.

Non-goals: rewriting FullCalendar, adding Google push-notification sync, admin calendar views, mobile-specific calendar redesign.

---

## Problem

Today, every visit to `/me/calendar` blocks on a single sequential chain:

1. TanStack Query has no persistence — the in-memory cache is lost on every page reload, so the user sees `CalendarSkeleton` for the full round-trip.
2. The backend (`GET /me/calendar?weekStart=...`) runs Prisma queries sequentially, then calls Google `events.list` without a `fields` projection, pulling ~5–10× more payload than needed, then reconstructs a fresh `OAuth2` client every time (forcing frequent token refreshes).
3. The FullCalendar bundle (`@fullcalendar/react` + `timegrid` + `interaction`, ~250 KB gzip) is part of the page's initial JS, so nothing above the grid renders until it arrives.
4. In dark mode, FullCalendar's page background collapses into the ICS event card background (both `hsl(var(--surface))`), killing contrast. The "today" highlight is invisible (`primary/0.04`). External events visually compete with ICS events.

`calendar.google.com` feels instant because it ships a service worker + IndexedDB + push channels — we can't replicate that stack, but we can close most of the gap with partial responses, an auth client cache, lazy loading the grid bundle, and localStorage SWR.

---

## Design

Four independent sections. They can land in separate PRs but the order below is a natural build sequence.

### Section 1 — Visual polish (dark mode focus)

Scope: CSS in `apps/web/app/globals.css` under `.ics-calendar-grid`, plus the event components under `apps/web/components/member/calendar/`. No structural changes.

**Fixes:**

1. **Page vs card contrast.** Change `--fc-page-bg-color` from `hsl(var(--surface))` to `hsl(var(--bg))`. ICS event cards keep `bg-surface` — now they visually sit *on top of* the grid instead of blending into it. Applies to light + dark.
2. **Today column highlight.** Replace `--fc-today-bg-color: hsl(var(--primary) / 0.04)` with dual-theme values: `0.08` in light, `0.12` in dark. Still subtle, finally visible.
3. **External event differentiation.** `calendar-event-external.tsx`: drop `bg-bg-subtle`, use `bg-transparent` + `border border-dashed border-border-token`. Reads as "not yours" at a glance — also relieves the visual competition with ICS cards.
4. **Now indicator.** Bump from 1px to 2px and prepend a 6px dot at the left edge. Done in the `.ics-calendar-grid .fc-timegrid-now-indicator-line` rule.
5. **Day header separator.** `.fc-col-header-cell` bottom border switches to `hsl(var(--border-strong))` so the day row visually anchors the grid.
6. **Legend collapse.** `calendar-legend.tsx` wraps its content in a `<details>` that is collapsed by default, with a compact `summary` showing "Outcomes" + the 5 dots. Users who want labels click to expand.
7. **Sidebar width.** `/me/calendar/page.tsx` grid template goes from `320px_1fr` to `280px_1fr`.

No new tokens. Everything routes through the existing design-system variables.

### Section 2 — Backend perf

Scope: `apps/api/src/google-calendar/google-calendar.service.ts`, `apps/api/src/me/calendar/calendar.service.ts`, plus their specs.

**Changes:**

1. **Partial response on `events.list`.** Add `fields: 'items(id,summary,description,start,end,location,htmlLink,conferenceData/entryPoints)'` and `maxResults: 100`. Cuts Google's response payload ~5–10× and bounds it regardless of how many events the user has.
2. **Auth client cache.** Add a private `Map<string, { client: OAuth2Client; expiresAt: number }>` on `GoogleCalendarService`. `clientFor(userId)` checks the cache first — if `expiresAt > now + 60s`, returns the cached client; else rebuilds and stores. Add a public `invalidateAuth(userId: string)` method that deletes the entry; call it from `AuthService.loginWithGoogle` right after the `GoogleAccount` upsert (so a fresh login/refresh flushes any stale cached client). TTL uses the DB row's `expiresAt` minus 60s safety buffer, so we never serve a client that's about to expire mid-request.
3. **Parallel Prisma reads in `getWeek`.** `availability` and `googleAccount` go into a single `Promise.all`. The `weeklyPlanItem` batch stays downstream since it depends on the Google response.

Tests (`google-calendar.service.spec.ts`):
- Asserts `events.list` is called with the exact `fields` string and `maxResults: 100`.
- Asserts the OAuth2 client is constructed once across two consecutive `listEventsInRange` calls inside the TTL window, and twice when the second call is past `expiresAt`.
- Asserts `invalidateAuth` removes the cached entry.

### Section 3 — SWR localStorage (frontend cache)

Scope: one new file + edits to the existing query hook + small render tweaks in the page.

**New file — `apps/web/lib/cache/calendar-cache.ts`:**

```ts
type CachedWeek = { data: GetWeekResponse; updatedAt: number };

const VERSION = 'v1';
const PREFIX = `ics:calendar:${VERSION}:`;
const MAX_WEEKS = 8;

export function readCachedWeek(weekStart: Date): CachedWeek | null;
export function writeCachedWeek(weekStart: Date, data: GetWeekResponse): void;
```

- Guards `typeof window !== 'undefined'` on every call.
- `read` wraps `JSON.parse` in try/catch — any corruption is silently treated as cache miss.
- `write` also prunes: on each write, scans `localStorage` keys prefixed with `PREFIX`, drops anything older than `MAX_WEEKS` by week start. Quota errors are swallowed (cache is an optimisation, never load-bearing).

**Edits — `apps/web/lib/queries/me-calendar.ts`:**

- `useMeCalendarWeek` becomes:
  ```ts
  const cached = useMemo(() => readCachedWeek(weekStart), [weekStartKey]);
  return useQuery({
    queryKey: ['me', 'calendar', weekStartKey],
    queryFn: async () => {
      const fresh = await apiFetch<GetWeekResponse>(...);
      writeCachedWeek(weekStart, fresh);
      return fresh;
    },
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.updatedAt,
    staleTime: 0, // always refetch on mount; cache is just instant paint
    refetchOnWindowFocus: true,
  });
  ```
- `useRescheduleEvent` adds a `writeCachedWeek` call in `onSettled` after invalidating the query, so the persisted cache reflects the optimistic reschedule even after the server-authoritative refetch lands.

**Edits — `apps/web/app/(member)/me/calendar/page.tsx`:**

- Render guard `isLoading || !data` becomes `!data`. With cache hydration, `data` is present on first render for returning users and the skeleton is skipped.
- Header gets a small "refreshing" indicator: `isFetching && !isLoading` pulses a 6px dot in `bg-fg-faint` next to the week-range label. (Distinguishes "showing you cached, fresh incoming" from "nothing to show".)

### Section 4 — Lazy bundle

Scope: `apps/web/app/(member)/me/calendar/page.tsx` + one new skeleton.

- `CalendarGrid` becomes a dynamic import: `const CalendarGrid = dynamic(() => import('...').then(m => m.CalendarGrid), { ssr: false, loading: () => <CalendarGridSkeleton /> })`.
- New `apps/web/components/member/calendar/calendar-grid-skeleton.tsx` — a grid-area-only skeleton (not full page). The existing `CalendarSkeleton` is kept for the pre-hydration state of the whole page (rare after Section 3 lands).
- `CalendarHeader` + `CalendarSidebar` + `CalendarLegend` render synchronously — they're tiny and the user gets immediate visual response while the ~250 KB grid bundle streams in.

---

## Dependency graph

```
Section 1 (visual) ─ independent
Section 2 (backend) ─ independent
Section 3 (SWR cache) ─ independent of 1, 2, 4
Section 4 (lazy bundle) ─ independent, but benefits Section 3 UX (skeleton is smaller)
```

All four can ship in any order. Natural build order: 2 (biggest server-side win) → 3 (biggest UX win) → 4 (polish) → 1 (visual pass, can be its own PR).

---

## Acceptance criteria

**Section 1:**
- Dark mode: ICS event cards are visually distinct from the grid background (manual check). Today column is noticeably tinted. Now indicator reads clearly. External events render with a dashed border, no fill.
- Light mode: no regressions (manual check).

**Section 2:**
- `events.list` is invoked with the `fields` projection and `maxResults: 100` (unit test).
- Two consecutive `listEventsInRange` calls for the same user inside the TTL construct only one `OAuth2Client` (unit test).
- `availability` and `googleAccount` reads run concurrently in `getWeek` (unit test inspects call order / timing via mock).
- No behavioural regression in `me-calendar.controller.e2e-spec.ts` (or equivalent).

**Section 3:**
- On a second visit to `/me/calendar` within the same browser session, the grid paints with cached data before the network round-trip completes (manual check; also assertable via Playwright by throttling the network).
- After a reschedule, a reload shows the updated time from cache (manual check).
- A cleared localStorage falls back to the skeleton path.

**Section 4:**
- Initial JS for `/me/calendar` no longer contains the FullCalendar chunks (verify via `pnpm --filter web build` + `next build` output / Next.js bundle analyser).
- Header + sidebar are interactive before the grid bundle arrives (manual check with slow-3G throttle).

---

## Out of scope / follow-ups

- Prefetching next/previous week in the background on hover of the arrow buttons.
- Google Calendar push-channel sync (webhook → invalidate backend cache → client revalidates via TanStack Query).
- Server-side response cache (20–30s TTL) — deferred because reschedule invalidation needs careful thought.
- Mobile redesign of the weekly grid.

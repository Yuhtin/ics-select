# Member Cockpit

**Date:** 2026-05-02
**Status:** Draft, awaiting user review

## Problem

Admin has no engagement metrics for members. Today the only signal that a member is disengaged is anecdotal — Maria Clara hasn't submitted a retro in two weeks, the Diretor Educacional notices in passing. There's no surface that answers "should I cut this member?" with quantitative evidence.

Specific gaps:

- No way to know how many times per day or per week a member opens the platform. JWT cookies live for weeks so "logins" barely happen — there is no proxy for "did they open the platform today".
- No way to see hours actually invested in study. `WeeklyPlanItem` records `outcome` and `scheduledMinutes` (planned), but no real time spent.
- Cohort comparison is impossible — admin can see Maria's `2 / 12 items completed` but not whether the cohort median is `4` or `10`.
- Activity over time is invisible — when did the member start cooling off? Was last week the first bad week or the fourth?
- The current `/admin/member/[id]` page surfaces topic coverage and a tabbed view of timeline/retros/diagnose/notes/attendance. It documents history; it does not summarize state-of-engagement.

The goal is a **decision tool**: admin opens the page and within 5 seconds knows whether to act on the member.

## Goals

- Replace the current `/admin/member/[id]` page with a "cockpit" — a dense, single-screen-ish dashboard whose top half answers "should I cut this member?" with a verdict + 3 hero metrics + 7-KPI strip.
- Capture the events needed to answer that question: session starts (30-min gap heuristic), plan/item views, outcome markings, retro submissions, availability updates.
- Add `WeeklyPlanItem.actualMinutes` so members can self-report real time spent (with a "Não sei" escape hatch on the marking flow).
- Compute an engagement score (0-100) and a risk verdict (`ON_TRACK` / `WATCH` / `AT_RISK`) per member per cycle. Both surfaced prominently.
- Show every metric with a cohort comparison so absolute numbers have meaning.
- Demote the existing tabs (timeline / retros / diagnose / notes / attendance / topic coverage rings) into a "Raw data" accordion at the bottom — useful for retrospectives, not for cut decisions.

## Non-goals

- No client-side beacon for page-view tracking. Server-side middleware is enough at this cohort size (≤12 members per cycle).
- No nightly rollup table. Live SQL aggregation per request is fast enough for 12 members × ~12 weeks of events.
- No member-facing dashboard with the same metrics. The cockpit is admin-only. (A member retrospective view can fork later from the same data.)
- No PostHog / Plausible / external analytics integration. All event data stays in Postgres.
- No backfill of past activity — capture begins at deploy. Existing `WeeklyPlanItem.actualMinutes` rows stay null (interpreted as "not provided").
- No changes to the `/admin/members` cohort table on this iteration. Risk pills there can come later.

## Design

### Schema

`packages/prisma/prisma/schema.prisma` — one new table, one new enum, one column.

```prisma
model UserEvent {
  id         String        @id @default(cuid())
  userId     String
  type       UserEventType
  occurredAt DateTime      @default(now())
  meta       Json?
  user       User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, occurredAt])
  @@index([userId, type, occurredAt])
}

enum UserEventType {
  SESSION_START
  PLAN_VIEW
  ITEM_VIEW
  OUTCOME_MARKED
  RETRO_SUBMITTED
  AVAILABILITY_SAVED
}

model WeeklyPlanItem {
  // … existing fields
  actualMinutes Int?  // null = "Não sei" / not provided. Aggregations fall back to scheduledMinutes.
}

model User {
  // … existing relations
  events UserEvent[]
}
```

Migration name: `j_user_events_and_actual_minutes`. Pure Prisma DDL, no raw SQL needed (no pgvector or tsvector here).

### Event capture

A new module `apps/api/src/activity/`:

- **`ActivityMiddleware`** (registered global in `AppModule`). On every authenticated request:
  1. Read `userId` from the JWT (already attached by `JwtAuthGuard` — middleware runs after the guard).
  2. `prisma.userEvent.findFirst({ where: { userId }, orderBy: { occurredAt: 'desc' }, select: { occurredAt: true } })`.
  3. If no prior event OR `now - last > 30min`, insert `SESSION_START`.
  4. Wrapped in `setImmediate(() => …)` — fire-and-forget. Errors swallowed and logged via Nest `Logger`. Never blocks the request.
- **`@LogEvent(type, metaFn?)`** decorator + interceptor. Marks specific routes:
  - `GET /me/plan` → `PLAN_VIEW`, meta `{ planId, weekStart }`
  - `GET /me/item/:id` → `ITEM_VIEW`, meta `{ itemId, libraryItemId }`
  - `PATCH /me/plan/:planId/items/:itemId` (outcome update) → `OUTCOME_MARKED`, meta `{ itemId, outcome, actualMinutes }`
  - `POST /me/retro` → `RETRO_SUBMITTED`, meta `{ planId, weekStart }`
  - `POST /me/availability` → `AVAILABILITY_SAVED`
- The interceptor writes the event after the controller resolves, so a failed request does not log an event. Same fire-and-forget envelope.

The middleware writes only `SESSION_START`; the interceptor writes everything else. There is no double-counting.

### `actualMinutes` capture (member UI)

`apps/web/app/(member)/me/item/[id]/page.tsx` — when the member marks outcome (any value other than `PENDING`), reveal a "Tempo gasto" chip group below the outcome buttons:

- `15 min` · `30 min` · `1h` · `1h30` · `2h+` · `Não sei`
- Default selection: none required. "Não sei" is explicitly the no-friction option.
- Submit value as `actualMinutes: number | null` on the existing `PATCH` endpoint. `Não sei` and "no chip selected" both send `null`.

The existing reflection textarea stays as-is.

### Cockpit endpoint

`apps/api/src/admin/cockpit/` — new module.

`GET /admin/member/:id/cockpit?cycleId=…&range=cycle|7d|all` (default `range=cycle`).

```ts
type CockpitResponse = {
  member: { id: string; name: string; email: string; pictureUrl: string | null; track: Track | null; whatsappPhone: string | null };
  cycle:  { id: string; name: string; weekNumber: number; weeksTotal: number; startsAt: string; endsAt: string };
  range:  'cycle' | '7d' | 'all';
  risk:   { status: 'ON_TRACK' | 'WATCH' | 'AT_RISK'; reasons: string[] };

  engagement: {
    score: number;                       // 0-100
    cohortMedian: number;
    breakdown: Array<{ label: string; value: string; weight: number; status: 'ok' | 'warn' | 'bad' }>;
    scoreByWeek: number[];               // length = weeksElapsed
  };

  itemsCompleted: {
    total: number;
    planned: number;
    completionPct: number;
    cohortMedian: number;
    byOutcome: Record<ItemOutcome, number>;
    perWeek: Array<{ weekStart: string; byOutcome: Record<ItemOutcome, number> }>;
    needsAttention: { total: number; stuck: number; doubts: number };
  };

  timeInvested: {
    actualMinutes: number;               // sum of actualMinutes (null falls back to scheduledMinutes)
    scheduledMinutes: number;
    cohortMedianMinutes: number;
    naoSeiCount: number;                 // items where actualMinutes was explicitly null but outcome != PENDING
    perWeekMinutes: number[];
  };

  behavior: {
    sessions:        { value: number; cohortMedian: number; perWeek: number[] };
    daysActive:      { value: number; cycleDays: number; cohortMedian: number; perWeek: number[] };
    daysStudying:    { value: number; cycleDays: number; cohortMedian: number; perWeek: number[] };
    timeToFirstView: { medianHours: number; cohortMedianHours: number; perWeek: number[] };
    retros:          { submitted: number; expected: number };
    carryOver:       { value: number; cohortMedian: number; perWeek: number[] };
    lastSeen:        { occurredAt: string; surface: string };
  };

  topicEngagement: Array<{
    topicId: string;
    label: string;
    minutes: number;
    pctOfTotal: number;
    itemsDone: number;
    itemsPlanned: number;
    cohortMedianMinutes: number;
  }>;

  classAttendance: { present: number; total: number; cohortPresent: number; sessions: Array<{ scheduledAt: string; status: AttendanceStatus | null }> };
  firstSession:    { occurredAt: string; dayOfCycle: number };

  recentActivity: Array<{ occurredAt: string; type: UserEventType; meta: unknown; label: string }>;  // limit 5, descending
};
```

All values computed live with SQL aggregates (`COUNT`, `SUM`, `DATE_TRUNC`, `percentile_cont`). Cohort = every other `MEMBER` user in the same cycle (`CycleMembership.cycleId = :cycleId`, excluding the target user). Topic time uses `coalesce(actualMinutes, scheduledMinutes)` and only includes items with `outcome != 'PENDING'`. All `perWeek: number[]` arrays are ordered ascending by `weekStart`, length = `weeksElapsed` for the requested range (so `perWeek[0]` is week 1, last entry is the current week).

### Engagement score (0-100)

Composite, weighted, defensible. File: `apps/api/src/admin/cockpit/engagement-score.ts`.

| Component | Weight | Formula |
|---|---|---|
| Cohort rank percentile | 25 | `(1 - (rankFromBottom / cohortSize)) × 25`, where rank is by completionPct |
| Days active vs cycle days elapsed | 20 | `min(1, daysActive / daysElapsed) × 20` |
| Plan completion (items done ÷ planned) | 20 | `completionPct × 20` |
| Retro completion rate | 15 | `(retrosSubmitted / weeksElapsed) × 15` |
| Time-to-first-view bonus | 10 | `0` if `medianHours > 24`, scales linearly down to `10` at `medianHours = 0` |
| Recency bonus | 10 | `10` if last session ≤ 3d, `5` if ≤ 7d, `0` if > 14d |

Rounded to integer. `scoreByWeek` recomputes the same formula for each weekly cohort cutoff.

### Risk thresholds

`apps/api/src/admin/cockpit/risk-thresholds.ts` — constants the user can tune.

```ts
export const RISK_THRESHOLDS = {
  AT_RISK: {
    daysSinceLastSession: 7,
    completionRate:       0.25,    // < 25% items completed for elapsed weeks
    cohortRankBottomPct:  0.25,    // bottom 25% of cohort by score
  },
  WATCH: {
    daysSinceLastSession: 3,
    completionRate:       0.5,
    cohortRankBottomPct:  0.5,
  },
};
```

A member is `AT_RISK` if **any 2 of 3** AT_RISK criteria match. `WATCH` if **any 2 of 3** WATCH criteria match (and not AT_RISK). Otherwise `ON_TRACK`. The reasons list contains the human-readable strings for whichever criteria triggered.

### Frontend layout

Refactor `apps/web/app/(admin)/admin/member/[id]/page.tsx` into the cockpit. The fully-rendered preview lives at `/tmp/cockpit-preview/index.html` (open in browser) — it is the canonical visual reference for this spec.

Page sits inside the existing `AdminShell` (top navbar + `max-w-[1400px] px-6 py-10` content area).

Layout, top to bottom:

1. **Back link** to `/admin/members` (small, mono).
2. **Header strip** (1 row, `border-b border-rule pb-5`) — avatar + name (Newsreader 34px) + member meta + range selector segment control (`7d / Cycle / All`) + Plan week / WhatsApp / overflow actions.
3. **Risk banner** — only rendered when `risk.status !== 'ON_TRACK'`. Left border 3px (stuck color for AT_RISK, accent terracotta for WATCH), status pill on the left, comma-separated `risk.reasons` in mono, "Why?" link on the right that opens a tooltip explaining the heuristic. When `ON_TRACK`, the banner is omitted entirely; the Engagement card's status pill renders as `ON TRACK` in `done-easy` green so the verdict is still visible.
4. **Hero row** — `grid grid-cols-12 gap-5`:
   - **Engagement** card (3 cols): score 32 / 100 in Source Serif 4 72px + AT RISK pill + "▼ 47% vs cohort" + 4-line breakdown list + score-by-week sparkline at bottom showing the trend.
   - **Items completed** card (6 cols): hero number `5 of 24 planned · 21%` + bar chart per week (only weeks elapsed, not future) on the left, outcome breakdown column on the right with `Needs attention: 2 items · 1 stuck, 1 doubts` callout.
   - **Time invested** card (3 cols): `14h` hero + Below plan pill + cohort delta + single split bar (actual vs scheduled with cohort marker) + hours-per-week mini-bars below.
5. **Behavior strip** (full width, 1 row): 7 KPIs separated by `divide-x divide-rule`. Each cell: eyebrow label + Source Serif 30px number + 5-bar mini sparkbar (last 5 weeks) + delta vs cohort. Order: Sessions · Days active · Days studying · TTFv plan · Retros · Carry-over · Last seen.
6. **Two-column row** — `grid grid-cols-12 gap-5`:
   - **Topic engagement** (8 cols): table with 5 cols (Topic / Time invested bar / Hours / Items done / vs cohort), 6 rows (one per Topic ordered by `Topic.order`), untouched topics get a subtle stuck-tinted background + dashed bar border + "Never opened" inline label. Footer: 3-cell summary (Strongest topic · Concentration risk · Cohort baseline).
   - **Right column** (4 cols, 3 stacked widgets):
     - **Session pattern** card: total + sparkline area chart of sessions per day across the cycle, with a vertical red dashed line at the start of any cold streak ≥ 7 days.
     - **Class attendance** card: `5 / 6` + dot grid of class sessions (`bg-ink` present, `bg-paper-warm + border` absent) + "First session" and "Cycle progress" stats.
     - **Latest activity** card: 5 most recent `UserEvent` rows with relative-time + type-coded label. "View full timeline →" link at bottom.
7. **Raw data accordion** (collapsed by default): expanding reveals a horizontal sub-tab nav over the existing components — Timeline (densified into a one-line-per-item table; see below), Retros, Activity (a GitHub-contribution-style heatmap matching the cycle page squares — moved here from the current page top), Topic coverage rings (the existing matrix), Diagnose, Notes, Attendance.

### Components

New `apps/web/components/admin/member-cockpit/`:

- `risk-banner.tsx`
- `engagement-card.tsx`
- `items-completed-card.tsx`
- `time-invested-card.tsx`
- `behavior-strip.tsx` (renders the 7 KPIs)
- `kpi-cell.tsx` (single cell: eyebrow + number + mini sparkbar + delta)
- `topic-engagement-table.tsx`
- `session-pattern-card.tsx`
- `class-attendance-card.tsx`
- `latest-activity-card.tsx`
- `raw-data-accordion.tsx`

Refactor existing `apps/web/components/admin/member-detail/timeline-tab.tsx` into a dense one-line-per-item table (dot · title · outcome chip · topic · open icon) — the list-row layout is described inline in the spec, replacing the current full-width per-item cards.

### Charts

Use **Tremor (`@tremor/react`)** for charts. Add to `apps/web/package.json`. Components used:

- `<BarChart>` — items completed per week, hours per week mini bars
- `<DonutChart>` — not needed (outcome breakdown is a list, not a donut, in the final design)
- `<AreaChart>` — session pattern + score-by-week + sparklines (via `<SparkAreaChart>`)
- `<BarList>` — topic engagement bars (alternative to the hand-rolled grid table; evaluate at implementation)

Tremor's default color palette is overridden via Tailwind. Charts use the project's outcome tokens (`done-easy`, `done-hard`, `doubts`, `stuck`, `pending`) plus `ink` / `ink-soft` for neutral series. Define the mapping once in `apps/web/lib/charts/tremor-theme.ts`.

### Risk pill in `/admin/members` cohort table

Out of scope for this spec — file as a follow-up. The cohort table stays as it is today.

## Migration policy

- Migration `j_user_events_and_actual_minutes` is pure Prisma DDL.
- **Local-first**: developer runs `DATABASE_URL=...local... pnpm --filter @ics-select/prisma exec prisma migrate dev --name j_user_events_and_actual_minutes` against the local Docker Postgres. The repo's `apps/api/.env` ships pointing at production — never run `migrate dev` against that URL (see CLAUDE.md "Database workflow").
- Production deploy: container's `docker-entrypoint.sh` runs `prisma migrate deploy` automatically on next start. Pure additive DDL, no data loss risk.
- No backfill needed. Existing `WeeklyPlanItem` rows have `actualMinutes = null` (interpreted as "not provided" — falls back to `scheduledMinutes` in aggregations). `UserEvent` starts collecting events from the deploy onward; the cockpit gracefully renders zero / placeholder for cycles before the deploy date.

## Testing

**API:**
- `engagement-score.spec.ts` — exhaustive table tests for the formula, including edge cases (`weeksElapsed = 0`, `cohortSize = 1`, `medianHours = 0`).
- `risk-thresholds.spec.ts` — 3-state transitions for each combination of (sessions, completion, cohort rank).
- `cockpit.service.spec.ts` — mocked Prisma, covering: empty cycle (no events), full cycle, one-member cohort (no comparison possible), excluded admins from cohort.
- `activity.middleware.spec.ts` — verify SESSION_START is written exactly once per 30-min window per user.
- `log-event.interceptor.spec.ts` — verify event written only on success path.
- E2E `cockpit.e2e-spec.ts` — happy path: seed member with events, GET endpoint, assert response shape.

**Web:**
- Playwright snapshot of the cockpit in `ON_TRACK`, `WATCH`, `AT_RISK` states (mocked API responses).
- Component-level smoke tests for `<EngagementCard>`, `<ItemsCompletedCard>`, `<TopicEngagementTable>` with empty-state and loaded-state fixtures.

## Open questions

None blocking. Items to revisit after first deploy:

- Whether the engagement score formula needs reweighting after observing the first cohort. Likely.
- Whether the "Recent activity" feed grows into a full event log view (own page).
- Whether the cohort table at `/admin/members` should show a status pill per member based on `risk.status`.

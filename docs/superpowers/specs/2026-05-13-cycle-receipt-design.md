# Cycle Receipt — Design

**Status:** Spec
**Date:** 2026-05-13
**Author:** Davi Duarte (with Claude)
**Related idea:** [`docs/ideas/cohort-knowledge-grid.md`](../../ideas/cohort-knowledge-grid.md)

## TL;DR

A new admin-only view at `/admin/cycle/[id]/receipt` that renders a single,
screenshot-friendly "receipt" snapshot of a cycle's state, as of a chosen date
(default: today; range: `[cycle.startsAt, min(today, cycle.endsAt)]`). The
admin uses it weekly to share cohort evolution with students after each class.

Two render modes share the same route and endpoint:

- **Thermal Receipt** (default during the cycle) — fixed 720px-wide vertical
  artifact, IBM Plex Mono throughout, perforations on the sides, sections
  separated by dashed lines and unicode `█░` bars. On-brand with the feature
  name "RECEIPT".
- **Wrapped** (cycle complete) — vertical stack of full-bleed gradient blocks,
  Newsreader display type, post-cycle celebration. Triggered when `asOf ===
  cycle.endsAt` or `cycle.status === 'ARCHIVED'`. Admin can force either mode
  via `?mode=` query param for preview.

The view also introduces a reusable `<CohortKnowledgeGrid>` component (the
"who studied what" matrix from the related idea doc) — embedded in both
modes, but with API hooks (`onCellClick`, `onMemberClick`) left unconnected
inside the Receipt so the artifact stays static for screenshot.

## Why

The admin currently has no fast way to:

- Show the cohort "you're all evolving" — students don't see aggregate
  progress, only their own.
- See, at a glance, who has studied what (the knowledge-grid problem from
  the idea doc).
- Snapshot cycle state at a specific date for retrospectives.

The current admin overview is dense and operational (triage, ranking,
heatmap) — bad for sharing. A separate Receipt view, layout-isolated from
the admin shell, fills that gap and gives the knowledge grid a home.

## Non-goals

- Editing `LibraryItemTopic.order` from the UI (uses what exists).
- Interactive knowledge grid embedded inside the cycle overview (component
  is built reusable, but wiring it into the overview is a follow-up spec).
- Sharing the Receipt by public URL — admin downloads PNG and shares
  manually.
- Per-member receipts (this is cohort-level only).
- Receipts for historical week deltas ("what happened between class 3 and
  class 4") — only cumulative-from-cycle-start with as-of cutoff.

## User flow

1. Admin lands on `/admin/cycle/[id]` (cycle overview).
2. Under the `MEMBERS` section label, above the `<CycleMembersGrid />`, a
   new "ticket stub" link reads `RECEIPT →`. Clicking it navigates to
   `/admin/cycle/[id]/receipt`.
3. Receipt page loads with `asOf = today` and `mode = 'thermal'` (or
   `'wrapped'` if cycle ended).
4. Sticky toolbar at top: `← back to cycle`, `AS OF [date picker]`,
   `Switch to wrapped ⇆` (when applicable), `Download PNG`.
5. Admin adjusts `AS OF` to time-travel (e.g., "show me a week ago").
6. Admin clicks `Download PNG` → file lands locally → drops in the
   student WhatsApp/Discord group.

## Surface & layout

### Route & layout isolation

- **New route:** `apps/web/app/(admin)/admin/cycle/[id]/receipt/page.tsx`.
- **Custom local layout:** `apps/web/app/(admin)/admin/cycle/[id]/receipt/layout.tsx`
  intentionally does NOT compose the admin shell (no sidebar, no topbar).
  Renders `<main className="min-h-screen bg-paper">{children}</main>` so the
  screenshot capture is clean.
- Authentication still enforced (parent `(admin)` layout's auth check still
  runs). Backend endpoint is `@Roles('ADMIN')`.

### Entry button (on `/admin/cycle/[id]`)

Modify `apps/web/components/admin/cycle/cycle-overview-view.tsx`. Between
`<SectionLabel>Members</SectionLabel>` (line 74) and `<CycleMembersGrid/>`
(line 75), insert a "ticket stub":

```tsx
<Link
  href={`/admin/cycle/${data.cycle.id}/receipt`}
  className="group mb-4 inline-flex items-center gap-2 border border-dashed border-rule px-3 py-1.5 font-mono text-xs uppercase tracking-label text-ink-soft hover:border-ink hover:text-ink"
>
  <Receipt className="h-3.5 w-3.5" strokeWidth={1.5} />
  Receipt
  <span className="text-ink-faint group-hover:text-ink">→</span>
</Link>
```

(`Receipt` icon from `lucide-react`.)

Disabled state (cycle not started yet, `cycle.weekNumber === 0` AND
`new Date(cycle.startsAt) > now`): renders as a non-link span with tooltip
"Cycle hasn't started yet".

## Backend

### Endpoint

`GET /admin/cycle/:id/receipt?asOf=YYYY-MM-DD`

- `:id` — cycle id.
- `asOf` — optional. Default = `new Date()`. Validation:
  - `asOf >= cycle.startsAt`
  - `asOf <= min(now, cycle.endsAt)`
  - Out of range → 400 with `{ error: { code: 'INVALID_AS_OF' } }`.
- Cycle is `UPCOMING` and `startsAt > now` → 409 with
  `{ error: { code: 'CYCLE_NOT_STARTED' } }`.
- Non-admin → 403 (global `RolesGuard`).
- Cycle not found → 404.

### Service

New module: `apps/api/src/admin/cycle-receipt/` with
`CycleReceiptService.build(cycleId, asOf)` and a thin controller.

The service runs aggregated queries (NOT N+1 per member):

1. **Cycle metadata** — `prisma.cycle.findUnique` with the active members
   (`memberships.where: { status: 'ACTIVE' }`, scoped to active at `asOf`).
2. **All positive-outcome plan items in the cycle, as of cutoff** — one
   `WeeklyPlanItem` query with `where: { weeklyPlan: { cycleId }, completedAt:
   { gte: cycle.startsAt, lte: asOfEndOfDay }, outcome: { in:
   Array.from(POSITIVE_OUTCOMES) } }` and `include: { libraryItem: { include:
   { topics: { include: { topic: true } } } }, weeklyPlan: { select: { userId:
   true } } }`. Aggregations (totals, by-topic, knowledge-grid cells) derive
   from this single result set in memory.
3. **Retros count by user** — `prisma.weeklyRetro.groupBy({ by: ['userId'],
   _count: true, where: { weeklyPlan: { cycleId }, createdAt: { lte:
   asOfEndOfDay } } })`.
4. **Classes** — `prisma.classSession` where `cycleId, scheduledAt <=
   asOfEndOfDay`. Attendance joins via `ClassAttendance` filtered to
   `status === 'PRESENT'`. (Mirrors `CockpitService` pattern.)
5. **Streak champion** — implement a small helper `computeStreakDays(items,
   asOf)`: items sorted by `completedAt` DESC, count consecutive BRT
   calendar days with at least one positive-outcome completion ending at
   `asOf` (today or earlier, breaks on first gap). Use the same BRT
   conversion the engagement-score `daysActive` SQL uses (`AT TIME ZONE
   'America/Sao_Paulo'`). Iterate members, return the one with the
   highest `streakDays`; if multiple tied, the one with the most items
   completed in the cycle. Returns `null` if every member's streak is
   zero.
6. **Top movers** — second `WeeklyPlanItem` query scoped to a 7-day window
   ending at `asOf`: `where: { weeklyPlan: { cycleId }, completedAt: { gte:
   asOf - 7d, lte: asOfEndOfDay }, outcome: { in: POSITIVE_OUTCOMES } }`.
   Group by `userId`, count items, also collect the top 3 topics by item
   count per user. Return top 3 movers (deltaItems > 0).

### Response contract

```ts
type CycleReceiptResponse = {
  cycle: {
    id: string;
    name: string;
    weekNumber: number;        // 0 if UPCOMING
    weeksTotal: number;
    startsAt: string;          // ISO
    endsAt: string;            // ISO
    status: 'UPCOMING' | 'ACTIVE' | 'ARCHIVED';
  };
  asOf: string;                // ISO date, server-resolved
  mode: 'thermal' | 'wrapped'; // server decision; client may override via ?mode=

  totals: {
    members: number;
    totalMinutes: number;             // sum of LibraryItem.estimatedMinutes
                                      //   over completed items (positive outcomes)
    avgMinutesPerMember: number;      // totalMinutes / members; 0 if members === 0
    itemsCompleted: number;
    retros: number;
    classesHeld: number;              // scheduledAt <= asOf
    classesTotal: number;             // all classes in cycle
    attendanceRate: number;           // 0..1; presentAttendances / (classesHeld * members)
  };

  byTopic: Array<{
    topicId: string;
    slug: string;
    label: string;
    order: number;
    membersReached: number;           // members with itemsDone > 0 in this topic
    itemsCompleted: number;           // total completions in this topic
    coveragePct: number;              // membersReached / totalMembers; 0..1
  }>;

  knowledgeGrid: {
    members: Array<{ userId: string; name: string; pictureUrl: string | null }>;
    topics: Array<{ topicId: string; slug: string; label: string; order: number }>;
    cells: Array<{
      userId: string;
      topicId: string;
      itemsDone: number;
      hasStuckOrDoubts: boolean;      // member has STUCK or DOUBTS outcome on any
                                      //   item in this topic, regardless of itemsDone
    }>;
  };

  topMovers: Array<{
    userId: string;
    name: string;
    pictureUrl: string | null;
    deltaItems: number;               // items completed in last 7 days ending at asOf
    topTopics: string[];              // top 3 topic labels by completions in window
  }>;

  cycleTopMover: {
    userId: string;
    name: string;
    pictureUrl: string | null;
    deltaItems: number;               // cumulative items completed across full cycle
    topTopics: string[];              // top 3 topic labels by completions across cycle
  } | null;                           // null when no member has any completion

  streakChampion: {
    userId: string;
    name: string;
    pictureUrl: string | null;
    streakDays: number;
  } | null;

  retroChampions: Array<{
    userId: string;
    name: string;
    pictureUrl: string | null;
    retros: number;
  }>;                                 // top 3 by retro count, ties broken alphabetically

  perfectAttendance: Array<{
    userId: string;
    name: string;
    pictureUrl: string | null;
  }>;                                 // members PRESENT at every classesHeld;
                                      //   empty if classesHeld === 0
};
```

### Data semantics — locked decisions

- **"Hours studied" = `LibraryItem.estimatedMinutes`**, not `actualMinutes`.
  Rationale: `estimatedMinutes` is always populated; `actualMinutes` is
  nullable and depends on member input. Front formats `Xh Ym`.
- **Positive outcomes** = `POSITIVE_OUTCOMES` from `@ics-select/shared`
  (the 4-outcome set including `DOUBTS` and `SKIPPED`). DO NOT redefine
  inline. CLAUDE.md explicitly forbids hand-listing outcomes.
- **Cross-topic items count for every topic they cover.** Mirrors
  `computeTopicCoverage` in `HomeService`, `MemberDetailService`,
  `PlanContextService`. A single completed item with 3 topics increments
  `itemsCompleted` and `membersReached` (if first time for that member) in
  all 3 by-topic rows AND adds 3 separate `cells` rows (one per topic) in
  the knowledge grid.
- **Membership filter for nominal sections** (knowledge grid, top movers,
  hall of fame): only members ACTIVE in the cycle at `asOf` show up. Items
  completed by removed members still feed `totals` and `byTopic`
  aggregates (the work happened) but the names disappear from the grid.
- **Top movers 7-day window** is fixed and unrelated to the
  cumulative-from-start framing. Hard-coded 7 days, not configurable.
- **Mode decision rule (server):**
  - `cycle.status === 'ARCHIVED'` → `mode = 'wrapped'`
  - OR `asOf` is the same calendar date as `cycle.endsAt` (BRT) →
    `mode = 'wrapped'`
  - Otherwise → `mode = 'thermal'`
  Client `?mode=thermal|wrapped` query param overrides server default for
  preview.

### Caching

- In-memory cache in `CycleReceiptService` keyed by `(cycleId, asOf
  ISO-date)` with TTL 5 minutes. Avoids re-running the heavy aggregations
  when the admin reopens the receipt or flips back and forth. No explicit
  invalidation; TTL is acceptable for this use case.

## Frontend

### Receipt page structure

```
/admin/cycle/[id]/receipt
├── layout.tsx              ← bare-bones; no AppShell
├── page.tsx                ← server component; fetches receipt data;
│                             routes to thermal or wrapped view
├── thermal-receipt-view.tsx
├── wrapped-view.tsx
└── components/
    ├── receipt-toolbar.tsx ← sticky header: back, as-of picker,
    │                         mode toggle, download PNG
    ├── thermal-paper.tsx   ← the 720px-wide paper frame with
    │                         perforations
    ├── thermal-row.tsx     ← `LABEL ............... VALUE` row
    ├── thermal-bar.tsx     ← unicode `█░` bar for byTopic
    ├── wrapped-block.tsx   ← full-bleed gradient block wrapper
    └── cohort-knowledge-grid.tsx  ← reusable
```

The page component is a server component; it fetches the receipt JSON, then
delegates to thermal/wrapped based on `mode` (after applying the client's
`?mode=` override). Toolbar is a client component (date picker state, PNG
download).

### Thermal Receipt — visual spec

Fixed container width **720px**, centered on the page. Outside the
container: `bg-paper-warm` decorative area with small perforation dots
(`·`) along left/right edges (CSS pseudo-elements with `radial-gradient` or
just rendered unicode `·` characters along the side).

Inside the container: `bg-surface` (white). All content in **IBM Plex Mono
14px** body, **16px** for section heads, **24px** for the top header
`ICS · SELECT`.

Section order, top to bottom:

1. **Header block** — `ICS · SELECT` / underline / `COHORT RECEIPT · <CYCLE
   NAME UPPERCASED>` / weekday-date-time line. (Cycles already carry
   human names like "Ciclo 4 · 2026" — uppercase the existing
   `cycle.name`, don't synthesize a `STORE #N` from position.)
2. `═══` divider (one row of solid horizontal block chars, not CSS).
3. **Totals table** — left-aligned label, dotted leader, right-aligned
   value:
   - `members in cohort`
   - `total hours studied`
   - `avg per member`
   - `items completed`
   - `retros submitted`
   - `classes held` (`X / Y`)
   - `attendance rate` (`X%`)
4. `═══` divider.
5. **BY TOPIC** — label / `───` thin dashed rule / one row per topic
   sorted by `coveragePct` DESC, ties broken by `Topic.order` ASC (so
   the most-grokked topics surface first; the receipt reads
   "celebratory" top-down). Each row: topic label (truncated 22 chars),
   `█░` bar (12 cells), `XX%`. Maximum 12 topics displayed; remainder
   collapse into a single `+N more topics` line. Topics with
   `membersReached === 0` are excluded entirely (cohort hasn't touched
   them yet; not noise pollution for sharing).
6. `═══` divider.
7. **KNOWLEDGE GRID** — embedded `<CohortKnowledgeGrid variant="thermal">`.
   See component spec below.
8. `═══` divider.
9. **TOP MOVERS · LAST 7 DAYS** — up to 3 entries, each: `▸ NAME`,
   `+N items`, then the 3 top topics on a second line. Section hidden
   entirely if `topMovers` is empty.
10. `═══` divider.
11. **HALL OF FAME** — three rows:
    - `STREAK CHAMPION ▸ Name · Nd` (omitted row if `streakChampion` null)
    - `RETROS ▸ Name · N` then up to 2 more names
    - `PERFECT ATTEND. ▸ Name, Name, Name, Name` (omitted row if empty)
12. **Footer** — `THANK YOU FOR STUDYING` / `★ ★ ★ ★ ★` / `─ keep going ─`.

Color palette inside the receipt: only `--ink` text on `--surface` bg.
No accent colors. The `hasStuckOrDoubts` exception in the knowledge grid
(see below) is the only place red appears.

### Wrapped — visual spec

Vertical stack of 7 full-bleed blocks. Each block: `min-h-screen`,
centered content, unique gradient background.

Block order:

1. **Cover** — `cycle N · YEAR` / `ended <date>` / `N weeks · N minds`.
   Gradient: deep purple → indigo.
2. **Hours headline** — "together you studied" / `XXXh YYm` (display
   number ~120px) / "that's roughly an entire work month each."
   Gradient: terracotta → warm rose.
3. **Most-grokked topic** — pick the `byTopic` entry with the highest
   `membersReached` (ties broken by highest `itemsCompleted`).
   Gradient: indigo → midnight blue.
4. **Top mover of the cycle** — renders `cycleTopMover` from the response
   (cumulative across the full cycle, NOT the 7-day window used in
   thermal). Computed via the same aggregation pass — see contract above.
   Block hidden if `cycleTopMover === null`.
   Gradient: warm gold → amber.
5. **The cohort** — full `<CohortKnowledgeGrid variant="inverted">` over
   dark charcoal bg, dots in white. Centered, with the cycle name above
   and topics labeled below.
   Gradient: charcoal → near-black.
6. **Hall of fame** — three big rows: STREAK / RETROS / PERFECT
   ATTENDANCE, larger type than the thermal version.
   Gradient: amber → orange.
7. **Closing** — `cycle N closed` / `★ ★ ★ ★ ★` / `see you in cycle N+1`.
   Gradient: warm cream.

Typography: **Newsreader** display for headline numbers and member names
at 60–120px scale; **IBM Plex Mono** for eyebrows and metadata.

### `<CohortKnowledgeGrid>` component spec

Props:
```ts
type Props = {
  members: Array<{ userId: string; name: string; pictureUrl: string | null }>;
  topics: Array<{ topicId: string; slug: string; label: string; order: number }>;
  cells: Array<{ userId: string; topicId: string; itemsDone: number; hasStuckOrDoubts: boolean }>;
  variant?: 'thermal' | 'inverted';         // default 'thermal'
  showTotals?: boolean;                     // default true
  onMemberClick?: (userId: string) => void; // optional; receipt leaves unset
  onCellClick?: (userId: string, topicId: string) => void;
};
```

Rendering:
- Members on rows (sorted alphabetically by `name`), topics on columns
  (sorted by `topic.order` asc).
- Topic header labels rotated `-45deg` (start with this; switch to
  `-90deg` if columns become too narrow for legibility — pick during
  implementation after seeing real data).
- Left member-name column: 180px fixed width, truncated to ~22 chars
  with `title={fullName}` tooltip. No avatars (mono aesthetic).
- Cell rendering:
  - `itemsDone === 0` → `·` in `--ink-faint`
  - `itemsDone === 1` → `●` in `--ink-soft`
  - `itemsDone >= 2` → `●●` in `--ink`
  - **Override**: if `hasStuckOrDoubts === true`, the dot(s) render in
    `--outcome-stuck` (red), regardless of `itemsDone`. Tooltip on hover:
    "has stuck or doubts in this topic".
- **Grouping**: topics with adjacent `Topic.order` values may form
  visual clusters. v1 inserts a thin vertical `--rule` line between
  every 4 topics (simple, no Topic.group field exists). Revisit if
  pedagogical groups emerge later.
- **Totals row** (`showTotals`): bottom row labeled `TOTAL`, one number
  per column = count of members with `itemsDone > 0`.
- **Overflow**: receipt is 720px wide; grid can handle ~18-20 topics.
  Beyond 20, the grid splits into two stacked sub-grids (same members,
  topics partitioned alphabetically by `Topic.order` halves), separated
  by a `─────` dashed rule. Implementation: compute split when topics.length
  > 20; first sub-grid takes topics in the lower-order half, second the
  upper half.
- **`inverted` variant**: white text/dots on dark bg, otherwise
  identical.

### Toolbar — date picker

- Native `<input type="date">` is acceptable for v1 (no design-system
  picker required). Min = `cycle.startsAt`, max = `min(today,
  cycle.endsAt)`. Changing the date triggers `router.replace(\`?asOf=
  ${newDate}\`)` (Next.js App Router) and the page re-fetches.
- The toolbar is a client component. The page (server component) reads
  `searchParams.asOf` and `searchParams.mode`, passes them to the
  fetch, and re-renders.
- Mode toggle pill: always rendered when `mode === 'wrapped'` (so admin
  can revert to thermal) AND when `cycle.status === 'ARCHIVED'` OR
  `asOf` is within 2 days of `cycle.endsAt` (so admin can preview
  wrapped before formal cycle end). Otherwise hidden — direct URL with
  `?mode=wrapped` still works for forced preview.

### Download PNG

- Use `html-to-image` (peer-dep-free, ~50KB). Capture the receipt root
  element (NOT the toolbar) via `toPng(receiptRef.current, { pixelRatio:
  2 })`. Result is a single tall PNG (Wrapped mode = one long image, not
  multiple files).
- Filename: `cycle-${cycle.id.slice(-6)}-receipt-${asOf}.png`.
- Triggered by `<a download={filename} href={dataUrl}>` after generation.

## Edge cases

| Case | Behavior |
|------|----------|
| `asOf < cycle.startsAt` or `> cycle.endsAt` | 400 `INVALID_AS_OF`. Front: date picker prevents selection. |
| Cycle UPCOMING (`startsAt > now`) | 409 `CYCLE_NOT_STARTED`. Front: entry button disabled with tooltip. Direct URL → empty state with link back to overview. |
| Empty cohort (0 members) | All `totals` zero, knowledge grid renders "No members in this cycle" placeholder. Not a 404. |
| Member removed from cycle mid-cycle | Their completed items still feed `totals` and `byTopic`. Their name is absent from `knowledgeGrid.members`, `topMovers`, `streakChampion`, `retroChampions`, `perfectAttendance`. |
| Zero items completed yet | Receipt renders with `totals.itemsCompleted === 0`. By Topic, Knowledge Grid, Top Movers, Hall of Fame sections render empty placeholders ("nothing studied yet"). Sections are NOT hidden. |
| Top movers empty (no completions in last 7d ending at `asOf`) | Entire "TOP MOVERS" section hidden — don't show "(empty)". |
| `asOf` close to `cycle.startsAt` (<3 days in) | Subtle banner above receipt: "early in the cycle — numbers will grow." |
| No classes held at `asOf` | `classesHeld: 0`, `attendanceRate: 0`. `PERFECT ATTEND.` row hidden in Hall of Fame. |

## Testing

### Backend (`apps/api`, jest)

Unit — `apps/api/src/admin/cycle-receipt/cycle-receipt.service.spec.ts`:

- `asOf` cutoff: items completed AFTER `asOf` do not appear in any totals
  or grid cells.
- `totalMinutes` is sum of `LibraryItem.estimatedMinutes`, NOT
  `actualMinutes`.
- Cross-topic items: one item completion with 3 topics increments
  `itemsCompleted` in all 3 byTopic rows; increments `membersReached`
  for each topic the first time that member completes anything there.
- Top movers: 7-day window ending at `asOf` is exclusive of completions
  before that window even if cumulative items are huge.
- Members removed from membership at `asOf` are excluded from
  `knowledgeGrid.members` but their items still appear in `totals`.
- `mode` decision: returns `'wrapped'` when cycle.status `ARCHIVED` or
  `asOf` matches `cycle.endsAt` calendar date in BRT; else `'thermal'`.
- `POSITIVE_OUTCOMES` source: service imports from
  `@ics-select/shared`, not redefined inline (lint-style assertion ok).

E2E — `apps/api/test/cycle-receipt.e2e-spec.ts`:

- 200 + payload shape with cycle and valid `asOf`.
- 400 with `asOf` out of range.
- 409 with cycle UPCOMING.
- 403 with non-ADMIN JWT.

### Frontend (`apps/web`, playwright)

`apps/web/tests/cycle-receipt.spec.ts`:

- Click `RECEIPT` ticket-stub on cycle overview → navigate to
  `/admin/cycle/:id/receipt`.
- Thermal mode renders by default; toolbar shows admin AS-OF date.
- Date picker change updates URL `?asOf=` and re-fetches.
- `?mode=wrapped` query forces Wrapped view.
- Snapshot tests for both modes with fixture data (covers regression
  on layout drift).

### Out of test scope

- Visual fidelity of `<CohortKnowledgeGrid>` cell-by-cell — covered by
  Playwright snapshot, not unit test.
- PNG generation correctness (`html-to-image` is the lib).

## Open implementation choices (decide during build, not blocking)

1. **Topic header rotation angle** — `-45deg` or `-90deg`. Test with real
   data; pick the one that fits more topics without becoming illegible.
2. **Knowledge grid splitting threshold** — currently set at >20 topics.
   Tune up or down once we see actual topic count in production cycles.
3. **Wrapped gradients** — exact stops/colors. Will be specified by Davi
   on first implementation pass; not blocked by spec.

## Implementation order

1. Backend service + endpoint + e2e tests
2. `<CohortKnowledgeGrid>` reusable component + storybook-style isolation
3. Receipt route + custom layout
4. Thermal view
5. Toolbar (date picker, mode toggle)
6. PNG download
7. Wrapped view
8. Entry ticket-stub on cycle overview
9. Playwright snapshots

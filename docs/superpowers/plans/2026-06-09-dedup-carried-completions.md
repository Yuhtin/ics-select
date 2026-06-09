# Dedup Carried-Over Completions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the same study material counting multiple times when it is carried across several weeks and then completed once per week, while crediting the *first* completion week.

**Architecture:** A study material (`LibraryItem`) legitimately appears as multiple independent `WeeklyPlanItem` rows across weeks (carry-over is a feature). Every cross-cycle aggregate that counts "items done" currently counts each row, inflating totals (Leunam: 26 real items → 55 counted). We introduce one shared primitive — `canonicalCompletions` — that, per `(member, libraryItem)`, keeps only the earliest-completed non-PENDING row, and apply it at every cross-cycle counting site. Per-single-plan completion (one plan's own items) is left untouched: a plan has each material at most once, so it never triple-counts, and "did the member finish *this* week's plan" should count carried items the member actually did that week. Secondary fix: the editor save path silently drops `carriedFromItemId`; we re-derive it so carries become traceable.

**Tech Stack:** NestJS 10, Prisma 5 (raw SQL via `$queryRawUnsafe`), Jest, `@ics-select/shared` (`isPositiveOutcome`, `ItemOutcome`).

---

## Policy (the one rule applied everywhere)

For a fixed member, group all their `WeeklyPlanItem` rows in the cycle by `libraryItemId`. Among rows with `outcome <> 'PENDING'`, the **canonical completion** is the one with the smallest `completedAt` (NULL `completedAt` sorts last). A material with only PENDING rows has no canonical completion.

- **Items done (cross-cycle)** = number of canonical completions.
- **Per-week credit** = each canonical completion counts in the week of the plan it belongs to (its first completion week).
- **Minutes / topic coverage / superlatives** = computed from canonical rows only.

**Sites that DEDUP (cross-cycle):** `engagement-inputs.ts`, `cockpit.service.ts` (cross-cycle counts, medians, `bucketPerWeek`, `bucketMinutesPerWeek`, topic coverage), `cycle-receipt.service.ts`, `home.service.ts` topic coverage, `plan-context.service.ts` topic coverage, `member-detail.service.ts` topic coverage, `draft-plan.service.ts` topic coverage, `admin-dashboard.service.ts`.

**Sites left AS-IS (per-single-plan "did you finish THIS plan"):** `cycle-overview.service.ts` (`members[].done`, `heatmapRows`), `plans-overview.service.ts`, `triage.service.ts`, `weekly-plans.service.ts#cohortProgress`, `home.service.ts` "all done" / current-week study time.

---

## File Structure

- **Create** `apps/api/src/common/completions/canonical-completions.ts` — the shared primitive + types.
- **Create** `apps/api/src/common/completions/canonical-completions.spec.ts` — unit tests for the primitive.
- **Modify** `apps/api/src/admin/cockpit/engagement-inputs.ts` — `wp_done` / `wp_plan` count distinct materials.
- **Modify** `apps/api/src/admin/cockpit/cockpit.service.ts` — cross-cycle counts, medians, per-week buckets, topic coverage.
- **Modify** `apps/api/src/admin/cycle-receipt/cycle-receipt.service.ts` — totals + superlatives from canonical rows.
- **Modify** `apps/api/src/me/home/home.service.ts` — topic coverage from canonical rows.
- **Modify** `apps/api/src/admin/plan-context/plan-context.service.ts` — `computeTopicCoverage`.
- **Modify** `apps/api/src/admin/member-detail/member-detail.service.ts` — `computeTopicCoverage`.
- **Modify** `apps/api/src/ai/draft-plan.service.ts` — topic coverage for the AI prompt.
- **Modify** `apps/api/src/admin-dashboard/admin-dashboard.service.ts` — done counts.
- **Modify** `apps/api/src/weekly-plans/weekly-plans.service.ts` — re-derive `carriedFromItemId` on save (carry-link fix).

---

## Task 1: Shared `canonicalCompletions` primitive

**Files:**
- Create: `apps/api/src/common/completions/canonical-completions.ts`
- Test: `apps/api/src/common/completions/canonical-completions.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/common/completions/canonical-completions.spec.ts
import { canonicalCompletions, countCanonicalDone } from './canonical-completions.js';

const d = (iso: string) => new Date(iso);

describe('canonicalCompletions', () => {
  it('keeps one row per libraryItem: earliest completedAt among non-PENDING', () => {
    const rows = [
      { libraryItemId: 'A', outcome: 'DONE_EASY' as const, completedAt: d('2026-05-31T00:00:00Z'), weekStart: d('2026-05-18') },
      { libraryItemId: 'A', outcome: 'DONE_EASY' as const, completedAt: d('2026-05-30T00:00:00Z'), weekStart: d('2026-05-11') },
      { libraryItemId: 'A', outcome: 'DONE_EASY' as const, completedAt: d('2026-06-02T00:00:00Z'), weekStart: d('2026-05-25') },
      { libraryItemId: 'B', outcome: 'DONE_HARD' as const, completedAt: d('2026-05-06T00:00:00Z'), weekStart: d('2026-05-04') },
    ];
    const canon = canonicalCompletions(rows);
    expect(canon).toHaveLength(2);
    const a = canon.find((r) => r.libraryItemId === 'A')!;
    expect(a.weekStart).toEqual(d('2026-05-11')); // earliest completion's week
    expect(canon.find((r) => r.libraryItemId === 'B')!.weekStart).toEqual(d('2026-05-04'));
  });

  it('excludes materials that only have PENDING rows', () => {
    const rows = [
      { libraryItemId: 'C', outcome: 'PENDING' as const, completedAt: null },
      { libraryItemId: 'C', outcome: 'PENDING' as const, completedAt: null },
    ];
    expect(canonicalCompletions(rows)).toHaveLength(0);
    expect(countCanonicalDone(rows)).toBe(0);
  });

  it('a NULL completedAt non-PENDING row sorts after a dated one', () => {
    const rows = [
      { libraryItemId: 'D', outcome: 'SKIPPED' as const, completedAt: null },
      { libraryItemId: 'D', outcome: 'DONE_EASY' as const, completedAt: d('2026-05-10T00:00:00Z') },
    ];
    const canon = canonicalCompletions(rows);
    expect(canon).toHaveLength(1);
    expect(canon[0]!.outcome).toBe('DONE_EASY');
  });

  it('countCanonicalDone equals number of distinct completed materials', () => {
    const rows = [
      { libraryItemId: 'A', outcome: 'DONE_EASY' as const, completedAt: d('2026-05-01T00:00:00Z') },
      { libraryItemId: 'A', outcome: 'DONE_EASY' as const, completedAt: d('2026-05-08T00:00:00Z') },
      { libraryItemId: 'B', outcome: 'STUCK' as const, completedAt: d('2026-05-02T00:00:00Z') },
    ];
    expect(countCanonicalDone(rows)).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern canonical-completions`
Expected: FAIL — `Cannot find module './canonical-completions.js'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/api/src/common/completions/canonical-completions.ts
import type { ItemOutcome } from '@ics-select/prisma';

/**
 * Minimum shape needed to dedupe carried-over completions. A study material
 * (libraryItemId) can appear as many WeeklyPlanItem rows across weeks; only
 * one of them should count.
 */
export interface CompletionRow {
  libraryItemId: string;
  outcome: ItemOutcome;
  completedAt: Date | null;
}

/**
 * Per libraryItemId, returns the single "canonical" completion: the row whose
 * outcome is not PENDING with the earliest completedAt (NULL completedAt sorts
 * last). Materials with only PENDING rows are dropped. Preserves any extra
 * fields on the input rows (e.g. weekStart, minutes) for downstream bucketing.
 *
 * Use this at every CROSS-CYCLE counting site so a material carried across N
 * weeks and marked done in each counts once, credited to its first completion.
 */
export function canonicalCompletions<T extends CompletionRow>(rows: readonly T[]): T[] {
  const best = new Map<string, T>();
  for (const r of rows) {
    if (r.outcome === 'PENDING') continue;
    const cur = best.get(r.libraryItemId);
    if (!cur) {
      best.set(r.libraryItemId, r);
      continue;
    }
    const a = r.completedAt?.getTime() ?? Number.POSITIVE_INFINITY;
    const b = cur.completedAt?.getTime() ?? Number.POSITIVE_INFINITY;
    if (a < b) best.set(r.libraryItemId, r);
  }
  return [...best.values()];
}

/** Count of distinct completed (non-PENDING) materials. */
export function countCanonicalDone(rows: readonly CompletionRow[]): number {
  return canonicalCompletions(rows).length;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern canonical-completions`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/completions/canonical-completions.ts apps/api/src/common/completions/canonical-completions.spec.ts
git commit -m "feat(completions): canonicalCompletions primitive to dedup carried items"
```

---

## Task 2: Engagement inputs — count distinct materials

**Why:** `wp_done` (itemsDone) drives the cohort-rank criterion and plan-completion in the engagement score, used by BOTH the admin ranking (`/admin/cycle/:id`) and member ranking (`/me/cohort`). This is the highest-impact site (Leunam ranked on 55 phantom items).

**Files:**
- Modify: `apps/api/src/admin/cockpit/engagement-inputs.ts` (the `wp_done` and `wp_plan` LEFT JOINs)
- Test: `apps/api/src/admin/cockpit/engagement-inputs.spec.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/admin/cockpit/engagement-inputs.spec.ts
import { computeEngagementInputsForCohort } from './engagement-inputs.js';

describe('computeEngagementInputsForCohort dedup', () => {
  it('itemsDone counts distinct libraryItems, not duplicate carried rows', async () => {
    // Two members; member u1 has the SAME libraryItem completed in 3 weeks.
    const fakePrisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([
        { userId: 'u1', daysActive: 2, itemsDone: 3, itemsPlanned: 3, retrosSubmitted: 0, daysSinceLastSession: 1, classesHeld: 0, classesAttended: 0 },
      ]),
    } as any;
    const start = new Date('2026-05-04T00:00:00Z');
    const now = new Date('2026-05-25T00:00:00Z');
    await computeEngagementInputsForCohort(fakePrisma, ['u1'], 'cyc', start, now);
    const sql = fakePrisma.$queryRawUnsafe.mock.calls[0][0] as string;
    // wp_done must count DISTINCT libraryItemId among non-PENDING rows.
    expect(sql).toMatch(/COUNT\(DISTINCT wpi\."libraryItemId"\)[\s\S]*?outcome"\s*<>\s*'PENDING'/);
    // wp_plan must count DISTINCT planned materials too.
    expect(sql).toMatch(/wp_plan/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern engagement-inputs`
Expected: FAIL — current SQL uses `COUNT(*)`, regex for `COUNT(DISTINCT wpi."libraryItemId")` near `outcome <> 'PENDING'` does not match.

- [ ] **Step 3: Edit the SQL**

In `apps/api/src/admin/cockpit/engagement-inputs.ts`, replace the `wp_done` LEFT JOIN body:

```sql
     LEFT JOIN (
       -- Dedup carried-over completions: a material carried across N weeks and
       -- marked done in each must count once. COUNT(DISTINCT libraryItemId)
       -- among non-PENDING rows == number of distinct completed materials.
       SELECT wp."userId", COUNT(DISTINCT wpi."libraryItemId")::int AS cnt
       FROM "WeeklyPlanItem" wpi JOIN "WeeklyPlan" wp ON wp.id = wpi."weeklyPlanId"
       WHERE wp."cycleId" = $4 AND wp."userId" = ANY($1::text[]) AND wpi."outcome" <> 'PENDING'
       GROUP BY wp."userId"
     ) wp_done ON wp_done."userId" = u."userId"
```

And replace the `wp_plan` LEFT JOIN body (denominator must match — distinct planned materials):

```sql
     LEFT JOIN (
       SELECT wp."userId", COUNT(DISTINCT wpi."libraryItemId")::int AS cnt
       FROM "WeeklyPlanItem" wpi JOIN "WeeklyPlan" wp ON wp.id = wpi."weeklyPlanId"
       WHERE wp."cycleId" = $4 AND wp."userId" = ANY($1::text[])
       GROUP BY wp."userId"
     ) wp_plan ON wp_plan."userId" = u."userId"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern engagement-inputs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/admin/cockpit/engagement-inputs.ts apps/api/src/admin/cockpit/engagement-inputs.spec.ts
git commit -m "fix(engagement): count distinct materials for itemsDone/itemsPlanned"
```

---

## Task 3: Cockpit — cross-cycle counts, medians, per-week buckets

**Files:**
- Modify: `apps/api/src/admin/cockpit/cockpit.service.ts`
  - `getCockpit` cross-cycle `completed` (line ~129)
  - `bucketPerWeek` (line ~894), `bucketMinutesPerWeek` (line ~910)
  - cohort medians SQL: `itemsDoneMedian` (~590), `minutesMedian` (~605), per-user done at ~497/726
  - `computeTopicCoverage` (~955)
- Test: `apps/api/src/admin/cockpit/cockpit-buckets.spec.ts` (create)

- [ ] **Step 1: Write the failing test for the per-week buckets**

```typescript
// apps/api/src/admin/cockpit/cockpit-buckets.spec.ts
import { bucketPerWeekForTest } from './cockpit.service.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

describe('bucketPerWeek credits first completion week only', () => {
  it('a material carried + done in 3 weeks counts once, in week 0', () => {
    const cycleStart = new Date('2026-05-04T00:00:00Z');
    const week = (i: number) => new Date(cycleStart.getTime() + i * WEEK_MS);
    const mk = (w: number, completedAt: string) => ({
      weekStart: week(w),
      publishedAt: null,
      items: [{ libraryItemId: 'A', outcome: 'DONE_EASY' as const, completedAt: new Date(completedAt), scheduledMinutes: 30, actualMinutes: null }],
    });
    const plans = [mk(0, '2026-05-06T00:00:00Z'), mk(1, '2026-05-13T00:00:00Z'), mk(2, '2026-05-20T00:00:00Z')];
    const buckets = bucketPerWeekForTest(plans, 3, cycleStart);
    expect(buckets[0]!.byOutcome.DONE_EASY).toBe(1);
    expect(buckets[1]!.byOutcome.DONE_EASY).toBe(0);
    expect(buckets[2]!.byOutcome.DONE_EASY).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern cockpit-buckets`
Expected: FAIL — `bucketPerWeekForTest` is not exported; current `bucketPerWeek` counts per-plan so each week would show 1.

- [ ] **Step 3: Rewrite `bucketPerWeek` and `bucketMinutesPerWeek` to dedup across plans**

In `cockpit.service.ts`, change `bucketPerWeek` so it first computes canonical completions across ALL plans, then buckets each canonical row into ITS plan's week. Import the primitive at the top of the file:

```typescript
import { canonicalCompletions } from '../../common/completions/canonical-completions.js';
```

Replace the body of `bucketPerWeek`:

```typescript
function bucketPerWeek(plans: PlanLike[], weeksElapsed: number, cycleStart: Date) {
  // Flatten every item, tagging its plan week, then keep one canonical
  // completion per material (earliest). Each canonical row lands in its own
  // (first-completion) week — a material carried + done across weeks counts once.
  const flat = plans.flatMap((p) =>
    p.items.map((it) => ({
      libraryItemId: it.libraryItemId,
      outcome: it.outcome,
      completedAt: it.completedAt ?? null,
      weekStartMs: p.weekStart.getTime(),
    })),
  );
  const canon = canonicalCompletions(flat);
  const buckets: Array<{ weekStart: string; byOutcome: Record<ItemOutcome, number> }> = [];
  for (let i = 0; i < weeksElapsed; i++) {
    const weekStart = new Date(cycleStart.getTime() + i * WEEK_MS);
    const byOutcome = { ...ZERO_OUTCOMES };
    for (const r of canon) {
      if (r.weekStartMs === weekStart.getTime()) byOutcome[r.outcome] += 1;
    }
    buckets.push({ weekStart: weekStart.toISOString(), byOutcome });
  }
  return buckets;
}

// Test seam.
export const bucketPerWeekForTest = bucketPerWeek;
```

> NOTE: `PlanLike.items` must carry `libraryItemId` and `completedAt`. Update the `PlanLike` type (line ~877) to add `libraryItemId: string;` and `completedAt: Date | null;` to the item shape, and ensure the cockpit's `plans` query `select`s `libraryItemId` and `completedAt` on items (add them to the `select` near line ~67-84 if missing).

Replace `bucketMinutesPerWeek` the same way — sum canonical rows' minutes into their first-completion week:

```typescript
function bucketMinutesPerWeek(plans: PlanLike[], weeksElapsed: number, cycleStart: Date): number[] {
  const flat = plans.flatMap((p) =>
    p.items.map((it) => ({
      libraryItemId: it.libraryItemId,
      outcome: it.outcome,
      completedAt: it.completedAt ?? null,
      weekStartMs: p.weekStart.getTime(),
      minutes: it.actualMinutes ?? it.scheduledMinutes ?? it.libraryItem?.estimatedMinutes ?? 0,
    })),
  );
  const canon = canonicalCompletions(flat);
  return Array.from({ length: weeksElapsed }, (_, i) => {
    const wkMs = cycleStart.getTime() + i * WEEK_MS;
    return canon.filter((r) => r.weekStartMs === wkMs).reduce((s, r) => s + r.minutes, 0);
  });
}
```

- [ ] **Step 4: Fix the cross-cycle `completed` count in `getCockpit`**

At line ~129, `const completed = allItems.filter((i) => i.outcome !== 'PENDING');` counts duplicates. Replace with canonical dedup (keep the original `completed` array only where per-row detail is needed; for COUNTS use canonical):

```typescript
const completed = canonicalCompletions(
  allItems.map((i) => ({ libraryItemId: i.libraryItemId, outcome: i.outcome, completedAt: i.completedAt ?? null, ref: i })),
);
const byOutcome = countByOutcome(completed.map((i) => i.outcome));
```

Ensure `allItems` rows include `libraryItemId` and `completedAt` (extend the select if needed). If `completed` is consumed later for minutes/topics, read `i.ref` for the original row.

- [ ] **Step 5: Fix the cohort-median SQL (items + minutes)**

`itemsDoneMedian` (~line 588) `per_user` subquery: change `COUNT(*)` to `COUNT(DISTINCT wpi."libraryItemId")`:

```sql
SELECT wp."userId", COUNT(DISTINCT wpi."libraryItemId")::int AS cnt
FROM "WeeklyPlanItem" wpi
JOIN "WeeklyPlan" wp ON wp.id = wpi."weeklyPlanId"
WHERE wp."cycleId" = $2 AND wp."userId" = ANY($1::text[]) AND wpi."outcome" <> 'PENDING'
GROUP BY wp."userId"
```

`minutesMedian` (~line 600) `per_user`: dedup to canonical row's minutes with `DISTINCT ON`:

```sql
SELECT canon."userId", SUM(canon.mins)::int AS mins
FROM (
  SELECT DISTINCT ON (wp."userId", wpi."libraryItemId")
         wp."userId",
         COALESCE(wpi."actualMinutes", wpi."scheduledMinutes", li."estimatedMinutes", 0) AS mins
  FROM "WeeklyPlanItem" wpi
  JOIN "WeeklyPlan" wp ON wp.id = wpi."weeklyPlanId"
  JOIN "LibraryItem" li ON li.id = wpi."libraryItemId"
  WHERE wp."cycleId" = $2 AND wp."userId" = ANY($1::text[]) AND wpi."outcome" <> 'PENDING'
  ORDER BY wp."userId", wpi."libraryItemId", wpi."completedAt" ASC NULLS LAST
) canon
GROUP BY canon."userId"
```

Apply the same `COUNT(DISTINCT wpi."libraryItemId")` / `DISTINCT ON` treatment to the per-user `done` SQL at line ~497 and the SQL at line ~726 (verify each is a cross-cycle aggregate before editing; if it is per-week-per-plan leave it).

- [ ] **Step 6: Fix `computeTopicCoverage` (~line 955)**

Dedup items to canonical before tallying planned/done per topic:

```typescript
const canon = canonicalCompletions(
  itemsForTopic.map((i) => ({ libraryItemId: i.libraryItemId, outcome: i.outcome, completedAt: i.completedAt ?? null, ref: i })),
);
const completed = canon; // already non-PENDING canonical rows
```

(planned should likewise count distinct `libraryItemId`; build a `Set` of `libraryItemId` per topic for the planned tally.)

- [ ] **Step 7: Run the cockpit tests**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern "cockpit"`
Expected: PASS (new bucket test + existing cockpit suite green).

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/admin/cockpit/cockpit.service.ts apps/api/src/admin/cockpit/cockpit-buckets.spec.ts
git commit -m "fix(cockpit): dedup carried completions in counts, medians, per-week buckets"
```

---

## Task 4: Topic coverage across the remaining services + admin-dashboard

**Files:**
- Modify: `apps/api/src/me/home/home.service.ts` (`computeTopicCoverage`, ~line 305)
- Modify: `apps/api/src/admin/plan-context/plan-context.service.ts` (`computeTopicCoverage`, ~line 520)
- Modify: `apps/api/src/admin/member-detail/member-detail.service.ts` (`computeTopicCoverage`, ~line 480)
- Modify: `apps/api/src/ai/draft-plan.service.ts` (topic coverage tally, ~line 270)
- Modify: `apps/api/src/admin-dashboard/admin-dashboard.service.ts` (~lines 33, 73, 90)
- Test: `apps/api/src/me/home/home-coverage.spec.ts` (create; representative test for one site)

- [ ] **Step 1: Write the failing test (home coverage)**

```typescript
// apps/api/src/me/home/home-coverage.spec.ts
import { canonicalCompletions } from '../../common/completions/canonical-completions.js';

describe('topic coverage dedup contract', () => {
  it('a material carried+done in 3 weeks contributes once to its topic', () => {
    const rows = [
      { libraryItemId: 'A', outcome: 'DONE_EASY' as const, completedAt: new Date('2026-05-06') },
      { libraryItemId: 'A', outcome: 'DONE_EASY' as const, completedAt: new Date('2026-05-13') },
      { libraryItemId: 'A', outcome: 'DONE_EASY' as const, completedAt: new Date('2026-05-20') },
    ];
    expect(canonicalCompletions(rows)).toHaveLength(1);
  });
});
```

(This documents the contract; the per-service edits below all apply the same primitive.)

- [ ] **Step 2: Run it (sanity, should pass since it only exercises the primitive)**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern home-coverage`
Expected: PASS.

- [ ] **Step 3: Apply the dedup in each `computeTopicCoverage`**

In each of `home.service.ts`, `plan-context.service.ts`, `member-detail.service.ts`, the loop currently does, per item: `stat.planned += 1; if (done) stat.done += 1;`. Replace with: build canonical completions first for the DONE tally, and count DISTINCT `libraryItemId` per topic for the PLANNED tally. Concretely, for `home.service.ts` (`items` already selected with `outcome` + `libraryItem.topics`; add `libraryItemId` + `completedAt` to the `select`):

```typescript
// planned = distinct materials per topic; done = canonical completions per topic
const plannedSeen = new Map<string, Set<string>>(); // topicId -> libraryItemIds
for (const t of topics) plannedSeen.set(t.id, new Set());
for (const it of items) {
  for (const topicId of it.libraryItem?.topics?.map((x) => x.topicId) ?? []) {
    plannedSeen.get(topicId)?.add(it.libraryItemId);
  }
}
const canon = canonicalCompletions(
  items.map((i) => ({ libraryItemId: i.libraryItemId, outcome: i.outcome, completedAt: i.completedAt ?? null, topicIds: i.libraryItem?.topics?.map((x) => x.topicId) ?? [] })),
);
const doneByTopic = new Map<string, number>();
for (const r of canon) {
  if (!isPositiveOutcome(r.outcome)) continue;
  for (const topicId of r.topicIds) doneByTopic.set(topicId, (doneByTopic.get(topicId) ?? 0) + 1);
}
for (const t of topics) {
  byTopic.set(t.id, { planned: plannedSeen.get(t.id)?.size ?? 0, done: doneByTopic.get(t.id) ?? 0 });
}
```

Add `import { canonicalCompletions } from '../../common/completions/canonical-completions.js';` (adjust relative depth per file) and ensure each query `select`s `libraryItemId` and `completedAt`. Apply the same shape to `plan-context.service.ts:533` and `member-detail.service.ts:489` (they share the same `if (POSITIVE_OUTCOMES.has(item.outcome)) itemsDone += 1` pattern — replace with canonical count). For `draft-plan.service.ts` (~line 270-280), dedup the per-topic `done` tally the same way.

- [ ] **Step 4: Fix admin-dashboard done counts**

In `admin-dashboard.service.ts`:
- Line ~33: the Prisma `count` with `where: { outcome: { in: POSITIVE_OUTCOMES_ARR } }` over the whole cycle counts duplicates. Replace with a fetch of `{ libraryItemId, outcome, completedAt }` rows then `countCanonicalDone(rows.filter(r => isPositiveOutcome(r.outcome)))` — or, simpler, `groupBy libraryItemId`. Use:

```typescript
const rows = await this.prisma.weeklyPlanItem.findMany({
  where: { weeklyPlan: { userId: u.id }, outcome: { in: POSITIVE_OUTCOMES_ARR } },
  select: { libraryItemId: true, outcome: true, completedAt: true },
});
const doneCount = countCanonicalDone(rows);
```

- Lines ~73 and ~90 (`if (isPositiveOutcome(item.outcome)) cur.done += 1` and `doneCount: p.items.filter(...).length`): line 90 is per-single-plan (`p.items`) — LEAVE if `p` is one plan. Line 73 — if it aggregates across the cycle, dedup with `canonicalCompletions`; if per-plan, leave. Inspect the surrounding loop to decide.

Add `import { countCanonicalDone, canonicalCompletions } from '../common/completions/canonical-completions.js';`.

- [ ] **Step 5: Run the affected suites**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern "home|plan-context|member-detail|draft-plan|admin-dashboard|home-coverage"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/me/home/home.service.ts apps/api/src/admin/plan-context/plan-context.service.ts apps/api/src/admin/member-detail/member-detail.service.ts apps/api/src/ai/draft-plan.service.ts apps/api/src/admin-dashboard/admin-dashboard.service.ts apps/api/src/me/home/home-coverage.spec.ts
git commit -m "fix(coverage): dedup carried completions in topic coverage + admin dashboard"
```

---

## Task 5: Cycle receipt — totals + superlatives from canonical rows

**Files:**
- Modify: `apps/api/src/admin/cycle-receipt/cycle-receipt.service.ts`
- Test: existing `cycle-receipt.service.spec.ts` (extend if present; else create `cycle-receipt-dedup.spec.ts`)

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/admin/cycle-receipt/cycle-receipt-dedup.spec.ts
import { canonicalCompletions } from '../../common/completions/canonical-completions.js';

describe('receipt item counts dedup', () => {
  it('mostItemsCompleted should not count the same material twice', () => {
    const rows = [
      { libraryItemId: 'A', outcome: 'DONE_EASY' as const, completedAt: new Date('2026-05-06') },
      { libraryItemId: 'A', outcome: 'DONE_EASY' as const, completedAt: new Date('2026-05-13') },
      { libraryItemId: 'B', outcome: 'DONE_EASY' as const, completedAt: new Date('2026-05-07') },
    ];
    expect(canonicalCompletions(rows)).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern cycle-receipt-dedup`
Expected: PASS (contract test).

- [ ] **Step 3: Apply canonical dedup to the `items` loop**

In `cycle-receipt.service.ts`, the big `for (const it of items)` loops (item counts, minutes, marathon `itemsPerUserDay`, polymath topics, longest item, `itemsByUserCount`, `minutesByUser`) all run over raw `items` (one row per plan-item, duplicates included). Before these loops, reduce to canonical rows **per user**:

```typescript
import { canonicalCompletions } from '../../common/completions/canonical-completions.js';

// Group by user, keep canonical completions, then flatten back.
const byUserRows = new Map<string, typeof items>();
for (const it of items) {
  const u = it.weeklyPlan.userId;
  if (!byUserRows.has(u)) byUserRows.set(u, []);
  byUserRows.get(u)!.push(it);
}
const canonItems = [...byUserRows.values()].flatMap((rows) =>
  canonicalCompletions(
    rows.map((r) => ({ libraryItemId: r.libraryItemId, outcome: r.outcome, completedAt: r.completedAt ?? null, ref: r })),
  ).map((c) => c.ref),
);
```

Then change the superlative/count loops (`itemsByUserCount`, `minutesByUser`, marathon, polymath, longest, streak `itemsByUser`) to iterate `canonItems` instead of `items`. Leave any per-week-plan completion-percentage logic (if present) on raw `items`. The `completedAt`-keyed streak/active-day logic already dedups by day, but using `canonItems` keeps the per-day item COUNT honest.

> Note: `items` is already filtered to `POSITIVE_OUTCOMES` upstream (line ~304/447 `outcome: { in: Array.from(POSITIVE_OUTCOMES) }`), so every canonical row here is positive — no extra filter needed.

- [ ] **Step 4: Run the receipt suite**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern "cycle-receipt"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/admin/cycle-receipt/cycle-receipt.service.ts apps/api/src/admin/cycle-receipt/cycle-receipt-dedup.spec.ts
git commit -m "fix(receipt): dedup carried completions in totals and superlatives"
```

---

## Task 6: Carry-link fix — stop silently dropping `carriedFromItemId`

**Why:** The editor save path (`weekly-plans.service.ts#createDraft` / `#update`) writes items as `{ libraryItemId, order }` and never sets `carriedFromItemId`; `update` deletes+recreates all items on every save, so any link is wiped. Re-derive the link by matching each incoming item against the immediately-previous week's PUBLISHED plan PENDING/STUCK items (same rule the carry-over candidates use).

**Files:**
- Modify: `apps/api/src/weekly-plans/weekly-plans.service.ts` (`createDraft` ~line 94, `update` ~line 130)
- Test: `apps/api/src/weekly-plans/weekly-plans-carry-link.spec.ts` (create)

- [ ] **Step 1: Write the failing test**

```typescript
// apps/api/src/weekly-plans/weekly-plans-carry-link.spec.ts
import { deriveCarryLinks } from './weekly-plans.service.js';

describe('deriveCarryLinks', () => {
  it('links an item to the previous week PENDING/STUCK row with the same libraryItem', () => {
    const prevItems = [
      { id: 'prev-A', libraryItemId: 'A', outcome: 'PENDING' as const },
      { id: 'prev-B', libraryItemId: 'B', outcome: 'DONE_EASY' as const },
    ];
    const incoming = [
      { libraryItemId: 'A', order: 0 },
      { libraryItemId: 'B', order: 1 },
      { libraryItemId: 'C', order: 2 },
    ];
    const linked = deriveCarryLinks(incoming, prevItems);
    expect(linked[0]).toEqual({ libraryItemId: 'A', order: 0, carriedFromItemId: 'prev-A' });
    expect(linked[1]).toEqual({ libraryItemId: 'B', order: 1, carriedFromItemId: null }); // B was DONE, not carried
    expect(linked[2]).toEqual({ libraryItemId: 'C', order: 2, carriedFromItemId: null });
  });
});
```

- [ ] **Step 2: Run it**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern weekly-plans-carry-link`
Expected: FAIL — `deriveCarryLinks` not exported.

- [ ] **Step 3: Implement `deriveCarryLinks` and wire it in**

Add to `weekly-plans.service.ts`:

```typescript
const CARRY_OUTCOMES = new Set<ItemOutcome>(['PENDING', 'STUCK']);

/**
 * For each incoming plan item, set carriedFromItemId to the previous week's
 * PUBLISHED-plan row with the SAME libraryItem when that row was PENDING/STUCK
 * (the carry-over rule). Pure; unit-tested.
 */
export function deriveCarryLinks(
  incoming: Array<{ libraryItemId: string; order: number }>,
  prevItems: Array<{ id: string; libraryItemId: string; outcome: ItemOutcome }>,
): Array<{ libraryItemId: string; order: number; carriedFromItemId: string | null }> {
  const prevByLib = new Map<string, string>();
  for (const p of prevItems) {
    if (CARRY_OUTCOMES.has(p.outcome)) prevByLib.set(p.libraryItemId, p.id);
  }
  return incoming.map((i) => ({
    libraryItemId: i.libraryItemId,
    order: i.order,
    carriedFromItemId: prevByLib.get(i.libraryItemId) ?? null,
  }));
}

private async prevWeekCarrySource(userId: string, weekStart: Date) {
  const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const prevWeekStart = new Date(weekStart.getTime() - WEEK_MS);
  const prev = await this.prisma.weeklyPlan.findFirst({
    where: { userId, weekStart: prevWeekStart, status: 'PUBLISHED' },
    select: { items: { select: { id: true, libraryItemId: true, outcome: true } } },
  });
  return prev?.items ?? [];
}
```

In `createDraft`, replace the `items: { create: input.items.map((i) => ({ libraryItemId, order })) }` block with:

```typescript
const prevItems = await this.prevWeekCarrySource(input.userId, input.weekStart);
const linked = deriveCarryLinks(input.items, prevItems);
// ...
items: { create: linked.map((i) => ({ libraryItemId: i.libraryItemId, order: i.order, carriedFromItemId: i.carriedFromItemId })) },
```

In `update`, after loading `existing` (which has `userId` + `weekStart`), do the same before recreating items:

```typescript
const prevItems = await this.prevWeekCarrySource(existing.userId, existing.weekStart);
const linked = deriveCarryLinks(input.items, prevItems);
// in the tx recreate:
items: { create: linked.map((i) => ({ libraryItemId: i.libraryItemId, order: i.order, carriedFromItemId: i.carriedFromItemId })) },
```

Verify `getByIdOrThrow`/`existing` exposes `userId` and `weekStart`; add them to the select if missing.

- [ ] **Step 4: Run the test + full weekly-plans suite**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern "weekly-plans"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/weekly-plans/weekly-plans.service.ts apps/api/src/weekly-plans/weekly-plans-carry-link.spec.ts
git commit -m "fix(weekly-plans): persist carriedFromItemId on draft save/update"
```

---

## Task 7: Full verification

- [ ] **Step 1: Typecheck + lint + full API test**

Run: `pnpm --filter @ics-select/api typecheck && pnpm --filter @ics-select/api lint && pnpm --filter @ics-select/api test`
Expected: all green.

- [ ] **Step 2: Re-run the read-only prod diagnostic (with explicit user OK)**

Re-create the throwaway read-only script from the investigation (dump Leunam's per-week `bucketPerWeek` via the cockpit, or re-run the `(user, libraryItem)` distinct-vs-rows query) to confirm `itemsDone` for Leunam now reports ~26, not 55. **Requires the user's per-command go-ahead to point at `apps/api/.env.production`.** Do not run against prod without it.

- [ ] **Step 3: Decide data cleanup (deferred item)**

With counting fixed, the 29 inflated rows no longer distort metrics. Revisit whether to physically normalize old rows (the user chose "decide after the count fix"). If yes, write a dry-preview script that, per `(user, libraryItem)`, keeps the earliest completed copy and reverts later non-PENDING duplicates to PENDING — shown to the user before any write.

---

## Self-Review notes

- **Spec coverage:** count fix (Tasks 1–5) + carry-link fix (Task 6) + verification/cleanup hook (Task 7). First-completion-week credit is realized by `canonicalCompletions` picking the earliest `completedAt` and `bucketPerWeek` bucketing on that row's plan week.
- **Type consistency:** the primitive is `canonicalCompletions<T extends CompletionRow>` / `countCanonicalDone` everywhere; `CompletionRow = { libraryItemId, outcome, completedAt }`. Every site adds `libraryItemId` + `completedAt` to its `select`.
- **Left-as-is (intentional):** `cycle-overview.service.ts` (`members[].done`, `heatmapRows`), `plans-overview.service.ts`, `triage.service.ts`, `weekly-plans#cohortProgress`, home current-week study time — all per-single-plan, where each material appears once and carry-over is a legitimate part of that week's plan.
- **Risk:** raw-SQL `DISTINCT ON` (minutes median) must keep its `ORDER BY userId, libraryItemId, completedAt ASC NULLS LAST` to be deterministic. The `daysActive`/streak logic is unchanged (already distinct-by-day).

---

## Audit Addendum (2026-06-09) — applied before implementation

A 5-agent audit workflow (3 independent enumerations + adversarial classification challenge + synthesis) verified this plan. Verdict: **GO-WITH-CHANGES**. The LEAVE-AS-IS bucket was fully verified (zero misclassifications). The following changes are folded into execution:

### Primitive revision (Task 1)
Canonical row per `(member, libraryItem)` = **earliest row with a POSITIVE outcome** (`isPositiveOutcome`); if no positive row exists, fall back to the **earliest non-PENDING** row. This realizes "credited to the earliest week it was *positively* completed" and prevents a `STUCK`-then-`DONE` material (a common carry path) from being lost from the done tally. Export TWO counters:
- `countCanonicalDone(rows)` = distinct materials with ANY non-PENDING row (cohort-rank "itemsDone" semantics — includes STUCK).
- `countCanonicalPositive(rows)` = distinct materials whose canonical row is positive (used by `isPositiveOutcome`/`POSITIVE_OUTCOMES` sites).
SQL sites that only need the non-PENDING count use `COUNT(DISTINCT "libraryItemId") WHERE outcome <> 'PENDING'` directly.

### Five gap sites to ADD/AMEND
1. **NEW Task — `reports/reports.service.ts#buildCycleReport`** (L36 cohort %, L53 per-member `mDone`). Live `GET /reports/:id`, not even cycle-scoped. DEDUP with `countCanonicalPositive` per member.
2. **Amend Task 3 — `cockpit.service.ts#scoreByWeek`** (L824-836). Cumulative `plansUpToWeek` reduce double-counts in the engagement sparkline. Extend its query select (L810) to include `libraryItemId` + `completedAt`, then dedup cumulatively (canonical among plans with `weekStart <= w`).
3. **Amend Task 4 — `ai/draft-plan.service.ts` `allItemsAgg` groupBy** (L349-372). Separate from the topic tally. Replace the `groupBy(['outcome'])` with `findMany({ select: { libraryItemId, outcome, completedAt }})` over the member's published plans → `countCanonicalPositive` / distinct total → correct `completionPct` for the LLM prompt.
4. **Amend Task 5 — `cycle-receipt.service.ts`** must pass the deduped `canonItems` into `computeTotals(items)` (L68), `computeByTopic(items)` (L69), and `buildKnowledgeGrid(cycle, items, stuck)` (L70) — not only the inline superlative loops. Keep `buildKnowledgeGrid`'s `stuckItems` arg untouched.
5. **De-defer Task 4 — `admin-dashboard.service.ts#getMemberOverview` topicCoverage** (L67-77). Verified cross-cycle (loop over all `plans`, no cycle filter). DEDUP both `done` and `total` (distinct material per tag). L90 `plans[].doneCount` stays AS-IS (per-single-plan).

### Confirmed AS-IS (do not touch)
`cycle-overview` members[].done + heatmap + feed; `triage` (Set-deduped by member / per-plan); `plans-overview`; `weekly-plans#cohortProgress`; `home` current-week study time + loadTodayView + loadNextUp; `me/cohort` + `cycle-overview` feed (event-per-completion semantics); `plan-context#getContext` memberHistory (already dedups by libraryItemId). Frontend is display-only — no edits; values correct themselves once the API fields are fixed.

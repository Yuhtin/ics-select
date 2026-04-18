# Admin Plans Overview + Plan Dedupe

**Date:** 2026-04-17
**Status:** Draft, awaiting user review

## Problem

Admin has no way to see all of a cycle's plans (drafts + published) in one place. Two divergent surfaces today:

- `/admin/members` shows `{plansCount} plans` per member counting **all** rows in `WeeklyPlan` for that user (any status, any cycle). Source: `AdminDashboardService.getCohort` → `weeklyPlan.count({ where: { userId } })`.
- `/admin/member/[id]` Timeline tab shows only `status: 'PUBLISHED'`, `take: 6`. Source: `MemberDetailService.getDetail`.

Result: Maria's card says "4 plans" but the timeline shows 1, and the admin can't inspect the missing 3.

Two underlying causes feed this:

1. `PlanDraftsService.getOrCreateDraft` auto-pick walks forward week by week looking for a "free" week and creates a brand new DRAFT. Every click of "Create plan for next week" without a publish creates another orphan draft (different `weekStart` each time).
2. `WeeklyPlan` has only `@@index([userId, weekStart])` — non-unique. Race conditions can also produce true duplicates for the same `(userId, weekStart)`.

## Goals

- Admin can see every plan (DRAFT or PUBLISHED) in a cycle, grouped by `weekStart`, with one click from the cycle page.
- "Plan next week" button is idempotent — clicking it always lands on the same plan for the upcoming week (existing or freshly-created DRAFT).
- DB enforces no duplicate `(userId, weekStart)` plans.
- `plansCount` on `/admin/members` reflects what the timeline shows (PUBLISHED only) so the two surfaces stop disagreeing.

## Non-goals

- No new way to create plans for arbitrary future weeks from a button — admin uses the new Plans page to navigate to any week.
- No member-side UI changes.
- No `updatedAt` column on `WeeklyPlan` (defer; we use `publishedAt ?? createdAt` for "last activity" labels).

## Design

### Backend

#### 1. Fix the autopick (`PlanDraftsService.getOrCreateDraft`)

File: `apps/api/src/admin/plan-drafts/plan-drafts.service.ts`

Replace the 52-iteration walk-forward loop with single-week lookup:

```ts
// Auto-pick: the very next Monday >= max(now, cycle.startsAt).
// If a plan already exists for that week (DRAFT or PUBLISHED), return it.
// Else create a new DRAFT.
const cursor = mondayUTC(now < cycle.startsAt ? cycle.startsAt : now);
const weekStart = new Date(cursor);
const weekEnd = new Date(weekStart.getTime() + WEEK_MS - 1);

if (weekEnd > cycle.endsAt) {
  // No more weeks in this cycle — fall back to the latest existing plan
  // so the admin lands on something editable.
  const latest = await this.prisma.weeklyPlan.findFirst({
    where: { userId: input.memberId, cycleId: cycle.id },
    orderBy: { weekStart: 'desc' },
    include: { items: { include: { libraryItem: true }, orderBy: { order: 'asc' } } },
  });
  if (latest) return latest;
  throw new ConflictException({
    error: { code: 'PLAN_OUTSIDE_CYCLE', message: 'Não há semanas restantes no ciclo pra planejar.' },
  });
}

const existing = await this.prisma.weeklyPlan.findFirst({
  where: { userId: input.memberId, weekStart },
  include: { items: { include: { libraryItem: true }, orderBy: { order: 'asc' } } },
});
if (existing) return existing;
return this.createDraft(input.memberId, cycle.id, weekStart, weekEnd);
```

Tests to update in `plan-drafts.service.spec.ts`:
- `auto-pick returns existing DRAFT for next week instead of creating duplicate`
- `auto-pick returns existing PUBLISHED for next week instead of creating duplicate`
- `auto-pick returns latest plan when next week is past cycle end`
- Drop any test that asserted walk-forward behavior.

#### 2. Align `plansCount` with the timeline

File: `apps/api/src/admin-dashboard/admin-dashboard.service.ts`

Change one line in `getCohort()`:

```ts
this.prisma.weeklyPlan.count({ where: { userId: u.id, status: 'PUBLISHED' } })
```

Update `admin-dashboard.service.spec.ts` to reflect the new semantics (PUBLISHED-only count).

#### 3. New module: plans overview

New files:
- `apps/api/src/admin/plans-overview/plans-overview.module.ts`
- `apps/api/src/admin/plans-overview/plans-overview.controller.ts`
- `apps/api/src/admin/plans-overview/plans-overview.service.ts`
- `apps/api/src/admin/plans-overview/plans-overview.service.spec.ts`

Register the module in `apps/api/src/admin/admin.module.ts`.

Endpoint: `GET /admin/cycles/:cycleId/plans?status=all|draft|published` (defaults to `all`)

Guard: `@Roles('ADMIN')`.

Response shape:

```ts
{
  cycle: {
    id: string;
    name: string;
    startsAt: string; // ISO
    endsAt: string;
    weekNumber: number;
    weeksTotal: number;
  };
  weeks: Array<{
    weekStart: string; // ISO
    weekEnd: string;
    plans: Array<{
      id: string;
      status: 'DRAFT' | 'PUBLISHED';
      lastActivityAt: string; // publishedAt ?? createdAt
      items: { total: number; done: number }; // done = DONE_EASY + DONE_HARD
      user: { id: string; name: string; pictureUrl: string | null };
    }>;
  }>;
}
```

Sort: `weeks` desc by `weekStart`. Within a week: plans alphabetical by user name.

Empty cycle → `weeks: []`.

Service implementation: single Prisma query `weeklyPlan.findMany({ where: { cycleId, ...statusFilter }, include: { user, items: { select: { outcome } } } })`, then group in memory by `weekStart.getTime()`.

#### 4. Database: dedupe + unique constraint

New migration `packages/prisma/prisma/migrations/f_weekly_plan_unique_user_week/migration.sql`:

```sql
-- Step 1: dedupe (userId, weekStart) collisions, keeping the PUBLISHED one
-- if any, else the most recently created. WeeklyPlanItem cascades on delete.
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "weekStart"
      ORDER BY (CASE WHEN status = 'PUBLISHED' THEN 0 ELSE 1 END), "createdAt" DESC
    ) AS rn
  FROM "WeeklyPlan"
)
DELETE FROM "WeeklyPlan" WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 2: replace the non-unique index with a unique one.
DROP INDEX IF EXISTS "WeeklyPlan_userId_weekStart_idx";
CREATE UNIQUE INDEX "WeeklyPlan_userId_weekStart_key"
  ON "WeeklyPlan"("userId", "weekStart");
```

Schema change in `packages/prisma/prisma/schema.prisma`:

```prisma
model WeeklyPlan {
  // ... existing fields
  @@unique([userId, weekStart])
}
```

(Removes the `@@index` line. The unique index covers the same lookup pattern.)

Note: this migration is **safe to run unattended** — it dedupes before constraining. The dedupe is conservative (keeps PUBLISHED first, then most recent). If the production audit (see deploy section) shows zero collisions, the dedupe is a no-op.

### Frontend

#### 1. New route `/admin/plans`

File: `apps/web/app/(admin)/admin/plans/page.tsx`

URL params: `?cycleId=<id>&status=all|draft|published`

Layout:

```
Plans · [Cycle 2026.2 ▾]                    [Status: All ▾]
─────────────────────────────────────────────────────────
WEEK OF APR 14
  Maria Clara    DRAFT       0/0 items     · 2d ago     →
  Pedro          PUBLISHED   4/6 done      · 5h ago     →

WEEK OF APR 7
  Maria Clara    PUBLISHED   3/4 done      · 6d ago     →
```

States:
- No `cycleId` in URL: show only the cycle dropdown + caption "Select a cycle to view its plans".
- `cycleId` set, no plans returned: "No plans yet for this cycle." (no rows)
- `cycleId` set, plans returned: render grouped list as above.
- API error: red pill with error message (matches existing pattern in plan editor).

Each row clicks through to `/admin/member/{userId}/plan/{planId}`.

Status badge styling: reuse existing classes — `DRAFT` → `bg-paper-warm text-ink-mute`, `PUBLISHED` → `bg-ink/10 text-ink`.

Date formatting: `Apr 14 – Apr 20` for week range; `2d ago` / `5h ago` for `lastActivityAt` (a tiny helper if one doesn't exist; check `apps/web/lib/format/`).

Cycle dropdown: reuses `useAdminCycles()` from `lib/queries/admin-cycles.ts`. Selecting a cycle updates the `cycleId` query param via `router.replace` (no nav reload). Sort cycles ACTIVE → past, matching the cycles index sort.

#### 2. New query hook

File: `apps/web/lib/queries/admin-plans-overview.ts`

```ts
export type PlansOverviewResponse = { /* matches API */ };

export function useAdminPlansOverview(
  cycleId: string | null,
  status: 'all' | 'draft' | 'published',
) {
  return useQuery({
    queryKey: ['admin', 'plans-overview', cycleId, status],
    queryFn: () =>
      apiFetch<PlansOverviewResponse>(
        `/admin/cycles/${cycleId}/plans?status=${status}`,
      ),
    enabled: cycleId !== null,
  });
}
```

#### 3. "All plans →" link on cycle page

File: `apps/web/app/(admin)/admin/cycle/[id]/page.tsx`

In the header (next to the `RankingToggle`), add:

```tsx
<Link
  href={`/admin/plans?cycleId=${data.cycle.id}`}
  className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-label text-ink-soft hover:text-ink"
>
  All plans →
</Link>
```

#### 4. Sidebar nav

File: `apps/web/components/admin-shell/sidebar-admin.tsx`

Insert `Plans` between `Cycles` and `Library`:

```ts
{ href: '/admin/plans', label: 'Plans', icon: ListChecks },
```

(Or another lucide icon — `CalendarDays` or `LayoutList` are alternatives. Pick one during implementation.)

#### 5. Rename autopick button

File: `apps/web/app/(admin)/admin/member/[id]/page.tsx`

Change the button label `Create plan for next week` → `Plan next week →`. Drop the `<Plus />` icon since it's no longer always a "create" action. Keep the same href (`/admin/member/${memberId}/plan/new`).

### Tests

- **Backend unit:** `plans-overview.service.spec.ts` (grouping, status filter, empty cycle, member without picture). `plan-drafts.service.spec.ts` (idempotent autopick, fallback when out of cycle). `admin-dashboard.service.spec.ts` (PUBLISHED-only count).
- **Backend e2e:** none required — controllers wrap services with no extra logic.
- **Frontend Playwright:** one new spec `admin-plans.spec.ts` covering: load page without cycleId → see prompt; pick a cycle → see grouped weeks; click a row → land on plan editor.

### Deploy & one-off cleanup

Order:

1. Open PR with all backend + frontend + migration changes. CI runs unit + e2e + Playwright.
2. Before merge, run audit on prod:
   ```sql
   SELECT "userId", "weekStart", COUNT(*) AS n
   FROM "WeeklyPlan"
   GROUP BY 1, 2
   HAVING COUNT(*) > 1
   ORDER BY n DESC;
   ```
   Confirm the dedupe step in the migration won't surprise anyone. (Expected: zero or very few rows.)
3. Run one-off cleanup for Maria's orphan empty drafts (these are NOT same-week duplicates, so the migration won't touch them):
   ```sql
   -- Inspect first
   SELECT wp.id, wp."weekStart", wp.status, wp."createdAt",
          (SELECT COUNT(*) FROM "WeeklyPlanItem" WHERE "weeklyPlanId" = wp.id) AS items
   FROM "WeeklyPlan" wp
   WHERE wp."userId" = 'cmnwc9pwn000g2lqwwz1ovdoc'
   ORDER BY wp."weekStart";

   -- Delete drafts with zero items
   DELETE FROM "WeeklyPlan"
   WHERE "userId" = 'cmnwc9pwn000g2lqwwz1ovdoc'
     AND status = 'DRAFT'
     AND id NOT IN (SELECT DISTINCT "weeklyPlanId" FROM "WeeklyPlanItem");
   ```
4. Merge PR. Docker entrypoint runs `prisma migrate deploy` — applies dedupe + unique index automatically.
5. Smoke check in prod: open `/admin/plans?cycleId=<2026.2>`, verify Maria shows 1 plan.

## Open questions

- Sidebar icon for "Plans" — pick during implementation (`ListChecks`, `CalendarDays`, or `LayoutList`).
- Does the cycle dropdown on `/admin/plans` need to scope itself to non-archived cycles, or show everything? Default: show everything, since the page is for historical inspection too.

## Files touched

**Backend (new):**
- `apps/api/src/admin/plans-overview/plans-overview.module.ts`
- `apps/api/src/admin/plans-overview/plans-overview.controller.ts`
- `apps/api/src/admin/plans-overview/plans-overview.service.ts`
- `apps/api/src/admin/plans-overview/plans-overview.service.spec.ts`
- `packages/prisma/prisma/migrations/f_weekly_plan_unique_user_week/migration.sql`

**Backend (modified):**
- `apps/api/src/admin/plan-drafts/plan-drafts.service.ts`
- `apps/api/src/admin/plan-drafts/plan-drafts.service.spec.ts`
- `apps/api/src/admin-dashboard/admin-dashboard.service.ts`
- `apps/api/src/admin-dashboard/admin-dashboard.service.spec.ts`
- `apps/api/src/admin/admin.module.ts`
- `packages/prisma/prisma/schema.prisma`

**Frontend (new):**
- `apps/web/app/(admin)/admin/plans/page.tsx`
- `apps/web/lib/queries/admin-plans-overview.ts`
- `apps/web/tests/admin-plans.spec.ts`

**Frontend (modified):**
- `apps/web/app/(admin)/admin/cycle/[id]/page.tsx` (add "All plans →" link)
- `apps/web/app/(admin)/admin/member/[id]/page.tsx` (rename button)
- `apps/web/components/admin-shell/sidebar-admin.tsx` (add nav item)

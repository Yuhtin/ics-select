# Admin Plans Overview + Plan Dedupe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give admins a single page to inspect every plan (DRAFT or PUBLISHED) in a cycle, make the autopick idempotent, and prevent duplicate `(userId, weekStart)` plans at the DB level.

**Architecture:** New NestJS module `plans-overview` exposes `GET /admin/cycles/:cycleId/plans?status=...`; a new Next.js client page `/admin/plans` consumes it via TanStack Query. Existing autopick logic in `PlanDraftsService.getOrCreateDraft` shrinks to a single-week lookup. A migration dedupes any same-week duplicates and adds `@@unique([userId, weekStart])` to `WeeklyPlan`.

**Tech Stack:** NestJS 10 + Prisma 5 + PostgreSQL 16 (api), Next.js 15 App Router + HeroUI/Tailwind + TanStack Query (web), Jest (api tests). The web app has no automated test setup right now — verify UI changes manually in the dev browser per CLAUDE.md.

**Spec:** `docs/superpowers/specs/2026-04-17-admin-plans-overview-and-dedupe-design.md`

---

## File Structure

**Backend, new:**
- `apps/api/src/admin/plans-overview/plans-overview.module.ts` — Nest module wiring
- `apps/api/src/admin/plans-overview/plans-overview.controller.ts` — `GET /admin/cycles/:cycleId/plans`
- `apps/api/src/admin/plans-overview/plans-overview.service.ts` — query + grouping logic
- `apps/api/src/admin/plans-overview/plans-overview.service.spec.ts` — unit tests
- `packages/prisma/prisma/migrations/f_weekly_plan_unique_user_week/migration.sql` — dedupe + unique index

**Backend, modified:**
- `apps/api/src/admin/plan-drafts/plan-drafts.service.ts` — replace walk-forward with single-week lookup
- `apps/api/src/admin/plan-drafts/plan-drafts.service.spec.ts` — update auto-pick tests
- `apps/api/src/admin-dashboard/admin-dashboard.service.ts` — `plansCount` → PUBLISHED only
- `apps/api/src/admin-dashboard/admin-dashboard.service.spec.ts` — assert new count behavior
- `apps/api/src/admin/admin.module.ts` — register `PlansOverviewModule`
- `packages/prisma/prisma/schema.prisma` — `@@index([userId, weekStart])` → `@@unique([userId, weekStart])` on `WeeklyPlan`

**Frontend, new:**
- `apps/web/app/(admin)/admin/plans/page.tsx` — list page (cycle dropdown, status filter, weekStart-grouped plans)
- `apps/web/lib/queries/admin-plans-overview.ts` — TanStack Query hook + types

**Frontend, modified:**
- `apps/web/lib/format/time.ts` — add `formatRelativeFromIso(iso)` helper for "5h ago" / "3d ago"
- `apps/web/components/admin-shell/sidebar-admin.tsx` — add `Plans` nav item between Cycles and Library
- `apps/web/app/(admin)/admin/cycle/[id]/page.tsx` — add "All plans →" link in header
- `apps/web/app/(admin)/admin/member/[id]/page.tsx` — rename autopick button to "Plan next week →" and drop the `Plus` icon

---

## Task 1: Make autopick idempotent

**Files:**
- Modify: `apps/api/src/admin/plan-drafts/plan-drafts.service.ts`
- Modify: `apps/api/src/admin/plan-drafts/plan-drafts.service.spec.ts`

The walk-forward loop is replaced with a single-week lookup. With the unique constraint coming in Task 4, we want at most one plan per `(userId, weekStart)` — and the autopick must never create a same-week duplicate even if called twice in a row.

- [ ] **Step 1: Update the auto-pick test block to expect idempotent behavior**

Replace the entire `describe('auto-pick (no weekStart)', ...)` block in `plan-drafts.service.spec.ts` (lines 82–123) with:

```ts
describe('auto-pick (no weekStart)', () => {
  // Cycle: Apr 23 – Jun 26 (Thu through Fri for easy Monday math)
  const cycle = {
    id: 'c-hot',
    startsAt: new Date('2026-04-23T00:00:00Z'),
    endsAt: new Date('2026-06-26T23:59:59Z'),
  };

  it('creates a draft starting at the cycle.startsAt Monday when today is before the cycle starts', async () => {
    const prisma = makePrisma();
    prisma.cycleMembership.findFirst.mockResolvedValue({ cycle });
    prisma.weeklyPlan.findFirst.mockResolvedValue(null);
    prisma.weeklyPlan.create.mockResolvedValue({ id: 'new-auto', status: 'DRAFT', items: [] });
    const svc = new PlanDraftsService(prisma as any);
    // Today = Apr 17 (Fri), cycle starts Thu Apr 23 — Monday of that week is Apr 20.
    await svc.getOrCreateDraft(
      { memberId: 'm1' },
      new Date('2026-04-17T12:00:00Z'),
    );
    const created = prisma.weeklyPlan.create.mock.calls[0][0].data;
    expect(created.weekStart.toISOString()).toBe('2026-04-20T00:00:00.000Z');
  });

  it('returns the existing DRAFT for the upcoming week instead of creating a duplicate', async () => {
    const prisma = makePrisma();
    prisma.cycleMembership.findFirst.mockResolvedValue({ cycle });
    const existing = { id: 'existing-draft', status: 'DRAFT', items: [] };
    prisma.weeklyPlan.findFirst.mockResolvedValue(existing);
    const svc = new PlanDraftsService(prisma as any);
    const result = await svc.getOrCreateDraft(
      { memberId: 'm1' },
      new Date('2026-04-17T12:00:00Z'),
    );
    expect(result).toBe(existing);
    expect(prisma.weeklyPlan.create).not.toHaveBeenCalled();
  });

  it('returns the existing PUBLISHED plan for the upcoming week instead of walking forward', async () => {
    const prisma = makePrisma();
    prisma.cycleMembership.findFirst.mockResolvedValue({ cycle });
    const existing = { id: 'existing-pub', status: 'PUBLISHED', items: [] };
    prisma.weeklyPlan.findFirst.mockResolvedValue(existing);
    const svc = new PlanDraftsService(prisma as any);
    const result = await svc.getOrCreateDraft(
      { memberId: 'm1' },
      new Date('2026-04-17T12:00:00Z'),
    );
    expect(result).toBe(existing);
    expect(prisma.weeklyPlan.create).not.toHaveBeenCalled();
    // findFirst is called exactly once (no walk).
    expect(prisma.weeklyPlan.findFirst).toHaveBeenCalledTimes(1);
  });

  it('falls back to the latest existing plan when the upcoming week is past cycle.endsAt', async () => {
    const prisma = makePrisma();
    // Today is after cycle.endsAt — next Monday is past the cycle.
    prisma.cycleMembership.findFirst.mockResolvedValue({ cycle });
    const latest = { id: 'latest', status: 'PUBLISHED', items: [] };
    // First findFirst is the fallback "latest plan in cycle" lookup.
    prisma.weeklyPlan.findFirst.mockResolvedValue(latest);
    const svc = new PlanDraftsService(prisma as any);
    const result = await svc.getOrCreateDraft(
      { memberId: 'm1' },
      new Date('2026-07-15T12:00:00Z'),
    );
    expect(result).toBe(latest);
    expect(prisma.weeklyPlan.create).not.toHaveBeenCalled();
  });

  it('throws PLAN_OUTSIDE_CYCLE when upcoming week is past cycle end and no plan exists', async () => {
    const prisma = makePrisma();
    prisma.cycleMembership.findFirst.mockResolvedValue({ cycle });
    prisma.weeklyPlan.findFirst.mockResolvedValue(null);
    const svc = new PlanDraftsService(prisma as any);
    await expect(
      svc.getOrCreateDraft({ memberId: 'm1' }, new Date('2026-07-15T12:00:00Z')),
    ).rejects.toMatchObject({
      response: { error: { code: 'PLAN_OUTSIDE_CYCLE' } },
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm --filter @ics-select/api test -- --testPathPattern plan-drafts.service.spec
```

Expected: At least one of the new tests fails. The `it('returns the existing PUBLISHED plan for the upcoming week instead of walking forward', ...)` test will fail because the current code DOES walk forward and create a new draft.

- [ ] **Step 3: Replace the auto-pick loop with a single-week lookup**

In `apps/api/src/admin/plan-drafts/plan-drafts.service.ts`, replace the body of `getOrCreateDraft` from line 42 (`if (input.weekStart) {`) through the end of the method with:

```ts
    if (input.weekStart) {
      return this.returnOrCreate(input.memberId, cycle, input.weekStart, { strict: true });
    }

    // Auto-pick: the very next Monday >= max(now, cycle.startsAt).
    // If a plan already exists for that week (DRAFT or PUBLISHED), return it.
    // Else create a new DRAFT. No walking forward — that's what /admin/plans is for.
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
        error: {
          code: 'PLAN_OUTSIDE_CYCLE',
          message: 'Não há semanas restantes no ciclo pra planejar.',
        },
      });
    }

    const existing = await this.prisma.weeklyPlan.findFirst({
      where: { userId: input.memberId, weekStart },
      include: { items: { include: { libraryItem: true }, orderBy: { order: 'asc' } } },
    });
    if (existing) return existing;
    return this.createDraft(input.memberId, cycle.id, weekStart, weekEnd);
  }
```

(Drop the `for (let i = 0; i < 52; i += 1) { ... }` loop and the trailing `throw new ConflictException` after it — they no longer apply.)

- [ ] **Step 4: Run the tests to verify they pass**

Run:

```bash
pnpm --filter @ics-select/api test -- --testPathPattern plan-drafts.service.spec
```

Expected: all PlanDraftsService tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/admin/plan-drafts/
git commit -m "$(cat <<'EOF'
fix(admin): make plan autopick idempotent — return existing instead of walking forward

The auto-pick path used to walk week-by-week looking for a free slot, which
created an orphan DRAFT every click. Now it returns whatever exists for the
next Monday (DRAFT or PUBLISHED) and only creates when truly empty. Picking
a different week is the job of the new /admin/plans page.
EOF
)"
```

---

## Task 2: Filter `plansCount` to PUBLISHED only

**Files:**
- Modify: `apps/api/src/admin-dashboard/admin-dashboard.service.ts:26`
- Modify: `apps/api/src/admin-dashboard/admin-dashboard.service.spec.ts`

Aligns the count shown in `/admin/members` with the timeline (which already filters PUBLISHED).

- [ ] **Step 1: Update the test fixture to surface a DRAFT that should be excluded**

In `apps/api/src/admin-dashboard/admin-dashboard.service.spec.ts`, modify the `plans` fixture (lines 8–18) to:

```ts
  const plans = [
    {
      id: 'p-1',
      userId: 'u-1',
      status: 'PUBLISHED',
      items: [
        { id: 'i-1', outcome: 'DONE_EASY', libraryItem: { tags: ['arrays'] } },
        { id: 'i-2', outcome: 'PENDING', libraryItem: { tags: ['dp'] } },
      ],
    },
    {
      id: 'p-1-draft',
      userId: 'u-1',
      status: 'DRAFT',
      items: [],
    },
  ];
```

And update the `weeklyPlan.count` mock (line 29) to honour the `status` filter:

```ts
      count: jest.fn(async ({ where }: any) => {
        return plans.filter(
          (p) => p.userId === where.userId && (where.status === undefined || p.status === where.status),
        ).length;
      }),
```

The existing assertion `expect(first?.stats.plansCount).toBe(1)` already expects 1, which matches PUBLISHED-only counting. Add one more assertion just below it to make the intent explicit:

```ts
    expect(first?.stats.plansCount).toBe(1);
    // The DRAFT for u-1 should NOT be counted.
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter @ics-select/api test -- --testPathPattern admin-dashboard.service.spec
```

Expected: `plansCount` returns 2 (DRAFT + PUBLISHED) instead of 1, so the assertion fails.

- [ ] **Step 3: Apply the one-line filter change to the service**

In `apps/api/src/admin-dashboard/admin-dashboard.service.ts`, change line 26 from:

```ts
        this.prisma.weeklyPlan.count({ where: { userId: u.id } }),
```

to:

```ts
        this.prisma.weeklyPlan.count({ where: { userId: u.id, status: 'PUBLISHED' } }),
```

- [ ] **Step 4: Run the test to verify it passes**

Run:

```bash
pnpm --filter @ics-select/api test -- --testPathPattern admin-dashboard.service.spec
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/admin-dashboard/
git commit -m "fix(admin-dashboard): plansCount counts only PUBLISHED plans

Aligns the /admin/members count with the timeline tab (which filters to
PUBLISHED). Drafts are now visible via the new /admin/plans page instead."
```

---

## Task 3: Plans overview backend module

**Files:**
- Create: `apps/api/src/admin/plans-overview/plans-overview.service.ts`
- Create: `apps/api/src/admin/plans-overview/plans-overview.service.spec.ts`
- Create: `apps/api/src/admin/plans-overview/plans-overview.controller.ts`
- Create: `apps/api/src/admin/plans-overview/plans-overview.module.ts`
- Modify: `apps/api/src/admin/admin.module.ts`

Service queries plans by `cycleId`, optionally filters by status, and groups by `weekStart`.

- [ ] **Step 1: Write the service spec**

Create `apps/api/src/admin/plans-overview/plans-overview.service.spec.ts`:

```ts
import { NotFoundException } from '@nestjs/common';
import { PlansOverviewService } from './plans-overview.service';

function makePrisma() {
  return {
    cycle: { findUnique: jest.fn() },
    weeklyPlan: { findMany: jest.fn() },
  };
}

const CYCLE = {
  id: 'c-1',
  name: '2026.2',
  startsAt: new Date('2026-04-13T00:00:00Z'),
  endsAt: new Date('2026-06-21T23:59:59Z'),
};

describe('PlansOverviewService', () => {
  it('throws NotFoundException for unknown cycleId', async () => {
    const prisma = makePrisma();
    prisma.cycle.findUnique.mockResolvedValue(null);
    const svc = new PlansOverviewService(prisma as any);
    await expect(svc.list('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns weeks: [] when cycle has no plans', async () => {
    const prisma = makePrisma();
    prisma.cycle.findUnique.mockResolvedValue(CYCLE);
    prisma.weeklyPlan.findMany.mockResolvedValue([]);
    const svc = new PlansOverviewService(prisma as any);
    const result = await svc.list('c-1');
    expect(result.cycle.id).toBe('c-1');
    expect(result.weeks).toEqual([]);
  });

  it('groups plans by weekStart desc and sorts members alphabetically within a week', async () => {
    const prisma = makePrisma();
    prisma.cycle.findUnique.mockResolvedValue(CYCLE);
    const week1 = new Date('2026-04-20T00:00:00Z');
    const week1End = new Date('2026-04-26T23:59:59.999Z');
    const week2 = new Date('2026-04-13T00:00:00Z');
    const week2End = new Date('2026-04-19T23:59:59.999Z');
    prisma.weeklyPlan.findMany.mockResolvedValue([
      {
        id: 'p-pedro-w1',
        status: 'PUBLISHED',
        weekStart: week1,
        weekEnd: week1End,
        publishedAt: new Date('2026-04-20T10:00:00Z'),
        createdAt: new Date('2026-04-19T12:00:00Z'),
        items: [
          { outcome: 'DONE_EASY' },
          { outcome: 'DONE_HARD' },
          { outcome: 'PENDING' },
        ],
        user: { id: 'u-pedro', name: 'Pedro', pictureUrl: null },
      },
      {
        id: 'p-maria-w1',
        status: 'DRAFT',
        weekStart: week1,
        weekEnd: week1End,
        publishedAt: null,
        createdAt: new Date('2026-04-15T08:00:00Z'),
        items: [],
        user: { id: 'u-maria', name: 'Maria', pictureUrl: null },
      },
      {
        id: 'p-maria-w2',
        status: 'PUBLISHED',
        weekStart: week2,
        weekEnd: week2End,
        publishedAt: new Date('2026-04-13T09:00:00Z'),
        createdAt: new Date('2026-04-12T20:00:00Z'),
        items: [{ outcome: 'DONE_EASY' }, { outcome: 'STUCK' }],
        user: { id: 'u-maria', name: 'Maria', pictureUrl: null },
      },
    ]);
    const svc = new PlansOverviewService(prisma as any);
    const result = await svc.list('c-1');

    expect(result.weeks).toHaveLength(2);
    // Newest week first.
    expect(result.weeks[0].weekStart).toBe(week1.toISOString());
    expect(result.weeks[1].weekStart).toBe(week2.toISOString());
    // Within week1, Maria comes before Pedro alphabetically.
    expect(result.weeks[0].plans.map((p) => p.user.name)).toEqual(['Maria', 'Pedro']);
    // Done counts are computed correctly.
    expect(result.weeks[0].plans[1]).toMatchObject({
      id: 'p-pedro-w1',
      status: 'PUBLISHED',
      items: { total: 3, done: 2 },
      lastActivityAt: '2026-04-20T10:00:00.000Z',
    });
    // For draft, lastActivityAt falls back to createdAt.
    expect(result.weeks[0].plans[0].lastActivityAt).toBe('2026-04-15T08:00:00.000Z');
  });

  it('filters by status=draft', async () => {
    const prisma = makePrisma();
    prisma.cycle.findUnique.mockResolvedValue(CYCLE);
    prisma.weeklyPlan.findMany.mockResolvedValue([]);
    const svc = new PlansOverviewService(prisma as any);
    await svc.list('c-1', 'draft');
    expect(prisma.weeklyPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ cycleId: 'c-1', status: 'DRAFT' }),
      }),
    );
  });

  it('filters by status=published', async () => {
    const prisma = makePrisma();
    prisma.cycle.findUnique.mockResolvedValue(CYCLE);
    prisma.weeklyPlan.findMany.mockResolvedValue([]);
    const svc = new PlansOverviewService(prisma as any);
    await svc.list('c-1', 'published');
    expect(prisma.weeklyPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ cycleId: 'c-1', status: 'PUBLISHED' }),
      }),
    );
  });

  it('does not filter by status when status=all', async () => {
    const prisma = makePrisma();
    prisma.cycle.findUnique.mockResolvedValue(CYCLE);
    prisma.weeklyPlan.findMany.mockResolvedValue([]);
    const svc = new PlansOverviewService(prisma as any);
    await svc.list('c-1', 'all');
    const arg = prisma.weeklyPlan.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ cycleId: 'c-1' });
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails (file doesn't exist yet)**

Run:

```bash
pnpm --filter @ics-select/api test -- --testPathPattern plans-overview.service.spec
```

Expected: fails with "Cannot find module './plans-overview.service'".

- [ ] **Step 3: Implement the service**

Create `apps/api/src/admin/plans-overview/plans-overview.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { computeWeekPosition } from '../../common/cycle/active-cycle.js';

const POSITIVE = new Set(['DONE_EASY', 'DONE_HARD']);

export type PlansOverviewStatus = 'all' | 'draft' | 'published';

export type PlansOverviewResponse = {
  cycle: {
    id: string;
    name: string;
    startsAt: string;
    endsAt: string;
    weekNumber: number;
    weeksTotal: number;
  };
  weeks: Array<{
    weekStart: string;
    weekEnd: string;
    plans: Array<{
      id: string;
      status: 'DRAFT' | 'PUBLISHED';
      lastActivityAt: string;
      items: { total: number; done: number };
      user: { id: string; name: string; pictureUrl: string | null };
    }>;
  }>;
};

type PlanRow = {
  id: string;
  status: 'DRAFT' | 'PUBLISHED';
  weekStart: Date;
  weekEnd: Date;
  publishedAt: Date | null;
  createdAt: Date;
  items: Array<{ outcome: string }>;
  user: { id: string; name: string; pictureUrl: string | null };
};

@Injectable()
export class PlansOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    cycleId: string,
    status: PlansOverviewStatus = 'all',
    now: Date = new Date(),
  ): Promise<PlansOverviewResponse> {
    const cycle = await this.prisma.cycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new NotFoundException('cycle not found');

    const where: { cycleId: string; status?: 'DRAFT' | 'PUBLISHED' } = { cycleId };
    if (status === 'draft') where.status = 'DRAFT';
    else if (status === 'published') where.status = 'PUBLISHED';

    const plans = (await this.prisma.weeklyPlan.findMany({
      where,
      orderBy: { weekStart: 'desc' },
      include: {
        user: { select: { id: true, name: true, pictureUrl: true } },
        items: { select: { outcome: true } },
      },
    })) as PlanRow[];

    const groups = new Map<number, { weekStart: Date; weekEnd: Date; plans: PlanRow[] }>();
    for (const plan of plans) {
      const key = plan.weekStart.getTime();
      const group = groups.get(key);
      if (group) {
        group.plans.push(plan);
      } else {
        groups.set(key, { weekStart: plan.weekStart, weekEnd: plan.weekEnd, plans: [plan] });
      }
    }

    const weeks = Array.from(groups.values())
      .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime())
      .map((g) => ({
        weekStart: g.weekStart.toISOString(),
        weekEnd: g.weekEnd.toISOString(),
        plans: g.plans
          .slice()
          .sort((a, b) => a.user.name.localeCompare(b.user.name))
          .map((p) => ({
            id: p.id,
            status: p.status,
            lastActivityAt: (p.publishedAt ?? p.createdAt).toISOString(),
            items: {
              total: p.items.length,
              done: p.items.filter((i) => POSITIVE.has(i.outcome)).length,
            },
            user: {
              id: p.user.id,
              name: p.user.name,
              pictureUrl: p.user.pictureUrl,
            },
          })),
      }));

    const pos = computeWeekPosition(cycle, now);
    return {
      cycle: {
        id: cycle.id,
        name: cycle.name,
        startsAt: cycle.startsAt.toISOString(),
        endsAt: cycle.endsAt.toISOString(),
        weekNumber: pos.weekNumber,
        weeksTotal: pos.weeksTotal,
      },
      weeks,
    };
  }
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run:

```bash
pnpm --filter @ics-select/api test -- --testPathPattern plans-overview.service.spec
```

Expected: all 6 tests pass.

- [ ] **Step 5: Implement the controller**

Create `apps/api/src/admin/plans-overview/plans-overview.controller.ts`:

```ts
import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { PlansOverviewService, type PlansOverviewStatus } from './plans-overview.service.js';

const ALLOWED: ReadonlySet<PlansOverviewStatus> = new Set(['all', 'draft', 'published']);

@Controller('admin/cycles')
@Roles('ADMIN')
export class PlansOverviewController {
  constructor(private readonly service: PlansOverviewService) {}

  @Get(':cycleId/plans')
  list(
    @Param('cycleId') cycleId: string,
    @Query('status') status?: string,
  ) {
    const normalized = (status ?? 'all') as PlansOverviewStatus;
    if (!ALLOWED.has(normalized)) {
      throw new BadRequestException(`Invalid status filter: ${status}`);
    }
    return this.service.list(cycleId, normalized);
  }
}
```

- [ ] **Step 6: Implement the module**

Create `apps/api/src/admin/plans-overview/plans-overview.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PlansOverviewService } from './plans-overview.service.js';
import { PlansOverviewController } from './plans-overview.controller.js';

@Module({
  providers: [PlansOverviewService],
  controllers: [PlansOverviewController],
})
export class PlansOverviewModule {}
```

- [ ] **Step 7: Register the module in `AdminModule`**

In `apps/api/src/admin/admin.module.ts`, add the import and include it in the `imports` array:

```ts
import { Module } from '@nestjs/common';
import { TriageModule } from './triage/triage.module.js';
import { AlertsModule } from './alerts/alerts.module.js';
import { CycleOverviewModule } from './cycle/cycle-overview.module.js';
import { PlanContextModule } from './plan-context/plan-context.module.js';
import { PlanDraftsModule } from './plan-drafts/plan-drafts.module.js';
import { NotesModule } from './notes/notes.module.js';
import { MemberDetailModule } from './member-detail/member-detail.module.js';
import { PlansOverviewModule } from './plans-overview/plans-overview.module.js';

@Module({
  imports: [
    TriageModule,
    AlertsModule,
    CycleOverviewModule,
    PlanContextModule,
    PlanDraftsModule,
    NotesModule,
    MemberDetailModule,
    PlansOverviewModule,
  ],
})
export class AdminModule {}
```

- [ ] **Step 8: Run the full api test suite to confirm nothing else broke**

Run:

```bash
pnpm --filter @ics-select/api test
```

Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/admin/plans-overview apps/api/src/admin/admin.module.ts
git commit -m "feat(admin): add /admin/cycles/:cycleId/plans endpoint

Returns every WeeklyPlan in a cycle (DRAFT + PUBLISHED), grouped by
weekStart desc, with member info and item counts. Powers the new
/admin/plans page."
```

---

## Task 4: WeeklyPlan unique constraint migration

**Files:**
- Modify: `packages/prisma/prisma/schema.prisma:234`
- Create: `packages/prisma/prisma/migrations/f_weekly_plan_unique_user_week/migration.sql`

The migration is safe to run unattended: it dedupes any same-week duplicates first (keeping PUBLISHED if any, else most recent), then drops the old non-unique index and adds the unique one in the same transaction.

- [ ] **Step 1: Update the schema**

In `packages/prisma/prisma/schema.prisma`, change line 234 from:

```prisma
  @@index([userId, weekStart])
```

to:

```prisma
  @@unique([userId, weekStart])
```

- [ ] **Step 2: Create the migration SQL by hand**

Create the directory and file:

```bash
mkdir -p packages/prisma/prisma/migrations/f_weekly_plan_unique_user_week
```

Then create `packages/prisma/prisma/migrations/f_weekly_plan_unique_user_week/migration.sql`:

```sql
-- Step 1: dedupe (userId, weekStart) collisions.
-- Keep the PUBLISHED row if one exists; otherwise keep the most recently created.
-- WeeklyPlanItem has ON DELETE CASCADE so deleted plans cascade their items.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "weekStart"
      ORDER BY (CASE WHEN status = 'PUBLISHED' THEN 0 ELSE 1 END), "createdAt" DESC
    ) AS rn
  FROM "WeeklyPlan"
)
DELETE FROM "WeeklyPlan"
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 2: replace the non-unique index with a unique one.
DROP INDEX IF EXISTS "WeeklyPlan_userId_weekStart_idx";
CREATE UNIQUE INDEX "WeeklyPlan_userId_weekStart_key"
  ON "WeeklyPlan"("userId", "weekStart");
```

- [ ] **Step 3: Apply the migration locally**

Make sure the local Postgres container is running (per CLAUDE.md):

```bash
docker compose up -d postgres
```

Then apply migrations + regenerate the client:

```bash
pnpm db:migrate
pnpm db:generate
```

Expected: prisma reports the new migration applied. No error.

- [ ] **Step 4: Run the full api test suite to confirm Prisma client regen didn't break anything**

Run:

```bash
pnpm --filter @ics-select/api test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/prisma/prisma/schema.prisma packages/prisma/prisma/migrations/f_weekly_plan_unique_user_week/
git commit -m "feat(prisma): unique (userId, weekStart) on WeeklyPlan with safe dedupe

Migration first dedupes any pre-existing same-week duplicates (keeping
PUBLISHED if any, else most recent), then replaces the non-unique index
with a unique one. Defends against autopick race conditions."
```

---

## Task 5: Plans overview frontend page

**Files:**
- Modify: `apps/web/lib/format/time.ts` (add helper)
- Create: `apps/web/lib/queries/admin-plans-overview.ts`
- Create: `apps/web/app/(admin)/admin/plans/page.tsx`

The page itself is split into a `Suspense` wrapper + an inner component because it uses `useSearchParams`. This avoids the Next.js build-time deopt warning.

- [ ] **Step 1: Add the relative-day formatter helper**

In `apps/web/lib/format/time.ts`, append at the end of the file:

```ts
/** "5h ago" / "3d ago" / "2w ago" / "just now". */
export function formatRelativeFromIso(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diffMs = now.getTime() - then;
  if (diffMs < 60 * 1000) return 'just now';
  const diffMin = Math.floor(diffMs / (60 * 1000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 14) return `${diffD}d ago`;
  const diffW = Math.floor(diffD / 7);
  return `${diffW}w ago`;
}
```

- [ ] **Step 2: Create the query hook**

Create `apps/web/lib/queries/admin-plans-overview.ts`:

```ts
'use client';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type PlansOverviewStatus = 'all' | 'draft' | 'published';

export type PlansOverviewPlan = {
  id: string;
  status: 'DRAFT' | 'PUBLISHED';
  lastActivityAt: string;
  items: { total: number; done: number };
  user: { id: string; name: string; pictureUrl: string | null };
};

export type PlansOverviewWeek = {
  weekStart: string;
  weekEnd: string;
  plans: PlansOverviewPlan[];
};

export type PlansOverviewResponse = {
  cycle: {
    id: string;
    name: string;
    startsAt: string;
    endsAt: string;
    weekNumber: number;
    weeksTotal: number;
  };
  weeks: PlansOverviewWeek[];
};

export function useAdminPlansOverview(
  cycleId: string | null,
  status: PlansOverviewStatus,
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

- [ ] **Step 3: Create the page**

Create `apps/web/app/(admin)/admin/plans/page.tsx`:

```tsx
'use client';
import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { clsx } from 'clsx';
import { useAdminCycles } from '../../../../lib/queries/admin-cycles';
import {
  useAdminPlansOverview,
  type PlansOverviewStatus,
} from '../../../../lib/queries/admin-plans-overview';
import { Eyebrow } from '../../../../components/ui/eyebrow';
import { formatRelativeFromIso } from '../../../../lib/format/time';

const STATUS_OPTIONS: ReadonlyArray<{ value: PlansOverviewStatus; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
];

function isPlansStatus(v: string | null): v is PlansOverviewStatus {
  return v === 'all' || v === 'draft' || v === 'published';
}

function formatWeekRange(startIso: string, endIso: string): string {
  const start = new Date(startIso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  const end = new Date(endIso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
  return `${start} – ${end}`;
}

function PlansPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const cycleId = params.get('cycleId');
  const statusParam = params.get('status');
  const status: PlansOverviewStatus = isPlansStatus(statusParam) ? statusParam : 'all';

  const { data: cycles, isLoading: cyclesLoading } = useAdminCycles();
  const { data, isLoading, error } = useAdminPlansOverview(cycleId, status);

  function update(next: Partial<{ cycleId: string | null; status: PlansOverviewStatus }>) {
    const url = new URLSearchParams(params.toString());
    if ('cycleId' in next) {
      if (next.cycleId) url.set('cycleId', next.cycleId);
      else url.delete('cycleId');
    }
    if ('status' in next && next.status) {
      if (next.status === 'all') url.delete('status');
      else url.set('status', next.status);
    }
    const qs = url.toString();
    router.replace(qs ? `/admin/plans?${qs}` : '/admin/plans');
  }

  return (
    <div className="max-w-5xl space-y-8">
      <header>
        <Eyebrow>Plans</Eyebrow>
        <h1 className="mt-2 font-serif-tool text-3xl font-semibold tracking-tight">Plans</h1>
        <p className="mt-1 font-mono text-xs text-ink-mute">
          Every plan in a cycle, drafts and published.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
          Cycle
        </label>
        <select
          value={cycleId ?? ''}
          onChange={(e) => update({ cycleId: e.target.value || null })}
          disabled={cyclesLoading}
          className="rounded-input border border-rule bg-paper px-3 py-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-focus/40"
        >
          <option value="">— Select a cycle —</option>
          {(cycles ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <label className="ml-4 font-mono text-[10px] uppercase tracking-label text-ink-mute">
          Status
        </label>
        <select
          value={status}
          onChange={(e) => update({ status: e.target.value as PlansOverviewStatus })}
          className="rounded-input border border-rule bg-paper px-3 py-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-focus/40"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {!cycleId ? (
        <p className="font-mono text-xs text-ink-mute py-12 text-center border border-dashed border-rule rounded-card">
          Select a cycle to view its plans.
        </p>
      ) : isLoading ? (
        <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Loading…</p>
      ) : error ? (
        <p className="inline-flex items-center gap-2 rounded-pill bg-outcome-stuck/10 px-3 py-1.5 font-mono text-xs uppercase tracking-label text-outcome-stuck">
          Failed to load · {(error as Error).message}
        </p>
      ) : !data || data.weeks.length === 0 ? (
        <p className="font-mono text-xs text-ink-mute py-12 text-center border border-dashed border-rule rounded-card">
          No plans yet for this cycle.
        </p>
      ) : (
        <div className="space-y-8">
          {data.weeks.map((week) => (
            <section key={week.weekStart}>
              <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                Week of {formatWeekRange(week.weekStart, week.weekEnd)}
              </p>
              <ul className="mt-2 divide-y divide-rule border border-rule rounded-card bg-surface">
                {week.plans.map((plan) => (
                  <li key={plan.id}>
                    <Link
                      href={`/admin/member/${plan.user.id}/plan/${plan.id}`}
                      className="flex items-center gap-4 px-4 py-3 hover:bg-paper-warm/60 transition-colors"
                    >
                      <span className="flex-1 font-serif-tool text-base font-semibold text-ink truncate">
                        {plan.user.name}
                      </span>
                      <span
                        className={clsx(
                          'font-mono text-[10px] uppercase tracking-label px-2 py-0.5 rounded-pill border',
                          plan.status === 'PUBLISHED'
                            ? 'bg-ink/5 text-ink border-ink/20'
                            : 'bg-paper-warm text-ink-mute border-rule',
                        )}
                      >
                        {plan.status}
                      </span>
                      <span className="font-mono text-[11px] text-ink-mute tabular-nums w-24 text-right">
                        {plan.items.done}/{plan.items.total} done
                      </span>
                      <span className="font-mono text-[11px] text-ink-mute w-20 text-right">
                        {formatRelativeFromIso(plan.lastActivityAt)}
                      </span>
                      <span className="font-mono text-xs text-ink-mute">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminPlansPage() {
  return (
    <Suspense
      fallback={
        <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Loading…</p>
      }
    >
      <PlansPageInner />
    </Suspense>
  );
}
```

- [ ] **Step 4: Verify the page in a browser**

Make sure the api dev server is running too (so the new endpoint is reachable). In one terminal:

```bash
pnpm dev
```

In a browser, visit:

1. `http://localhost:3000/admin/plans` — should render the dropdowns + "Select a cycle to view its plans" message.
2. Pick a cycle from the dropdown — URL becomes `?cycleId=...`. Plans render grouped by week, sorted desc; rows clickable to plan editor.
3. Switch the status filter to `Draft` — list filters to drafts only; URL becomes `?cycleId=...&status=draft`.
4. Switch back to `All`, change cycle, deselect cycle — empty-state prompt returns.

If you have no plans locally, seed at least one to verify.

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm --filter @ics-select/web typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(admin\)/admin/plans apps/web/lib/queries/admin-plans-overview.ts apps/web/lib/format/time.ts
git commit -m "feat(admin): /admin/plans overview page

New page lists every plan in a cycle, grouped by weekStart desc, with
status + items counts + last-activity. Cycle and status filter are
URL-driven so they survive refresh and can be deep-linked from the
cycle page (next commit)."
```

---

## Task 6: Sidebar nav, "All plans →" link, and button rename

**Files:**
- Modify: `apps/web/components/admin-shell/sidebar-admin.tsx`
- Modify: `apps/web/app/(admin)/admin/cycle/[id]/page.tsx`
- Modify: `apps/web/app/(admin)/admin/member/[id]/page.tsx`

Three small wiring changes that complete the page's discoverability.

- [ ] **Step 1: Add `Plans` to the sidebar nav**

In `apps/web/components/admin-shell/sidebar-admin.tsx`, change the icon import on line 6 to add `ListChecks`:

```ts
import { Bell, BookOpen, CircleDot, ListChecks, Sparkles, Users } from 'lucide-react';
```

And insert the new nav item between Cycles and Library in the `NAV` array (after line 19):

```ts
const NAV: readonly NavItem[] = [
  { href: '/admin', label: 'Triage', icon: Bell, exact: true },
  { href: '/admin/members', label: 'Members', icon: Users },
  { href: '/admin/cycles', label: 'Cycles', icon: CircleDot },
  { href: '/admin/plans', label: 'Plans', icon: ListChecks },
  { href: '/admin/library', label: 'Library', icon: BookOpen },
  { href: '/admin/ai-usage', label: 'AI usage', icon: Sparkles },
];
```

- [ ] **Step 2: Add "All plans →" link to the cycle page header**

In `apps/web/app/(admin)/admin/cycle/[id]/page.tsx`, add `Link` to the imports if it's not there yet (it's not — current imports start at line 2). At the top of the file change the imports to:

```tsx
'use client';
import { use } from 'react';
import Link from 'next/link';
import { useAdminCycleOverview } from '../../../../../lib/queries/admin-cycle';
import { RankingToggle } from '../../../../../components/admin/ranking-toggle';
import { CycleMembersGrid } from '../../../../../components/admin/cycle-members-grid';
import { CohortHeatmap } from '../../../../../components/admin/cohort-heatmap';
import { ClassesSection } from '../../../../../components/admin/cycles/classes-section';
import { Eyebrow } from '../../../../../components/ui/eyebrow';
import { SectionLabel } from '../../../../../components/ui/section-label';
```

Then in the header section (currently the `RankingToggle` is the only header-right item), wrap the toggle and add the link beside it. Replace the `<RankingToggle>` element on lines 53–56 with:

```tsx
        <div className="flex items-center gap-4">
          <Link
            href={`/admin/plans?cycleId=${data.cycle.id}`}
            className="inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-label text-ink-soft hover:text-ink"
          >
            All plans →
          </Link>
          <RankingToggle
            cycleId={data.cycle.id}
            checked={data.cycle.rankingVisibleToMembers}
          />
        </div>
```

- [ ] **Step 3: Rename the autopick button on the member detail page**

In `apps/web/app/(admin)/admin/member/[id]/page.tsx`, the button is at lines 77–83 currently. Drop the `Plus` icon usage and rename. Change the import on line 4 from:

```tsx
import { ArrowLeft, MessageCircle, Plus } from 'lucide-react';
```

to:

```tsx
import { ArrowLeft, MessageCircle } from 'lucide-react';
```

Then replace the existing `<Link href={`/admin/member/${memberId}/plan/new`} ...>` block (lines 77–83) with:

```tsx
          <Link
            href={`/admin/member/${memberId}/plan/new`}
            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-label px-4 py-2 bg-ink text-paper rounded-pill hover:opacity-90"
          >
            Plan next week →
          </Link>
```

- [ ] **Step 4: Verify all three changes in the browser**

With `pnpm dev` running:

1. Sidebar shows a new "Plans" entry between "Cycles" and "Library", with the `ListChecks` icon. Clicking it navigates to `/admin/plans`.
2. Visit any `/admin/cycle/[id]` page. There's an "All plans →" link in the header. Clicking it lands on `/admin/plans?cycleId=<that cycle>` with the dropdown pre-selected.
3. Visit any `/admin/member/[id]` page. The big primary button reads "Plan next week →" without the `+` icon. Clicking it still routes through `/plan/new` → autopick → editor for next week's existing or freshly-created draft. (To verify idempotency: click "Plan next week →" twice in a row from a fresh state — the second click should land on the same plan id, not a new one.)

- [ ] **Step 5: Run typecheck**

Run:

```bash
pnpm --filter @ics-select/web typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/admin-shell/sidebar-admin.tsx apps/web/app/\(admin\)/admin/cycle apps/web/app/\(admin\)/admin/member
git commit -m "feat(admin): sidebar Plans entry, All-plans link, rename autopick button

- Sidebar: 'Plans' between Cycles and Library
- Cycle page header: 'All plans →' that deep-links into /admin/plans?cycleId=
- Member detail: button is now 'Plan next week →' since the autopick is
  idempotent and may open an existing plan."
```

---

## Task 7: End-to-end verification

**Files:** none modified — this is a verification gate before opening the PR.

- [ ] **Step 1: Run the full test + typecheck matrix**

```bash
pnpm --filter @ics-select/api test
pnpm --filter @ics-select/api typecheck
pnpm --filter @ics-select/web typecheck
pnpm --filter @ics-select/shared build
```

Expected: green across the board.

- [ ] **Step 2: Manual smoke test of the full flow**

With `pnpm dev` running and a local DB seeded with at least one cycle + a couple members + plans (DRAFT and PUBLISHED):

1. From `/admin/members`, confirm `plansCount` only counts PUBLISHED plans (compare against the timeline tab on the member detail page — they must agree).
2. From `/admin/cycle/[id]`, click "All plans →". Lands on `/admin/plans?cycleId=...` with the cycle pre-selected. The list shows weeks desc, members alphabetical within each week.
3. Click any row — opens the plan editor for that user/plan id.
4. From `/admin/member/[id]`, click "Plan next week →" twice. Both clicks land on the same plan id (no duplicate created). Inspect the URL — second click should be a no-op route push to the same `/plan/<id>`.
5. Switch the Plans page status filter to `Draft` and `Published`. Counts and rows update to match.

- [ ] **Step 3: Open the PR**

The PR title and body summarize the four tightly-coupled changes.

```bash
git push -u origin <branch>
gh pr create --title "feat(admin): plans overview page + idempotent autopick + dedupe" --body "$(cat <<'EOF'
## Summary
- New `/admin/plans` page listing every plan in a cycle (DRAFT + PUBLISHED), grouped by weekStart desc, deep-linkable from cycle page via "All plans →".
- Autopick (`Plan next week →`) is now idempotent — returns the existing plan for the upcoming week instead of walking forward and creating orphan drafts.
- DB migration: dedupes any same-week duplicates and adds `@@unique([userId, weekStart])` on `WeeklyPlan`.
- `/admin/members` `plansCount` now counts only PUBLISHED so the surface stops disagreeing with the member timeline.

Spec: `docs/superpowers/specs/2026-04-17-admin-plans-overview-and-dedupe-design.md`

## Test plan
- [ ] api unit tests pass (`pnpm --filter @ics-select/api test`)
- [ ] web typecheck passes
- [ ] Manual: `/admin/plans` empty/select-cycle/with-cycle states, status filter, row click navigates
- [ ] Manual: `/admin/cycle/[id]` "All plans →" deep-links with cycleId pre-selected
- [ ] Manual: clicking "Plan next week →" twice never creates a duplicate plan
- [ ] Manual: `/admin/members` plansCount matches the member detail timeline count

## Deploy notes
1. Pre-merge, run on prod:
   ```sql
   SELECT "userId", "weekStart", COUNT(*) AS n FROM "WeeklyPlan"
   GROUP BY 1,2 HAVING COUNT(*) > 1 ORDER BY n DESC;
   ```
   Confirm the migration's dedupe step won't surprise anyone.
2. One-off cleanup of Maria's orphan empty drafts (NOT a same-week duplicate, so the migration won't touch them):
   ```sql
   DELETE FROM "WeeklyPlan"
   WHERE "userId" = 'cmnwc9pwn000g2lqwwz1ovdoc'
     AND status = 'DRAFT'
     AND id NOT IN (SELECT DISTINCT "weeklyPlanId" FROM "WeeklyPlanItem");
   ```
3. Merge → Docker entrypoint runs `prisma migrate deploy` automatically.
EOF
)"
```

---

## Out-of-band runbook (post-merge, on prod DB)

These are SQL snippets the operator runs against prod after the PR merges and the migration deploys. They are NOT part of the code commits.

**Audit for same-week duplicates** (sanity check that the migration's dedupe was a no-op or did the right thing):

```sql
SELECT "userId", "weekStart", COUNT(*)
FROM "WeeklyPlan"
GROUP BY 1, 2
HAVING COUNT(*) > 1;
```

Expected: zero rows after the migration.

**Cleanup of Maria's orphan empty drafts** (separate from dedupe — these are different `weekStart`s, so the migration won't touch them):

```sql
-- Inspect first
SELECT wp.id, wp."weekStart", wp.status, wp."createdAt",
       (SELECT COUNT(*) FROM "WeeklyPlanItem" WHERE "weeklyPlanId" = wp.id) AS items
FROM "WeeklyPlan" wp
WHERE wp."userId" = 'cmnwc9pwn000g2lqwwz1ovdoc'
ORDER BY wp."weekStart";

-- Then delete the empty drafts
DELETE FROM "WeeklyPlan"
WHERE "userId" = 'cmnwc9pwn000g2lqwwz1ovdoc'
  AND status = 'DRAFT'
  AND id NOT IN (SELECT DISTINCT "weeklyPlanId" FROM "WeeklyPlanItem");
```

**Smoke check:** open `/admin/plans?cycleId=<2026.2 cycle id>` and confirm Maria shows exactly the plan(s) she should have.

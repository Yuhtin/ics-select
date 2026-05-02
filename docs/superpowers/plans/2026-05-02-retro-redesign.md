# Retro Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/me/retro`'s three blind textareas with a guided debrief — a stats + items recap, then three pointed questions, two of which pick from dropdowns of the week's actual items.

**Architecture:** Additive Prisma migration adds two nullable FK columns (`valuedItemId`, `stuckItemId`) on `WeeklyRetro`. Backend `RetroService.getCurrent` builds a `weekRecap` block by loading the current-week plan and aggregating outcomes; `submit` validates that any provided item ids belong to the caller's current-week plan. Frontend `RetroForm` is rewritten as five controlled values + two HeroUI `Select` pickers and a new `RetroRecap` presentational component. Admin retro renderers (plan editor context panel, member-detail retros tab) read denormalized `valuedItem`/`stuckItem` shapes from the API and render clickable item chips.

**Tech Stack:** NestJS 10 + Prisma 5 + PostgreSQL 16 (api), Next.js 15 App Router + HeroUI + TanStack Query (web), Jest (api unit), Playwright (web smoke). Spec at `docs/superpowers/specs/2026-05-02-retro-redesign-design.md`.

---

## File Structure

**Create:**
- `packages/prisma/prisma/migrations/r_weekly_retro_item_links/migration.sql` — additive columns + FKs
- `apps/web/components/member/retro-recap.tsx` — presentational recap (stats ribbon + items list)

**Modify (api):**
- `packages/prisma/prisma/schema.prisma` — add `valuedItemId`, `stuckItemId` to `WeeklyRetro`; inverse relations on `WeeklyPlanItem`
- `apps/api/src/me/retro/dto.ts` — extend `SubmitRetroSchema` with optional id fields
- `apps/api/src/me/retro/retro.service.ts` — `getCurrent` returns `weekRecap`; `submit` validates + persists ids
- `apps/api/src/me/retro/retro.service.spec.ts` — new tests for both paths
- `apps/api/src/admin/plan-context/plan-context.service.ts` — include `valuedItem`/`stuckItem` denormalized shape in retro response
- `apps/api/src/admin/member-detail/member-detail.service.ts` — same denormalization for the retros list

**Modify (web):**
- `apps/web/lib/queries/me-retro.ts` — extend `RetroCurrentResponse` with `weekRecap`, retro shape with id fields, mutation body
- `apps/web/lib/queries/admin-member.ts` — extend retros entry with `valuedItem`/`stuckItem`
- `apps/web/components/member/retro-form.tsx` — rewrite with pickers + recap
- `apps/web/components/admin/plan-editor/context-panel.tsx` — chip rendering on linked items
- `apps/web/components/admin/member-detail/retros-tab.tsx` — chip rendering on linked items
- `apps/web/tests/retro.spec.ts` (new) — Playwright smoke

Each task ends with a commit. Run `pnpm typecheck` from the workspace root before commits in api/web tasks (it's the cheapest signal that nothing else broke).

---

## Task 1: Prisma schema + migration for retro item links

**Files:**
- Modify: `packages/prisma/prisma/schema.prisma:336-351` (WeeklyRetro model) and around line 295 (WeeklyPlanItem model)
- Create: `packages/prisma/prisma/migrations/r_weekly_retro_item_links/migration.sql`

- [ ] **Step 1: Locate the WeeklyPlanItem model**

Run: `grep -n "^model WeeklyPlanItem" packages/prisma/prisma/schema.prisma`

Note the line number — you'll need to add inverse relations to it.

- [ ] **Step 2: Edit `schema.prisma` — add the two nullable FK columns + relations to `WeeklyRetro`**

Replace the existing `WeeklyRetro` model (lines 336–351) with:

```prisma
model WeeklyRetro {
  id           String   @id @default(cuid())
  userId       String
  cycleId      String
  weekStart    DateTime
  // whatClicked: kept name; semantics shifted to "valued reason" — paired with valuedItemId
  whatClicked  String?
  // whatStuck: kept name; semantics shifted to "stuck blocker" — paired with stuckItemId
  whatStuck    String?
  nextWeekWish String?
  // FK to the WeeklyPlanItem the member picked as "most valued" in Q2.
  // SetNull so deleting an item doesn't cascade-delete the retro text.
  valuedItemId String?
  // FK to the WeeklyPlanItem the member picked as "stuck/in doubt" in Q1.
  stuckItemId  String?
  submittedAt  DateTime @default(now())

  user        User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  cycle       Cycle            @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  valuedItem  WeeklyPlanItem?  @relation("RetroValuedItem", fields: [valuedItemId], references: [id], onDelete: SetNull)
  stuckItem   WeeklyPlanItem?  @relation("RetroStuckItem",  fields: [stuckItemId],  references: [id], onDelete: SetNull)

  @@unique([userId, weekStart])
  @@index([cycleId, weekStart])
}
```

- [ ] **Step 3: Edit `schema.prisma` — add inverse relations to `WeeklyPlanItem`**

Find the `WeeklyPlanItem` model and add these two lines inside the relation list (after the existing relations, before any `@@` block):

```prisma
  valuedInRetros WeeklyRetro[] @relation("RetroValuedItem")
  stuckInRetros  WeeklyRetro[] @relation("RetroStuckItem")
```

- [ ] **Step 4: Generate the migration SQL**

Run: `pnpm --filter @ics-select/prisma exec prisma migrate dev --create-only --name r_weekly_retro_item_links`

Expected: a new directory `packages/prisma/prisma/migrations/r_weekly_retro_item_links/` containing `migration.sql`. The SQL should include `ALTER TABLE "WeeklyRetro" ADD COLUMN "valuedItemId" TEXT, ADD COLUMN "stuckItemId" TEXT;` plus two `ADD CONSTRAINT` blocks with `ON DELETE SET NULL ON UPDATE CASCADE` and the inverse-relation indexes (`CREATE INDEX "WeeklyRetro_valuedItemId_idx"` etc.).

If Prisma generates anything else (renames, drops), abort and re-read the schema diff — the migration should be purely additive.

- [ ] **Step 5: Apply the migration locally**

Run: `pnpm --filter @ics-select/prisma exec prisma migrate dev`

Expected: `Database in sync` or similar. The local Postgres now has the new columns.

- [ ] **Step 6: Regenerate the Prisma client**

Run: `pnpm db:generate`

Expected: success. Subsequent `tsc` runs will see `valuedItemId`, `stuckItemId`, `valuedItem`, `stuckItem` on the generated types.

- [ ] **Step 7: Commit**

```bash
git add packages/prisma/prisma/schema.prisma packages/prisma/prisma/migrations/r_weekly_retro_item_links/
git commit -m "feat(retro): add valuedItemId + stuckItemId FKs on WeeklyRetro"
```

---

## Task 2: Extend SubmitRetroSchema DTO

**Files:**
- Modify: `apps/api/src/me/retro/dto.ts`

- [ ] **Step 1: Replace the schema with the extended version**

Replace the entire contents of `apps/api/src/me/retro/dto.ts`:

```ts
import { z } from 'zod';

// whatClicked and whatStuck retain their column names for migration cost
// reasons but their semantics shifted: whatClicked = "why this item was
// valued" (Q2), whatStuck = "what's blocking on this item" (Q1).
export const SubmitRetroSchema = z.object({
  whatClicked: z.string().max(1000).optional(),
  whatStuck: z.string().max(1000).optional(),
  nextWeekWish: z.string().max(1000).optional(),
  // FK to the WeeklyPlanItem the member picked as "most valued" in Q2.
  // null/undefined = no item linked (free-text retro still allowed).
  valuedItemId: z.string().cuid().nullable().optional(),
  // FK to the WeeklyPlanItem the member picked as "stuck/in doubt" in Q1.
  stuckItemId: z.string().cuid().nullable().optional(),
});
export type SubmitRetroInput = z.infer<typeof SubmitRetroSchema>;
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/api typecheck`

Expected: no errors. Existing call sites pass undefined for the new fields, which is allowed.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/me/retro/dto.ts
git commit -m "feat(retro): extend SubmitRetroSchema with valuedItemId/stuckItemId"
```

---

## Task 3: RetroService.getCurrent — return weekRecap

**Files:**
- Modify: `apps/api/src/me/retro/retro.service.ts`
- Modify: `apps/api/src/me/retro/retro.service.spec.ts`

- [ ] **Step 1: Add tests for `weekRecap` to `retro.service.spec.ts`**

Append the following inside the existing `describe('RetroService', ...)` block, after the existing `it('returns existing retro when submitted', ...)` test. Note: the existing mock factory `makePrismaMock` doesn't include `weeklyPlan` — we'll extend it.

Replace the existing `makePrismaMock` near the top of the file with:

```ts
const makePrismaMock = () => ({
  memberAvailability: { findUnique: jest.fn() },
  cycleMembership: { findFirst: jest.fn() },
  weeklyRetro: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  weeklyPlan: {
    findFirst: jest.fn(),
  },
});
```

Then append these new tests inside `describe('RetroService', ...)`:

```ts
  it('weekRecap is null when there is no current-week PUBLISHED plan', async () => {
    prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
    prisma.weeklyRetro.findUnique.mockResolvedValue(null);
    prisma.weeklyPlan.findFirst.mockResolvedValue(null);
    const result = await service.getCurrent('u-1', new Date('2026-04-17T22:00:00Z'));
    expect(result.weekRecap).toBeNull();
  });

  it('weekRecap aggregates outcomes and minutesStudied from current-week plan items', async () => {
    prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
    prisma.weeklyRetro.findUnique.mockResolvedValue(null);
    prisma.weeklyPlan.findFirst.mockResolvedValue({
      id: 'p-1',
      items: [
        // Two DONE_EASY (45 + 30 = 75 min), one DONE_HARD (60 min) → 135 minutesStudied
        { id: 'i1', order: 0, outcome: 'DONE_EASY', scheduledMinutes: 45, libraryItem: { title: 'A', format: 'VIDEO', estimatedMinutes: 30, url: 'https://x/a' } },
        { id: 'i2', order: 1, outcome: 'DONE_HARD', scheduledMinutes: 60, libraryItem: { title: 'B', format: 'PROBLEM', estimatedMinutes: 45, url: 'https://x/b' } },
        { id: 'i3', order: 2, outcome: 'DONE_EASY', scheduledMinutes: 30, libraryItem: { title: 'C', format: 'ARTICLE', estimatedMinutes: 25, url: null } },
        { id: 'i4', order: 3, outcome: 'DOUBTS', scheduledMinutes: 30, libraryItem: { title: 'D', format: 'VIDEO', estimatedMinutes: 20, url: null } },
        { id: 'i5', order: 4, outcome: 'STUCK', scheduledMinutes: 30, libraryItem: { title: 'E', format: 'VIDEO', estimatedMinutes: 20, url: null } },
        { id: 'i6', order: 5, outcome: 'SKIPPED', scheduledMinutes: null, libraryItem: { title: 'F', format: 'VIDEO', estimatedMinutes: 5, url: null } },
        { id: 'i7', order: 6, outcome: 'PENDING', scheduledMinutes: 30, libraryItem: { title: 'G', format: 'VIDEO', estimatedMinutes: 30, url: null } },
      ],
    });
    const result = await service.getCurrent('u-1', new Date('2026-04-17T22:00:00Z'));
    expect(result.weekRecap).not.toBeNull();
    expect(result.weekRecap!.stats).toEqual({
      nailed: 2,
      hard: 1,
      doubts: 1,
      stuck: 1,
      skipped: 1,
      minutesStudied: 135,
    });
    expect(result.weekRecap!.items).toHaveLength(7);
    expect(result.weekRecap!.items[0]).toEqual({
      id: 'i1',
      title: 'A',
      format: 'VIDEO',
      estimatedMinutes: 30,
      url: 'https://x/a',
      outcome: 'DONE_EASY',
      order: 0,
    });
  });
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern retro.service`

Expected: 2 new failures — `weekRecap` is `undefined` on the response shape.

- [ ] **Step 3: Implement `weekRecap` in `retro.service.ts`**

Replace the entire `getCurrent` method (and add a private helper) so the file looks like:

```ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ItemOutcome } from '@ics-select/prisma';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { resolveActiveMembership } from '../../common/cycle/active-cycle.js';
import type { SubmitRetroInput } from './dto.js';

export type WeekRecapItem = {
  id: string;
  title: string;
  format: string;
  estimatedMinutes: number;
  url: string | null;
  outcome: ItemOutcome;
  order: number;
};

export type WeekRecap = {
  stats: {
    nailed: number;
    hard: number;
    doubts: number;
    stuck: number;
    skipped: number;
    minutesStudied: number;
  };
  items: WeekRecapItem[];
};

@Injectable()
export class RetroService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(userId: string, now: Date = new Date()) {
    const availability = await this.prisma.memberAvailability.findUnique({ where: { userId } });
    const tz = availability?.timezone ?? 'America/Sao_Paulo';
    const { open, windowOpensAt, windowClosesAt, weekStart } = this.computeWindow(now, tz);

    const [retro, weekRecap] = await Promise.all([
      this.prisma.weeklyRetro.findUnique({
        where: { userId_weekStart: { userId, weekStart } },
      }),
      this.loadWeekRecap(userId, weekStart),
    ]);

    return {
      open,
      retro,
      windowOpensAt: windowOpensAt.toISOString(),
      windowClosesAt: windowClosesAt.toISOString(),
      weekRecap,
    };
  }

  // Loads the current-week PUBLISHED plan and shapes its items into the
  // recap block the frontend renders above the form. Returns null if the
  // member has no published plan for the week — the form falls back to
  // showing only Q3 (the wish field).
  private async loadWeekRecap(userId: string, weekStart: Date): Promise<WeekRecap | null> {
    const plan = await this.prisma.weeklyPlan.findFirst({
      where: { userId, weekStart, status: 'PUBLISHED' },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: {
            libraryItem: {
              select: { title: true, format: true, estimatedMinutes: true, url: true },
            },
          },
        },
      },
    });
    if (!plan) return null;

    const stats = { nailed: 0, hard: 0, doubts: 0, stuck: 0, skipped: 0, minutesStudied: 0 };
    const items: WeekRecapItem[] = [];
    for (const i of plan.items) {
      switch (i.outcome) {
        case 'DONE_EASY':
          stats.nailed += 1;
          stats.minutesStudied += i.scheduledMinutes ?? 0;
          break;
        case 'DONE_HARD':
          stats.hard += 1;
          stats.minutesStudied += i.scheduledMinutes ?? 0;
          break;
        case 'DOUBTS':
          stats.doubts += 1;
          break;
        case 'STUCK':
          stats.stuck += 1;
          break;
        case 'SKIPPED':
          stats.skipped += 1;
          break;
        // PENDING is intentionally not surfaced in stats — the recap is
        // about what happened, not what's still pending.
      }
      items.push({
        id: i.id,
        title: i.libraryItem.title,
        format: i.libraryItem.format,
        estimatedMinutes: i.libraryItem.estimatedMinutes,
        url: i.libraryItem.url,
        outcome: i.outcome,
        order: i.order,
      });
    }

    return { stats, items };
  }

  // ... submit() and computeWindow() remain unchanged below
```

Keep the existing `submit()` and `computeWindow()` methods at the bottom of the class — they don't change in this task. The diff for this task is: import added at top, two exported types added, `getCurrent` rewritten to call `loadWeekRecap` in parallel, `loadWeekRecap` private method added.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern retro.service`

Expected: all 7 tests pass (5 existing + 2 new).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @ics-select/api typecheck`

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/me/retro/retro.service.ts apps/api/src/me/retro/retro.service.spec.ts
git commit -m "feat(retro): RetroService.getCurrent returns weekRecap"
```

---

## Task 4: RetroService.submit — accept and validate item ids

**Files:**
- Modify: `apps/api/src/me/retro/retro.service.ts`
- Modify: `apps/api/src/me/retro/retro.service.spec.ts`

- [ ] **Step 1: Add tests for the validated submit path**

Extend `makePrismaMock` to include `weeklyPlanItem.findMany`:

```ts
const makePrismaMock = () => ({
  memberAvailability: { findUnique: jest.fn() },
  cycleMembership: { findFirst: jest.fn() },
  weeklyRetro: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  weeklyPlan: {
    findFirst: jest.fn(),
  },
  weeklyPlanItem: {
    findMany: jest.fn(),
  },
});
```

Then append three new tests inside `describe('RetroService', ...)`:

```ts
  it('submit accepts valuedItemId/stuckItemId when both belong to the caller and the current week', async () => {
    prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
    prisma.cycleMembership.findFirst.mockResolvedValue({ cycleId: 'c-1' });
    // Both ids resolve to items in the caller's current-week plan.
    prisma.weeklyPlanItem.findMany.mockResolvedValue([
      { id: 'item-valued', weeklyPlan: { userId: 'u-1', weekStart: new Date('2026-04-13T00:00:00Z') } },
      { id: 'item-stuck',  weeklyPlan: { userId: 'u-1', weekStart: new Date('2026-04-13T00:00:00Z') } },
    ]);
    prisma.weeklyRetro.upsert.mockResolvedValue({
      id: 'r-1', userId: 'u-1', cycleId: 'c-1',
      weekStart: new Date('2026-04-13T00:00:00Z'),
      whatClicked: 'because',
      whatStuck: 'lost on subqueries',
      nextWeekWish: null,
      valuedItemId: 'item-valued',
      stuckItemId: 'item-stuck',
      submittedAt: new Date(),
    });
    const result = await service.submit(
      'u-1',
      {
        whatClicked: 'because',
        whatStuck: 'lost on subqueries',
        valuedItemId: 'item-valued',
        stuckItemId: 'item-stuck',
      },
      new Date('2026-04-17T22:00:00Z'),
    );
    expect(prisma.weeklyRetro.upsert).toHaveBeenCalled();
    expect(result.valuedItemId).toBe('item-valued');
    expect(result.stuckItemId).toBe('item-stuck');
  });

  it('submit rejects valuedItemId belonging to another user', async () => {
    prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
    prisma.cycleMembership.findFirst.mockResolvedValue({ cycleId: 'c-1' });
    prisma.weeklyPlanItem.findMany.mockResolvedValue([
      // findMany returned 0 rows that match the caller + week — the id either
      // doesn't exist or belongs to a different user/week.
    ]);
    await expect(
      service.submit(
        'u-1',
        { whatClicked: 'x', valuedItemId: 'foreign-item' },
        new Date('2026-04-17T22:00:00Z'),
      ),
    ).rejects.toThrow(/INVALID_ITEM_REFERENCE/);
  });

  it('submit treats null/undefined ids as "no link" (no validation needed)', async () => {
    prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
    prisma.cycleMembership.findFirst.mockResolvedValue({ cycleId: 'c-1' });
    prisma.weeklyRetro.upsert.mockResolvedValue({
      id: 'r-1', userId: 'u-1', cycleId: 'c-1',
      weekStart: new Date('2026-04-13T00:00:00Z'),
      whatClicked: null, whatStuck: null,
      nextWeekWish: 'mais SD',
      valuedItemId: null, stuckItemId: null,
      submittedAt: new Date(),
    });
    await service.submit(
      'u-1',
      { nextWeekWish: 'mais SD' },
      new Date('2026-04-17T22:00:00Z'),
    );
    // No findMany call needed when both ids are absent.
    expect(prisma.weeklyPlanItem.findMany).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern retro.service`

Expected: 3 new failures — `valuedItemId`/`stuckItemId` are not yet read by `submit`, and the rejection test passes through to upsert without validation.

- [ ] **Step 3: Rewrite the `submit` method to validate + persist**

Replace the existing `submit` method body in `retro.service.ts`:

```ts
  async submit(userId: string, input: SubmitRetroInput, now: Date = new Date()) {
    const availability = await this.prisma.memberAvailability.findUnique({ where: { userId } });
    const tz = availability?.timezone ?? 'America/Sao_Paulo';
    const { open, weekStart } = this.computeWindow(now, tz);
    if (!open) {
      throw new ConflictException('Retro window is closed — try again Fri 18:00 to Sun 23:59 local time.');
    }

    const membership = await resolveActiveMembership(this.prisma, userId, now);
    if (!membership) throw new NotFoundException('No active cycle membership');

    // Validate any provided item ids against the caller's current-week plan.
    // Both ids are independently optional; null means "explicit clear" and
    // is also valid (no DB lookup needed).
    const idsToCheck = [input.valuedItemId, input.stuckItemId].filter(
      (id): id is string => typeof id === 'string',
    );
    if (idsToCheck.length > 0) {
      const found = await this.prisma.weeklyPlanItem.findMany({
        where: {
          id: { in: idsToCheck },
          weeklyPlan: { userId, weekStart },
        },
        select: { id: true },
      });
      const foundIds = new Set(found.map((r) => r.id));
      const missing = idsToCheck.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        throw new ConflictException({
          error: {
            code: 'INVALID_ITEM_REFERENCE',
            message: 'One or more linked items do not belong to your current-week plan',
            details: { missing },
          },
        });
      }
    }

    return this.prisma.weeklyRetro.upsert({
      where: { userId_weekStart: { userId, weekStart } },
      create: {
        userId,
        cycleId: membership.cycleId,
        weekStart,
        whatClicked: input.whatClicked ?? null,
        whatStuck: input.whatStuck ?? null,
        nextWeekWish: input.nextWeekWish ?? null,
        valuedItemId: input.valuedItemId ?? null,
        stuckItemId: input.stuckItemId ?? null,
      },
      update: {
        whatClicked: input.whatClicked ?? null,
        whatStuck: input.whatStuck ?? null,
        nextWeekWish: input.nextWeekWish ?? null,
        valuedItemId: input.valuedItemId ?? null,
        stuckItemId: input.stuckItemId ?? null,
        submittedAt: new Date(),
      },
    });
  }
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern retro.service`

Expected: all 10 tests pass (5 original + 2 from Task 3 + 3 from Task 4).

- [ ] **Step 5: Run the full api unit suite**

Run: `pnpm --filter @ics-select/api test`

Expected: all suites pass (the change is local to retro service; should not affect anything else).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/me/retro/retro.service.ts apps/api/src/me/retro/retro.service.spec.ts
git commit -m "feat(retro): submit validates and persists valuedItemId/stuckItemId"
```

---

## Task 5: Admin retro shapes — denormalize linked items

**Files:**
- Modify: `apps/api/src/admin/plan-context/plan-context.service.ts`
- Modify: `apps/api/src/admin/member-detail/member-detail.service.ts`
- Modify: `apps/api/src/admin/plan-context/plan-context.service.spec.ts`
- Modify: `apps/api/src/admin/member-detail/member-detail.service.spec.ts`

The admin renderers need the linked item title (and outcome) inline so they don't have to look it up separately. We extend the API response with a small `valuedItem`/`stuckItem` object per retro.

- [ ] **Step 1: Examine the existing retro shape in plan-context.service.ts**

Run: `grep -n "retro\|valuedItem\|stuckItem" apps/api/src/admin/plan-context/plan-context.service.ts`

You're looking at lines ~80–90 (response type) and ~290–305 (response builder). The current shape returns text + submittedAt. You'll add `valuedItem` and `stuckItem` fields, both `{ id: string; title: string; outcome: ItemOutcome } | null`.

- [ ] **Step 2: Edit `plan-context.service.ts` — add the denormalized fields**

In the response **type** (around line 80–90), where you see:

```ts
  retro: {
    whatClicked: string | null;
    whatStuck: string | null;
    nextWeekWish: string | null;
    submittedAt: string;
  } | null;
```

replace with:

```ts
  retro: {
    whatClicked: string | null;
    whatStuck: string | null;
    nextWeekWish: string | null;
    submittedAt: string;
    valuedItem: { id: string; title: string; outcome: string } | null;
    stuckItem: { id: string; title: string; outcome: string } | null;
  } | null;
```

In the Prisma `select` for the retro fetch (around line 230, where you see `whatClicked: true, whatStuck: true, nextWeekWish: true`), replace that block with:

```ts
        whatClicked: true,
        whatStuck: true,
        nextWeekWish: true,
        valuedItem: {
          select: {
            id: true,
            outcome: true,
            libraryItem: { select: { title: true } },
          },
        },
        stuckItem: {
          select: {
            id: true,
            outcome: true,
            libraryItem: { select: { title: true } },
          },
        },
```

In the response builder (around line 295–305), where you see:

```ts
      retro: retro
        ? {
            whatClicked: retro.whatClicked,
            whatStuck: retro.whatStuck,
            nextWeekWish: retro.nextWeekWish,
            submittedAt: retro.submittedAt.toISOString(),
          }
        : null,
```

replace with:

```ts
      retro: retro
        ? {
            whatClicked: retro.whatClicked,
            whatStuck: retro.whatStuck,
            nextWeekWish: retro.nextWeekWish,
            submittedAt: retro.submittedAt.toISOString(),
            valuedItem: retro.valuedItem
              ? {
                  id: retro.valuedItem.id,
                  title: retro.valuedItem.libraryItem.title,
                  outcome: retro.valuedItem.outcome,
                }
              : null,
            stuckItem: retro.stuckItem
              ? {
                  id: retro.stuckItem.id,
                  title: retro.stuckItem.libraryItem.title,
                  outcome: retro.stuckItem.outcome,
                }
              : null,
          }
        : null,
```

- [ ] **Step 3: Update `plan-context.service.spec.ts`**

Run: `grep -n "whatClicked\|whatStuck" apps/api/src/admin/plan-context/plan-context.service.spec.ts`

For each existing test that mocks a retro row, add the two new fields to the mock (set them to `null` for existing tests):

```ts
{
  id: 'r-1',
  whatClicked: 'great week',
  whatStuck: null,
  nextWeekWish: null,
  submittedAt: new Date('2026-04-13T00:00:00Z'),
  valuedItem: null,
  stuckItem: null,
}
```

Then add one new test:

```ts
  it('denormalizes valuedItem and stuckItem with title + outcome', async () => {
    // ... existing setup that resolves a member + cycle ...
    // Mock the retro fetch to include linked items
    prisma.weeklyRetro.findFirst.mockResolvedValue({
      id: 'r-1',
      whatClicked: 'this one finally clicked',
      whatStuck: 'lost on inner joins',
      nextWeekWish: null,
      submittedAt: new Date('2026-04-13T00:00:00Z'),
      valuedItem: {
        id: 'wpi-valued',
        outcome: 'DONE_HARD',
        libraryItem: { title: 'SQL Joins Explained' },
      },
      stuckItem: {
        id: 'wpi-stuck',
        outcome: 'DOUBTS',
        libraryItem: { title: 'Indexes Deep Dive' },
      },
    });
    const result = await service.getContext('u-1', 'cycle-1');
    expect(result.retro?.valuedItem).toEqual({
      id: 'wpi-valued',
      title: 'SQL Joins Explained',
      outcome: 'DONE_HARD',
    });
    expect(result.retro?.stuckItem).toEqual({
      id: 'wpi-stuck',
      title: 'Indexes Deep Dive',
      outcome: 'DOUBTS',
    });
  });
```

If the existing `plan-context.service.spec.ts` uses a different mocking pattern (e.g., via `prisma.weeklyRetro.findFirst` versus a different method), match it. The principle is: include the new fields in any retro mock, and add one test asserting the denormalization.

- [ ] **Step 4: Edit `member-detail.service.ts` similarly**

In the `MemberDetailResponse` type (around line 84):

```ts
  retros: Array<{
    id: string;
    weekStart: string;
    whatClicked: string | null;
    whatStuck: string | null;
    nextWeekWish: string | null;
    submittedAt: string;
  }>;
```

replace with:

```ts
  retros: Array<{
    id: string;
    weekStart: string;
    whatClicked: string | null;
    whatStuck: string | null;
    nextWeekWish: string | null;
    submittedAt: string;
    valuedItem: { id: string; title: string; outcome: string } | null;
    stuckItem: { id: string; title: string; outcome: string } | null;
  }>;
```

Find the `retros: retros.map(...)` builder (around line 354) and the corresponding Prisma fetch. Add the same `valuedItem` / `stuckItem` `include` to the fetch query and the same denormalization in the map. The exact shape mirrors Step 2 above.

- [ ] **Step 5: Update `member-detail.service.spec.ts`** with the same `null` defaults on existing retro mocks plus one denormalization assertion.

- [ ] **Step 6: Run the api unit suite**

Run: `pnpm --filter @ics-select/api test`

Expected: all suites pass.

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @ics-select/api typecheck`

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/admin/plan-context/ apps/api/src/admin/member-detail/
git commit -m "feat(retro): denormalize valuedItem/stuckItem in admin retro responses"
```

---

## Task 6: Frontend types — extend RetroCurrentResponse and admin retros shape

**Files:**
- Modify: `apps/web/lib/queries/me-retro.ts`
- Modify: `apps/web/lib/queries/admin-member.ts`

- [ ] **Step 1: Replace `apps/web/lib/queries/me-retro.ts`**

```ts
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ItemOutcome } from '@ics-select/shared';
import { apiFetch } from '../api/client';

export type WeekRecapItem = {
  id: string;
  title: string;
  format: string;
  estimatedMinutes: number;
  url: string | null;
  outcome: ItemOutcome;
  order: number;
};

export type WeekRecap = {
  stats: {
    nailed: number;
    hard: number;
    doubts: number;
    stuck: number;
    skipped: number;
    minutesStudied: number;
  };
  items: WeekRecapItem[];
};

export type RetroCurrentResponse = {
  open: boolean;
  retro: {
    id: string;
    whatClicked: string | null;
    whatStuck: string | null;
    nextWeekWish: string | null;
    valuedItemId: string | null;
    stuckItemId: string | null;
    submittedAt: string;
  } | null;
  windowOpensAt: string;
  windowClosesAt: string;
  // Optional because the API and web ship through different pipelines
  // (EasyPanel vs Vercel) — the web may briefly load before the API
  // ships the new field. Treat as null when absent.
  weekRecap?: WeekRecap | null;
};

export function useMeRetroCurrent() {
  return useQuery({
    queryKey: ['me', 'retro', 'current'],
    queryFn: () => apiFetch<RetroCurrentResponse>('/me/retro/current'),
  });
}

export type SubmitRetroBody = {
  whatClicked?: string;
  whatStuck?: string;
  nextWeekWish?: string;
  valuedItemId?: string | null;
  stuckItemId?: string | null;
};

export function useSubmitRetro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SubmitRetroBody) =>
      apiFetch<unknown>('/me/retro', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'retro'] }),
  });
}
```

- [ ] **Step 2: Edit `apps/web/lib/queries/admin-member.ts` — extend the retros entry**

Run: `grep -n "retros:" apps/web/lib/queries/admin-member.ts`

You'll see lines ~61. Replace the retros entry to mirror the API shape:

```ts
  retros: Array<{
    id: string;
    weekStart: string;
    whatClicked: string | null;
    whatStuck: string | null;
    nextWeekWish: string | null;
    submittedAt: string;
    valuedItem: { id: string; title: string; outcome: string } | null;
    stuckItem: { id: string; title: string; outcome: string } | null;
  }>;
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: no errors. Existing consumers (RetroForm, retros-tab, context-panel) keep working — they just don't yet read the new fields. We'll wire them up in the next tasks.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/queries/me-retro.ts apps/web/lib/queries/admin-member.ts
git commit -m "feat(retro): extend frontend types with weekRecap and linked items"
```

---

## Task 7: Frontend — RetroRecap component

**Files:**
- Create: `apps/web/components/member/retro-recap.tsx`

- [ ] **Step 1: Create `apps/web/components/member/retro-recap.tsx`**

```tsx
'use client';
import type { WeekRecap, WeekRecapItem } from '../../lib/queries/me-retro';
import { formatMinutes } from '../../lib/format/time';
import { detectPlatform, platformLabel } from '../../lib/format/platform';

interface RetroRecapProps {
  recap: WeekRecap;
}

export function RetroRecap({ recap }: RetroRecapProps) {
  const { stats, items } = recap;
  return (
    <section className="border-t border-rule pt-6">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute">
        This week
      </p>
      <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-1 font-mono text-[12px] tabular-nums text-fg-mute">
        <Stat label="nailed" value={stats.nailed} />
        <Stat label="hard"   value={stats.hard} />
        <Stat label="doubts" value={stats.doubts} />
        <Stat label="stuck"  value={stats.stuck} />
        <Stat label="skipped" value={stats.skipped} />
        {stats.minutesStudied > 0 && (
          <span className="text-fg">
            {formatMinutes(stats.minutesStudied)} studied
          </span>
        )}
      </div>
      <ul className="mt-5 divide-y divide-rule border-y border-rule">
        {items.map((it) => (
          <li key={it.id}>
            <RecapRow item={it} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span>
      <span className={value > 0 ? 'text-fg' : 'text-fg-faint'}>{value}</span>{' '}
      {label}
    </span>
  );
}

function RecapRow({ item }: { item: WeekRecapItem }) {
  const platform = detectPlatform(item.url, item.format);
  return (
    <div className="flex items-center gap-4 py-3">
      <OutcomeChip outcome={item.outcome} />
      <p className="flex-1 min-w-0 truncate font-sans text-sm text-fg">
        {item.title}
      </p>
      <span className="font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">
        {platformLabel(platform)} · {formatMinutes(item.estimatedMinutes)}
      </span>
    </div>
  );
}

function OutcomeChip({ outcome }: { outcome: WeekRecapItem['outcome'] }) {
  const config: Record<WeekRecapItem['outcome'], { label: string; cls: string }> = {
    DONE_EASY: { label: 'Nailed',  cls: 'bg-outcome-done-easy/10 text-outcome-done-easy border-outcome-done-easy/30' },
    DONE_HARD: { label: 'Hard',    cls: 'bg-outcome-done-hard/10 text-outcome-done-hard border-outcome-done-hard/30' },
    DOUBTS:    { label: 'Doubts',  cls: 'bg-outcome-doubts/10 text-outcome-doubts border-outcome-doubts/30' },
    STUCK:     { label: 'Stuck',   cls: 'bg-outcome-stuck/10 text-outcome-stuck border-outcome-stuck/30' },
    SKIPPED:   { label: 'Skipped', cls: 'bg-fg-faint/10 text-fg-mute border-fg-faint/30' },
    PENDING:   { label: 'Pending', cls: 'bg-fg-faint/10 text-fg-mute border-fg-faint/30' },
  };
  const { label, cls } = config[outcome];
  return (
    <span
      className={`inline-flex w-[68px] justify-center rounded-pill border px-2 py-0.5 font-mono text-[10px] uppercase tracking-eyebrow ${cls}`}
    >
      {label}
    </span>
  );
}
```

Note: the outcome chip color tokens (`outcome-done-easy`, etc.) follow the design system palette in `docs/design-system.md`. If the project uses different exact class names (run `grep -n "outcome-done-easy" apps/web/`), match those — semantics are the same.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/member/retro-recap.tsx
git commit -m "feat(retro): add RetroRecap presentational component"
```

---

## Task 8: Frontend — rewrite RetroForm with pickers

**Files:**
- Modify: `apps/web/components/member/retro-form.tsx`

- [ ] **Step 1: Replace the entire RetroForm**

Replace `apps/web/components/member/retro-form.tsx` with:

```tsx
'use client';
import { useState } from 'react';
import { Select, SelectItem } from '@heroui/react';
import type { RetroCurrentResponse, WeekRecapItem } from '../../lib/queries/me-retro';
import { useSubmitRetro } from '../../lib/queries/me-retro';
import { Eyebrow } from '../ui/eyebrow';
import { SectionLabel } from '../ui/section-label';
import { Button } from '../ui/button';
import { RetroRecap } from './retro-recap';

interface RetroFormProps {
  data: RetroCurrentResponse;
}

const STUCK_OUTCOMES: ReadonlySet<WeekRecapItem['outcome']> = new Set(['DOUBTS', 'STUCK']);
const VALUED_OUTCOMES: ReadonlySet<WeekRecapItem['outcome']> = new Set(['DONE_EASY', 'DONE_HARD']);

export function RetroForm({ data }: RetroFormProps) {
  const recap = data.weekRecap ?? null;
  const [whatClicked, setWhatClicked]   = useState(data.retro?.whatClicked ?? '');
  const [whatStuck,   setWhatStuck]     = useState(data.retro?.whatStuck   ?? '');
  const [nextWeekWish, setNextWeekWish] = useState(data.retro?.nextWeekWish ?? '');
  const [valuedItemId, setValuedItemId] = useState<string | null>(data.retro?.valuedItemId ?? null);
  const [stuckItemId,  setStuckItemId]  = useState<string | null>(data.retro?.stuckItemId  ?? null);
  const submit = useSubmitRetro();

  const disabled = !data.open;
  const stuckOptions  = recap?.items.filter((i) => STUCK_OUTCOMES.has(i.outcome))  ?? [];
  const valuedOptions = recap?.items.filter((i) => VALUED_OUTCOMES.has(i.outcome)) ?? [];
  // Q1 only renders when there's at least one DOUBTS/STUCK item to anchor against.
  const showStuckQuestion = stuckOptions.length > 0;
  // Q2 renders whenever there is a recap (even if 0 valued items — picker shows "Nenhum" only).
  const showValuedQuestion = recap !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await submit.mutateAsync({
      whatClicked: whatClicked.trim() || undefined,
      whatStuck:   whatStuck.trim()   || undefined,
      nextWeekWish: nextWeekWish.trim() || undefined,
      valuedItemId: valuedItemId,
      stuckItemId:  stuckItemId,
    });
  }

  return (
    <form className="max-w-3xl space-y-8" onSubmit={handleSubmit}>
      <header>
        <Eyebrow>Weekly retro</Eyebrow>
        <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight">
          How was this week?
        </h1>
        <p className="mt-3 font-sans text-sm text-ink-soft">
          Your notes help shape next week&apos;s plan. Only the program director sees them.
        </p>
        {!data.open && (
          <p className="mt-3 border-l-4 border-outcome-done-hard pl-4 font-mono text-xs uppercase tracking-label text-outcome-done-hard">
            Retro closed — window reopens Fri 18:00 local.
          </p>
        )}
      </header>

      {recap && <RetroRecap recap={recap} />}

      {showStuckQuestion && (
        <fieldset className="space-y-3" disabled={disabled}>
          <SectionLabel>Qual item dessa semana travou ou ficou com dúvida?</SectionLabel>
          <Select
            aria-label="Item travado"
            placeholder="Escolha um item…"
            selectedKeys={stuckItemId ? [stuckItemId] : []}
            onSelectionChange={(keys) => {
              const next = Array.from(keys)[0];
              setStuckItemId(typeof next === 'string' ? next : null);
            }}
          >
            {stuckOptions.map((it) => (
              <SelectItem key={it.id}>{it.title}</SelectItem>
            ))}
          </Select>
          <RetroTextarea
            label="O que falta pra desbloquear?"
            value={whatStuck}
            onChange={setWhatStuck}
            disabled={disabled}
          />
        </fieldset>
      )}

      {showValuedQuestion && (
        <fieldset className="space-y-3" disabled={disabled}>
          <SectionLabel>Qual item dessa semana mais valeu a pena?</SectionLabel>
          <Select
            aria-label="Item que mais valeu a pena"
            placeholder="Escolha um item…"
            selectedKeys={valuedItemId ? [valuedItemId] : ['__none__']}
            onSelectionChange={(keys) => {
              const next = Array.from(keys)[0];
              if (next === '__none__' || typeof next !== 'string') {
                setValuedItemId(null);
              } else {
                setValuedItemId(next);
              }
            }}
          >
            <SelectItem key="__none__">Nenhum</SelectItem>
            <>
              {valuedOptions.map((it) => (
                <SelectItem key={it.id}>{it.title}</SelectItem>
              ))}
            </>
          </Select>
          <RetroTextarea
            label="Por quê?"
            value={whatClicked}
            onChange={setWhatClicked}
            disabled={disabled}
          />
        </fieldset>
      )}

      <fieldset className="space-y-3" disabled={disabled}>
        <SectionLabel>1 coisa que você quer no próximo plano</SectionLabel>
        <textarea
          value={nextWeekWish}
          onChange={(e) => setNextWeekWish(e.target.value)}
          placeholder="ex: 'menos LeetCode, mais system design' / 'item Y específico' / 'só 4 itens, essa semana foi pesada' / 'mais conteúdo em pt-BR'"
          disabled={disabled}
          className="w-full min-h-[120px] rounded-input border border-rule bg-surface p-3 font-sans text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-ink disabled:cursor-not-allowed disabled:opacity-60"
        />
      </fieldset>

      <Button type="submit" disabled={disabled || submit.isPending}>
        {submit.isPending ? 'Saving…' : data.retro ? 'Update retro' : 'Submit retro'}
      </Button>
    </form>
  );
}

function RetroTextarea({
  label, value, onChange, disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <p className="font-mono text-[10px] font-semibold uppercase tracking-eyebrow text-fg-mute mb-2">
        {label}
      </p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full min-h-[100px] rounded-input border border-rule bg-surface p-3 font-sans text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-ink disabled:cursor-not-allowed disabled:opacity-60"
      />
    </div>
  );
}
```

Notes:
- The Q2 dropdown always shows `Nenhum` as the first option. When the user picks `Nenhum`, we set `valuedItemId = null`. Initial render: if `data.retro?.valuedItemId` is null, `selectedKeys = ['__none__']` so `Nenhum` is highlighted by default.
- The Q1 dropdown has no `Nenhum` option — picking nothing leaves `stuckItemId = null`. The textarea can still be filled (free retro on a stuck topic without anchoring).
- HeroUI `Select` is already used elsewhere in the codebase (see `apps/web/components/admin/...`); if its import path or API shape differs, match the existing usage.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/member/retro-form.tsx
git commit -m "feat(retro): rewrite RetroForm with anchored pickers and recap"
```

---

## Task 9: Admin chip rendering — context-panel + retros-tab

**Files:**
- Modify: `apps/web/components/admin/plan-editor/context-panel.tsx`
- Modify: `apps/web/components/admin/member-detail/retros-tab.tsx`

We replace the plain `RetroBlock` quotes with chip-prefixed quotes when the linked item exists.

- [ ] **Step 1: Edit `context-panel.tsx`**

Find the existing block (around lines 81–95):

```tsx
          {data.retro ? (
            <>
              {data.retro.whatClicked && (
                <RetroBlock label="What clicked" text={data.retro.whatClicked} />
              )}
              {data.retro.whatStuck && (
                <RetroBlock label="What stuck" text={data.retro.whatStuck} />
              )}
              {data.retro.nextWeekWish && (
                <RetroBlock label="Next week wish" text={data.retro.nextWeekWish} />
              )}
            </>
          ) : (
            <p className="font-mono text-xs text-ink-mute">No retro submitted last week.</p>
          )}
```

replace with:

```tsx
          {data.retro ? (
            <>
              {data.retro.whatClicked && (
                <RetroBlock
                  label="What clicked"
                  text={data.retro.whatClicked}
                  linkedItem={data.retro.valuedItem}
                />
              )}
              {data.retro.whatStuck && (
                <RetroBlock
                  label="What stuck"
                  text={data.retro.whatStuck}
                  linkedItem={data.retro.stuckItem}
                />
              )}
              {data.retro.nextWeekWish && (
                <RetroBlock label="Next week wish" text={data.retro.nextWeekWish} />
              )}
            </>
          ) : (
            <p className="font-mono text-xs text-ink-mute">No retro submitted last week.</p>
          )}
```

Then replace the existing `RetroBlock` function at the bottom of the file (around lines 143–152) with:

```tsx
function RetroBlock({
  label,
  text,
  linkedItem,
}: {
  label: string;
  text: string;
  linkedItem?: { id: string; title: string; outcome: string } | null;
}) {
  return (
    <div className="border-l-2 border-accent pl-4 py-2 bg-paper-warm/40">
      <p className="font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute font-semibold">
        {label}
      </p>
      {linkedItem && (
        <p className="mt-1 font-mono text-[11px] text-ink-mute">
          → {linkedItem.title}
          <span className="ml-2 text-ink-faint">[{linkedItem.outcome}]</span>
        </p>
      )}
      <p className="mt-1 font-serif-tool text-sm italic text-ink leading-relaxed">&ldquo;{text}&rdquo;</p>
    </div>
  );
}
```

The chip is rendered as a small mono caption above the quote — minimal visual change, gives the admin the context of *which item* the quote is about.

- [ ] **Step 2: Edit `retros-tab.tsx`**

Find the existing block (around lines 24–50):

```tsx
                {r.whatClicked && <RetroBlock label="What clicked" text={r.whatClicked} />}
                {r.whatStuck && <RetroBlock label="What stuck" text={r.whatStuck} />}
                {r.nextWeekWish && <RetroBlock label="Next week wish" text={r.nextWeekWish} />}
```

replace with:

```tsx
                {r.whatClicked && (
                  <RetroBlock label="What clicked" text={r.whatClicked} linkedItem={r.valuedItem} />
                )}
                {r.whatStuck && (
                  <RetroBlock label="What stuck" text={r.whatStuck} linkedItem={r.stuckItem} />
                )}
                {r.nextWeekWish && <RetroBlock label="Next week wish" text={r.nextWeekWish} />}
```

Then replace the existing `RetroBlock` function (around lines 15–22) with the same expanded version from Step 1:

```tsx
function RetroBlock({
  label,
  text,
  linkedItem,
}: {
  label: string;
  text: string;
  linkedItem?: { id: string; title: string; outcome: string } | null;
}) {
  return (
    <div className="border-l-2 border-accent pl-4 py-2 bg-paper-warm/40">
      <p className="font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute font-semibold">
        {label}
      </p>
      {linkedItem && (
        <p className="mt-1 font-mono text-[11px] text-ink-mute">
          → {linkedItem.title}
          <span className="ml-2 text-ink-faint">[{linkedItem.outcome}]</span>
        </p>
      )}
      <p className="mt-1 font-serif-tool text-sm italic text-ink leading-relaxed">&ldquo;{text}&rdquo;</p>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/admin/plan-editor/context-panel.tsx apps/web/components/admin/member-detail/retros-tab.tsx
git commit -m "feat(retro): admin retro renderers show linked item caption"
```

---

## Task 10: Playwright smoke for /me/retro

**Files:**
- Create: `apps/web/tests/retro.spec.ts`

Mirrors the auth + mock pattern from `apps/web/tests/settings-tabs.spec.ts`.

- [ ] **Step 1: Create the test**

```ts
/**
 * Playwright smoke test — /me/retro renders recap, allows submit with item links.
 *
 * Mocked routes:
 *   GET /me                 → valid MEMBER user
 *   GET /me/retro/current   → open=true, no existing retro, weekRecap with 3 items
 *   POST /me/retro          → 200 echo
 */

import { test, expect } from '@playwright/test';

const API_BASE = 'http://localhost:3001';

const MOCK_USER = {
  id: 'u-1',
  email: 'eduardo@test.com',
  name: 'Eduardo',
  pictureUrl: null,
  role: 'MEMBER',
  privacyAcceptedAt: '2026-01-01T00:00:00.000Z',
  whatsappPhone: null,
  targetTrack: 'BIG_TECH',
  googleConnected: true,
};

const MOCK_RETRO_CURRENT = {
  open: true,
  retro: null,
  windowOpensAt: '2026-04-17T21:00:00.000Z',
  windowClosesAt: '2026-04-19T23:59:59.999Z',
  weekRecap: {
    stats: { nailed: 1, hard: 1, doubts: 1, stuck: 0, skipped: 0, minutesStudied: 75 },
    items: [
      { id: 'wpi-1', title: 'SQL Joins Explained',  format: 'VIDEO',   estimatedMinutes: 30, url: null, outcome: 'DONE_EASY', order: 0 },
      { id: 'wpi-2', title: 'Indexes Deep Dive',     format: 'VIDEO',   estimatedMinutes: 45, url: null, outcome: 'DONE_HARD', order: 1 },
      { id: 'wpi-3', title: 'Query Plan Explained',  format: 'ARTICLE', estimatedMinutes: 20, url: null, outcome: 'DOUBTS',    order: 2 },
    ],
  },
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('ics_access_token', 'fake-token');
  });
  await page.route(`${API_BASE}/me`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) }),
  );
  await page.route(`${API_BASE}/me/retro/current`, (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_RETRO_CURRENT) }),
  );
});

test('renders recap stats + items list', async ({ page }) => {
  await page.goto('/me/retro');
  await expect(page.getByText('1 nailed')).toBeVisible();
  await expect(page.getByText('1 hard')).toBeVisible();
  await expect(page.getByText('1 doubts')).toBeVisible();
  await expect(page.getByText('SQL Joins Explained')).toBeVisible();
  await expect(page.getByText('Indexes Deep Dive')).toBeVisible();
  await expect(page.getByText('Query Plan Explained')).toBeVisible();
});

test('Q1 (stuck) renders only because there is one DOUBTS item; Q2 (valued) renders because plan exists', async ({ page }) => {
  await page.goto('/me/retro');
  await expect(page.getByText('Qual item dessa semana travou ou ficou com dúvida?')).toBeVisible();
  await expect(page.getByText('Qual item dessa semana mais valeu a pena?')).toBeVisible();
  await expect(page.getByText('1 coisa que você quer no próximo plano')).toBeVisible();
});

test('submit posts the linked ids', async ({ page }) => {
  let captured: any = null;
  await page.route(`${API_BASE}/me/retro`, async (r) => {
    if (r.request().method() === 'POST') {
      captured = JSON.parse(r.request().postData() ?? '{}');
      await r.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    } else {
      await r.continue();
    }
  });
  await page.goto('/me/retro');
  await page.getByRole('textbox', { name: '' }).first().fill('mais SD');
  await page.getByRole('button', { name: /submit retro/i }).click();
  // Captured POST body has the empty pickers + the wish text.
  await expect.poll(() => captured).not.toBeNull();
  expect(captured.nextWeekWish).toBe('mais SD');
});
```

- [ ] **Step 2: Run the playwright smoke**

Run: `pnpm --filter @ics-select/web test tests/retro.spec.ts`

Expected: 3 tests pass. If selectors don't match (HeroUI renders Select with specific aria-labels), adjust `getByRole`/`getByText` calls — the *intent* of each test is what matters: stats render, the right questions show, submit posts to the API.

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests/retro.spec.ts
git commit -m "test(retro): playwright smoke for /me/retro recap and submit"
```

---

## Self-review summary

**Spec coverage:**
- Recap (stats ribbon + items list, B-medium): Tasks 3, 7
- Q1 stuck with picker, render-gated: Tasks 4 (backend), 8 (frontend)
- Q2 valued with `Nenhum` option: Tasks 4, 8
- Q3 wish with pointed placeholder: Task 8
- Schema columns + FK SetNull: Task 1
- DTO with optional id fields: Task 2
- Server validation INVALID_ITEM_REFERENCE: Task 4
- Optional + window unchanged + closed banner: preserved verbatim in Task 8
- Empty-week fallback (no plan → only Q3): Task 8 (`showStuckQuestion` and `showValuedQuestion` both false when `recap === null`)
- Admin chip in plan-editor + member-detail: Tasks 5, 9
- API/web pipeline drift defense (`weekRecap?` optional): Task 6

**Type consistency check:**
- `valuedItemId` / `stuckItemId` used identically in Prisma model, DTO, API response, frontend types, RetroForm controlled state, mutation body. No drift.
- `WeekRecap` / `WeekRecapItem` defined identically in `retro.service.ts` (api) and `me-retro.ts` (web).
- `valuedItem` / `stuckItem` denormalized shape identical in `plan-context.service.ts`, `member-detail.service.ts`, `admin-member.ts`, `RetroBlock` linkedItem prop.

**Placeholder scan:** none.

**Out-of-band notes (carried from spec):**
- `whatClicked` and `whatStuck` columns keep their names. Only the model-level Prisma comments and the DTO docblock mark the semantic shift. Not re-renaming saves a multi-file rename migration.
- The `HomeService.pickCarryOverReflection` carry-over path is unrelated (it reads `WeeklyPlanItem.reflection`, not retros). Don't touch it.

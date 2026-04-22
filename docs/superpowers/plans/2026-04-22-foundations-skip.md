# Foundations Skip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let members mark foundations items as "already known" in one click and let admins see a "skippable" hint during plan draft — with no Calendar pollution and honest analytics.

**Architecture:** Add `SKIPPED` to the `ItemOutcome` enum. An item is skippable iff `foundations` is in its `LibraryItem.topics` (primary OR cover). Server validates the transition, cleans up the Google Calendar event when needed, and treats `SKIPPED` as a positive outcome across every coverage helper. Admin cohort views get a separate `SKIPPED` count so skips don't masquerade as learning.

**Tech Stack:** Prisma 5 (Postgres migration), NestJS 10 (service + controller), `@ics-select/shared` (TypeScript enum), Next.js 15 + HeroUI (member + admin UI), Google Calendar API (event cleanup), Jest (API unit + e2e), Playwright (web).

**Spec:** `docs/superpowers/specs/2026-04-22-foundations-skip-design.md`

---

## File Structure

### API (`apps/api/`)

- **Modify** `src/weekly-plans/weekly-plans.service.ts:175-199` — `setItemOutcome` validates foundations-only for `SKIPPED`; on transition to `SKIPPED` for a `PUBLISHED` plan, calls Calendar cleanup.
- **Modify** `src/weekly-plans/weekly-plans.service.ts` (read path, ~line 160) — includes `skippable: boolean` per item in plan-detail responses.
- **Modify** `src/weekly-plans/publication.service.ts:90-130` — pre-publication filter drops items with outcome `SKIPPED` before scheduling.
- **Modify** `src/weekly-plans/dto.ts` — DTO already uses `ITEM_OUTCOMES` from shared, so no change; plan read shape is typed in this file.
- **Modify** `src/google-calendar/google-calendar.service.ts` — new helper `findEventIdByIcsId(userId, planId, itemId, range)` that lists events in the plan's week range and returns the matching event ID (or `null`).
- **Modify coverage helpers** (6 files, each adds `SKIPPED` to the `POSITIVE` set):
  - `src/admin/cycle/cycle-overview.service.ts:5`
  - `src/admin/plans-overview/plans-overview.service.ts:5`
  - `src/admin/triage/triage.service.ts:50`
  - `src/admin/member-detail/member-detail.service.ts:8`
  - `src/admin/plan-context/plan-context.service.ts:9`
  - `src/ai/draft-plan.service.ts:151` (inline condition)
- **Modify** `src/admin-dashboard/admin-dashboard.service.ts:28,65,82` — three spots using `{ in: ['DONE_EASY', 'DONE_HARD'] }` (extended to include `SKIPPED` for "covered") plus a new separate count for `SKIPPED` per member.

### Shared (`packages/shared/`)

- **Modify** `src/domain/outcome.ts` — add `SKIPPED` to `ITEM_OUTCOMES` and `POSITIVE_OUTCOMES`. Add `isSkipped(o)` helper.

### Prisma (`packages/prisma/`)

- **Create** migration `packages/prisma/prisma/migrations/m_item_outcome_skipped/migration.sql` (the prefix `m_` follows the existing naming scheme — latest is `l_waitlist_year_and_drop_updates`).
- **Modify** `packages/prisma/prisma/schema.prisma:52-58` — add `SKIPPED` to `enum ItemOutcome`.

### Web (`apps/web/`)

- **Modify** `components/ui/outcome-picker.tsx` — add `SKIPPED` as a picker option, rendered only when the item is skippable.
- **Modify** `components/ui/outcome-dot.tsx` — add gray/muted dot variant for `SKIPPED`.
- **Modify** `components/member/item-focus.tsx` — render a compact "I already know this" action on skippable items when outcome is `PENDING`; render a subdued "Already known" state + undo when outcome is `SKIPPED`.
- **Modify** `components/member/day-list.tsx:23,56` — exclude `SKIPPED` from "next up" ranking; render as a collapsed/de-emphasized row.
- **Modify** `components/member/day-ring-card.tsx:14-29` — count `SKIPPED` toward day completion.
- **Modify** `lib/queries/admin-plan-editor.ts:9` — extend outcome union; add `skippable: boolean` per item.
- **Modify** `app/(admin)/admin/member/[id]/plan/[planId]/page.tsx` — render a `skippable` pill next to each draft item that has `skippable: true`.
- **Modify** the admin cohort/dashboard surfaces — display `SKIPPED` count alongside `done` count (exact files discovered per task below).

### Tests

- **Create** `apps/api/src/weekly-plans/skip.spec.ts` — unit tests for the service behavior added in Tasks 4, 5, 6, 7.
- **Modify** `apps/api/src/weekly-plans/publication.service.spec.ts` — add case: item with `SKIPPED` outcome is not scheduled.
- **Modify** `apps/api/src/google-calendar/google-calendar.service.spec.ts` — test `findEventIdByIcsId`.
- **Create** `apps/web/tests/member-skip.spec.ts` — Playwright end-to-end smoke: member clicks "I already know this" on a foundations item and the item moves to skipped state.

---

## Task 1: Prisma — add `SKIPPED` to `ItemOutcome` enum

**Files:**
- Modify: `packages/prisma/prisma/schema.prisma:52-58`
- Create: `packages/prisma/prisma/migrations/m_item_outcome_skipped/migration.sql`

- [ ] **Step 1: Edit the Prisma enum**

In `packages/prisma/prisma/schema.prisma` change:

```prisma
enum ItemOutcome {
  PENDING
  DONE_EASY
  DONE_HARD
  DOUBTS
  STUCK
}
```

to:

```prisma
enum ItemOutcome {
  PENDING
  DONE_EASY
  DONE_HARD
  DOUBTS
  STUCK
  SKIPPED
}
```

- [ ] **Step 2: Generate the migration SQL**

Run: `cd packages/prisma && pnpm exec prisma migrate dev --create-only --name item_outcome_skipped`

Expected: Prisma creates `packages/prisma/prisma/migrations/<timestamp>_item_outcome_skipped/migration.sql` containing `ALTER TYPE "ItemOutcome" ADD VALUE 'SKIPPED';`.

- [ ] **Step 3: Rename the migration directory to match convention**

The existing migrations use a single-letter prefix (`a_init`, `b_...`, ..., `l_waitlist_year_and_drop_updates`). Rename the generated directory to `m_item_outcome_skipped`:

```bash
cd packages/prisma/prisma/migrations
mv <timestamp>_item_outcome_skipped m_item_outcome_skipped
```

Also drop the timestamp prefix from the folder Prisma tracks — Prisma accepts any migration folder name as long as `migration.sql` exists inside.

- [ ] **Step 4: Apply the migration to the local DB**

Run: `cd packages/prisma && pnpm exec prisma migrate deploy`

Expected: `1 migration applied`. No errors.

- [ ] **Step 5: Regenerate the Prisma client**

Run: `pnpm db:generate`

Expected: `Generated Prisma Client` with no errors.

- [ ] **Step 6: Verify the enum accepts SKIPPED**

Run:

```bash
source apps/api/.env && psql "$DATABASE_URL" -c "SELECT unnest(enum_range(NULL::\"ItemOutcome\"));"
```

Expected: list contains `SKIPPED`.

- [ ] **Step 7: Commit**

```bash
git add packages/prisma/prisma/schema.prisma packages/prisma/prisma/migrations/m_item_outcome_skipped
git commit -m "feat(prisma): add SKIPPED to ItemOutcome enum"
```

---

## Task 2: Shared — extend `ITEM_OUTCOMES` and `POSITIVE_OUTCOMES`

**Files:**
- Modify: `packages/shared/src/domain/outcome.ts`
- Test: `packages/shared/src/domain/outcome.test.ts` (create if missing)

- [ ] **Step 1: Write failing tests**

Create (or append to) `packages/shared/src/domain/outcome.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  ITEM_OUTCOMES,
  POSITIVE_OUTCOMES,
  isPositiveOutcome,
  isSkipped,
  summarizeOutcomes,
} from './outcome';

describe('ItemOutcome', () => {
  it('includes SKIPPED in the enum', () => {
    expect(ITEM_OUTCOMES).toContain('SKIPPED');
  });

  it('treats SKIPPED as positive', () => {
    expect(POSITIVE_OUTCOMES.has('SKIPPED')).toBe(true);
    expect(isPositiveOutcome('SKIPPED')).toBe(true);
  });

  it('isSkipped is true only for SKIPPED', () => {
    expect(isSkipped('SKIPPED')).toBe(true);
    expect(isSkipped('DONE_EASY')).toBe(false);
    expect(isSkipped('PENDING')).toBe(false);
  });

  it('summarizeOutcomes counts SKIPPED', () => {
    const counts = summarizeOutcomes([{ outcome: 'SKIPPED' }, { outcome: 'DONE_EASY' }]);
    expect(counts.SKIPPED).toBe(1);
    expect(counts.DONE_EASY).toBe(1);
  });
});
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `pnpm --filter @ics-select/shared test`

Expected: test failures (`SKIPPED` missing from `ITEM_OUTCOMES`, `isSkipped` undefined, counts record missing `SKIPPED` key).

- [ ] **Step 3: Extend `outcome.ts`**

Replace the content of `packages/shared/src/domain/outcome.ts` with:

```ts
export const ITEM_OUTCOMES = [
  'PENDING',
  'DONE_EASY',
  'DONE_HARD',
  'DOUBTS',
  'STUCK',
  'SKIPPED',
] as const;

export type ItemOutcome = (typeof ITEM_OUTCOMES)[number];

export const POSITIVE_OUTCOMES: ReadonlySet<ItemOutcome> = new Set([
  'DONE_EASY',
  'DONE_HARD',
  'SKIPPED',
]);

export function isPositiveOutcome(o: ItemOutcome): boolean {
  return POSITIVE_OUTCOMES.has(o);
}

export function isSkipped(o: ItemOutcome): boolean {
  return o === 'SKIPPED';
}

export function summarizeOutcomes(
  items: ReadonlyArray<{ outcome: ItemOutcome }>,
): Record<ItemOutcome, number> {
  const counts: Record<ItemOutcome, number> = {
    PENDING: 0,
    DONE_EASY: 0,
    DONE_HARD: 0,
    DOUBTS: 0,
    STUCK: 0,
    SKIPPED: 0,
  };
  for (const item of items) counts[item.outcome]++;
  return counts;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ics-select/shared test`

Expected: 4 tests pass.

- [ ] **Step 5: Build shared (API consumes compiled output)**

Run: `pnpm --filter @ics-select/shared build`

Expected: `tsc` completes with no errors, `packages/shared/dist/domain/outcome.js` exists.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/domain/outcome.ts packages/shared/src/domain/outcome.test.ts packages/shared/dist
git commit -m "feat(shared): SKIPPED outcome + isSkipped helper"
```

If `packages/shared/dist` is gitignored (check `.gitignore`), only stage the `src` files.

---

## Task 3: Google Calendar — `findEventIdByIcsId` helper

**Files:**
- Modify: `apps/api/src/google-calendar/google-calendar.service.ts`
- Test: `apps/api/src/google-calendar/google-calendar.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/google-calendar/google-calendar.service.spec.ts`:

```ts
describe('findEventIdByIcsId', () => {
  it('returns the event ID when a matching ICS marker exists', async () => {
    const fakeList = jest.fn().mockResolvedValue({
      data: {
        items: [
          { id: 'evt-a', description: 'unrelated' },
          { id: 'evt-b', description: 'ICS ID: plan-1/item-42' },
          { id: 'evt-c', description: 'ICS ID: plan-2/item-1' },
        ],
      },
    });
    const service = buildService({ eventsList: fakeList });

    const id = await service.findEventIdByIcsId('user-1', 'plan-1', 'item-42', {
      start: new Date('2026-04-20'),
      end: new Date('2026-04-27'),
    });

    expect(id).toBe('evt-b');
  });

  it('returns null when no event matches', async () => {
    const fakeList = jest.fn().mockResolvedValue({ data: { items: [] } });
    const service = buildService({ eventsList: fakeList });
    const id = await service.findEventIdByIcsId('user-1', 'plan-1', 'item-42', {
      start: new Date('2026-04-20'),
      end: new Date('2026-04-27'),
    });
    expect(id).toBeNull();
  });
});
```

`buildService` is the test helper already present in this spec file. If it does not expose the `eventsList` hook, extend it minimally so the `events.list` method is stubbable (match the pattern used for `events.insert`).

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern google-calendar.service`

Expected: TypeError / method not found for `findEventIdByIcsId`.

- [ ] **Step 3: Implement the helper**

In `apps/api/src/google-calendar/google-calendar.service.ts`, add:

```ts
async findEventIdByIcsId(
  userId: string,
  planId: string,
  itemId: string,
  range: { start: Date; end: Date },
): Promise<string | null> {
  const client = await this.clientFor(userId);
  const res = await client.events.list({
    calendarId: 'primary',
    timeMin: range.start.toISOString(),
    timeMax: range.end.toISOString(),
    singleEvents: true,
    maxResults: 250,
  });
  const marker = `ICS ID: ${planId}/${itemId}`;
  const hit = (res.data.items ?? []).find((e) =>
    typeof e.description === 'string' && e.description.includes(marker),
  );
  return hit?.id ?? null;
}
```

Place it next to the existing `listEventsInRange` / `deleteEvent` methods so the API groups read/write neighbours.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern google-calendar.service`

Expected: both new tests pass; pre-existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/google-calendar/google-calendar.service.ts apps/api/src/google-calendar/google-calendar.service.spec.ts
git commit -m "feat(google-calendar): find event ID by ICS marker"
```

---

## Task 4: `setItemOutcome` — allow SKIPPED only for foundations + delete Calendar event

**Files:**
- Modify: `apps/api/src/weekly-plans/weekly-plans.service.ts:175-199`
- Create: `apps/api/src/weekly-plans/skip.spec.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/weekly-plans/skip.spec.ts`:

```ts
import { Test } from '@nestjs/testing';
import { PrismaService } from '../common/prisma/prisma.service';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';
import { WeeklyPlansService } from './weekly-plans.service';

describe('WeeklyPlansService.setItemOutcome — SKIPPED', () => {
  const calendar = {
    findEventIdByIcsId: jest.fn(),
    deleteEvent: jest.fn(),
  };

  const buildPrisma = (item: {
    planId: string;
    userId: string;
    planStatus: 'DRAFT' | 'PUBLISHED';
    topicSlugs: string[];
    weekStartsAt: Date;
    weekEndsAt: Date;
  }) => ({
    weeklyPlanItem: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'item-1',
        weeklyPlan: {
          id: item.planId,
          userId: item.userId,
          status: item.planStatus,
          startsAt: item.weekStartsAt,
          endsAt: item.weekEndsAt,
        },
        libraryItem: {
          topics: item.topicSlugs.map((slug) => ({ topic: { slug } })),
        },
      }),
      update: jest.fn().mockResolvedValue({ id: 'item-1', outcome: 'SKIPPED' }),
    },
  });

  const build = (prisma: unknown) => {
    return new WeeklyPlansService(prisma as PrismaService, calendar as unknown as GoogleCalendarService);
  };

  beforeEach(() => {
    calendar.findEventIdByIcsId.mockReset();
    calendar.deleteEvent.mockReset();
  });

  it('rejects SKIPPED on a non-foundations item', async () => {
    const prisma = buildPrisma({
      planId: 'p1',
      userId: 'u1',
      planStatus: 'DRAFT',
      topicSlugs: ['sorting'],
      weekStartsAt: new Date('2026-04-20'),
      weekEndsAt: new Date('2026-04-27'),
    });
    const service = build(prisma);
    await expect(
      service.setItemOutcome('item-1', 'u1', { outcome: 'SKIPPED' }),
    ).rejects.toThrow(/only foundations items can be skipped/i);
  });

  it('accepts SKIPPED on a foundations item and skips Calendar cleanup when plan is DRAFT', async () => {
    const prisma = buildPrisma({
      planId: 'p1',
      userId: 'u1',
      planStatus: 'DRAFT',
      topicSlugs: ['foundations'],
      weekStartsAt: new Date('2026-04-20'),
      weekEndsAt: new Date('2026-04-27'),
    });
    const service = build(prisma);
    await service.setItemOutcome('item-1', 'u1', { outcome: 'SKIPPED' });
    expect(calendar.findEventIdByIcsId).not.toHaveBeenCalled();
    expect(calendar.deleteEvent).not.toHaveBeenCalled();
  });

  it('accepts SKIPPED on a foundations item in PUBLISHED plan and deletes the Calendar event', async () => {
    const prisma = buildPrisma({
      planId: 'p1',
      userId: 'u1',
      planStatus: 'PUBLISHED',
      topicSlugs: ['sorting', 'foundations'],
      weekStartsAt: new Date('2026-04-20'),
      weekEndsAt: new Date('2026-04-27'),
    });
    calendar.findEventIdByIcsId.mockResolvedValue('evt-99');
    const service = build(prisma);
    await service.setItemOutcome('item-1', 'u1', { outcome: 'SKIPPED' });
    expect(calendar.findEventIdByIcsId).toHaveBeenCalledWith(
      'u1',
      'p1',
      'item-1',
      { start: expect.any(Date), end: expect.any(Date) },
    );
    expect(calendar.deleteEvent).toHaveBeenCalledWith('u1', 'evt-99');
  });

  it('tolerates missing Calendar event on PUBLISHED skip', async () => {
    const prisma = buildPrisma({
      planId: 'p1',
      userId: 'u1',
      planStatus: 'PUBLISHED',
      topicSlugs: ['foundations'],
      weekStartsAt: new Date('2026-04-20'),
      weekEndsAt: new Date('2026-04-27'),
    });
    calendar.findEventIdByIcsId.mockResolvedValue(null);
    const service = build(prisma);
    await expect(
      service.setItemOutcome('item-1', 'u1', { outcome: 'SKIPPED' }),
    ).resolves.toBeDefined();
    expect(calendar.deleteEvent).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern skip.spec`

Expected: failures — service either doesn't accept `SKIPPED`, doesn't validate topics, or doesn't call Calendar.

- [ ] **Step 3: Update `setItemOutcome`**

Replace the body of `setItemOutcome` in `apps/api/src/weekly-plans/weekly-plans.service.ts` (current lines 175-199) with:

```ts
async setItemOutcome(
  itemId: string,
  userId: string,
  input: { outcome: ItemOutcome; reflection?: string | null },
) {
  const item = await this.prisma.weeklyPlanItem.findUnique({
    where: { id: itemId },
    include: {
      weeklyPlan: { select: { id: true, userId: true, status: true, startsAt: true, endsAt: true } },
      libraryItem: { include: { topics: { include: { topic: { select: { slug: true } } } } } },
    },
  });
  if (!item) throw new NotFoundException('Item not found');
  if (item.weeklyPlan.userId !== userId) {
    throw new ForbiddenException("Forbidden: cannot change someone else's item");
  }

  if (input.outcome === 'SKIPPED') {
    const slugs = item.libraryItem.topics.map((t) => t.topic.slug);
    if (!slugs.includes('foundations')) {
      throw new ForbiddenException('Only foundations items can be skipped');
    }
    if (item.weeklyPlan.status === 'PUBLISHED') {
      const eventId = await this.calendar.findEventIdByIcsId(
        userId,
        item.weeklyPlan.id,
        item.id,
        { start: item.weeklyPlan.startsAt, end: item.weeklyPlan.endsAt },
      );
      if (eventId) {
        try {
          await this.calendar.deleteEvent(userId, eventId);
        } catch {
          // swallow, matches PublicationService style
        }
      }
    }
  }

  const completed = input.outcome !== 'PENDING';

  return this.prisma.weeklyPlanItem.update({
    where: { id: itemId },
    data: {
      outcome: input.outcome,
      reflection: input.reflection ?? undefined,
      completedAt: completed ? new Date() : null,
    },
  });
}
```

Also add `private readonly calendar: GoogleCalendarService` to the constructor of `WeeklyPlansService` and import `GoogleCalendarService` + `ItemOutcome` at the top of the file. Register `GoogleCalendarModule` as an import of `WeeklyPlansModule` (check `weekly-plans.module.ts` and add if missing).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern skip.spec`

Expected: 4 tests pass.

- [ ] **Step 5: Run the full API test suite**

Run: `pnpm --filter @ics-select/api test`

Expected: all existing tests still pass. If `weekly-plans.service.spec.ts` breaks because the constructor signature changed, update the test's `new WeeklyPlansService(...)` construction to pass a minimal Calendar stub.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/weekly-plans/
git commit -m "feat(weekly-plans): accept SKIPPED for foundations + Calendar cleanup"
```

---

## Task 5: `PublicationService` — don't schedule SKIPPED items

**Files:**
- Modify: `apps/api/src/weekly-plans/publication.service.ts` (around lines 90-130 where items are iterated)
- Modify: `apps/api/src/weekly-plans/publication.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/weekly-plans/publication.service.spec.ts`:

```ts
describe('publish — SKIPPED items', () => {
  it('skips scheduling and Calendar creation for items with outcome SKIPPED', async () => {
    // Arrange: plan with 2 items, one already SKIPPED, one PENDING.
    const plan = buildPlan({
      items: [
        { id: 'i1', outcome: 'SKIPPED', preferredSessionMinutes: 30 },
        { id: 'i2', outcome: 'PENDING', preferredSessionMinutes: 30 },
      ],
    });
    // ... (use the existing helpers in this spec file for scheduler + calendar spies)
    await service.publish(plan.id, { force: false });

    // Assert: scheduler received only 'i2'
    expect(schedulerMock.plan).toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([expect.objectContaining({ id: 'i2' })]),
      }),
    );
    expect(schedulerMock.plan).not.toHaveBeenCalledWith(
      expect.objectContaining({
        items: expect.arrayContaining([expect.objectContaining({ id: 'i1' })]),
      }),
    );
    expect(calendarMock.createEvent).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ icsId: { planId: plan.id, itemId: 'i1' } }),
    );
  });
});
```

Adapt `buildPlan`, `schedulerMock`, and `calendarMock` to the helpers already present at the top of the spec file. If they do not exist with these exact names, reuse whatever the current tests use.

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern publication.service`

Expected: scheduler sees both items, test fails.

- [ ] **Step 3: Add the filter in `PublicationService.publish`**

In `apps/api/src/weekly-plans/publication.service.ts`, right before the block that forwards items to the scheduler, add:

```ts
const schedulableItems = plan.items.filter((i) => i.outcome !== 'SKIPPED');
```

Then change the scheduler call to pass `schedulableItems` instead of `plan.items`. The `createEvent` loop should iterate over the scheduler output chunks (which originate from `schedulableItems`), so no separate change is needed there.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern publication.service`

Expected: new test passes, existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/weekly-plans/publication.service.ts apps/api/src/weekly-plans/publication.service.spec.ts
git commit -m "feat(weekly-plans): skip scheduling for SKIPPED items on publish"
```

---

## Task 6: Coverage helpers — count `SKIPPED` as positive

**Files:**
- Modify (6 files, all contain `const POSITIVE = new Set(['DONE_EASY', 'DONE_HARD']);` or inline equivalent):
  - `apps/api/src/admin/cycle/cycle-overview.service.ts:5`
  - `apps/api/src/admin/plans-overview/plans-overview.service.ts:5`
  - `apps/api/src/admin/triage/triage.service.ts:50`
  - `apps/api/src/admin/member-detail/member-detail.service.ts:8`
  - `apps/api/src/admin/plan-context/plan-context.service.ts:9`
  - `apps/api/src/ai/draft-plan.service.ts:151` (inline condition)
- Modify: `apps/api/src/weekly-plans/weekly-plans.service.ts:133` (inline condition)
- Modify: `apps/api/src/admin-dashboard/admin-dashboard.service.ts:28,65,82`

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/weekly-plans/skip.spec.ts`:

```ts
describe('SKIPPED counts as completed across services', () => {
  it('weekly-plans done-count includes SKIPPED', async () => {
    const prisma = {
      weeklyPlan: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'p1',
          userId: 'u1',
          items: [
            { id: 'a', outcome: 'DONE_EASY' },
            { id: 'b', outcome: 'SKIPPED' },
            { id: 'c', outcome: 'PENDING' },
          ],
        }),
      },
    };
    const service = new WeeklyPlansService(
      prisma as unknown as PrismaService,
      { findEventIdByIcsId: jest.fn(), deleteEvent: jest.fn() } as unknown as GoogleCalendarService,
    );
    const summary = await service.summaryFor('u1');
    // assert the 'done' number equals 2 (DONE_EASY + SKIPPED)
    expect(summary.done).toBe(2);
  });
});
```

Adjust to the existing shape of the summary method if it's named differently (the snippet reflects the pattern at `weekly-plans.service.ts:133`).

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern skip.spec`

Expected: `summary.done` is 1, fails.

- [ ] **Step 3: Update every POSITIVE set**

For each of the 5 files with a `POSITIVE` set, replace:

```ts
const POSITIVE = new Set(['DONE_EASY', 'DONE_HARD']);
```

with:

```ts
const POSITIVE = new Set<ItemOutcome>(['DONE_EASY', 'DONE_HARD', 'SKIPPED']);
```

Import `ItemOutcome` from `@ics-select/shared` in each file if not already imported.

For `apps/api/src/weekly-plans/weekly-plans.service.ts:133`, replace:

```ts
const done = currentPlan?.items.filter((i) => i.outcome === 'DONE_EASY' || i.outcome === 'DONE_HARD').length ?? 0;
```

with:

```ts
const done = currentPlan?.items.filter((i) => isPositiveOutcome(i.outcome)).length ?? 0;
```

(Import `isPositiveOutcome` from `@ics-select/shared`.)

For `apps/api/src/ai/draft-plan.service.ts:151` and similar inline comparisons, use `isPositiveOutcome(item.outcome)`.

For `apps/api/src/admin-dashboard/admin-dashboard.service.ts`:
- Line 28: change `outcome: { in: ['DONE_EASY', 'DONE_HARD'] }` to `outcome: { in: ['DONE_EASY', 'DONE_HARD', 'SKIPPED'] }`.
- Lines 65 and 82: replace `item.outcome === 'DONE_EASY' || item.outcome === 'DONE_HARD'` with `isPositiveOutcome(item.outcome)`.

- [ ] **Step 4: Run the full API test suite**

Run: `pnpm --filter @ics-select/api test`

Expected: new test passes; no prior test regresses.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/
git commit -m "feat(api): count SKIPPED as positive across coverage helpers"
```

---

## Task 7: Expose `skippable` flag in plan-detail responses

**Files:**
- Modify: `apps/api/src/weekly-plans/weekly-plans.service.ts` (read path near line 160) + `dto.ts`
- Modify: `apps/api/src/admin/plan-context/plan-context.service.ts` (if it also returns items to the admin UI — check before editing)

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/weekly-plans/skip.spec.ts`:

```ts
describe('plan read — skippable flag', () => {
  it('sets skippable=true when foundations is in item topics', async () => {
    const prisma = {
      weeklyPlan: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p1',
          userId: 'u1',
          items: [
            {
              id: 'i1',
              libraryItem: { topics: [{ topic: { slug: 'sorting' } }] },
            },
            {
              id: 'i2',
              libraryItem: {
                topics: [{ topic: { slug: 'array' } }, { topic: { slug: 'foundations' } }],
              },
            },
          ],
        }),
      },
    };
    const service = new WeeklyPlansService(
      prisma as unknown as PrismaService,
      { findEventIdByIcsId: jest.fn(), deleteEvent: jest.fn() } as unknown as GoogleCalendarService,
    );
    const plan = await service.getPlanDetail('p1', 'u1');
    expect(plan.items[0].skippable).toBe(false);
    expect(plan.items[1].skippable).toBe(true);
  });
});
```

If the read method has a different name, use whatever the controller calls. The shape expected is `{ items: [{ id, skippable, ... }] }`.

- [ ] **Step 2: Run the test to confirm it fails**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern skip.spec`

Expected: `skippable` undefined, fails.

- [ ] **Step 3: Shape the read response**

In the read method in `weekly-plans.service.ts`, change the Prisma include to:

```ts
include: {
  items: {
    include: {
      libraryItem: {
        include: { topics: { include: { topic: { select: { slug: true } } } } },
      },
    },
    orderBy: { order: 'asc' },
  },
},
```

Then after loading, map items to attach `skippable`:

```ts
const shaped = plan.items.map((i) => ({
  ...i,
  skippable: i.libraryItem.topics.some((t) => t.topic.slug === 'foundations'),
}));
return { ...plan, items: shaped };
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern skip.spec`

Expected: the new case passes.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/weekly-plans/
git commit -m "feat(weekly-plans): expose skippable per item in plan-detail"
```

---

## Task 8: Shared UI — `OutcomePicker` + `OutcomeDot` support `SKIPPED`

**Files:**
- Modify: `apps/web/components/ui/outcome-dot.tsx`
- Modify: `apps/web/components/ui/outcome-picker.tsx`

- [ ] **Step 1: Extend `outcome-dot.tsx`**

Read the file and add a `SKIPPED` branch that renders a muted gray dot using the existing `--ink-mute` token (design-system.md):

```tsx
if (outcome === 'SKIPPED') {
  return <span className={cn('inline-block rounded-full bg-ink-mute', sizeClasses[size])} />;
}
```

(Mirror the conditional branches already in place for other outcomes; use the same size classes.)

- [ ] **Step 2: Extend `outcome-picker.tsx`**

Add a new option for `SKIPPED`, visible only when the parent passes `showSkip={true}`:

```tsx
{showSkip && (
  <button
    onClick={() => onChange('SKIPPED')}
    className={cn(
      'flex items-center gap-2 rounded-lg border border-rule px-3 py-2 text-sm text-ink-soft hover:bg-paper-warm',
      value === 'SKIPPED' && 'border-ink bg-paper-warm',
    )}
  >
    <OutcomeDot outcome="SKIPPED" size="sm" />
    Already known
  </button>
)}
```

Also extend the component's props type:

```tsx
type Props = {
  value: ItemOutcome | null;
  onChange: (o: ItemOutcome) => void;
  showSkip?: boolean;
};
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/ui/outcome-dot.tsx apps/web/components/ui/outcome-picker.tsx
git commit -m "feat(web): SKIPPED in OutcomeDot + OutcomePicker"
```

---

## Task 9: Member `item-focus` — "I already know this" action + undo

**Files:**
- Modify: `apps/web/components/member/item-focus.tsx`
- Modify: `apps/web/components/member/day-list.tsx:23,56`
- Modify: `apps/web/components/member/day-ring-card.tsx:14-29`

- [ ] **Step 1: Thread `skippable` through the item type used by the member UI**

The plan-detail query that drives the member UI needs to include the new field. Find the TanStack Query hook that loads the weekly plan (likely `apps/web/lib/queries/member-plan.ts` or similar — grep for `/plans/` or `getPlanDetail`). Extend its item type with `skippable: boolean`.

- [ ] **Step 2: Render the skip action in `item-focus.tsx`**

In `apps/web/components/member/item-focus.tsx`, near the existing outcome section, render the skip button only when `item.skippable` is true AND outcome is `PENDING`:

```tsx
{item.skippable && outcome === null && (
  <button
    onClick={async () => {
      if (!confirm('Marcar como já sabido? Você pode desfazer depois.')) return;
      await setOutcome('SKIPPED');
    }}
    className="text-sm text-ink-mute underline-offset-4 hover:underline"
  >
    I already know this
  </button>
)}
```

Render a muted "Already known" state + undo when `outcome === 'SKIPPED'`:

```tsx
{item.outcome === 'SKIPPED' && (
  <div className="flex items-center gap-2 text-ink-mute">
    <OutcomeDot outcome="SKIPPED" size="sm" />
    <span className="text-sm">Already known</span>
    <button onClick={() => setOutcome('PENDING')} className="text-xs underline">
      Undo
    </button>
  </div>
)}
```

Use whatever mutation hook the file currently uses to set outcomes — do not introduce a new one.

- [ ] **Step 3: Collapse `SKIPPED` in `day-list.tsx`**

In `apps/web/components/member/day-list.tsx:23`, extend the "next up" filter so SKIPPED items are never surfaced as the next action. In the same file, around line 56, render SKIPPED rows with a muted style (strikethrough + `text-ink-mute`) or group them under an "already known" section.

- [ ] **Step 4: Count SKIPPED in `day-ring-card.tsx`**

In `apps/web/components/member/day-ring-card.tsx:25`, change:

```tsx
(i) => i.outcome === 'DONE_EASY' || i.outcome === 'DONE_HARD',
```

to:

```tsx
(i) => isPositiveOutcome(i.outcome),
```

and import `isPositiveOutcome` from `@ics-select/shared`.

- [ ] **Step 5: Typecheck + run existing unit tests**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/member/ apps/web/lib/queries/
git commit -m "feat(web): member 'I already know this' action + SKIPPED rendering"
```

---

## Task 10: Admin plan editor — `skippable` badge

**Files:**
- Modify: `apps/web/lib/queries/admin-plan-editor.ts:9`
- Modify: `apps/web/app/(admin)/admin/member/[id]/plan/[planId]/page.tsx`

- [ ] **Step 1: Extend the admin query type**

In `apps/web/lib/queries/admin-plan-editor.ts:9`, change:

```ts
outcome: 'PENDING' | 'DONE_EASY' | 'DONE_HARD' | 'DOUBTS' | 'STUCK';
```

to:

```ts
outcome: ItemOutcome;
skippable: boolean;
```

with `import type { ItemOutcome } from '@ics-select/shared';` at the top.

- [ ] **Step 2: Render the badge**

In `apps/web/app/(admin)/admin/member/[id]/plan/[planId]/page.tsx`, locate where each draft item is rendered in the list. Add a compact pill next to the title:

```tsx
{item.skippable && (
  <span className="rounded-full border border-rule bg-paper-warm px-2 py-0.5 text-xs font-mono uppercase tracking-label text-ink-mute">
    skippable
  </span>
)}
```

Follow the palette from `docs/design-system.md` — gray tokens, no accent color; the badge is informational.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/queries/admin-plan-editor.ts "apps/web/app/(admin)/admin/member/[id]/plan/[planId]/page.tsx"
git commit -m "feat(admin): skippable badge on plan draft items"
```

---

## Task 11: Admin cohort / dashboard — show `SKIPPED` count

**Files:**
- Modify: `apps/api/src/admin-dashboard/admin-dashboard.service.ts` (add `skippedCount` alongside `doneCount`)
- Modify: the web component that renders the admin home's progress column (grep for `doneCount` under `apps/web/components/admin/`)

- [ ] **Step 1: Emit `skippedCount` from the service**

In `apps/api/src/admin-dashboard/admin-dashboard.service.ts` around line 82, where `doneCount` is computed, add:

```ts
const skippedCount = p.items.filter((i) => i.outcome === 'SKIPPED').length;
```

and include it in the returned object. Keep `doneCount` as `filter((i) => isPositiveOutcome(i.outcome))` (already fixed in Task 6) — but note that `doneCount` already includes `SKIPPED` after Task 6, so document this behavior or rename to `coveredCount` + keep `doneCount` as "real wins only" (`DONE_EASY` + `DONE_HARD`). **Choose one:**
- Option A (simpler): `doneCount` = positive (incl. `SKIPPED`); add `skippedCount` as a sub-breakdown. UI shows e.g. `5 done (2 skipped)`.
- Option B: split into `doneCount` (`DONE_EASY` + `DONE_HARD`) and `skippedCount`. UI shows two numbers.

**Plan uses Option A** — simplest, matches the spec's D6 (skip counts toward completion), and still surfaces the number separately via `skippedCount`.

- [ ] **Step 2: Extend the web component**

Grep for the component that reads `doneCount` from the admin dashboard response. Add rendering for `skippedCount` next to it:

```tsx
<span className="text-ink">
  {doneCount}
  {skippedCount > 0 && (
    <span className="ml-1 text-xs text-ink-mute">({skippedCount} skipped)</span>
  )}
</span>
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck && pnpm --filter @ics-select/api typecheck`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/admin-dashboard/admin-dashboard.service.ts apps/web/components/admin/
git commit -m "feat(admin): surface SKIPPED count on cohort progress"
```

---

## Task 12: Playwright end-to-end smoke

**Files:**
- Create: `apps/web/tests/member-skip.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from '@playwright/test';

test('member skips a foundations item', async ({ page }) => {
  await page.goto('/login');
  // reuse the existing auth helper; if the project stubs Google OAuth in tests,
  // call whatever setup other tests use (grep test helpers).

  await page.goto('/me/plan');
  const firstFoundations = page.getByRole('button', { name: /I already know this/i }).first();
  await expect(firstFoundations).toBeVisible();

  page.on('dialog', (d) => d.accept());
  await firstFoundations.click();

  await expect(page.getByText(/Already known/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Undo/i })).toBeVisible();
});
```

If the project uses a different seed/login strategy for Playwright, match that pattern — see `apps/web/tests/auth-flow.spec.ts` (mentioned in CLAUDE.md).

- [ ] **Step 2: Run Playwright**

Run: `pnpm --filter @ics-select/web test tests/member-skip.spec.ts`

Expected: PASS. If the member plan UI isn't ready in the repo yet (per CLAUDE.md, PR 2 rebuilds `/me/plan`), mark this task's step as deferred and land it when that surface ships.

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests/member-skip.spec.ts
git commit -m "test(web): e2e smoke for foundations skip"
```

---

## Task 13: Final verification

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`

Expected: all green.

- [ ] **Step 2: Run lint + typecheck**

Run: `pnpm lint && pnpm typecheck`

Expected: no errors.

- [ ] **Step 3: Manual smoke in dev**

Run: `pnpm dev` and in another shell verify:

```bash
# set a foundations item to SKIPPED via the API
curl -X PATCH http://localhost:3001/plans/<plan-id>/items/<item-id>/outcome \
  -H "Cookie: <auth cookie>" \
  -H "Content-Type: application/json" \
  -d '{"outcome":"SKIPPED"}'
```

Expected: 200 with the updated item; Google Calendar event (if plan was published) is gone.

Also try skipping a non-foundations item — expect 403 `Only foundations items can be skipped`.

- [ ] **Step 4: Push + open PR**

Run (only after explicit user approval):

```bash
git push -u origin feat/foundations-skip
gh pr create --base main --title "feat: foundations skip mechanism" \
  --body "$(cat <<'EOF'
## Summary
- Adds SKIPPED outcome to ItemOutcome enum
- Members can mark foundations items as 'already known' — counts toward topic completion, zero Calendar time
- Admins see a 'skippable' hint on draft items + a separate SKIPPED count on cohort progress

## Test plan
- [ ] Foundations item → SKIPPED works from member UI, Calendar event deleted
- [ ] Non-foundations item → SKIPPED returns 403
- [ ] Draft plan with SKIPPED items is published without scheduling them
- [ ] Admin cohort view shows SKIPPED count next to done count
- [ ] Undo from SKIPPED back to PENDING works
EOF
)"
```

---

## Self-review

- **Spec coverage.** Every spec decision D1–D7 maps to a task:
  - D1 (SKIPPED enum) → Tasks 1, 2
  - D2 (any topic in topicSlugs) → Task 4 (validation), Task 7 (read shape)
  - D3 (member + admin) → Task 9 (member UI), Task 10 (admin UI)
  - D4 (reversible) → Task 9 (undo button)
  - D5 (Calendar impact, 3 cases) → Task 4 (post-publish delete), Task 5 (draft publish skip), Task 9 (unskip returns to PENDING, no auto-schedule)
  - D6 (counts toward completion) → Tasks 2, 6
  - D7 (separate SKIPPED count admin-side) → Task 11
- **Placeholder scan.** No "TBD"/"implement later" left. Task 12 flags a legitimate deferral (member UI revamp may not be merged) rather than hiding work.
- **Type consistency.** `ItemOutcome` sourced consistently from `@ics-select/shared`. `isPositiveOutcome` used uniformly across API and web where a previously inline check lived. `skippable: boolean` used the same way in API response, admin query, and member UI.

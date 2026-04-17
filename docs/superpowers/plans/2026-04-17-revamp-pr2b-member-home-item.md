# PR 2b — Member Home + Item Page (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the member's daily loop — backend `GET /me/home` + `GET /me/item/:id`, frontend `/me` (daily home: hero + today list + rest-of-week), `/me/plan` (full week list), `/me/item/[id]` (focus page with outcome picker + reflection). Set up Playwright in the web package and lock visual baselines.

**Architecture:** 
- **Small schema add:** `WeeklyPlanItem.scheduledAt: DateTime?` and `scheduledMinutes: Int?`. These let the UI show a planned time without round-tripping to Google Calendar on every page view. Calendar events remain source-of-truth for *actual* reminders (PR 3), but the app caches the planned time from the scheduler output for fast display.
- **Hero logic** (on the home) picks the most-relevant item by comparing `scheduledAt` to `now()`. States: `up_next`, `now`, `running_late`, `all_done`, `free_day`.
- **Streak** is computed server-side: count of consecutive days with at least one `DONE_EASY | DONE_HARD` outcome, ending at or before today. Breaks on 2+ consecutive zero-positive days.
- **Feed ambient** (cohort activity strip) is **deferred to PR 2c** (which ships `/me/cohort` with full feed + ranking). Home omits the feed in this PR — layout reserves no space for it yet.
- **Playwright setup** becomes part of PR 2b because the plan for PR 2a Task 14 was blocked by its absence. This PR installs it, configures `webServer`, and adds specs.

**Tech Stack:** NestJS 10 + Prisma 5 · Next.js 15 App Router · TanStack Query · lucide-react · Framer Motion · Playwright 1.x · Magazine Editorial primitives from PR 2a.

**Reference spec:** `docs/superpowers/specs/2026-04-16-revamp-design.md` sections §4.1 (home), §4.2 (week plan), §4.3 (item page).

**Out of scope in this PR:** `/me/cohort`, `/me/retro`, `/me/settings`, `/me/onboarding`, admin pages (PR 3), IA deepening (PR 4), retro cron, reminder cron rewrite (PR 3), WhatsApp phone collection (PR 2c with settings).

---

## File Structure

### Created

- `packages/prisma/prisma/migrations/12_weekly_plan_item_schedule/migration.sql`
- `apps/api/src/me/home/home.service.ts`
- `apps/api/src/me/home/home.service.spec.ts`
- `apps/api/src/me/home/home.controller.ts`
- `apps/api/src/me/home/home.module.ts`
- `apps/api/src/me/item/item.service.ts`
- `apps/api/src/me/item/item.service.spec.ts`
- `apps/api/src/me/item/item.controller.ts`
- `apps/api/src/me/item/item.module.ts`
- `apps/web/lib/queries/me-home.ts`
- `apps/web/lib/queries/me-item.ts`
- `apps/web/lib/format/time.ts`
- `apps/web/lib/format/platform.ts`
- `apps/web/app/(member)/page.tsx` (replaces `/home` — this PR consolidates to `/me`)
- `apps/web/app/(member)/me/page.tsx`
- `apps/web/app/(member)/me/plan/page.tsx`
- `apps/web/app/(member)/me/item/[id]/page.tsx`
- `apps/web/components/member/home-hero.tsx`
- `apps/web/components/member/day-list.tsx`
- `apps/web/components/member/week-list.tsx`
- `apps/web/components/member/item-focus.tsx`
- `apps/web/playwright.config.ts`
- `apps/web/tests/me-home.spec.ts`
- `apps/web/tests/me-item.spec.ts`

### Modified

- `packages/prisma/prisma/schema.prisma`
- `apps/api/src/scheduler/scheduler.service.ts` (populate `scheduledAt` + `scheduledMinutes`)
- `apps/api/src/weekly-plans/publication.service.ts` (pass through the new fields)
- `apps/api/src/me/me.module.ts` (import the two new modules)
- `apps/api/src/app.module.ts` (only if `MeModule` isn't already wired)
- `apps/web/package.json` (add `@playwright/test`, `test` + `test:update` scripts)
- `apps/web/app/page.tsx` (redirect members to `/me` not `/home`)
- `apps/web/components/member-shell/topbar-member.tsx` (Today → `/me`)
- `apps/web/components/member-shell/bottom-tab-bar.tsx` (Today → `/me`)

### Deleted

- `apps/web/app/(member)/home/` (the placeholder route is replaced by `/me`)

---

## Tasks

### Task 1: Migration 12 — `scheduledAt` + `scheduledMinutes` on `WeeklyPlanItem`

**Files:**
- Create: `packages/prisma/prisma/migrations/12_weekly_plan_item_schedule/migration.sql`
- Modify: `packages/prisma/prisma/schema.prisma`

- [ ] **Step 1: Create the migration file**

Run:

```bash
mkdir -p packages/prisma/prisma/migrations/12_weekly_plan_item_schedule
```

Write `packages/prisma/prisma/migrations/12_weekly_plan_item_schedule/migration.sql`:

```sql
-- Cache the scheduler's planned time on each WeeklyPlanItem so the UI
-- can show "19:00 · 45m" without round-tripping to Google Calendar.
-- Calendar events remain source-of-truth for reminders (PR 3).

ALTER TABLE "WeeklyPlanItem"
  ADD COLUMN "scheduledAt" TIMESTAMP(3),
  ADD COLUMN "scheduledMinutes" INTEGER;

CREATE INDEX "WeeklyPlanItem_scheduledAt_idx"
  ON "WeeklyPlanItem"("scheduledAt");
```

- [ ] **Step 2: Update `packages/prisma/prisma/schema.prisma`**

Locate the `WeeklyPlanItem` model and add the two new fields:

```prisma
model WeeklyPlanItem {
  id                String      @id @default(cuid())
  weeklyPlanId      String
  libraryItemId     String
  order             Int
  outcome           ItemOutcome @default(PENDING)
  reflection        String?
  completedAt       DateTime?
  carriedFromItemId String?
  scheduledAt       DateTime?
  scheduledMinutes  Int?

  weeklyPlan  WeeklyPlan       @relation(fields: [weeklyPlanId], references: [id], onDelete: Cascade)
  libraryItem LibraryItem      @relation(fields: [libraryItemId], references: [id])
  carriedFrom WeeklyPlanItem?  @relation("carry", fields: [carriedFromItemId], references: [id])
  carriedTo   WeeklyPlanItem[] @relation("carry")
  @@unique([weeklyPlanId, order])
  @@index([scheduledAt])
}
```

- [ ] **Step 3: Apply + regenerate**

```bash
docker compose up -d postgres
pnpm db:deploy
pnpm db:generate
```

Expected: migration 12 applies cleanly, client regenerates with new fields.

- [ ] **Step 4: Commit**

```bash
git add packages/prisma/prisma/migrations/12_weekly_plan_item_schedule packages/prisma/prisma/schema.prisma
git commit -m "feat(prisma): add scheduledAt + scheduledMinutes to WeeklyPlanItem"
```

---

### Task 2: Scheduler populates `scheduledAt` + `scheduledMinutes`

**Files:**
- Modify: `apps/api/src/scheduler/scheduler.service.ts`
- Modify: `apps/api/src/scheduler/scheduler.service.spec.ts`
- Modify: `apps/api/src/weekly-plans/publication.service.ts`

Context: `SchedulerService.plan` already outputs chunks with a start time per chunk. We need to surface that time on each `WeeklyPlanItem` row. For items that are split across multiple chunks, use the first chunk's start time.

- [ ] **Step 1: Read the current scheduler output shape**

```bash
grep -n "return\|interface.*Scheduler\|type.*Scheduler\|export " apps/api/src/scheduler/scheduler.service.ts
```

Expected: see the scheduler's output — an object with `chunks: Array<{itemId, startAt, minutes}>` or similar shape, plus an `overflow` array.

- [ ] **Step 2: Update `publication.service.ts` to write the new fields per item**

Locate the block in `autoSchedule` that processes scheduler output. After the loop that creates Calendar events, compute for each item:
- `scheduledAt` = earliest `startAt` among that item's chunks (or `null` if in overflow).
- `scheduledMinutes` = sum of minutes across its chunks (`estimatedMinutes` if not chunked).

Update each `WeeklyPlanItem` via `prisma.weeklyPlanItem.update`:

```typescript
// Inside autoSchedule, after scheduler.plan(...) and Calendar event creation:
const chunksByItem = new Map<string, { startAt: Date; minutes: number }[]>();
for (const chunk of schedulerOutput.chunks) {
  const arr = chunksByItem.get(chunk.itemId) ?? [];
  arr.push({ startAt: chunk.startAt, minutes: chunk.minutes });
  chunksByItem.set(chunk.itemId, arr);
}
for (const [itemId, chunks] of chunksByItem) {
  chunks.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const scheduledAt = chunks[0].startAt;
  const scheduledMinutes = chunks.reduce((sum, c) => sum + c.minutes, 0);
  await this.prisma.weeklyPlanItem.update({
    where: { id: itemId },
    data: { scheduledAt, scheduledMinutes },
  });
}
```

Adapt the property names (`itemId` / `startAt` / `minutes`) to match the scheduler's actual output shape.

- [ ] **Step 3: Update existing publication tests**

The existing spec mocks `scheduler.plan()` output. Add to the mock: ensure chunks have a usable `startAt` (e.g. `new Date('2026-04-21T13:00:00Z')`) so the update call receives real dates. Assert that `prisma.weeklyPlanItem.update` is called with `scheduledAt` and `scheduledMinutes` for each item.

- [ ] **Step 4: Run the publication tests**

```bash
pnpm --filter @ics-select/api test -- --testPathPattern publication.service.spec
```

Expected: all tests pass.

- [ ] **Step 5: Full API test suite**

```bash
pnpm --filter @ics-select/api test
```

Expected: 86/86 + any new assertions.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/scheduler apps/api/src/weekly-plans/publication.service.ts apps/api/src/weekly-plans/publication.service.spec.ts
git commit -m "feat(scheduler): persist scheduledAt + scheduledMinutes on each WeeklyPlanItem"
```

---

### Task 3: Backend `GET /me/home` — service + controller + tests

**Files:**
- Create: `apps/api/src/me/home/home.service.ts`
- Create: `apps/api/src/me/home/home.service.spec.ts`
- Create: `apps/api/src/me/home/home.controller.ts`
- Create: `apps/api/src/me/home/home.module.ts`
- Modify: `apps/api/src/me/me.module.ts` (import HomeModule)

Response shape:

```typescript
type HomeResponse = {
  hero:
    | { state: 'now'; item: HomeItem }
    | { state: 'up_next'; item: HomeItem; minutesUntil: number }
    | { state: 'running_late'; item: HomeItem; minutesLate: number }
    | { state: 'all_done'; nextAt: string | null }  // ISO, the next scheduledAt across all days
    | { state: 'free_day'; nextAt: string | null }
    | null;  // no active plan
  today: HomeItem[];
  days: { label: string /* e.g. "Fri, Apr 18" */; date: string /* ISO YYYY-MM-DD */; items: HomeItem[] }[];
  streak: { current: number; last7: boolean[] };
};

type HomeItem = {
  id: string;              // WeeklyPlanItem id
  planId: string;
  order: number;
  title: string;
  format: ItemFormat;
  estimatedMinutes: number;
  url: string | null;
  topic: { slug: string; label: string } | null;
  outcome: ItemOutcome;
  scheduledAt: string | null;  // ISO
  scheduledMinutes: number | null;
  carriedFromItemId: string | null;
};
```

- [ ] **Step 1: Write the service (TDD — test first)**

Write `apps/api/src/me/home/home.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { HomeService } from './home.service';
import { PrismaService } from '../../prisma/prisma.service';

const makePrismaMock = () => ({
  weeklyPlan: {
    findFirst: jest.fn(),
  },
  weeklyPlanItem: {
    findMany: jest.fn(),
  },
});

describe('HomeService', () => {
  let service: HomeService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    const mod = await Test.createTestingModule({
      providers: [HomeService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = mod.get(HomeService);
  });

  it('returns null hero when no active plan', async () => {
    prisma.weeklyPlan.findFirst.mockResolvedValue(null);
    const result = await service.getHome('user-1', new Date('2026-04-17T19:00:00Z'));
    expect(result.hero).toBeNull();
    expect(result.today).toEqual([]);
    expect(result.days).toEqual([]);
  });

  it('hero state=now when a scheduled item is within 15 min of the current time', async () => {
    prisma.weeklyPlan.findFirst.mockResolvedValue({
      id: 'plan-1',
      weekStart: new Date('2026-04-13T00:00:00Z'),
      weekEnd: new Date('2026-04-19T23:59:59Z'),
    });
    const scheduledAt = new Date('2026-04-17T19:00:00Z');
    prisma.weeklyPlanItem.findMany.mockResolvedValue([
      {
        id: 'i1', weeklyPlanId: 'plan-1', order: 1, outcome: 'PENDING',
        reflection: null, completedAt: null, carriedFromItemId: null,
        scheduledAt, scheduledMinutes: 45,
        libraryItem: {
          title: 'BS patterns', format: 'PROBLEM', estimatedMinutes: 45, url: 'https://leetcode.com/x',
          topic: { slug: 'dp', label: 'DP' },
        },
      },
    ]);

    const result = await service.getHome('user-1', new Date('2026-04-17T19:05:00Z'));
    expect(result.hero?.state).toBe('now');
    expect(result.today).toHaveLength(1);
  });

  it('hero state=up_next when nearest scheduled item is later today', async () => {
    prisma.weeklyPlan.findFirst.mockResolvedValue({
      id: 'plan-1',
      weekStart: new Date('2026-04-13T00:00:00Z'),
      weekEnd: new Date('2026-04-19T23:59:59Z'),
    });
    prisma.weeklyPlanItem.findMany.mockResolvedValue([
      {
        id: 'i1', weeklyPlanId: 'plan-1', order: 1, outcome: 'PENDING',
        reflection: null, completedAt: null, carriedFromItemId: null,
        scheduledAt: new Date('2026-04-17T21:00:00Z'), scheduledMinutes: 45,
        libraryItem: { title: 'X', format: 'PROBLEM', estimatedMinutes: 45, url: null, topic: null },
      },
    ]);
    const result = await service.getHome('user-1', new Date('2026-04-17T19:00:00Z'));
    expect(result.hero?.state).toBe('up_next');
    expect((result.hero as any).minutesUntil).toBe(120);
  });

  it('hero state=running_late when scheduled item is in the past with no positive outcome', async () => {
    prisma.weeklyPlan.findFirst.mockResolvedValue({
      id: 'plan-1',
      weekStart: new Date('2026-04-13T00:00:00Z'),
      weekEnd: new Date('2026-04-19T23:59:59Z'),
    });
    prisma.weeklyPlanItem.findMany.mockResolvedValue([
      {
        id: 'i1', weeklyPlanId: 'plan-1', order: 1, outcome: 'PENDING',
        reflection: null, completedAt: null, carriedFromItemId: null,
        scheduledAt: new Date('2026-04-17T19:00:00Z'), scheduledMinutes: 45,
        libraryItem: { title: 'X', format: 'PROBLEM', estimatedMinutes: 45, url: null, topic: null },
      },
    ]);
    const result = await service.getHome('user-1', new Date('2026-04-17T20:00:00Z'));
    expect(result.hero?.state).toBe('running_late');
    expect((result.hero as any).minutesLate).toBeGreaterThanOrEqual(60);
  });

  it('groups days chronologically and skips already-done today items from today list? Actually keeps them for reference', async () => {
    // today = 2026-04-17 (Fri)
    // day items: 2 items on 17th (one DONE_EASY, one PENDING), 1 item on 18th.
    const mockItems = [
      {
        id: 'done',
        weeklyPlanId: 'plan-1',
        order: 1,
        outcome: 'DONE_EASY',
        reflection: null,
        completedAt: new Date(),
        carriedFromItemId: null,
        scheduledAt: new Date('2026-04-17T13:00:00Z'),
        scheduledMinutes: 30,
        libraryItem: {
          title: 'Morning study',
          format: 'VIDEO',
          estimatedMinutes: 30,
          url: null,
          topic: null,
        },
      },
      {
        id: 'pending-today',
        weeklyPlanId: 'plan-1',
        order: 2,
        outcome: 'PENDING',
        reflection: null,
        completedAt: null,
        carriedFromItemId: null,
        scheduledAt: new Date('2026-04-17T20:00:00Z'),
        scheduledMinutes: 45,
        libraryItem: {
          title: 'Evening study',
          format: 'PROBLEM',
          estimatedMinutes: 45,
          url: null,
          topic: null,
        },
      },
      {
        id: 'tomorrow',
        weeklyPlanId: 'plan-1',
        order: 3,
        outcome: 'PENDING',
        reflection: null,
        completedAt: null,
        carriedFromItemId: null,
        scheduledAt: new Date('2026-04-18T09:00:00Z'),
        scheduledMinutes: 45,
        libraryItem: {
          title: 'Next-day',
          format: 'ARTICLE',
          estimatedMinutes: 45,
          url: null,
          topic: null,
        },
      },
    ];
    prisma.weeklyPlan.findFirst.mockResolvedValue({
      id: 'plan-1',
      weekStart: new Date('2026-04-13T00:00:00Z'),
      weekEnd: new Date('2026-04-19T23:59:59Z'),
    });
    prisma.weeklyPlanItem.findMany.mockResolvedValue(mockItems);

    const result = await service.getHome('user-1', new Date('2026-04-17T19:00:00Z'));
    expect(result.today.map((i) => i.id)).toEqual(['done', 'pending-today']);
    expect(result.days).toHaveLength(2); // tomorrow + next two days may be empty; only days-with-items appear
    expect(result.days[0].items[0].id).toBe('tomorrow');
  });
});
```

Run to confirm they all fail (no service yet):

```bash
pnpm --filter @ics-select/api test -- --testPathPattern home.service.spec
```

Expected: fails with "Cannot find module './home.service'".

- [ ] **Step 2: Implement the service**

Write `apps/api/src/me/home/home.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import type { ItemOutcome } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type HomeItem = {
  id: string;
  planId: string;
  order: number;
  title: string;
  format: string;
  estimatedMinutes: number;
  url: string | null;
  topic: { slug: string; label: string } | null;
  outcome: ItemOutcome;
  scheduledAt: string | null;
  scheduledMinutes: number | null;
  carriedFromItemId: string | null;
};

type HeroState =
  | { state: 'now'; item: HomeItem }
  | { state: 'up_next'; item: HomeItem; minutesUntil: number }
  | { state: 'running_late'; item: HomeItem; minutesLate: number }
  | { state: 'all_done'; nextAt: string | null }
  | { state: 'free_day'; nextAt: string | null };

export type HomeResponse = {
  hero: HeroState | null;
  today: HomeItem[];
  days: { label: string; date: string; items: HomeItem[] }[];
  streak: { current: number; last7: boolean[] };
};

const NOW_WINDOW_MINUTES = 15;

function sameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function formatDayLabel(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toHomeItem(row: any): HomeItem {
  return {
    id: row.id,
    planId: row.weeklyPlanId,
    order: row.order,
    title: row.libraryItem.title,
    format: row.libraryItem.format,
    estimatedMinutes: row.libraryItem.estimatedMinutes,
    url: row.libraryItem.url ?? null,
    topic: row.libraryItem.topic
      ? { slug: row.libraryItem.topic.slug, label: row.libraryItem.topic.label }
      : null,
    outcome: row.outcome,
    scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
    scheduledMinutes: row.scheduledMinutes ?? null,
    carriedFromItemId: row.carriedFromItemId ?? null,
  };
}

@Injectable()
export class HomeService {
  constructor(private readonly prisma: PrismaService) {}

  async getHome(userId: string, now: Date = new Date()): Promise<HomeResponse> {
    const plan = await this.prisma.weeklyPlan.findFirst({
      where: {
        userId,
        status: 'PUBLISHED',
        weekStart: { lte: now },
        weekEnd: { gte: now },
      },
      orderBy: { weekStart: 'desc' },
    });

    if (!plan) {
      const streak = await this.computeStreak(userId, now);
      return { hero: null, today: [], days: [], streak };
    }

    const rawItems = await this.prisma.weeklyPlanItem.findMany({
      where: { weeklyPlanId: plan.id },
      include: {
        libraryItem: {
          include: { topic: true },
        },
      },
      orderBy: [{ scheduledAt: 'asc' }, { order: 'asc' }],
    });

    const items = rawItems.map(toHomeItem);

    const today: HomeItem[] = [];
    const futureByDay = new Map<string, HomeItem[]>();

    for (const item of items) {
      if (!item.scheduledAt) continue;
      const at = new Date(item.scheduledAt);
      if (sameUtcDay(at, now)) {
        today.push(item);
      } else if (at > now) {
        const key = toIsoDate(at);
        const arr = futureByDay.get(key) ?? [];
        arr.push(item);
        futureByDay.set(key, arr);
      }
    }

    today.sort((a, b) => (a.scheduledAt! < b.scheduledAt! ? -1 : 1));

    const days = [...futureByDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, dayItems]) => ({
        date,
        label: formatDayLabel(new Date(date + 'T00:00:00Z')),
        items: dayItems.sort((a, b) => (a.scheduledAt! < b.scheduledAt! ? -1 : 1)),
      }));

    const hero = this.pickHero(today, days, now);
    const streak = await this.computeStreak(userId, now);

    return { hero, today, days, streak };
  }

  private pickHero(
    today: HomeItem[],
    days: HomeResponse['days'],
    now: Date,
  ): HeroState | null {
    const nowMs = now.getTime();

    // 1) "now" — a pending item scheduled within NOW_WINDOW_MINUTES
    const nowItem = today.find((i) => {
      if (i.outcome !== 'PENDING' || !i.scheduledAt) return false;
      const diffMin = (new Date(i.scheduledAt).getTime() - nowMs) / 60_000;
      return Math.abs(diffMin) <= NOW_WINDOW_MINUTES;
    });
    if (nowItem) return { state: 'now', item: nowItem };

    // 2) "running_late" — pending item scheduled earlier today
    const lateItem = today.find((i) => {
      if (i.outcome !== 'PENDING' || !i.scheduledAt) return false;
      return new Date(i.scheduledAt).getTime() < nowMs;
    });
    if (lateItem) {
      const minutesLate = Math.round((nowMs - new Date(lateItem.scheduledAt!).getTime()) / 60_000);
      return { state: 'running_late', item: lateItem, minutesLate };
    }

    // 3) "up_next" — next pending item today
    const upNext = today.find((i) => i.outcome === 'PENDING' && i.scheduledAt && new Date(i.scheduledAt).getTime() > nowMs);
    if (upNext) {
      const minutesUntil = Math.round((new Date(upNext.scheduledAt!).getTime() - nowMs) / 60_000);
      return { state: 'up_next', item: upNext, minutesUntil };
    }

    // 4) "all_done" — today has items but none PENDING
    if (today.length > 0) {
      const nextAt = days[0]?.items[0]?.scheduledAt ?? null;
      return { state: 'all_done', nextAt };
    }

    // 5) "free_day" — today has no items
    const nextAt = days[0]?.items[0]?.scheduledAt ?? null;
    return { state: 'free_day', nextAt };
  }

  private async computeStreak(userId: string, now: Date): Promise<{ current: number; last7: boolean[] }> {
    // Look back up to 30 days; pull items with positive outcomes grouped by day.
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

    const rows = await this.prisma.weeklyPlanItem.findMany({
      where: {
        weeklyPlan: { userId },
        outcome: { in: ['DONE_EASY', 'DONE_HARD'] },
        completedAt: { gte: thirtyDaysAgo },
      },
      select: { completedAt: true },
    });

    const positiveDays = new Set<string>();
    for (const row of rows) {
      if (!row.completedAt) continue;
      positiveDays.add(toIsoDate(row.completedAt));
    }

    // last 7 days, oldest first
    const last7: boolean[] = [];
    for (let offset = 6; offset >= 0; offset--) {
      const day = new Date(now);
      day.setUTCDate(day.getUTCDate() - offset);
      last7.push(positiveDays.has(toIsoDate(day)));
    }

    // current streak: walk backwards from today; break when two consecutive zero-positive days occur
    let current = 0;
    let zeroStreak = 0;
    for (let offset = 0; offset < 30; offset++) {
      const day = new Date(now);
      day.setUTCDate(day.getUTCDate() - offset);
      const hasPositive = positiveDays.has(toIsoDate(day));
      if (hasPositive) {
        current++;
        zeroStreak = 0;
      } else {
        zeroStreak++;
        if (zeroStreak >= 2) break;
      }
    }

    return { current, last7 };
  }
}
```

Run the tests:

```bash
pnpm --filter @ics-select/api test -- --testPathPattern home.service.spec
```

Expected: all pass. If a specific edge case fails, adjust only the service (not the test) — the test codifies the intended behavior.

- [ ] **Step 3: Write the controller**

Write `apps/api/src/me/home/home.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { JwtPayload } from '../../auth/jwt-strategy.payload';
import { HomeService } from './home.service';

@Controller('me')
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get('home')
  getHome(@CurrentUser() user: JwtPayload) {
    return this.home.getHome(user.sub);
  }
}
```

(If `JwtStrategyPayload` or similar is the actual type name in the codebase, swap the import accordingly.)

- [ ] **Step 4: Write the module**

Write `apps/api/src/me/home/home.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { HomeService } from './home.service';
import { HomeController } from './home.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [HomeService],
  controllers: [HomeController],
})
export class HomeModule {}
```

(Adapt `PrismaModule` import path to match the codebase. If a global `PrismaService` is already available without explicit import, simplify accordingly.)

- [ ] **Step 5: Wire into `MeModule`**

Read `apps/api/src/me/me.module.ts`. Add `HomeModule` to imports:

```typescript
import { Module } from '@nestjs/common';
import { HomeModule } from './home/home.module';
// ... existing imports

@Module({
  imports: [HomeModule /* , other existing modules */],
  // ...
})
export class MeModule {}
```

- [ ] **Step 6: E2E smoke — hit the endpoint**

```bash
pnpm --filter @ics-select/api test
```

Expected: 86 + new home tests = 90+ pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/me/home apps/api/src/me/me.module.ts
git commit -m "feat(api): GET /me/home — hero + today + days + streak"
```

---

### Task 4: Backend `GET /me/item/:id`

**Files:**
- Create: `apps/api/src/me/item/item.service.ts`
- Create: `apps/api/src/me/item/item.service.spec.ts`
- Create: `apps/api/src/me/item/item.controller.ts`
- Create: `apps/api/src/me/item/item.module.ts`
- Modify: `apps/api/src/me/me.module.ts`

Response shape:

```typescript
type ItemResponse = {
  id: string;
  planId: string;
  order: number;
  outcome: ItemOutcome;
  reflection: string | null;
  completedAt: string | null;
  scheduledAt: string | null;
  scheduledMinutes: number | null;
  libraryItem: {
    id: string;
    title: string;
    description: string | null;
    url: string | null;
    format: ItemFormat;
    estimatedMinutes: number;
    topic: { slug: string; label: string } | null;
  };
  carriedFrom: {
    outcome: ItemOutcome;
    reflection: string | null;
    completedAt: string | null;
    weekStart: string;  // YYYY-MM-DD of the previous plan
  } | null;
};
```

- [ ] **Step 1: Write the test first**

Write `apps/api/src/me/item/item.service.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ItemService } from './item.service';
import { PrismaService } from '../../prisma/prisma.service';

const makePrismaMock = () => ({
  weeklyPlanItem: { findUnique: jest.fn() },
});

describe('ItemService', () => {
  let service: ItemService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    const mod = await Test.createTestingModule({
      providers: [ItemService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = mod.get(ItemService);
  });

  it('throws NotFoundException when item does not exist', async () => {
    prisma.weeklyPlanItem.findUnique.mockResolvedValue(null);
    await expect(service.getItem('missing', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when caller does not own the plan', async () => {
    prisma.weeklyPlanItem.findUnique.mockResolvedValue({
      id: 'i1',
      weeklyPlan: { userId: 'someone-else' },
      libraryItem: { topic: null },
      carriedFrom: null,
    });
    await expect(service.getItem('i1', 'user-1')).rejects.toThrow(ForbiddenException);
  });

  it('returns item + carriedFrom when present', async () => {
    prisma.weeklyPlanItem.findUnique.mockResolvedValue({
      id: 'i1',
      weeklyPlanId: 'plan-new',
      order: 1,
      outcome: 'PENDING',
      reflection: null,
      completedAt: null,
      scheduledAt: null,
      scheduledMinutes: null,
      weeklyPlan: { userId: 'user-1' },
      libraryItem: {
        id: 'lib-1',
        title: 'DP intro',
        description: 'Dynamic programming fundamentals',
        url: 'https://x',
        format: 'PROBLEM',
        estimatedMinutes: 45,
        topic: { slug: 'dp', label: 'Dynamic Programming' },
      },
      carriedFrom: {
        outcome: 'STUCK',
        reflection: 'travei no passo base',
        completedAt: new Date('2026-04-11T12:00:00Z'),
        weeklyPlan: { weekStart: new Date('2026-04-06T00:00:00Z') },
      },
    });

    const result = await service.getItem('i1', 'user-1');
    expect(result.id).toBe('i1');
    expect(result.libraryItem.topic?.slug).toBe('dp');
    expect(result.carriedFrom?.outcome).toBe('STUCK');
    expect(result.carriedFrom?.weekStart).toBe('2026-04-06');
  });
});
```

- [ ] **Step 2: Implement the service**

Write `apps/api/src/me/item/item.service.ts`:

```typescript
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ItemService {
  constructor(private readonly prisma: PrismaService) {}

  async getItem(itemId: string, userId: string) {
    const row = await this.prisma.weeklyPlanItem.findUnique({
      where: { id: itemId },
      include: {
        weeklyPlan: { select: { userId: true } },
        libraryItem: { include: { topic: true } },
        carriedFrom: {
          include: {
            weeklyPlan: { select: { weekStart: true } },
          },
        },
      },
    });

    if (!row) throw new NotFoundException('Item not found');
    if (row.weeklyPlan.userId !== userId) {
      throw new ForbiddenException('Cannot view this item');
    }

    return {
      id: row.id,
      planId: row.weeklyPlanId,
      order: row.order,
      outcome: row.outcome,
      reflection: row.reflection ?? null,
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
      scheduledMinutes: row.scheduledMinutes ?? null,
      libraryItem: {
        id: row.libraryItem.id,
        title: row.libraryItem.title,
        description: row.libraryItem.description ?? null,
        url: row.libraryItem.url ?? null,
        format: row.libraryItem.format,
        estimatedMinutes: row.libraryItem.estimatedMinutes,
        topic: row.libraryItem.topic
          ? { slug: row.libraryItem.topic.slug, label: row.libraryItem.topic.label }
          : null,
      },
      carriedFrom: row.carriedFrom
        ? {
            outcome: row.carriedFrom.outcome,
            reflection: row.carriedFrom.reflection ?? null,
            completedAt: row.carriedFrom.completedAt
              ? row.carriedFrom.completedAt.toISOString()
              : null,
            weekStart: row.carriedFrom.weeklyPlan.weekStart.toISOString().slice(0, 10),
          }
        : null,
    };
  }
}
```

Run tests:

```bash
pnpm --filter @ics-select/api test -- --testPathPattern item.service.spec
```

Expected: pass.

- [ ] **Step 3: Controller**

Write `apps/api/src/me/item/item.controller.ts`:

```typescript
import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../../auth/current-user.decorator';
import type { JwtPayload } from '../../auth/jwt-strategy.payload';
import { ItemService } from './item.service';

@Controller('me')
export class ItemController {
  constructor(private readonly item: ItemService) {}

  @Get('item/:id')
  getItem(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.item.getItem(id, user.sub);
  }
}
```

- [ ] **Step 4: Module + wire up**

Write `apps/api/src/me/item/item.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ItemService } from './item.service';
import { ItemController } from './item.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [ItemService],
  controllers: [ItemController],
})
export class ItemModule {}
```

Add to `MeModule` imports list alongside `HomeModule`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/me/item apps/api/src/me/me.module.ts
git commit -m "feat(api): GET /me/item/:id with carry-over context"
```

---

### Task 5: Frontend — data layer (React Query hooks + format helpers)

**Files:**
- Create: `apps/web/lib/queries/me-home.ts`
- Create: `apps/web/lib/queries/me-item.ts`
- Create: `apps/web/lib/format/time.ts`
- Create: `apps/web/lib/format/platform.ts`

- [ ] **Step 1: Write `me-home.ts`**

Write `apps/web/lib/queries/me-home.ts`:

```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import type { ItemOutcome } from '@ics-select/shared';
import { apiFetch } from '../api/client';

export type HomeItem = {
  id: string;
  planId: string;
  order: number;
  title: string;
  format: string;
  estimatedMinutes: number;
  url: string | null;
  topic: { slug: string; label: string } | null;
  outcome: ItemOutcome;
  scheduledAt: string | null;
  scheduledMinutes: number | null;
  carriedFromItemId: string | null;
};

export type HomeResponse = {
  hero:
    | { state: 'now'; item: HomeItem }
    | { state: 'up_next'; item: HomeItem; minutesUntil: number }
    | { state: 'running_late'; item: HomeItem; minutesLate: number }
    | { state: 'all_done'; nextAt: string | null }
    | { state: 'free_day'; nextAt: string | null }
    | null;
  today: HomeItem[];
  days: { label: string; date: string; items: HomeItem[] }[];
  streak: { current: number; last7: boolean[] };
};

export function useMeHome() {
  return useQuery({
    queryKey: ['me', 'home'],
    queryFn: () => apiFetch<HomeResponse>('/me/home'),
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  });
}
```

- [ ] **Step 2: Write `me-item.ts`**

Write `apps/web/lib/queries/me-item.ts`:

```typescript
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ItemOutcome } from '@ics-select/shared';
import { apiFetch } from '../api/client';

export type ItemResponse = {
  id: string;
  planId: string;
  order: number;
  outcome: ItemOutcome;
  reflection: string | null;
  completedAt: string | null;
  scheduledAt: string | null;
  scheduledMinutes: number | null;
  libraryItem: {
    id: string;
    title: string;
    description: string | null;
    url: string | null;
    format: string;
    estimatedMinutes: number;
    topic: { slug: string; label: string } | null;
  };
  carriedFrom: {
    outcome: ItemOutcome;
    reflection: string | null;
    completedAt: string | null;
    weekStart: string;
  } | null;
};

export function useMeItem(id: string) {
  return useQuery({
    queryKey: ['me', 'item', id],
    queryFn: () => apiFetch<ItemResponse>(`/me/item/${id}`),
    enabled: !!id,
  });
}

export function useSetItemOutcome() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { planId: string; itemId: string; outcome: ItemOutcome; reflection?: string }) =>
      apiFetch<ItemResponse>(
        `/plans/${input.planId}/items/${input.itemId}/outcome`,
        { method: 'PATCH', body: { outcome: input.outcome, reflection: input.reflection } },
      ),
    onSuccess: (_res, input) => {
      qc.invalidateQueries({ queryKey: ['me', 'home'] });
      qc.invalidateQueries({ queryKey: ['me', 'item', input.itemId] });
    },
  });
}
```

**CAVEAT:** verify the exact `apiFetch` call signature in the existing `apps/web/lib/api/client.ts`. Some codebases pass JSON body as `body: JSON.stringify(...)`, others serialize automatically via `body: {...}`. Mirror the existing pattern — check how other mutations in this codebase call `apiFetch` before finalizing this file.

- [ ] **Step 3: Write `format/time.ts`**

Write `apps/web/lib/format/time.ts`:

```typescript
/** Returns "19:00" in UTC-aware local-ish display (plain HH:mm). */
export function formatTimeUtc(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Returns "Wed, Apr 16". English abbreviated to avoid DMY/MDY ambiguity. */
export function formatDateShort(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

/** Returns "45 min" / "1 h 30 min". */
export function formatMinutes(m: number | null | undefined): string {
  if (m === null || m === undefined) return '';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h} h` : `${h} h ${rem} min`;
}

/** "in 23 min" / "2 min ago" / "in 1 h" etc. */
export function formatRelative(minutes: number): string {
  const abs = Math.abs(minutes);
  const future = minutes >= 0;
  if (abs < 60) return future ? `in ${abs} min` : `${abs} min ago`;
  const h = Math.round(abs / 60);
  return future ? `in ${h} h` : `${h} h ago`;
}
```

- [ ] **Step 4: Write `format/platform.ts`**

Write `apps/web/lib/format/platform.ts`:

```typescript
type Platform =
  | 'leetcode'
  | 'youtube'
  | 'medium'
  | 'github'
  | 'article'
  | 'book';

export function detectPlatform(url: string | null | undefined, format: string | undefined): Platform {
  if (url) {
    if (url.includes('leetcode.com')) return 'leetcode';
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('medium.com')) return 'medium';
    if (url.includes('github.com')) return 'github';
  }
  if (format === 'VIDEO') return 'youtube';
  if (format === 'BOOK') return 'book';
  return 'article';
}

export function platformLabel(p: Platform): string {
  return {
    leetcode: 'LeetCode',
    youtube: 'Video',
    medium: 'Medium',
    github: 'GitHub',
    article: 'Article',
    book: 'Book',
  }[p];
}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/queries apps/web/lib/format
git commit -m "feat(web): data hooks (me-home, me-item) + time/platform formatters"
```

---

### Task 6: Frontend `/me` home page (daily)

**Files:**
- Create: `apps/web/app/(member)/me/page.tsx`
- Create: `apps/web/components/member/home-hero.tsx`
- Create: `apps/web/components/member/day-list.tsx`

- [ ] **Step 1: Write `home-hero.tsx`**

Write `apps/web/components/member/home-hero.tsx`:

```tsx
'use client';

import Link from 'next/link';
import type { HomeResponse, HomeItem } from '../../lib/queries/me-home';
import { Eyebrow } from '../ui/eyebrow';
import { Pill } from '../ui/pill';
import { Button } from '../ui/button';
import { formatTimeUtc, formatRelative, formatDateShort } from '../../lib/format/time';
import { platformLabel, detectPlatform } from '../../lib/format/platform';

interface HomeHeroProps {
  hero: HomeResponse['hero'];
}

function HeroItemLayout({
  eyebrow,
  item,
  ctaHref,
  ctaLabel,
}: {
  eyebrow: string;
  item: HomeItem;
  ctaHref: string;
  ctaLabel: string;
}) {
  const platform = detectPlatform(item.url, item.format);
  return (
    <section className="max-w-3xl">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-3 font-serif text-[40px] font-medium leading-[1.05] tracking-tight">
        {item.title}
      </h1>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Pill>{platformLabel(platform)}</Pill>
        <span className="font-mono text-xs text-ink-mute">{item.estimatedMinutes} MIN</span>
        {item.topic && <Pill variant="soft">{item.topic.label}</Pill>}
      </div>
      <div className="mt-6 flex gap-2">
        <Link href={ctaHref}>
          <Button variant="primary">{ctaLabel}</Button>
        </Link>
      </div>
    </section>
  );
}

export function HomeHero({ hero }: HomeHeroProps) {
  if (!hero) {
    return (
      <section className="max-w-3xl">
        <Eyebrow>No active plan</Eyebrow>
        <h1 className="mt-3 font-serif text-[36px] font-medium leading-tight tracking-tight">
          Waiting for the next plan.
        </h1>
        <p className="mt-3 font-sans text-sm text-ink-soft">
          The program director hasn&apos;t published your plan yet.
        </p>
      </section>
    );
  }

  if (hero.state === 'now') {
    return (
      <HeroItemLayout
        eyebrow={`Now · ${formatTimeUtc(hero.item.scheduledAt) ?? ''}`}
        item={hero.item}
        ctaHref={`/me/item/${hero.item.id}`}
        ctaLabel="Start study"
      />
    );
  }
  if (hero.state === 'up_next') {
    return (
      <HeroItemLayout
        eyebrow={`Up next · ${formatRelative(hero.minutesUntil)}`}
        item={hero.item}
        ctaHref={`/me/item/${hero.item.id}`}
        ctaLabel="Open"
      />
    );
  }
  if (hero.state === 'running_late') {
    return (
      <HeroItemLayout
        eyebrow={`Running late · was at ${formatTimeUtc(hero.item.scheduledAt) ?? ''}`}
        item={hero.item}
        ctaHref={`/me/item/${hero.item.id}`}
        ctaLabel="Catch up"
      />
    );
  }
  if (hero.state === 'all_done') {
    return (
      <section className="max-w-3xl">
        <Eyebrow>All done today</Eyebrow>
        <h1 className="mt-3 font-serif text-[36px] font-medium leading-tight tracking-tight">
          Nothing more scheduled today.
        </h1>
        <p className="mt-3 font-sans text-sm text-ink-soft">
          {hero.nextAt ? `Next up: ${formatDateShort(hero.nextAt)} at ${formatTimeUtc(hero.nextAt)}.` : 'See you soon.'}
        </p>
      </section>
    );
  }
  // free_day
  return (
    <section className="max-w-3xl">
      <Eyebrow>Free day</Eyebrow>
      <h1 className="mt-3 font-serif text-[36px] font-medium leading-tight tracking-tight">
        No study scheduled today.
      </h1>
      <p className="mt-3 font-sans text-sm text-ink-soft">
        {hero.nextAt ? `Next up: ${formatDateShort(hero.nextAt)} at ${formatTimeUtc(hero.nextAt)}.` : 'Rest up.'}
      </p>
    </section>
  );
}
```

- [ ] **Step 2: Write `day-list.tsx`**

Write `apps/web/components/member/day-list.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import type { HomeItem } from '../../lib/queries/me-home';
import { ListRow } from '../ui/list-row';
import { DayHeader } from '../ui/day-header';
import { formatTimeUtc, formatMinutes } from '../../lib/format/time';
import { platformLabel, detectPlatform } from '../../lib/format/platform';

interface DayListProps {
  label: string;
  hint?: string;
  items: HomeItem[];
  activeItemId?: string | null;
}

export function DayList({ label, hint, items, activeItemId }: DayListProps) {
  const router = useRouter();
  return (
    <div>
      <DayHeader label={label} hint={hint} />
      {items.length === 0 ? (
        <p className="py-4 font-sans text-sm text-ink-mute">Nothing scheduled.</p>
      ) : (
        items.map((item) => {
          const platform = detectPlatform(item.url, item.format);
          const meta = `${platformLabel(platform).toUpperCase()} · ${formatMinutes(item.estimatedMinutes).toUpperCase()}`;
          return (
            <ListRow
              key={item.id}
              time={formatTimeUtc(item.scheduledAt) ?? undefined}
              outcome={item.outcome}
              active={activeItemId === item.id}
              title={item.title}
              meta={meta}
              onClick={() => router.push(`/me/item/${item.id}`)}
            />
          );
        })
      )}
    </div>
  );
}
```

- [ ] **Step 3: Write `/me/page.tsx`**

Write `apps/web/app/(member)/me/page.tsx`:

```tsx
'use client';

import { useMeHome } from '../../../lib/queries/me-home';
import { HomeHero } from '../../../components/member/home-hero';
import { DayList } from '../../../components/member/day-list';
import { StreakCard } from '../../../components/ui/streak-card';
import { formatMinutes } from '../../../lib/format/time';

export default function MeHomePage() {
  const { data, isLoading, error } = useMeHome();

  if (isLoading) {
    return <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Loading…</p>;
  }
  if (error || !data) {
    return <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Could not load your home.</p>;
  }

  const activeItemId = data.hero && 'item' in data.hero ? data.hero.item.id : null;

  const todayMinutes = data.today.reduce((sum, i) => sum + (i.scheduledMinutes ?? i.estimatedMinutes), 0);
  const todayHint = data.today.length > 0
    ? `${data.today.length} items · ${formatMinutes(todayMinutes)}`
    : undefined;

  return (
    <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_260px]">
      <div className="space-y-10 min-w-0">
        <HomeHero hero={data.hero} />
        <hr className="border-rule" />
        <DayList label="Today" hint={todayHint} items={data.today} activeItemId={activeItemId} />
        {data.days.map((day) => (
          <DayList key={day.date} label={day.label} items={day.items} />
        ))}
      </div>
      <aside className="space-y-6">
        <StreakCard current={data.streak.current} last7={data.streak.last7} />
      </aside>
    </div>
  );
}
```

- [ ] **Step 4: Redirect `/home` → `/me`**

Update the two navigation files so `Today` goes to `/me`:

`apps/web/components/member-shell/topbar-member.tsx`: change `{ href: '/home', label: 'Today', icon: Compass }` → `{ href: '/me', label: 'Today', icon: Compass }` (and the Logo link's `href="/home"` → `href="/me"`).

`apps/web/components/member-shell/bottom-tab-bar.tsx`: change `{ href: '/home', label: 'Today', icon: Compass }` → `{ href: '/me', label: 'Today', icon: Compass }`.

Also update `apps/web/app/page.tsx` line 29: `router.replace(user.role === 'ADMIN' ? '/admin/cycles' : '/me');`

- [ ] **Step 5: Delete the `/home` placeholder**

```bash
rm -rf 'apps/web/app/(member)/home'
```

- [ ] **Step 6: Move the placeholder into a `(member)/page.tsx`? NO.**

CLAUDE.md forbids `page.tsx` at route group root. Instead, the placeholder has been fully replaced by `/me/page.tsx`. `/home` is simply gone.

- [ ] **Step 7: Typecheck + build**

```bash
pnpm --filter @ics-select/web typecheck
pnpm --filter @ics-select/web build
```

Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add 'apps/web/app/(member)' apps/web/components/member-shell apps/web/app/page.tsx apps/web/components/member
git commit -m "feat(web): /me daily home (hero + day lists + streak sidebar)"
```

---

### Task 7: Frontend `/me/plan` — full week list

**Files:**
- Create: `apps/web/app/(member)/me/plan/page.tsx`
- Create: `apps/web/components/member/week-list.tsx`

- [ ] **Step 1: Write `week-list.tsx`**

Write `apps/web/components/member/week-list.tsx`:

```tsx
'use client';

import type { HomeResponse } from '../../lib/queries/me-home';
import { DayList } from './day-list';

interface WeekListProps {
  today: HomeResponse['today'];
  days: HomeResponse['days'];
}

export function WeekList({ today, days }: WeekListProps) {
  return (
    <div className="space-y-10">
      <DayList label="Today" items={today} />
      {days.map((day) => (
        <DayList key={day.date} label={day.label} items={day.items} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write `/me/plan/page.tsx`**

Write `apps/web/app/(member)/me/plan/page.tsx`:

```tsx
'use client';

import { useMeHome } from '../../../../lib/queries/me-home';
import { WeekList } from '../../../../components/member/week-list';
import { Eyebrow } from '../../../../components/ui/eyebrow';

export default function MePlanPage() {
  const { data, isLoading } = useMeHome();
  if (isLoading || !data) return <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Loading…</p>;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Eyebrow>This week</Eyebrow>
        <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight">
          Your full plan.
        </h1>
      </div>
      <WeekList today={data.today} days={data.days} />
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add 'apps/web/app/(member)/me/plan' apps/web/components/member/week-list.tsx
git commit -m "feat(web): /me/plan week-in-list view"
```

---

### Task 8: Frontend `/me/item/[id]` focus page

**Files:**
- Create: `apps/web/app/(member)/me/item/[id]/page.tsx`
- Create: `apps/web/components/member/item-focus.tsx`

- [ ] **Step 1: Write `item-focus.tsx`**

Write `apps/web/components/member/item-focus.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ItemResponse } from '../../lib/queries/me-item';
import { useSetItemOutcome } from '../../lib/queries/me-item';
import type { ItemOutcome } from '@ics-select/shared';
import { Eyebrow } from '../ui/eyebrow';
import { Pill } from '../ui/pill';
import { Button } from '../ui/button';
import { OutcomePicker } from '../ui/outcome-picker';
import { formatTimeUtc, formatDateShort } from '../../lib/format/time';
import { platformLabel, detectPlatform } from '../../lib/format/platform';

interface ItemFocusProps {
  item: ItemResponse;
}

export function ItemFocus({ item }: ItemFocusProps) {
  const isDone = item.outcome !== 'PENDING';
  const [outcome, setOutcome] = useState<ItemOutcome | null>(isDone ? item.outcome : null);
  const [reflection, setReflection] = useState(item.reflection ?? '');
  const [editing, setEditing] = useState(!isDone);

  const mutation = useSetItemOutcome();

  const now = new Date();
  const scheduledFuture =
    item.scheduledAt !== null && new Date(item.scheduledAt) > now && item.outcome === 'PENDING';

  const platform = detectPlatform(item.libraryItem.url, item.libraryItem.format);

  const eyebrowText = (() => {
    if (isDone && item.completedAt) return `Marked · ${formatDateShort(item.completedAt)}`;
    if (item.scheduledAt) {
      const sched = new Date(item.scheduledAt);
      if (sched > now) return `Scheduled · ${formatDateShort(item.scheduledAt)} ${formatTimeUtc(item.scheduledAt)}`;
      return `Running late · was at ${formatTimeUtc(item.scheduledAt)}`;
    }
    return 'Pending';
  })();

  async function handleSave() {
    if (!outcome) return;
    await mutation.mutateAsync({
      planId: item.planId,
      itemId: item.id,
      outcome,
      reflection: reflection.trim() === '' ? undefined : reflection,
    });
    setEditing(false);
  }

  return (
    <div className="max-w-3xl space-y-8">
      <Link
        href="/me"
        className="font-mono text-xs uppercase tracking-label text-ink-mute hover:text-ink"
      >
        ← Back
      </Link>

      <header>
        <Eyebrow>{eyebrowText}</Eyebrow>
        <h1 className="mt-3 font-serif text-[40px] font-medium leading-[1.05] tracking-tight">
          {item.libraryItem.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Pill>{platformLabel(platform)}</Pill>
          <span className="font-mono text-xs text-ink-mute">{item.libraryItem.estimatedMinutes} MIN</span>
          {item.libraryItem.topic && <Pill variant="soft">{item.libraryItem.topic.label}</Pill>}
        </div>
      </header>

      {item.libraryItem.url && (
        <a
          href={item.libraryItem.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 w-full items-center justify-center rounded-pill bg-ink px-6 text-sm font-semibold text-paper hover:bg-ink-soft md:w-auto"
        >
          Open on {platformLabel(platform)} ↗
        </a>
      )}

      {item.libraryItem.description && (
        <section>
          <Eyebrow>About this study</Eyebrow>
          <p className="mt-2 font-sans text-base text-ink-soft leading-relaxed">
            {item.libraryItem.description}
          </p>
        </section>
      )}

      {item.carriedFrom && (
        <section className="border-l-2 border-rule pl-4">
          <Eyebrow>Carried from last week · your note</Eyebrow>
          {item.carriedFrom.reflection ? (
            <p className="mt-2 font-serif italic text-ink-soft">&ldquo;{item.carriedFrom.reflection}&rdquo;</p>
          ) : (
            <p className="mt-2 font-sans text-sm text-ink-mute">(no reflection on the previous attempt)</p>
          )}
          <p className="mt-2 font-mono text-xs uppercase tracking-label text-ink-mute">
            Marked {item.carriedFrom.outcome.replace('_', ' ')} · week of {item.carriedFrom.weekStart}
          </p>
        </section>
      )}

      <section>
        <Eyebrow>How did it go?</Eyebrow>
        {editing ? (
          <div className="mt-3 space-y-4">
            <OutcomePicker
              value={outcome}
              onChange={setOutcome}
              disabled={scheduledFuture}
              disabledReason={
                scheduledFuture
                  ? `Available at ${formatTimeUtc(item.scheduledAt)} · don&apos;t mark before you start.`
                  : undefined
              }
            />
            {outcome && outcome !== 'PENDING' && (
              <textarea
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                placeholder="Escreve em pt-BR se quiser — é sua nota"
                className="w-full min-h-[96px] rounded-input border border-rule bg-surface p-3 font-sans text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-ink"
              />
            )}
            <Button
              onClick={handleSave}
              disabled={!outcome || mutation.isPending}
            >
              {mutation.isPending ? 'Saving…' : 'Save outcome'}
            </Button>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="font-mono text-xs uppercase tracking-label text-ink">
              {item.outcome.replace('_', ' ')}
            </p>
            {item.reflection && (
              <p className="font-serif italic text-ink-soft">&ldquo;{item.reflection}&rdquo;</p>
            )}
            <Button variant="ghost" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        )}
      </section>

      {item.outcome === 'STUCK' && (
        <p className="font-mono text-xs uppercase tracking-label text-ink-mute">
          The program director has been notified — talk to them when you can.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Write `/me/item/[id]/page.tsx`**

Write `apps/web/app/(member)/me/item/[id]/page.tsx`:

```tsx
'use client';

import { use } from 'react';
import { useMeItem } from '../../../../../lib/queries/me-item';
import { ItemFocus } from '../../../../../components/member/item-focus';

export default function MeItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useMeItem(id);
  if (isLoading) return <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Loading…</p>;
  if (error || !data) return <p className="font-mono text-xs uppercase tracking-label text-ink-mute">Item not found.</p>;
  return <ItemFocus item={data} />;
}
```

- [ ] **Step 3: Typecheck + build**

```bash
pnpm --filter @ics-select/web typecheck
pnpm --filter @ics-select/web build
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add 'apps/web/app/(member)/me/item' apps/web/components/member/item-focus.tsx
git commit -m "feat(web): /me/item/[id] focus page with outcome picker + carry-over context"
```

---

### Task 9: Install + configure Playwright

**Files:**
- Create: `apps/web/playwright.config.ts`
- Modify: `apps/web/package.json` (scripts + devDependency)

- [ ] **Step 1: Install**

```bash
pnpm --filter @ics-select/web add -D @playwright/test
pnpm --filter @ics-select/web exec playwright install chromium
```

Expected: Playwright core + Chromium browser downloaded.

- [ ] **Step 2: Add scripts to `apps/web/package.json`**

Inside `"scripts"`:

```json
"test": "playwright test",
"test:update": "playwright test --update-snapshots"
```

(If the existing `"test"` is something else like `echo "no tests"`, replace it.)

- [ ] **Step 3: Write `apps/web/playwright.config.ts`**

Write:

```typescript
import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `pnpm --filter @ics-select/web dev -- -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 4: Verify setup**

Create a tiny smoke test to verify the infra works:

Write `apps/web/tests/smoke.spec.ts`:

```typescript
import { expect, test } from '@playwright/test';

test('dev design system page loads', async ({ page }) => {
  await page.goto('/dev/design-system');
  await expect(page.getByRole('heading', { name: /magazine editorial primitives/i })).toBeVisible();
});
```

Run:

```bash
pnpm --filter @ics-select/web test tests/smoke.spec.ts
```

Expected: passes. The webServer should auto-start the dev server on port 3100.

- [ ] **Step 5: Commit**

```bash
git add apps/web/playwright.config.ts apps/web/tests/smoke.spec.ts apps/web/package.json pnpm-lock.yaml
git commit -m "test(web): install + configure Playwright with webServer on :3100"
```

---

### Task 10: Playwright specs for `/me` and `/me/item/[id]`

**Files:**
- Create: `apps/web/tests/me-home.spec.ts`
- Create: `apps/web/tests/me-item.spec.ts`

Context: these tests **mock the API** via `page.route()` so they don't need a running backend. Fixture data is embedded in the tests.

- [ ] **Step 1: Write `me-home.spec.ts`**

Write `apps/web/tests/me-home.spec.ts`:

```typescript
import { expect, test } from '@playwright/test';

const MOCK_HOME = {
  hero: {
    state: 'up_next' as const,
    item: {
      id: 'item-1',
      planId: 'plan-1',
      order: 2,
      title: 'Binary search patterns',
      format: 'PROBLEM',
      estimatedMinutes: 45,
      url: 'https://leetcode.com/problems/binary-search',
      topic: { slug: 'dp', label: 'Dynamic Programming' },
      outcome: 'PENDING',
      scheduledAt: '2026-04-17T21:00:00Z',
      scheduledMinutes: 45,
      carriedFromItemId: null,
    },
    minutesUntil: 120,
  },
  today: [
    {
      id: 'item-0',
      planId: 'plan-1',
      order: 1,
      title: 'Recursion intro',
      format: 'VIDEO',
      estimatedMinutes: 30,
      url: 'https://youtube.com/x',
      topic: null,
      outcome: 'DONE_EASY',
      scheduledAt: '2026-04-17T13:00:00Z',
      scheduledMinutes: 30,
      carriedFromItemId: null,
    },
    {
      id: 'item-1',
      planId: 'plan-1',
      order: 2,
      title: 'Binary search patterns',
      format: 'PROBLEM',
      estimatedMinutes: 45,
      url: 'https://leetcode.com/problems/binary-search',
      topic: { slug: 'dp', label: 'Dynamic Programming' },
      outcome: 'PENDING',
      scheduledAt: '2026-04-17T21:00:00Z',
      scheduledMinutes: 45,
      carriedFromItemId: null,
    },
  ],
  days: [
    {
      label: 'Sat, Apr 18',
      date: '2026-04-18',
      items: [
        {
          id: 'item-2',
          planId: 'plan-1',
          order: 3,
          title: 'Hash table patterns',
          format: 'ARTICLE',
          estimatedMinutes: 45,
          url: null,
          topic: null,
          outcome: 'PENDING',
          scheduledAt: '2026-04-18T09:00:00Z',
          scheduledMinutes: 45,
          carriedFromItemId: null,
        },
      ],
    },
  ],
  streak: { current: 12, last7: [true, true, true, false, true, true, true] },
};

test.describe('/me home', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/me/home', async (route) => {
      await route.fulfill({ json: MOCK_HOME });
    });
    // Mock auth: set a token cookie so AuthProvider resolves.
    await page.addInitScript(() => {
      window.localStorage.setItem('ics:accessToken', 'mock');
    });
    await page.route('**/me', async (route) => {
      await route.fulfill({
        json: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test Member',
          pictureUrl: null,
          role: 'MEMBER',
          privacyAcceptedAt: new Date().toISOString(),
        },
      });
    });
  });

  test('renders hero + today list + streak', async ({ page }) => {
    await page.goto('/me');
    await expect(page.getByText('Binary search patterns').first()).toBeVisible();
    await expect(page.getByText(/up next/i)).toBeVisible();
    await expect(page.getByText('12').first()).toBeVisible(); // streak number
    await page.waitForTimeout(500); // font load
    await expect(page).toHaveScreenshot('me-home-desktop.png', { fullPage: true });
  });
});
```

**Note:** adjust the `accessToken` localStorage key to match the actual key used in `apps/web/lib/api/client.ts`. Verify with `grep -n "accessToken\|AccessToken" apps/web/lib/api/client.ts` before finalizing.

- [ ] **Step 2: Write `me-item.spec.ts`**

Write `apps/web/tests/me-item.spec.ts`:

```typescript
import { expect, test } from '@playwright/test';

const MOCK_ITEM = {
  id: 'item-1',
  planId: 'plan-1',
  order: 2,
  outcome: 'PENDING' as const,
  reflection: null,
  completedAt: null,
  scheduledAt: '2026-04-17T21:00:00Z',
  scheduledMinutes: 45,
  libraryItem: {
    id: 'lib-1',
    title: 'Binary search patterns',
    description:
      'Walk through three common variants of binary search: classic, lower-bound, and upper-bound.',
    url: 'https://leetcode.com/problems/binary-search',
    format: 'PROBLEM',
    estimatedMinutes: 45,
    topic: { slug: 'binary-search', label: 'Binary Search' },
  },
  carriedFrom: null,
};

test.describe('/me/item/[id]', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('ics:accessToken', 'mock');
    });
    await page.route('**/me', async (route) => {
      await route.fulfill({
        json: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test Member',
          pictureUrl: null,
          role: 'MEMBER',
          privacyAcceptedAt: new Date().toISOString(),
        },
      });
    });
    await page.route('**/me/item/item-1', async (route) => {
      await route.fulfill({ json: MOCK_ITEM });
    });
  });

  test('renders item title + outcome picker', async ({ page }) => {
    await page.goto('/me/item/item-1');
    await expect(page.getByRole('heading', { name: /binary search patterns/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /nailed it/i })).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('me-item-desktop.png', { fullPage: true });
  });
});
```

- [ ] **Step 3: Generate baselines**

```bash
pnpm --filter @ics-select/web test:update tests/me-home.spec.ts tests/me-item.spec.ts
```

Expected: baseline PNGs created in `tests/*.spec.ts-snapshots/`.

- [ ] **Step 4: Run tests to verify against baseline**

```bash
pnpm --filter @ics-select/web test tests/me-home.spec.ts tests/me-item.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/tests
git commit -m "test(web): lock /me home + /me/item visual baselines"
```

---

### Task 11: Final regression + manual eyeball

**Files:** verification only.

- [ ] **Step 1: Full suite**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: all green. 

- [ ] **Step 2: Start dev server and spot-check**

```bash
pnpm --filter @ics-select/web dev
```

Open in browser:
- `http://localhost:3000/me` — confirm hero, today list, days, streak render.
- `http://localhost:3000/me/plan` — week list.
- `http://localhost:3000/me/item/<an-id-from-your-DB>` — focus page. If you have no real items, skip or use the page by hitting an id from the `WeeklyPlanItem` table via `pnpm --filter @ics-select/prisma exec prisma studio`.
- `http://localhost:3000/dev/design-system` — primitives unchanged.

Stop with Ctrl+C.

- [ ] **Step 3: No commit — gate only.**

---

## Self-review

**Spec coverage:**
- §4.1 home composition (hero + today list + days + streak + feed) — all except feed (deferred to PR 2c — noted explicitly).
- §4.2 week list — Task 7 ✅.
- §4.3 item focus — Task 8 ✅, including outcome picker, reflection textarea, carry-over context, stuck banner.
- §8.1 new endpoints `/me/home` + `/me/item/:id` — Tasks 3-4 ✅.
- §7.1 schema — Task 1 adds `scheduledAt` + `scheduledMinutes` (minor addition beyond the revamp spec, documented as an internal cache to avoid Calendar round-trips).

**Placeholder scan:** no TBD/TODO/vague handwaves. Every code block is complete.

**Type consistency:**
- `HomeItem` shape identical in backend (`home.service.ts`), frontend (`me-home.ts`), and tests.
- `ItemResponse` shape identical across service, frontend hook, tests.
- `ItemOutcome` imported from `@ics-select/shared` everywhere.

**Ambiguities noted:**
- The `apiFetch` body encoding style needs verification in Task 5 Step 2 before finalizing.
- The `accessToken` localStorage key needs verification in Task 10 Step 1 before finalizing.
- `JwtPayload` import path might need adaptation (tasks 3 and 4 note this).

**Out-of-scope correctly deferred:**
- `/me/cohort` feed + ranking: PR 2c.
- `/me/retro`: PR 2c.
- `/me/settings`, `/me/onboarding`, WhatsApp phone: PR 2c.
- Reminder cron rewrite (ICS-ID parsing): PR 3.
- Admin: PR 3.
- Tool calling / AI depth: PR 4.

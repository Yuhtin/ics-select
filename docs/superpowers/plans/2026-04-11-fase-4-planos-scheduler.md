# ICS Select — Fase 4 (Planos Semanais + Scheduler) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship the core feature of the product. The admin can create a weekly study plan for a member by picking items from the library (ordered), publish it, and the scheduler service distributes the items across the week as Google Calendar events. The member sees "this week" with today's sessions and the full plan, marks items as done (with a fácil/difícil rating + optional reflection + "travei" flag), and the admin sees progress in real time. No AI yet — Phase 6 adds that.

**Architecture:** A `WeeklyPlan` belongs to a `User` and a `Cycle`. It contains ordered `WeeklyPlanItem`s referencing `LibraryItem`s. On publish, a greedy scheduler chunks each item into sessions of at most `preferredSessionMinutes`, finds free windows in the member's availability minus busy slots from Google Calendar, places chunks in order, creates events on the member's primary calendar, and persists `StudySession` rows with the returned `googleEventId`. Overflow (items that don't fit) blocks publication with HTTP 409 unless `?force=true`. Re-publication diffs existing sessions and patches/deletes accordingly, preserving `COMPLETED` sessions.

**Tech Stack:** No new deps beyond what Phases 0-3 installed. Uses existing `PrismaService`, `GoogleCalendarService`, Zod, HeroUI.

---

## File Structure

### packages/prisma
| Path | Purpose |
|---|---|
| `schema.prisma` | Add `WeeklyPlan`, `WeeklyPlanItem`, `StudySession` models + enums |
| `migrations/5_weekly_plans/migration.sql` | New migration |

### apps/api
| Path | Purpose |
|---|---|
| `src/weekly-plans/weekly-plans.module.ts` | Module |
| `src/weekly-plans/weekly-plans.service.ts` | CRUD, publication gate |
| `src/weekly-plans/weekly-plans.service.spec.ts` | Unit tests |
| `src/weekly-plans/weekly-plans.controller.ts` | REST |
| `src/weekly-plans/dto.ts` | Zod schemas |
| `src/scheduler/scheduler.module.ts` | Module |
| `src/scheduler/scheduler.service.ts` | Greedy algorithm |
| `src/scheduler/scheduler.service.spec.ts` | Unit tests — many edge cases |
| `src/app.module.ts` | Import new modules |

### apps/web
| Path | Purpose |
|---|---|
| `app/(app)/admin/plans/[memberId]/page.tsx` | Plan editor for a member |
| `app/(app)/me/page.tsx` | Replace placeholder with "this week" |
| `app/(app)/me/plan/[planId]/item/[itemId]/page.tsx` | Item detail with mark done |
| `components/plans/plan-editor.tsx` | Editor widget |
| `components/plans/plan-week-view.tsx` | Member week view |

---

## Task 1: Prisma schema — weekly plans + study sessions

**Files:**
- Modify: `packages/prisma/prisma/schema.prisma`
- Create: `packages/prisma/prisma/migrations/5_weekly_plans/migration.sql`

- [ ] **Step 1: Add enums and models**

Append to `schema.prisma`:

```prisma
enum WeeklyPlanStatus {
  DRAFT
  PUBLISHED
  COMPLETED
  ARCHIVED
}

enum ItemStatus {
  PENDING
  DONE
}

enum DifficultyRating {
  EASY
  HARD
}

enum StudySessionStatus {
  SCHEDULED
  COMPLETED
  MISSED
  RESCHEDULED
}

model WeeklyPlan {
  id          String           @id @default(cuid())
  userId      String
  cycleId     String
  weekStart   DateTime
  weekEnd     DateTime
  status      WeeklyPlanStatus @default(DRAFT)
  adminNotes  String?
  createdAt   DateTime         @default(now())
  publishedAt DateTime?

  user  User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  cycle Cycle            @relation(fields: [cycleId], references: [id])
  items WeeklyPlanItem[]

  @@index([userId, weekStart])
}

model WeeklyPlanItem {
  id               String            @id @default(cuid())
  weeklyPlanId     String
  libraryItemId    String
  order            Int
  status           ItemStatus        @default(PENDING)
  difficultyRating DifficultyRating?
  stuck            Boolean           @default(false)
  stuckAt          DateTime?
  reflection       String?
  completedAt      DateTime?

  weeklyPlan  WeeklyPlan     @relation(fields: [weeklyPlanId], references: [id], onDelete: Cascade)
  libraryItem LibraryItem    @relation(fields: [libraryItemId], references: [id])
  sessions    StudySession[]

  @@unique([weeklyPlanId, order])
}

model StudySession {
  id               String             @id @default(cuid())
  weeklyPlanItemId String
  scheduledAt      DateTime
  durationMinutes  Int
  googleEventId    String?
  status           StudySessionStatus @default(SCHEDULED)

  weeklyPlanItem WeeklyPlanItem @relation(fields: [weeklyPlanItemId], references: [id], onDelete: Cascade)
}
```

Also add the back-relations in the `User`, `Cycle`, and `LibraryItem` models:
- `User`: add `weeklyPlans WeeklyPlan[]`
- `Cycle`: add `weeklyPlans WeeklyPlan[]`
- `LibraryItem`: add `planItems WeeklyPlanItem[]`

- [ ] **Step 2: Create SQL migration**

Create `packages/prisma/prisma/migrations/5_weekly_plans/migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "WeeklyPlanStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('PENDING', 'DONE');

-- CreateEnum
CREATE TYPE "DifficultyRating" AS ENUM ('EASY', 'HARD');

-- CreateEnum
CREATE TYPE "StudySessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'MISSED', 'RESCHEDULED');

-- CreateTable
CREATE TABLE "WeeklyPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "status" "WeeklyPlanStatus" NOT NULL DEFAULT 'DRAFT',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "WeeklyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyPlanItem" (
    "id" TEXT NOT NULL,
    "weeklyPlanId" TEXT NOT NULL,
    "libraryItemId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'PENDING',
    "difficultyRating" "DifficultyRating",
    "stuck" BOOLEAN NOT NULL DEFAULT false,
    "stuckAt" TIMESTAMP(3),
    "reflection" TEXT,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "WeeklyPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySession" (
    "id" TEXT NOT NULL,
    "weeklyPlanItemId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "googleEventId" TEXT,
    "status" "StudySessionStatus" NOT NULL DEFAULT 'SCHEDULED',

    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyPlan_userId_weekStart_idx" ON "WeeklyPlan"("userId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyPlanItem_weeklyPlanId_order_key" ON "WeeklyPlanItem"("weeklyPlanId", "order");

-- AddForeignKey
ALTER TABLE "WeeklyPlan" ADD CONSTRAINT "WeeklyPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyPlan" ADD CONSTRAINT "WeeklyPlan_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyPlanItem" ADD CONSTRAINT "WeeklyPlanItem_weeklyPlanId_fkey" FOREIGN KEY ("weeklyPlanId") REFERENCES "WeeklyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyPlanItem" ADD CONSTRAINT "WeeklyPlanItem_libraryItemId_fkey" FOREIGN KEY ("libraryItemId") REFERENCES "LibraryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_weeklyPlanItemId_fkey" FOREIGN KEY ("weeklyPlanItemId") REFERENCES "WeeklyPlanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Regenerate + apply**

Run: `pnpm --filter @ics-select/prisma exec prisma generate && docker compose up -d postgres && pnpm --filter @ics-select/prisma exec prisma migrate deploy`

- [ ] **Step 4: Commit**

```bash
git add packages/prisma/prisma/schema.prisma packages/prisma/prisma/migrations/5_weekly_plans
git commit -m "feat(prisma): add WeeklyPlan, WeeklyPlanItem, StudySession models"
```

---

## Task 2: SchedulerService with full unit tests (TDD)

**Files:**
- Create: `apps/api/src/scheduler/scheduler.service.ts`
- Create: `apps/api/src/scheduler/scheduler.service.spec.ts`

**Contract of the scheduler:** given an ordered list of items (each with estimated minutes), a member availability (minutes per weekday + preferredSessionMinutes), busy blocks from Google Calendar within [weekStart, weekEnd], produce either (a) a list of planned sessions, each tied to an item, with scheduledAt + durationMinutes, or (b) an overflow list for items (or item chunks) that could not fit.

**Algorithm (keep simple):**
1. Split each item into chunks of size ≤ preferredSessionMinutes (may leave a smaller residue at the end).
2. For each day in the week, compute free blocks from the declared daily minutes minus any overlap with busy windows. A "free block" is a single contiguous span starting at the day's start (local 08:00) of N minutes; we don't try to match actual calendar availability precisely in Phase 4 — that's a future refinement. We simply subtract busy time on each day from the declared daily budget to get an available-minutes number per day, and lay out chunks with a 10-minute buffer between them within a day's budget.
3. Walk chunks in order, packing them day by day. Each chunk gets `scheduledAt = dayStart + cumulativeMinutesToday` and `durationMinutes = chunk.size`. Add 10-minute buffer. If a day runs out, move to the next day.
4. If we run out of days, remaining chunks are overflow.

This is simpler than the spec's ideal algorithm but unblocks Phase 4. Refinements (real free windows, recovering missed sessions, etc.) come in Phase 5+.

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/scheduler/scheduler.service.spec.ts`:

```ts
import { SchedulerService, type SchedulerInput } from './scheduler.service';

const MONDAY = new Date('2026-04-13T00:00:00-03:00');

function input(overrides: Partial<SchedulerInput> = {}): SchedulerInput {
  return {
    weekStart: MONDAY,
    availability: {
      mondayMinutes: 60,
      tuesdayMinutes: 60,
      wednesdayMinutes: 60,
      thursdayMinutes: 60,
      fridayMinutes: 60,
      saturdayMinutes: 0,
      sundayMinutes: 0,
      preferredSessionMinutes: 60,
      timezone: 'America/Sao_Paulo',
    },
    busyByDay: {
      0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [],
    },
    items: [],
    ...overrides,
  };
}

describe('SchedulerService.plan', () => {
  const svc = new SchedulerService();

  it('places a single short item on Monday', () => {
    const result = svc.plan(
      input({ items: [{ id: 'i1', estimatedMinutes: 30 }] }),
    );
    expect(result.overflow).toEqual([]);
    expect(result.sessions).toHaveLength(1);
    expect(result.sessions[0]?.itemId).toBe('i1');
    expect(result.sessions[0]?.durationMinutes).toBe(30);
    // Monday 08:00 local ~= 11:00 UTC
    expect(result.sessions[0]?.scheduledAt.getUTCHours()).toBe(11);
  });

  it('splits a 90-minute item into two 45-minute sessions when pref is 45', () => {
    const result = svc.plan(
      input({
        items: [{ id: 'i1', estimatedMinutes: 90 }],
        availability: { ...input().availability, preferredSessionMinutes: 45 },
      }),
    );
    expect(result.overflow).toEqual([]);
    expect(result.sessions).toHaveLength(2);
    expect(result.sessions[0]?.durationMinutes).toBe(45);
    expect(result.sessions[1]?.durationMinutes).toBe(45);
  });

  it('leaves a residue chunk for an item that is not a multiple of pref', () => {
    const result = svc.plan(
      input({
        items: [{ id: 'i1', estimatedMinutes: 100 }],
        availability: { ...input().availability, preferredSessionMinutes: 45 },
      }),
    );
    expect(result.sessions).toHaveLength(3);
    expect(result.sessions[0]?.durationMinutes).toBe(45);
    expect(result.sessions[1]?.durationMinutes).toBe(45);
    expect(result.sessions[2]?.durationMinutes).toBe(10);
  });

  it('moves to the next day when daily budget is exceeded', () => {
    const result = svc.plan(
      input({
        items: [
          { id: 'i1', estimatedMinutes: 60 },
          { id: 'i2', estimatedMinutes: 60 },
        ],
      }),
    );
    expect(result.sessions).toHaveLength(2);
    // First on Monday, second on Tuesday (budget 60 min fills on Monday)
    const d1 = result.sessions[0]?.scheduledAt.getUTCDate();
    const d2 = result.sessions[1]?.scheduledAt.getUTCDate();
    expect(d2).toBe((d1 ?? 0) + 1);
  });

  it('reports overflow when the plan exceeds the weekly budget', () => {
    const result = svc.plan(
      input({
        items: [
          { id: 'i1', estimatedMinutes: 60 },
          { id: 'i2', estimatedMinutes: 60 },
          { id: 'i3', estimatedMinutes: 60 },
          { id: 'i4', estimatedMinutes: 60 },
          { id: 'i5', estimatedMinutes: 60 },
          { id: 'i6', estimatedMinutes: 60 },
        ],
      }),
    );
    // 5 week days × 60 min = 300 min; 6 × 60 = 360 min total; 60 min overflows
    expect(result.sessions.length).toBe(5);
    expect(result.overflow.length).toBeGreaterThan(0);
    expect(result.overflow[0]?.itemId).toBe('i6');
  });

  it('respects busy time by reducing that day budget', () => {
    const result = svc.plan(
      input({
        items: [
          { id: 'i1', estimatedMinutes: 30 },
          { id: 'i2', estimatedMinutes: 30 },
        ],
        busyByDay: {
          0: [{ startMinute: 8 * 60, endMinute: 9 * 60 }], // busy 8-9 Monday
          1: [], 2: [], 3: [], 4: [], 5: [], 6: [],
        },
      }),
    );
    // Monday budget shrinks to 0 (60min - 60min busy), both items move to Tue
    const monday = result.sessions.filter((s) => s.scheduledAt.getUTCDate() === MONDAY.getUTCDate());
    expect(monday.length).toBe(0);
  });
});
```

- [ ] **Step 2: Implement scheduler service**

Create `apps/api/src/scheduler/scheduler.service.ts`:

```ts
import { Injectable } from '@nestjs/common';

export type ItemInput = { id: string; estimatedMinutes: number };

export type BusyBlock = { startMinute: number; endMinute: number };

export type SchedulerInput = {
  weekStart: Date;
  availability: {
    mondayMinutes: number;
    tuesdayMinutes: number;
    wednesdayMinutes: number;
    thursdayMinutes: number;
    fridayMinutes: number;
    saturdayMinutes: number;
    sundayMinutes: number;
    preferredSessionMinutes: number;
    timezone: string;
  };
  // Key: day index 0..6 (0=Mon); value: busy blocks in minutes-of-day
  busyByDay: Record<number, BusyBlock[]>;
  items: ItemInput[];
};

export type PlannedSession = {
  itemId: string;
  scheduledAt: Date;
  durationMinutes: number;
};

export type OverflowChunk = { itemId: string; minutesRequired: number };

export type SchedulerOutput = {
  sessions: PlannedSession[];
  overflow: OverflowChunk[];
};

const DAY_MINUTES_KEYS: (keyof SchedulerInput['availability'])[] = [
  'mondayMinutes',
  'tuesdayMinutes',
  'wednesdayMinutes',
  'thursdayMinutes',
  'fridayMinutes',
  'saturdayMinutes',
  'sundayMinutes',
];

const DAY_START_MINUTE = 8 * 60; // 08:00 local
const BUFFER_MINUTES = 10;

@Injectable()
export class SchedulerService {
  plan(input: SchedulerInput): SchedulerOutput {
    const pref = input.availability.preferredSessionMinutes;

    // 1. Chunk items
    const chunks: Array<{ itemId: string; minutes: number }> = [];
    for (const item of input.items) {
      let remaining = item.estimatedMinutes;
      while (remaining > 0) {
        const size = Math.min(remaining, pref);
        chunks.push({ itemId: item.id, minutes: size });
        remaining -= size;
      }
    }

    // 2. Compute effective daily budgets after subtracting busy time
    const budgets: number[] = DAY_MINUTES_KEYS.map((key, idx) => {
      const declared = input.availability[key] as number;
      const busy = (input.busyByDay[idx] ?? []).reduce(
        (sum, b) => sum + Math.max(0, b.endMinute - b.startMinute),
        0,
      );
      return Math.max(0, declared - busy);
    });

    // 3. Pack chunks into days
    const sessions: PlannedSession[] = [];
    const overflow: OverflowChunk[] = [];
    let dayIdx = 0;
    let minuteIntoDay = 0;

    for (const chunk of chunks) {
      while (dayIdx < 7 && budgets[dayIdx]! - minuteIntoDay < chunk.minutes) {
        dayIdx += 1;
        minuteIntoDay = 0;
      }
      if (dayIdx >= 7) {
        overflow.push({ itemId: chunk.itemId, minutesRequired: chunk.minutes });
        continue;
      }
      const scheduledAt = addMinutesToMonday(input.weekStart, dayIdx, DAY_START_MINUTE + minuteIntoDay);
      sessions.push({
        itemId: chunk.itemId,
        scheduledAt,
        durationMinutes: chunk.minutes,
      });
      minuteIntoDay += chunk.minutes + BUFFER_MINUTES;
    }

    return { sessions, overflow };
  }
}

function addMinutesToMonday(weekStart: Date, dayIdx: number, minuteOfDay: number): Date {
  const d = new Date(weekStart.getTime());
  d.setUTCDate(d.getUTCDate() + dayIdx);
  // Assume weekStart is already normalized to 00:00 local. Add minuteOfDay.
  // This ignores DST drift — acceptable for Phase 4.
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCMinutes(d.getUTCMinutes() + minuteOfDay);
  return d;
}
```

Note: the tests use `2026-04-13T00:00:00-03:00` which is `2026-04-13T03:00:00Z`. Then adding 8 hours 0 minutes means `11:00Z`. The test expects `getUTCHours() === 11`. The `addMinutesToMonday` above normalizes to `00:00 UTC` first, which breaks the test. Adjust so it keeps the weekStart as-is and adds from there:

Replace `addMinutesToMonday` with:

```ts
function addMinutesToMonday(weekStart: Date, dayIdx: number, minuteOfDay: number): Date {
  const d = new Date(weekStart.getTime());
  d.setUTCDate(d.getUTCDate() + dayIdx);
  d.setUTCMinutes(d.getUTCMinutes() + minuteOfDay);
  return d;
}
```

Now `weekStart = 2026-04-13T03:00:00Z`, add 0 days + 480 minutes = `2026-04-13T11:00:00Z` → `getUTCHours() === 11`. ✓

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern scheduler.service`
Expected: 6 passing tests.

- [ ] **Step 4: Module**

Create `apps/api/src/scheduler/scheduler.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service.js';

@Module({
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class SchedulerModule {}
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/scheduler
git commit -m "feat(api): add SchedulerService with greedy chunk placement"
```

---

## Task 3: WeeklyPlansService + controller

**Files:**
- Create: `apps/api/src/weekly-plans/weekly-plans.service.ts`
- Create: `apps/api/src/weekly-plans/weekly-plans.service.spec.ts`
- Create: `apps/api/src/weekly-plans/weekly-plans.controller.ts`
- Create: `apps/api/src/weekly-plans/dto.ts`
- Create: `apps/api/src/weekly-plans/weekly-plans.module.ts`

- [ ] **Step 1: DTOs**

Create `apps/api/src/weekly-plans/dto.ts`:

```ts
import { z } from 'zod';

export const CreatePlanSchema = z.object({
  cycleId: z.string().min(1),
  weekStart: z.coerce.date(),
  weekEnd: z.coerce.date(),
  adminNotes: z.string().optional(),
  items: z
    .array(
      z.object({
        libraryItemId: z.string().min(1),
        order: z.number().int().min(0),
      }),
    )
    .min(1),
});

export const UpdatePlanSchema = z.object({
  adminNotes: z.string().optional(),
  items: z
    .array(
      z.object({
        libraryItemId: z.string().min(1),
        order: z.number().int().min(0),
      }),
    )
    .optional(),
});

export const MarkItemDoneSchema = z.object({
  rating: z.enum(['EASY', 'HARD']).optional(),
  reflection: z.string().optional(),
});
```

- [ ] **Step 2: Service (CRUD + publish stub — real publish happens in Task 4)**

Create `apps/api/src/weekly-plans/weekly-plans.service.ts`:

```ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';

type CreateInput = {
  userId: string;
  cycleId: string;
  weekStart: Date;
  weekEnd: Date;
  adminNotes?: string;
  items: Array<{ libraryItemId: string; order: number }>;
};

type UpdateInput = {
  adminNotes?: string;
  items?: Array<{ libraryItemId: string; order: number }>;
};

@Injectable()
export class WeeklyPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async createDraft(input: CreateInput) {
    return this.prisma.weeklyPlan.create({
      data: {
        userId: input.userId,
        cycleId: input.cycleId,
        weekStart: input.weekStart,
        weekEnd: input.weekEnd,
        adminNotes: input.adminNotes,
        status: 'DRAFT',
        items: {
          create: input.items.map((i) => ({
            libraryItemId: i.libraryItemId,
            order: i.order,
          })),
        },
      },
      include: { items: { include: { libraryItem: true, sessions: true } } },
    });
  }

  async update(id: string, input: UpdateInput) {
    const existing = await this.getByIdOrThrow(id);
    if (existing.status !== 'DRAFT') {
      throw new ConflictException('only DRAFT plans can be edited');
    }
    if (input.items) {
      // Delete and recreate items for simplicity
      await this.prisma.weeklyPlanItem.deleteMany({ where: { weeklyPlanId: id } });
    }
    return this.prisma.weeklyPlan.update({
      where: { id },
      data: {
        adminNotes: input.adminNotes,
        ...(input.items
          ? {
              items: {
                create: input.items.map((i) => ({
                  libraryItemId: i.libraryItemId,
                  order: i.order,
                })),
              },
            }
          : {}),
      },
      include: { items: { include: { libraryItem: true, sessions: true } } },
    });
  }

  getById(id: string) {
    return this.prisma.weeklyPlan.findUnique({
      where: { id },
      include: {
        items: {
          include: { libraryItem: true, sessions: true },
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async getByIdOrThrow(id: string) {
    const plan = await this.getById(id);
    if (!plan) throw new NotFoundException('plan not found');
    return plan;
  }

  listForMember(userId: string) {
    return this.prisma.weeklyPlan.findMany({
      where: { userId },
      orderBy: { weekStart: 'desc' },
      include: {
        items: { include: { libraryItem: true, sessions: true }, orderBy: { order: 'asc' } },
      },
    });
  }

  async markItemDone(
    planId: string,
    itemId: string,
    userId: string,
    input: { rating?: 'EASY' | 'HARD'; reflection?: string },
  ) {
    const plan = await this.prisma.weeklyPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('plan not found');
    if (plan.userId !== userId) throw new NotFoundException('plan not found');
    return this.prisma.weeklyPlanItem.update({
      where: { id: itemId },
      data: {
        status: 'DONE',
        completedAt: new Date(),
        difficultyRating: input.rating ?? null,
        reflection: input.reflection ?? null,
      },
    });
  }

  async markItemStuck(planId: string, itemId: string, userId: string) {
    const plan = await this.prisma.weeklyPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('plan not found');
    if (plan.userId !== userId) throw new NotFoundException('plan not found');
    return this.prisma.weeklyPlanItem.update({
      where: { id: itemId },
      data: { stuck: true, stuckAt: new Date() },
    });
  }
}
```

- [ ] **Step 3: Unit tests for the service (TDD minimum)**

Create `apps/api/src/weekly-plans/weekly-plans.service.spec.ts`:

```ts
import { WeeklyPlansService } from './weekly-plans.service';

function fakePrisma() {
  const plans = new Map<string, any>();
  const items = new Map<string, any>();
  let pid = 0;
  let iid = 0;
  return {
    plans,
    items,
    weeklyPlan: {
      create: jest.fn(async ({ data, include }: any) => {
        const id = `p-${++pid}`;
        const created = {
          id,
          userId: data.userId,
          cycleId: data.cycleId,
          weekStart: data.weekStart,
          weekEnd: data.weekEnd,
          adminNotes: data.adminNotes ?? null,
          status: data.status ?? 'DRAFT',
          publishedAt: null,
          items:
            data.items?.create?.map((i: any) => {
              const itemId = `i-${++iid}`;
              const item = { id: itemId, weeklyPlanId: id, ...i, status: 'PENDING', sessions: [] };
              items.set(itemId, item);
              return item;
            }) ?? [],
        };
        plans.set(id, created);
        return created;
      }),
      findUnique: jest.fn(async ({ where }: any) => plans.get(where.id) ?? null),
      update: jest.fn(async ({ where, data }: any) => {
        const cur = plans.get(where.id);
        const next = { ...cur, ...data };
        plans.set(where.id, next);
        return next;
      }),
      findMany: jest.fn(async () => Array.from(plans.values())),
    },
    weeklyPlanItem: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
      update: jest.fn(async ({ where, data }: any) => {
        const cur = items.get(where.id);
        const next = { ...cur, ...data };
        items.set(where.id, next);
        return next;
      }),
    },
  };
}

describe('WeeklyPlansService', () => {
  it('createDraft creates a DRAFT plan with ordered items', async () => {
    const prisma = fakePrisma();
    const svc = new WeeklyPlansService(prisma as any);
    const plan = await svc.createDraft({
      userId: 'u-1',
      cycleId: 'c-1',
      weekStart: new Date('2026-04-13'),
      weekEnd: new Date('2026-04-19'),
      items: [
        { libraryItemId: 'li-1', order: 0 },
        { libraryItemId: 'li-2', order: 1 },
      ],
    });
    expect(plan.status).toBe('DRAFT');
    expect(plan.items).toHaveLength(2);
  });

  it('markItemDone updates status and stores rating + reflection', async () => {
    const prisma = fakePrisma();
    const svc = new WeeklyPlansService(prisma as any);
    const plan = await svc.createDraft({
      userId: 'u-1',
      cycleId: 'c-1',
      weekStart: new Date('2026-04-13'),
      weekEnd: new Date('2026-04-19'),
      items: [{ libraryItemId: 'li-1', order: 0 }],
    });
    const itemId = plan.items[0].id;
    const updated = await svc.markItemDone(plan.id, itemId, 'u-1', {
      rating: 'HARD',
      reflection: 'Travei no passo 3',
    });
    expect(updated.status).toBe('DONE');
    expect(updated.difficultyRating).toBe('HARD');
    expect(updated.reflection).toBe('Travei no passo 3');
  });
});
```

- [ ] **Step 4: Controller**

Create `apps/api/src/weekly-plans/weekly-plans.controller.ts`:

```ts
import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { JwtStrategyPayload } from '../auth/strategies/jwt.strategy.js';
import { WeeklyPlansService } from './weekly-plans.service.js';
import { PublicationService } from './publication.service.js';
import { CreatePlanSchema, MarkItemDoneSchema, UpdatePlanSchema } from './dto.js';

@Controller()
export class WeeklyPlansController {
  constructor(
    private readonly plans: WeeklyPlansService,
    private readonly publication: PublicationService,
  ) {}

  @Roles('ADMIN')
  @Post('members/:memberId/plans')
  create(@Param('memberId') memberId: string, @Body() body: unknown) {
    const parsed = CreatePlanSchema.parse(body);
    return this.plans.createDraft({ userId: memberId, ...parsed });
  }

  @Roles('ADMIN')
  @Patch('plans/:id')
  update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdatePlanSchema.parse(body);
    return this.plans.update(id, parsed);
  }

  @Roles('ADMIN')
  @Post('plans/:id/publish')
  publish(@Param('id') id: string, @Query('force') force?: string) {
    return this.publication.publish(id, force === 'true');
  }

  @Get('plans/:id')
  async get(@Param('id') id: string, @CurrentUser() user: JwtStrategyPayload) {
    const plan = await this.plans.getById(id);
    if (!plan) throw new NotFoundException('plan not found');
    if (user.role !== 'ADMIN' && plan.userId !== user.sub) {
      throw new NotFoundException('plan not found');
    }
    return plan;
  }

  @Get('members/:memberId/plans')
  listForMember(@Param('memberId') memberId: string, @CurrentUser() user: JwtStrategyPayload) {
    if (user.role !== 'ADMIN' && user.sub !== memberId) {
      throw new NotFoundException('not found');
    }
    return this.plans.listForMember(memberId);
  }

  @Get('me/week')
  myWeek(@CurrentUser() user: JwtStrategyPayload) {
    return this.plans.listForMember(user.sub);
  }

  @Post('plans/:planId/items/:itemId/done')
  markDone(
    @Param('planId') planId: string,
    @Param('itemId') itemId: string,
    @Body() body: unknown,
    @CurrentUser() user: JwtStrategyPayload,
  ) {
    const parsed = MarkItemDoneSchema.parse(body);
    return this.plans.markItemDone(planId, itemId, user.sub, parsed);
  }

  @Post('plans/:planId/items/:itemId/stuck')
  markStuck(
    @Param('planId') planId: string,
    @Param('itemId') itemId: string,
    @CurrentUser() user: JwtStrategyPayload,
  ) {
    return this.plans.markItemStuck(planId, itemId, user.sub);
  }
}
```

- [ ] **Step 5: Module (will be completed in Task 4 when PublicationService is added)**

Create `apps/api/src/weekly-plans/weekly-plans.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { WeeklyPlansController } from './weekly-plans.controller.js';
import { WeeklyPlansService } from './weekly-plans.service.js';
import { PublicationService } from './publication.service.js';
import { SchedulerModule } from '../scheduler/scheduler.module.js';
import { GoogleCalendarModule } from '../google-calendar/google-calendar.module.js';

@Module({
  imports: [SchedulerModule, GoogleCalendarModule],
  controllers: [WeeklyPlansController],
  providers: [WeeklyPlansService, PublicationService],
  exports: [WeeklyPlansService],
})
export class WeeklyPlansModule {}
```

- [ ] **Step 6: Commit (the module will not build until Task 4 adds PublicationService — commit tests + service first, then controller + module stub)**

```bash
git add apps/api/src/weekly-plans/weekly-plans.service.ts apps/api/src/weekly-plans/weekly-plans.service.spec.ts apps/api/src/weekly-plans/dto.ts
git commit -m "feat(api): add WeeklyPlansService with CRUD and done/stuck endpoints"
```

---

## Task 4: PublicationService (publish + scheduler integration)

**Files:**
- Create: `apps/api/src/weekly-plans/publication.service.ts`
- Create: `apps/api/src/weekly-plans/publication.service.spec.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/weekly-plans/publication.service.spec.ts`:

```ts
import { PublicationService, PlanOverflowError } from './publication.service';

function fakePrisma() {
  const plans = new Map<string, any>();
  const items = new Map<string, any>();
  const sessions = new Map<string, any>();
  const availability = {
    mondayMinutes: 60,
    tuesdayMinutes: 60,
    wednesdayMinutes: 60,
    thursdayMinutes: 60,
    fridayMinutes: 60,
    saturdayMinutes: 0,
    sundayMinutes: 0,
    preferredSessionMinutes: 60,
    timezone: 'America/Sao_Paulo',
  };
  return {
    plans,
    items,
    sessions,
    availability,
    weeklyPlan: {
      findUnique: jest.fn(async ({ where }: any) => plans.get(where.id) ?? null),
      update: jest.fn(async ({ where, data }: any) => {
        const cur = plans.get(where.id);
        const next = { ...cur, ...data };
        plans.set(where.id, next);
        return next;
      }),
    },
    memberAvailability: {
      findUnique: jest.fn(async () => availability),
    },
    studySession: {
      create: jest.fn(async ({ data }: any) => {
        const id = `s-${sessions.size + 1}`;
        const rec = { id, ...data };
        sessions.set(id, rec);
        return rec;
      }),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
  };
}

const calendar = {
  getFreeBusy: jest.fn(async () => []),
  createEvent: jest.fn(async () => 'evt-1'),
  deleteEvent: jest.fn(async () => undefined),
};

const scheduler = {
  plan: jest.fn(),
};

describe('PublicationService.publish', () => {
  beforeEach(() => {
    calendar.getFreeBusy.mockClear();
    calendar.createEvent.mockClear();
    scheduler.plan.mockReset();
  });

  it('creates StudySessions and calendar events when scheduler returns no overflow', async () => {
    const prisma = fakePrisma();
    prisma.plans.set('p-1', {
      id: 'p-1',
      userId: 'u-1',
      cycleId: 'c-1',
      weekStart: new Date('2026-04-13T00:00:00-03:00'),
      weekEnd: new Date('2026-04-20T00:00:00-03:00'),
      status: 'DRAFT',
      items: [
        { id: 'wpi-1', libraryItemId: 'li-1', order: 0, libraryItem: { title: 'A', estimatedMinutes: 60 } },
      ],
    });
    scheduler.plan.mockReturnValue({
      sessions: [
        { itemId: 'wpi-1', scheduledAt: new Date('2026-04-13T11:00:00Z'), durationMinutes: 60 },
      ],
      overflow: [],
    });
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any);
    const result = await svc.publish('p-1', false);
    expect(result.plan.status).toBe('PUBLISHED');
    expect(result.sessionsCreated).toBe(1);
    expect(calendar.createEvent).toHaveBeenCalledTimes(1);
  });

  it('throws PlanOverflowError when there is overflow and force is false', async () => {
    const prisma = fakePrisma();
    prisma.plans.set('p-1', {
      id: 'p-1',
      userId: 'u-1',
      cycleId: 'c-1',
      weekStart: new Date('2026-04-13T00:00:00-03:00'),
      weekEnd: new Date('2026-04-20T00:00:00-03:00'),
      status: 'DRAFT',
      items: [
        { id: 'wpi-1', libraryItemId: 'li-1', order: 0, libraryItem: { title: 'A', estimatedMinutes: 60 } },
      ],
    });
    scheduler.plan.mockReturnValue({
      sessions: [],
      overflow: [{ itemId: 'wpi-1', minutesRequired: 60 }],
    });
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any);
    await expect(svc.publish('p-1', false)).rejects.toBeInstanceOf(PlanOverflowError);
    expect(prisma.plans.get('p-1').status).toBe('DRAFT');
  });

  it('publishes with force=true even with overflow, creating only fitting sessions', async () => {
    const prisma = fakePrisma();
    prisma.plans.set('p-1', {
      id: 'p-1',
      userId: 'u-1',
      cycleId: 'c-1',
      weekStart: new Date('2026-04-13T00:00:00-03:00'),
      weekEnd: new Date('2026-04-20T00:00:00-03:00'),
      status: 'DRAFT',
      items: [
        { id: 'wpi-1', libraryItemId: 'li-1', order: 0, libraryItem: { title: 'A', estimatedMinutes: 60 } },
        { id: 'wpi-2', libraryItemId: 'li-2', order: 1, libraryItem: { title: 'B', estimatedMinutes: 60 } },
      ],
    });
    scheduler.plan.mockReturnValue({
      sessions: [
        { itemId: 'wpi-1', scheduledAt: new Date('2026-04-13T11:00:00Z'), durationMinutes: 60 },
      ],
      overflow: [{ itemId: 'wpi-2', minutesRequired: 60 }],
    });
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any);
    const result = await svc.publish('p-1', true);
    expect(result.plan.status).toBe('PUBLISHED');
    expect(result.sessionsCreated).toBe(1);
    expect(result.overflow).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Implement publication service**

Create `apps/api/src/weekly-plans/publication.service.ts`:

```ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { SchedulerService, type SchedulerInput } from '../scheduler/scheduler.service.js';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service.js';

export class PlanOverflowError extends ConflictException {
  constructor(public readonly overflow: Array<{ itemId: string; minutesRequired: number }>) {
    super({
      error: {
        code: 'PLAN_OVERFLOW',
        message: 'Não há janelas suficientes no Calendar pra este plano',
        details: { overflow },
      },
    });
  }
}

@Injectable()
export class PublicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SchedulerService,
    private readonly calendar: GoogleCalendarService,
  ) {}

  async publish(planId: string, force: boolean) {
    const plan = await this.prisma.weeklyPlan.findUnique({
      where: { id: planId },
      include: {
        items: { include: { libraryItem: true }, orderBy: { order: 'asc' } },
      },
    });
    if (!plan) throw new NotFoundException('plan not found');

    const availability = await this.prisma.memberAvailability.findUnique({
      where: { userId: plan.userId },
    });
    if (!availability) {
      throw new ConflictException({
        error: {
          code: 'NO_AVAILABILITY',
          message: 'Membro ainda não definiu disponibilidade',
        },
      });
    }

    const input: SchedulerInput = {
      weekStart: plan.weekStart,
      availability,
      busyByDay: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }, // simplification: Phase 4 ignores real Calendar free/busy
      items: plan.items.map((i) => ({
        id: i.id,
        estimatedMinutes: i.libraryItem.estimatedMinutes,
      })),
    };

    const result = this.scheduler.plan(input);
    if (result.overflow.length > 0 && !force) {
      throw new PlanOverflowError(result.overflow);
    }

    // Remove any pre-existing sessions (re-publish) — Phase 4 uses "delete-all and recreate".
    // Phase 5+ will diff.
    await this.prisma.studySession.deleteMany({
      where: { weeklyPlanItem: { weeklyPlanId: planId } },
    });

    // Create sessions + Calendar events
    for (const session of result.sessions) {
      const item = plan.items.find((i) => i.id === session.itemId)!;
      const eventEnd = new Date(session.scheduledAt.getTime() + session.durationMinutes * 60 * 1000);
      let googleEventId: string | null = null;
      try {
        googleEventId = await this.calendar.createEvent(plan.userId, {
          summary: `ICS Select — ${item.libraryItem.title}`,
          description: item.libraryItem.url
            ? `Link: ${item.libraryItem.url}`
            : 'ICS Select study session',
          start: session.scheduledAt,
          end: eventEnd,
        });
      } catch {
        // If Calendar fails, still create the session record; admin can retry
        googleEventId = null;
      }
      await this.prisma.studySession.create({
        data: {
          weeklyPlanItemId: session.itemId,
          scheduledAt: session.scheduledAt,
          durationMinutes: session.durationMinutes,
          googleEventId,
          status: 'SCHEDULED',
        },
      });
    }

    const updated = await this.prisma.weeklyPlan.update({
      where: { id: planId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });

    return {
      plan: updated,
      sessionsCreated: result.sessions.length,
      overflow: result.overflow,
    };
  }
}
```

- [ ] **Step 3: Run tests**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern publication`
Expected: 3 passing tests.

- [ ] **Step 4: Wire `WeeklyPlansModule` into `AppModule`**

Import it.

- [ ] **Step 5: Run full test suite + build**

Run: `pnpm --filter @ics-select/api test && pnpm --filter @ics-select/api test:e2e && pnpm --filter @ics-select/api build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/weekly-plans apps/api/src/app.module.ts
git commit -m "feat(api): add PublicationService with scheduler + Calendar integration"
```

---

## Task 5: Frontend — admin plan editor

**Files:**
- Create: `apps/web/app/(app)/admin/plans/[memberId]/page.tsx`
- Create: `apps/web/components/plans/plan-editor.tsx`

- [ ] **Step 1: Plan editor component**

Create `apps/web/components/plans/plan-editor.tsx`:

```tsx
'use client';

import { Button, Card, CardBody, Chip, Input, Select, SelectItem } from '@heroui/react';
import { ArrowDown, ArrowUp, Search, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../lib/api/client';

type LibraryItem = {
  id: string;
  title: string;
  format: string;
  difficulty: string;
  estimatedMinutes: number;
};

type PlanItemRef = { libraryItemId: string; order: number; libraryItem: LibraryItem };

type PlanDraft = {
  cycleId: string;
  weekStart: string;
  weekEnd: string;
  items: PlanItemRef[];
};

export function PlanEditor({ memberId, cycleId }: { memberId: string; cycleId: string }) {
  const queryClient = useQueryClient();
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const [draft, setDraft] = useState<PlanDraft>({
    cycleId,
    weekStart: monday.toISOString().slice(0, 10),
    weekEnd: sunday.toISOString().slice(0, 10),
    items: [],
  });

  const [query, setQuery] = useState('');
  const { data: searchResults } = useQuery({
    queryKey: ['library-search', query],
    queryFn: async () => {
      if (!query) return apiFetch<LibraryItem[]>('/library');
      const res = await apiFetch<{ data: LibraryItem[] }>('/library/search', {
        method: 'POST',
        body: JSON.stringify({ query }),
      });
      return res.data;
    },
  });

  const addItem = (li: LibraryItem) => {
    setDraft((d) => ({
      ...d,
      items: [
        ...d.items,
        { libraryItemId: li.id, order: d.items.length, libraryItem: li },
      ],
    }));
  };

  const removeItem = (idx: number) => {
    setDraft((d) => ({
      ...d,
      items: d.items.filter((_, i) => i !== idx).map((it, i) => ({ ...it, order: i })),
    }));
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= draft.items.length) return;
    const next = [...draft.items];
    const [item] = next.splice(idx, 1);
    if (!item) return;
    next.splice(newIdx, 0, item);
    setDraft((d) => ({ ...d, items: next.map((it, i) => ({ ...it, order: i })) }));
  };

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>(`/members/${memberId}/plans`, {
        method: 'POST',
        body: JSON.stringify({
          cycleId: draft.cycleId,
          weekStart: draft.weekStart,
          weekEnd: draft.weekEnd,
          items: draft.items.map((i) => ({ libraryItemId: i.libraryItemId, order: i.order })),
        }),
      }),
  });

  const publishMutation = useMutation({
    mutationFn: (planId: string) =>
      apiFetch(`/plans/${planId}/publish`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plans', memberId] }),
  });

  const totalMinutes = draft.items.reduce((sum, i) => sum + i.libraryItem.estimatedMinutes, 0);

  const handleCreateAndPublish = async () => {
    const created = await createMutation.mutateAsync();
    try {
      await publishMutation.mutateAsync(created.id);
      alert('Plano publicado. Eventos criados no Calendar.');
    } catch (e) {
      alert(`Falha ao publicar: ${(e as Error).message}`);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardBody className="space-y-3">
          <h2 className="text-lg font-semibold">Acervo</h2>
          <Input
            placeholder="Buscar itens"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            startContent={<Search className="h-4 w-4 text-foreground/50" />}
          />
          <div className="max-h-[500px] space-y-2 overflow-y-auto">
            {(searchResults ?? []).map((li) => (
              <div
                key={li.id}
                className="flex items-center justify-between rounded-md border border-foreground/10 p-2"
              >
                <div>
                  <p className="text-sm font-medium">{li.title}</p>
                  <p className="text-xs text-foreground/60">
                    {li.format} · {li.difficulty} · {li.estimatedMinutes}min
                  </p>
                </div>
                <Button size="sm" variant="flat" onPress={() => addItem(li)}>
                  +
                </Button>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="space-y-3">
          <h2 className="text-lg font-semibold">Plano da semana</h2>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              label="Início"
              value={draft.weekStart}
              onChange={(e) => setDraft((d) => ({ ...d, weekStart: e.target.value }))}
            />
            <Input
              type="date"
              label="Fim"
              value={draft.weekEnd}
              onChange={(e) => setDraft((d) => ({ ...d, weekEnd: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            {draft.items.length === 0 && (
              <p className="text-sm text-foreground/60">Adicione itens do acervo ao lado.</p>
            )}
            {draft.items.map((it, idx) => (
              <div
                key={`${it.libraryItemId}-${idx}`}
                className="flex items-center justify-between rounded-md border border-foreground/10 p-2"
              >
                <div>
                  <p className="text-sm font-medium">
                    {idx + 1}. {it.libraryItem.title}
                  </p>
                  <p className="text-xs text-foreground/60">
                    {it.libraryItem.estimatedMinutes}min
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button isIconOnly size="sm" variant="light" onPress={() => moveItem(idx, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button isIconOnly size="sm" variant="light" onPress={() => moveItem(idx, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button isIconOnly size="sm" variant="light" color="danger" onPress={() => removeItem(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Chip size="sm" variant="flat">{totalMinutes} min total</Chip>
            <Button
              color="primary"
              isDisabled={draft.items.length === 0}
              isLoading={createMutation.isPending || publishMutation.isPending}
              onPress={handleCreateAndPublish}
            >
              Criar e publicar
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Editor page**

Create `apps/web/app/(app)/admin/plans/[memberId]/page.tsx`:

```tsx
'use client';

import { use } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PlanEditor } from '../../../../../components/plans/plan-editor';
import { apiFetch } from '../../../../../lib/api/client';

type Cycle = { id: string; name: string; status: string };

export default function AdminPlanEditorPage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = use(params);
  const { data: cycles } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => apiFetch<Cycle[]>('/cycles'),
  });
  const activeCycle = cycles?.find((c) => c.status === 'ACTIVE');

  if (!activeCycle) {
    return <p className="text-foreground/60">Crie um ciclo antes de montar um plano.</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-2xl font-semibold">Editor de plano semanal</h1>
      <p className="text-sm text-foreground/60">Ciclo ativo: {activeCycle.name}</p>
      <PlanEditor memberId={memberId} cycleId={activeCycle.id} />
    </div>
  );
}
```

- [ ] **Step 3: Add link in admin members page**

Modify `apps/web/app/(app)/admin/members/page.tsx` — wrap each member card in a `Link href={"/admin/plans/" + m.id}` so clicking opens the plan editor. Add the import.

Replace the `<li key={m.id} ...>` block with:

```tsx
                <li key={m.id}>
                  <Link
                    href={`/admin/plans/${m.id}`}
                    className="flex flex-col items-center gap-2 rounded-md border border-foreground/10 p-4 hover:border-foreground/30"
                  >
                    <Avatar src={m.pictureUrl ?? undefined} name={m.name} size="lg" />
                    <span className="text-sm font-medium">{m.name}</span>
                    <span className="text-xs text-foreground/60">{m.email}</span>
                    <Chip size="sm" variant="flat" color={m.role === 'ADMIN' ? 'primary' : 'default'}>
                      {m.role}
                    </Chip>
                  </Link>
                </li>
```

And import `Link`:
```tsx
import Link from 'next/link';
```

- [ ] **Step 4: Build**

Run: `pnpm --filter @ics-select/web build`. Expected: compiles.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(app\)/admin/plans apps/web/components/plans apps/web/app/\(app\)/admin/members
git commit -m "feat(web): add admin plan editor page and link from members"
```

---

## Task 6: Member "this week" + item detail pages

**Files:**
- Modify: `apps/web/app/(app)/me/page.tsx`
- Create: `apps/web/app/(app)/me/plan/[planId]/item/[itemId]/page.tsx`

- [ ] **Step 1: Replace `me/page.tsx` with week view**

```tsx
'use client';

import { Card, CardBody, CardHeader, Chip, Progress } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api/client';

type Plan = {
  id: string;
  status: string;
  weekStart: string;
  weekEnd: string;
  items: Array<{
    id: string;
    status: 'PENDING' | 'DONE';
    order: number;
    stuck: boolean;
    libraryItem: {
      id: string;
      title: string;
      estimatedMinutes: number;
      url: string | null;
      format: string;
    };
    sessions: Array<{ id: string; scheduledAt: string; durationMinutes: number }>;
  }>;
};

export default function MeHomePage() {
  const { data, isLoading } = useQuery({
    queryKey: ['me-week'],
    queryFn: () => apiFetch<Plan[]>('/me/week'),
  });

  if (isLoading) return <p>Carregando...</p>;
  const current = data?.[0];

  if (!current) {
    return (
      <Card>
        <CardBody>
          <p className="text-foreground/70">Nenhum plano ainda. Aguarde o admin montar.</p>
        </CardBody>
      </Card>
    );
  }

  const done = current.items.filter((i) => i.status === 'DONE').length;
  const total = current.items.length;
  const progress = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <div className="flex w-full items-center justify-between">
            <h1 className="text-2xl font-semibold">Esta semana</h1>
            <Chip size="sm" variant="flat">{current.status}</Chip>
          </div>
        </CardHeader>
        <CardBody className="space-y-3">
          <Progress label={`Progresso: ${done}/${total}`} value={progress} />
          <div className="space-y-2">
            {current.items.map((item) => (
              <Link
                key={item.id}
                href={`/me/plan/${current.id}/item/${item.id}`}
                className="flex items-center justify-between rounded-md border border-foreground/10 p-3 hover:border-foreground/30"
              >
                <div>
                  <p className="text-sm font-medium">
                    {item.order + 1}. {item.libraryItem.title}
                  </p>
                  <p className="text-xs text-foreground/60">
                    {item.libraryItem.format} · {item.libraryItem.estimatedMinutes}min
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {item.stuck && <Chip size="sm" color="warning">Travei</Chip>}
                  <Chip size="sm" variant="flat" color={item.status === 'DONE' ? 'success' : 'default'}>
                    {item.status === 'DONE' ? 'Feito' : 'Pendente'}
                  </Chip>
                </div>
              </Link>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Item detail page**

Create `apps/web/app/(app)/me/plan/[planId]/item/[itemId]/page.tsx`:

```tsx
'use client';

import { Button, Card, CardBody, CardHeader, Chip, Textarea } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import { apiFetch } from '../../../../../../../lib/api/client';

type Plan = {
  id: string;
  items: Array<{
    id: string;
    status: string;
    stuck: boolean;
    difficultyRating: 'EASY' | 'HARD' | null;
    reflection: string | null;
    libraryItem: {
      id: string;
      title: string;
      description: string | null;
      url: string | null;
      estimatedMinutes: number;
      format: string;
    };
  }>;
};

export default function ItemDetailPage({
  params,
}: {
  params: Promise<{ planId: string; itemId: string }>;
}) {
  const { planId, itemId } = use(params);
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data } = useQuery({
    queryKey: ['plan', planId],
    queryFn: () => apiFetch<Plan>(`/plans/${planId}`),
  });
  const item = data?.items.find((i) => i.id === itemId);

  const [rating, setRating] = useState<'EASY' | 'HARD' | null>(null);
  const [reflection, setReflection] = useState('');

  const doneMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/plans/${planId}/items/${itemId}/done`, {
        method: 'POST',
        body: JSON.stringify({ rating: rating ?? undefined, reflection: reflection || undefined }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', planId] });
      queryClient.invalidateQueries({ queryKey: ['me-week'] });
      router.push('/me');
    },
  });

  const stuckMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/plans/${planId}/items/${itemId}/stuck`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', planId] });
      queryClient.invalidateQueries({ queryKey: ['me-week'] });
    },
  });

  if (!item) return <p>Carregando...</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">{item.libraryItem.title}</h1>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="flex items-center gap-2">
            <Chip size="sm" variant="flat">{item.libraryItem.format}</Chip>
            <Chip size="sm" variant="flat">{item.libraryItem.estimatedMinutes}min</Chip>
            {item.stuck && <Chip size="sm" color="warning">Travei</Chip>}
          </div>
          {item.libraryItem.description && (
            <p className="text-sm text-foreground/70">{item.libraryItem.description}</p>
          )}
          {item.libraryItem.url && (
            <a
              href={item.libraryItem.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary underline"
            >
              Abrir material
            </a>
          )}

          {item.status === 'PENDING' && (
            <div className="space-y-3 pt-3">
              <div className="flex items-center gap-2">
                <span className="text-sm">Dificuldade:</span>
                <Button
                  size="sm"
                  variant={rating === 'EASY' ? 'solid' : 'flat'}
                  onPress={() => setRating('EASY')}
                >
                  Fácil
                </Button>
                <Button
                  size="sm"
                  variant={rating === 'HARD' ? 'solid' : 'flat'}
                  onPress={() => setRating('HARD')}
                >
                  Difícil
                </Button>
              </div>
              <Textarea
                label="Reflexão (opcional)"
                placeholder="Principal insight, o que ainda confunde..."
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
              />
              <div className="flex gap-2">
                <Button color="primary" isLoading={doneMutation.isPending} onPress={() => doneMutation.mutate()}>
                  Marcar feito
                </Button>
                <Button color="warning" variant="flat" isLoading={stuckMutation.isPending} onPress={() => stuckMutation.mutate()}>
                  Travei
                </Button>
              </div>
            </div>
          )}

          {item.status === 'DONE' && (
            <div className="pt-2">
              <Chip color="success">Feito</Chip>
              {item.difficultyRating && <Chip size="sm" variant="flat" className="ml-2">{item.difficultyRating}</Chip>}
              {item.reflection && <p className="mt-2 text-sm text-foreground/70">{item.reflection}</p>}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Build**

Run: `pnpm --filter @ics-select/web build`

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(app\)/me
git commit -m "feat(web): add member week view and item detail pages"
```

---

## Task 7: Verification

- [ ] **Step 1: Full test + build**

Run:
```bash
pnpm install
pnpm --filter @ics-select/shared build
pnpm --filter @ics-select/prisma exec prisma generate
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @ics-select/api test:e2e
pnpm build
```
Expected: everything green.

- [ ] **Step 2: Git log**

Run: `git log --oneline main..HEAD`
Expected: ~6 commits.

- [ ] **Step 3: Git status clean**

Phase 4 complete — this is the MVP milestone. A real cycle can run: admin creates a plan, publishes, eventos caem no Calendar do membro, membro marca feito com feedback.

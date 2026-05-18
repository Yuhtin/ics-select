# Plan Editor Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 3-column plan editor (Context · AI Draft · Editor) with a layered layout: slim context strip → editor + carry-over sidebar → full-width week preview (real-time dry-run for DRAFT, persisted placements for PUBLISHED) → unscheduled. AI moves into a side drawer.

**Architecture:** A new pure read-only endpoint `POST /plans/:id/preview-scheduling` runs `SchedulerService.plan` without persisting; the frontend hook debounces edits 500ms and re-renders the week. PUBLISHED plans render the existing persisted `WeeklyPlanItem.scheduledAt`/`scheduledMinutes` columns (no migration). The old context panel splits into a chip strip + a slim carry-over sidebar. The AI panel becomes a HeroUI Drawer.

**Tech Stack:** NestJS · Prisma · Next.js App Router · HeroUI (Drawer) · TanStack Query · Tailwind · Playwright · Jest.

**Spec:** `docs/superpowers/specs/2026-05-18-plan-editor-redesign-design.md`.

**Conventions:**
- Run package commands via `pnpm --filter <pkg> …` (see `CLAUDE.md`).
- Backend tests: jest. Frontend tests: Playwright (visual snapshots via `pnpm --filter @ics-select/web test:update`).
- Commit one bite per task with `type(scope): subject`.
- **Never** edit prod DB. No migrations needed for this plan.

---

## File map

### Backend (apps/api)

**Create:**
- `src/scheduler/availability-loader.ts` — extracted `loadSchedulerAvailability` + constants, shared between Publication and Preview services.
- `src/weekly-plans/scheduling-preview.service.ts` — composes availability + busy + items → `SchedulerService.plan`, returns placements/overflow.
- `src/weekly-plans/scheduling-preview.service.spec.ts`
- `src/weekly-plans/scheduling-preview.controller.ts` — `POST /plans/:id/preview-scheduling`.
- `test/scheduling-preview.e2e-spec.ts`

**Modify:**
- `src/weekly-plans/publication.service.ts` — replace inline `loadSchedulerAvailability` with the shared import.
- `src/weekly-plans/weekly-plans.module.ts` — register the new controller + service.

### Frontend (apps/web)

**Create:**
- `lib/queries/admin-plan-preview.ts` — `useSchedulingPreview` hook (debounced).
- `lib/hooks/use-debounced-value.ts` — `useDebouncedValue<T>(value, ms)` utility (only if it does not already exist; grep before creating).
- `components/admin/plan-editor/week-day-card.tsx` — one weekday card.
- `components/admin/plan-editor/week-preview.tsx` — section header + 7 day cards grid.
- `components/admin/plan-editor/unscheduled-section.tsx` — warning banner + overflow list.
- `components/admin/plan-editor/context-strip.tsx` — chip strip + retro/coverage accordion.
- `components/admin/plan-editor/ai-suggest-drawer.tsx` — HeroUI Drawer wrapping the AI flow.

**Modify:**
- `app/(admin)/admin/member/[id]/plan/[planId]/page.tsx` — new 5-region layout, wires new components and hook.
- `components/admin/plan-editor/editable-plan-panel.tsx` — drop references to deleted context/AI siblings.
- `components/admin/plan-editor/carry-over-list.tsx` — light tweak if header text changes; otherwise leave alone.
- `lib/queries/admin-plan-editor.ts` — add `scheduledAt: string | null` and `scheduledMinutes: number | null` to `WeeklyPlanItem`.

**Delete:**
- `components/admin/plan-editor/context-panel.tsx`
- `components/admin/plan-editor/ai-draft-panel.tsx`
- `components/admin/plan-editor/regenerate-brief-modal.tsx`

**New Playwright test:** `tests/admin-plan-editor.spec.ts` (file may or may not exist — check first).

---

## Phase 1 · Backend: shared availability loader

### Task 1: Extract `loadSchedulerAvailability` into a shared module

**Files:**
- Create: `apps/api/src/scheduler/availability-loader.ts`
- Modify: `apps/api/src/weekly-plans/publication.service.ts:73-109`

This is a pure refactor — no behavior change, no new tests needed. Existing PublicationService specs cover the function.

- [ ] **Step 1: Read the current private function**

Open `apps/api/src/weekly-plans/publication.service.ts`. The block to lift starts at the `async function loadSchedulerAvailability` declaration near line 73 and includes the constants `FORCE_FALLBACK_SLOTS`, `FORCE_FALLBACK_CAPS`, `EMPTY_CAPS`, `DEFAULT_PREFERRED_SESSION_MINUTES`, `DEFAULT_TIMEZONE` and the type alias `SchedulerAvailability` (read the file from the top to find these — they live in the same module).

- [ ] **Step 2: Create the new module**

Create `apps/api/src/scheduler/availability-loader.ts` with the lifted code. Public API:

```ts
import type { AvailabilitySlotInput } from './scheduler.types.js';

export type SchedulerAvailability = {
  slots: AvailabilitySlotInput[];
  caps: (number | null)[];
  preferredSessionMinutes: number;
  timezone: string;
};

export const DEFAULT_PREFERRED_SESSION_MINUTES = 60;
export const DEFAULT_TIMEZONE = 'America/Sao_Paulo';
export const EMPTY_CAPS: (number | null)[] = [null, null, null, null, null, null, null];
// FORCE_FALLBACK_SLOTS / FORCE_FALLBACK_CAPS — copy verbatim from the existing constants.

export async function loadSchedulerAvailability(
  prisma: { memberAvailability: any; availabilitySlot: any },
  userId: string,
  options: { force?: boolean } = {},
): Promise<SchedulerAvailability> {
  // body copied verbatim from publication.service.ts
}
```

Preserve the constant *values* verbatim — do not retype `FORCE_FALLBACK_SLOTS` by hand. Copy the exact array literal.

- [ ] **Step 3: Update `publication.service.ts` to use the shared module**

Replace the in-file declarations of `loadSchedulerAvailability`, `SchedulerAvailability`, and the five constants with a single import:

```ts
import {
  loadSchedulerAvailability,
  type SchedulerAvailability,
  DEFAULT_PREFERRED_SESSION_MINUTES,
  DEFAULT_TIMEZONE,
} from '../scheduler/availability-loader.js';
```

Drop the original definitions from the top of `publication.service.ts`. Keep all *call sites* unchanged.

- [ ] **Step 4: Run existing tests**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern publication.service`

Expected: all green. If a test fails it means the refactor changed behavior — diff carefully.

- [ ] **Step 5: Run full api test suite**

Run: `pnpm --filter @ics-select/api test`

Expected: green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/scheduler/availability-loader.ts apps/api/src/weekly-plans/publication.service.ts
git commit -m "refactor(scheduler): extract availability loader to shared module"
```

---

## Phase 2 · Backend: SchedulingPreviewService (pure, no IO writes)

### Task 2: Write the failing service tests

**Files:**
- Create: `apps/api/src/weekly-plans/scheduling-preview.service.spec.ts`

We test the service in isolation with mocked Prisma + a real `SchedulerService` (which is already pure). No mocked busy cache for the first tests — use an empty busy block list.

- [ ] **Step 1: Create the spec file with five tests**

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { SchedulingPreviewService } from './scheduling-preview.service.js';
import { SchedulerService } from '../scheduler/scheduler.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { BusyCacheService } from '../google-calendar/busy-cache.service.js';

function buildPrismaMock(opts: {
  plan?: any;
  availability?: any;
  slots?: any[];
}) {
  return {
    weeklyPlan: { findUnique: jest.fn().mockResolvedValue(opts.plan ?? null) },
    weeklyPlanItem: { findMany: jest.fn().mockResolvedValue([]) },
    memberAvailability: { findUnique: jest.fn().mockResolvedValue(opts.availability ?? null) },
    availabilitySlot: { findMany: jest.fn().mockResolvedValue(opts.slots ?? []) },
  };
}

const busyCacheMock = {
  getWeekBusy: jest.fn().mockResolvedValue([]),
};

const PLAN_FIXTURE = {
  id: 'plan-1',
  userId: 'user-1',
  weekStart: new Date('2026-05-18T00:00:00Z'),
  weekEnd: new Date('2026-05-25T00:00:00Z'),
  status: 'DRAFT',
};

const AVAILABILITY_FIXTURE = {
  userId: 'user-1',
  mondayMinutes: 90,
  tuesdayMinutes: 90,
  wednesdayMinutes: 60,
  thursdayMinutes: null,
  fridayMinutes: null,
  saturdayMinutes: 60,
  sundayMinutes: null,
  preferredSessionMinutes: 45,
  timezone: 'America/Sao_Paulo',
};

const SLOTS_FIXTURE = [
  { dayOfWeek: 0, startMinute: 17 * 60, endMinute: 19 * 60 }, // Mon 17–19
  { dayOfWeek: 1, startMinute: 17 * 60, endMinute: 19 * 60 }, // Tue 17–19
  { dayOfWeek: 2, startMinute: 17 * 60, endMinute: 18 * 60 }, // Wed 17–18
  { dayOfWeek: 5, startMinute: 10 * 60, endMinute: 11 * 60 }, // Sat 10–11
];

async function buildService(prismaMock: any) {
  const moduleRef: TestingModule = await Test.createTestingModule({
    providers: [
      SchedulingPreviewService,
      SchedulerService,
      { provide: PrismaService, useValue: prismaMock },
      { provide: BusyCacheService, useValue: busyCacheMock },
    ],
  }).compile();
  return moduleRef.get(SchedulingPreviewService);
}

describe('SchedulingPreviewService', () => {
  beforeEach(() => {
    busyCacheMock.getWeekBusy.mockClear();
  });

  it('returns empty placements when items is empty', async () => {
    const prisma = buildPrismaMock({
      plan: PLAN_FIXTURE,
      availability: AVAILABILITY_FIXTURE,
      slots: SLOTS_FIXTURE,
    });
    const svc = await buildService(prisma);

    const result = await svc.preview('plan-1', { items: [] });

    expect(result.placements).toEqual([]);
    expect(result.overflow).toEqual([]);
    expect(result.weekStart).toBe(PLAN_FIXTURE.weekStart.toISOString());
    expect(result.weekEnd).toBe(PLAN_FIXTURE.weekEnd.toISOString());
  });

  it('schedules items within availability slots', async () => {
    const prisma = buildPrismaMock({
      plan: PLAN_FIXTURE,
      availability: AVAILABILITY_FIXTURE,
      slots: SLOTS_FIXTURE,
    });
    const svc = await buildService(prisma);

    const result = await svc.preview('plan-1', {
      items: [
        { libraryItemId: 'lib-A', order: 0, estimatedMinutes: 45 },
        { libraryItemId: 'lib-B', order: 1, estimatedMinutes: 30 },
      ],
    });

    expect(result.placements.length).toBeGreaterThan(0);
    expect(result.overflow).toEqual([]);
    expect(result.placements.every((p) => p.itemId.startsWith('lib-'))).toBe(true);
  });

  it('returns overflow when items exceed availability', async () => {
    const prisma = buildPrismaMock({
      plan: PLAN_FIXTURE,
      availability: AVAILABILITY_FIXTURE,
      slots: SLOTS_FIXTURE,
    });
    const svc = await buildService(prisma);

    const result = await svc.preview('plan-1', {
      items: Array.from({ length: 10 }, (_, idx) => ({
        libraryItemId: `lib-${idx}`,
        order: idx,
        estimatedMinutes: 90,
      })),
    });

    expect(result.overflow.length).toBeGreaterThan(0);
  });

  it('throws when the plan is missing', async () => {
    const prisma = buildPrismaMock({ plan: null });
    const svc = await buildService(prisma);
    await expect(svc.preview('plan-missing', { items: [] })).rejects.toThrow(/not found/i);
  });

  it('throws MEMBER_NO_AVAILABILITY when the member has no availability row', async () => {
    const prisma = buildPrismaMock({
      plan: PLAN_FIXTURE,
      availability: null,
      slots: [],
    });
    const svc = await buildService(prisma);
    await expect(
      svc.preview('plan-1', {
        items: [{ libraryItemId: 'lib-A', order: 0, estimatedMinutes: 45 }],
      }),
    ).rejects.toMatchObject({ code: 'MEMBER_NO_AVAILABILITY' });
  });

  it('falls back to plan.items when body items omitted', async () => {
    const prisma = buildPrismaMock({
      plan: PLAN_FIXTURE,
      availability: AVAILABILITY_FIXTURE,
      slots: SLOTS_FIXTURE,
    });
    prisma.weeklyPlanItem.findMany.mockResolvedValue([
      { libraryItemId: 'lib-A', order: 0, libraryItem: { estimatedMinutes: 45, format: 'VIDEO' } },
    ]);
    const svc = await buildService(prisma);
    const result = await svc.preview('plan-1', {});
    expect(prisma.weeklyPlanItem.findMany).toHaveBeenCalled();
    expect(result.placements.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify the tests fail**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern scheduling-preview.service`

Expected: FAIL — `Cannot find module './scheduling-preview.service.js'`.

### Task 3: Implement the SchedulingPreviewService

**Files:**
- Create: `apps/api/src/weekly-plans/scheduling-preview.service.ts`

Use `loadSchedulerAvailability` from Task 1. Reuse `BusyCacheService.getWeekBusy`. The service exposes one public method `preview(planId, body)`.

The `allocatedMinutes(estimatedMinutes, format)` helper is currently imported inside `publication.service.ts` (search for it). Re-import from the same source — don't re-implement.

- [ ] **Step 1: Locate `allocatedMinutes`**

Run: `grep -rn 'function allocatedMinutes\|export.*allocatedMinutes' apps/api/src | head`

Note the file path; that's the source for the import.

- [ ] **Step 2: Write the service**

```ts
import { BadRequestException, Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { SchedulerService } from '../scheduler/scheduler.service.js';
import { BusyCacheService } from '../google-calendar/busy-cache.service.js';
import { loadSchedulerAvailability } from '../scheduler/availability-loader.js';
// Adjust the import path below per the grep result in Step 1.
import { allocatedMinutes } from './<wherever-allocated-minutes-lives>.js';

export class NoAvailabilityError extends BadRequestException {
  readonly code = 'MEMBER_NO_AVAILABILITY';
  constructor() {
    super({ code: 'MEMBER_NO_AVAILABILITY', message: 'Member has no availability configured.' });
  }
}

export type PreviewItemInput = {
  libraryItemId: string;
  order: number;
  estimatedMinutes?: number; // optional; if omitted, service hydrates from DB
};

export type PreviewBody = { items?: PreviewItemInput[] };

export type PreviewResult = {
  placements: Array<{ itemId: string; scheduledAt: string; durationMinutes: number }>;
  overflow: Array<{ itemId: string; minutesRequired: number }>;
  weekStart: string;
  weekEnd: string;
};

@Injectable()
export class SchedulingPreviewService {
  private readonly logger = new Logger(SchedulingPreviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SchedulerService,
    private readonly busyCache: BusyCacheService,
  ) {}

  async preview(planId: string, body: PreviewBody): Promise<PreviewResult> {
    const plan = await this.prisma.weeklyPlan.findUnique({
      where: { id: planId },
      select: { id: true, userId: true, weekStart: true, weekEnd: true, status: true },
    });
    if (!plan) throw new NotFoundException('plan not found');

    const items = body.items ?? (await this.loadPersistedItems(planId));

    if (items.length === 0) {
      return {
        placements: [],
        overflow: [],
        weekStart: plan.weekStart.toISOString(),
        weekEnd: plan.weekEnd.toISOString(),
      };
    }

    const availabilityRow = await this.prisma.memberAvailability.findUnique({
      where: { userId: plan.userId },
    });
    if (!availabilityRow) throw new NoAvailabilityError();

    const availability = await loadSchedulerAvailability(this.prisma, plan.userId);
    const busyBlocks = await this.busyCache
      .getWeekBusy(plan.userId, plan.weekStart, plan.weekEnd)
      .catch(() => [] as Array<{ start: Date; end: Date }>);

    const result = this.scheduler.plan({
      weekStart: plan.weekStart,
      availability,
      busyBlocks,
      items: items.map((i) => ({
        id: i.libraryItemId, // preview uses libraryItemId as the stable id
        order: i.order,
        estimatedMinutes: i.estimatedMinutes ?? 60,
      })),
    });

    return {
      placements: result.sessions.map((s) => ({
        itemId: s.itemId,
        scheduledAt: s.scheduledAt.toISOString(),
        durationMinutes: s.durationMinutes,
      })),
      overflow: result.overflow,
      weekStart: plan.weekStart.toISOString(),
      weekEnd: plan.weekEnd.toISOString(),
    };
  }

  private async loadPersistedItems(planId: string): Promise<PreviewItemInput[]> {
    const rows = await this.prisma.weeklyPlanItem.findMany({
      where: { weeklyPlanId: planId },
      include: { libraryItem: { select: { estimatedMinutes: true, format: true } } },
      orderBy: { order: 'asc' },
    });
    return rows.map((r: any) => ({
      libraryItemId: r.libraryItemId,
      order: r.order,
      estimatedMinutes: allocatedMinutes(r.libraryItem.estimatedMinutes, r.libraryItem.format),
    }));
  }
}
```

**Important design note:** the scheduler's `ItemInput.id` is opaque to the algorithm. We pass `libraryItemId` as `id` so that frontend matching (placement → editor row) works against `libraryItemId` (which is stable across `local-*` placeholder ids on unsaved items).

- [ ] **Step 3: Run the tests**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern scheduling-preview.service`

Expected: all five tests pass. If `allocatedMinutes` import path is wrong → fix and re-run.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/weekly-plans/scheduling-preview.service.ts apps/api/src/weekly-plans/scheduling-preview.service.spec.ts
git commit -m "feat(plans): scheduling preview service for admin editor dry-run"
```

---

## Phase 3 · Backend: controller + module wiring

### Task 4: Write the controller + e2e test together

**Files:**
- Create: `apps/api/src/weekly-plans/scheduling-preview.controller.ts`
- Create: `apps/api/test/scheduling-preview.e2e-spec.ts`
- Modify: `apps/api/src/weekly-plans/weekly-plans.module.ts`

The controller mounts at the root (no Nest controller prefix) so the path is exactly `POST /plans/:id/preview-scheduling`. Reuses the same auth/ownership pattern as the existing `GET plans/:id`.

- [ ] **Step 1: Read the existing controller pattern**

Open `apps/api/src/weekly-plans/weekly-plans.controller.ts:92-100`. Note: no `@Controller()` prefix, paths include `plans/:id`. Use the same pattern.

- [ ] **Step 2: Write the controller**

```ts
import {
  Body, Controller, Param, Post, NotFoundException,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { Roles } from '../auth/roles.decorator.js';
import type { JwtStrategyPayload } from '../auth/jwt-strategy.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SchedulingPreviewService } from './scheduling-preview.service.js';

class PreviewBodyDto {
  items?: Array<{ libraryItemId: string; order: number; estimatedMinutes?: number }>;
}

@Controller()
@Roles('ADMIN')
export class SchedulingPreviewController {
  constructor(
    private readonly preview: SchedulingPreviewService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('plans/:id/preview-scheduling')
  async run(
    @Param('id') id: string,
    @Body() body: PreviewBodyDto,
    @CurrentUser() user: JwtStrategyPayload,
  ) {
    const plan = await this.prisma.weeklyPlan.findUnique({ where: { id }, select: { userId: true } });
    if (!plan) throw new NotFoundException('plan not found');
    if (user.role !== 'ADMIN' && plan.userId !== user.sub) {
      throw new NotFoundException('plan not found');
    }
    return this.preview.preview(id, { items: body.items });
  }
}
```

- [ ] **Step 3: Register the controller + service in the module**

Open `apps/api/src/weekly-plans/weekly-plans.module.ts`. Add `SchedulingPreviewService` to `providers` and `SchedulingPreviewController` to `controllers`. The module already imports `SchedulerModule`, `GoogleCalendarModule`, `PrismaModule` (verify by reading the file); if not, add them.

- [ ] **Step 4: Write the e2e**

```ts
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('POST /plans/:id/preview-scheduling (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn().mockResolvedValue(undefined),
        $disconnect: jest.fn().mockResolvedValue(undefined),
        weeklyPlan: { findUnique: jest.fn() },
        weeklyPlanItem: { findMany: jest.fn().mockResolvedValue([]) },
        memberAvailability: { findUnique: jest.fn() },
        availabilitySlot: { findMany: jest.fn().mockResolvedValue([]) },
      })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 without a token', async () => {
    await request(app.getHttpServer())
      .post('/plans/plan-1/preview-scheduling')
      .send({ items: [] })
      .expect(401);
  });

  it('returns 404 for unknown plan id (admin token)', async () => {
    (prisma.weeklyPlan.findUnique as jest.Mock).mockResolvedValue(null);
    // Use the existing test-token helper from another e2e spec (see test/auth.e2e-spec.ts or similar).
    const token = await getAdminToken(app);
    await request(app.getHttpServer())
      .post('/plans/plan-missing/preview-scheduling')
      .set('Cookie', [`accessToken=${token}`])
      .send({ items: [] })
      .expect(404);
  });
});

async function getAdminToken(app: INestApplication): Promise<string> {
  // Copy the pattern from another e2e (e.g. auth.e2e-spec.ts) — likely uses
  // JwtService.signAsync({ sub: 'admin-id', role: 'ADMIN' }) with the test secret.
  // Document the helper inline if not already shared.
  throw new Error('replace with the project-standard admin token helper');
}
```

Replace `getAdminToken` with the project pattern — search existing e2e tests for the auth helper they share. Run `ls apps/api/test/` and pick one (e.g. `auth.e2e-spec.ts`) and read how it issues a token.

- [ ] **Step 5: Run the e2e**

Run: `pnpm --filter @ics-select/api test:e2e -- --testPathPattern scheduling-preview`

Expected: both tests pass. The 401 test fails closed (route requires auth via global `JwtAuthGuard`). The 404 test exercises the wiring.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/weekly-plans/scheduling-preview.controller.ts apps/api/src/weekly-plans/weekly-plans.module.ts apps/api/test/scheduling-preview.e2e-spec.ts
git commit -m "feat(plans): POST /plans/:id/preview-scheduling endpoint"
```

---

## Phase 4 · Frontend types & hook

### Task 5: Extend `WeeklyPlanItem` admin type

**Files:**
- Modify: `apps/web/lib/queries/admin-plan-editor.ts:6-22`

- [ ] **Step 1: Add the two fields**

Open `apps/web/lib/queries/admin-plan-editor.ts` and update the type:

```ts
export type WeeklyPlanItem = {
  id: string;
  libraryItemId: string;
  order: number;
  outcome: ItemOutcome;
  skippable: boolean;
  scheduledAt: string | null;
  scheduledMinutes: number | null;
  libraryItem: {
    id: string;
    title: string;
    estimatedMinutes: number;
    format: string;
    url?: string | null;
    topicId: string | null;
    tags?: string[];
    tracks?: string[];
  };
};
```

The backend already returns these (Prisma `findUnique` spreads all columns) — confirm by running:

```bash
grep -n 'scheduledAt' apps/api/src/weekly-plans/weekly-plans.service.ts | head
```

Expected to see references inside `getById`.

- [ ] **Step 2: Update the local optimistic object in the page**

Open `apps/web/app/(admin)/admin/member/[id]/plan/[planId]/page.tsx` at the `handleAddItem` function (~line 215). The locally-constructed `newItem` literal needs the two new fields:

```ts
const newItem: WeeklyPlanItem = {
  // existing fields…
  scheduledAt: null,
  scheduledMinutes: null,
  libraryItem: { /* … */ },
};
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: green. If a different consumer of `WeeklyPlanItem` complains, add `scheduledAt: null` to that literal too (likely test fixtures only).

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/queries/admin-plan-editor.ts apps/web/app/\(admin\)/admin/member/\[id\]/plan/\[planId\]/page.tsx
git commit -m "feat(plan-editor): expose scheduledAt/scheduledMinutes on admin item type"
```

### Task 6: Implement `useDebouncedValue` (if missing)

**Files:**
- Maybe create: `apps/web/lib/hooks/use-debounced-value.ts`

- [ ] **Step 1: Check if it exists**

Run: `grep -rn 'useDebouncedValue\|useDebounce' apps/web/lib apps/web/components 2>/dev/null | head`

If a hook already exists, skip this task and use it.

- [ ] **Step 2: If missing, create**

```ts
'use client';
import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}
```

- [ ] **Step 3: Commit (if a new file)**

```bash
git add apps/web/lib/hooks/use-debounced-value.ts
git commit -m "chore(web): add useDebouncedValue hook"
```

### Task 7: Implement `useSchedulingPreview` hook

**Files:**
- Create: `apps/web/lib/queries/admin-plan-preview.ts`

- [ ] **Step 1: Write the hook**

```ts
'use client';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { useDebouncedValue } from '../hooks/use-debounced-value';

export type SchedulingPlacement = {
  itemId: string; // matches libraryItemId
  scheduledAt: string;
  durationMinutes: number;
};

export type SchedulingPreview = {
  placements: SchedulingPlacement[];
  overflow: Array<{ itemId: string; minutesRequired: number }>;
  weekStart: string;
  weekEnd: string;
};

export type PreviewItem = {
  libraryItemId: string;
  order: number;
  estimatedMinutes: number;
};

export function useSchedulingPreview(
  planId: string | null,
  items: PreviewItem[],
  enabled: boolean,
) {
  const debouncedItems = useDebouncedValue(items, 500);
  const hash = useMemo(
    () => debouncedItems.map((i) => `${i.libraryItemId}:${i.order}:${i.estimatedMinutes}`).join('|'),
    [debouncedItems],
  );

  return useQuery({
    queryKey: ['plan-preview', planId, hash],
    queryFn: () =>
      apiFetch<SchedulingPreview>(`/plans/${planId}/preview-scheduling`, {
        method: 'POST',
        body: JSON.stringify({ items: debouncedItems }),
      }),
    enabled: Boolean(planId) && planId !== 'new' && enabled,
    placeholderData: (previous) => previous, // keep stale data visible during refetch
  });
}
```

**Why hash:** TanStack `queryKey` arrays compare by deep equality, but a long item list adds work; a small hash string is cheaper and stable.

**Why `placeholderData: (previous) => previous`:** the spec calls for showing the last good placements during a refetch and labeling the section "updating…" / "stale". This keeps `data` populated.

- [ ] **Step 2: Smoke-test the hook compiles**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: green. Hook is not wired anywhere yet — this just verifies imports.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/queries/admin-plan-preview.ts
git commit -m "feat(plan-editor): useSchedulingPreview hook (debounced 500ms)"
```

---

## Phase 5 · Frontend components

### Task 8: `WeekDayCard` component

**Files:**
- Create: `apps/web/components/admin/plan-editor/week-day-card.tsx`

Renders a single weekday card. Pure component, no data fetching.

- [ ] **Step 1: Write the component**

```tsx
'use client';
import { clsx } from 'clsx';
import { detectPlatform, platformLabel } from '../../../lib/format/platform';
import { formatTimeLocal, formatMinutes } from '../../../lib/format/time';
import type { ItemOutcome } from '@ics-select/shared';

export type DayCardItem = {
  itemId: string;
  libraryItemId: string;
  title: string;
  format: string;
  url?: string | null;
  outcome: ItemOutcome;
  scheduledAt: string;
  durationMinutes: number;
};

export type DayCardSlot = { startMinute: number; endMinute: number };

export type DayCardProps = {
  label: string;                // e.g. "Mon"
  dateLabel: string;            // e.g. "18 May"
  capMinutes: number | null;    // null/0 → OFF
  slots: DayCardSlot[];         // sorted by startMinute
  items: DayCardItem[];         // sorted by scheduledAt
  contributesOverflow?: boolean;
  onItemClick?: (libraryItemId: string) => void;
};

function formatSlot(s: DayCardSlot): string {
  const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return `${fmt(s.startMinute)}–${fmt(s.endMinute)}`;
}

const OUTCOME_DOT: Record<ItemOutcome, string> = {
  PENDING: 'bg-outcome-pending',
  DONE_EASY: 'bg-outcome-done-easy',
  DONE_HARD: 'bg-outcome-done-hard',
  DOUBTS: 'bg-outcome-doubts',
  STUCK: 'bg-outcome-stuck',
  SKIPPED: 'bg-outcome-pending', // muted; skipped doesn't render on day cards but keep total enum coverage
};

export function WeekDayCard(props: DayCardProps) {
  const isOff = !props.capMinutes || props.capMinutes === 0;
  const scheduledMinutes = props.items.reduce((sum, i) => sum + i.durationMinutes, 0);
  const free = isOff ? 0 : Math.max(0, (props.capMinutes ?? 0) - scheduledMinutes);

  return (
    <div
      className={clsx(
        'rounded-card border bg-surface p-3 min-w-0',
        props.contributesOverflow ? 'border-l-2 border-l-outcome-stuck' : 'border-rule',
        isOff && 'bg-paper-warm',
      )}
    >
      <header className="mb-2">
        <p className="font-serif-tool text-sm font-semibold text-ink">{props.label}</p>
        <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute">{props.dateLabel}</p>
      </header>

      <div className="mb-2 space-y-0.5">
        <p className={clsx('font-mono text-[10px] uppercase tracking-label', isOff ? 'italic text-ink-mute' : 'text-ink-soft')}>
          {isOff ? 'OFF' : `${props.capMinutes}m cap`}
        </p>
        {!isOff && props.slots.map((s, idx) => (
          <p key={idx} className="font-mono text-[10px] text-ink-mute tabular-nums">{formatSlot(s)}</p>
        ))}
      </div>

      <hr className="my-2 border-rule" />

      <div className="space-y-2">
        {props.items.length === 0 ? (
          <p className="font-sans text-xs text-ink-faint italic">—</p>
        ) : (
          props.items.map((item) => {
            const platform = detectPlatform(item.url, item.format);
            return (
              <button
                type="button"
                key={item.itemId}
                onClick={() => props.onItemClick?.(item.libraryItemId)}
                className="w-full text-left group"
              >
                <p className="font-mono text-[10px] text-ink-mute tabular-nums">
                  {formatTimeLocal(item.scheduledAt)}
                </p>
                <div className="flex items-start gap-2 mt-0.5 border-l-[3px] pl-2"
                     style={{ borderLeftColor: `var(--platform-${platform})` }}>
                  <span className={clsx('mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0', OUTCOME_DOT[item.outcome])} />
                  <p className="font-sans text-xs text-ink line-clamp-2 group-hover:text-ink-soft">{item.title}</p>
                </div>
                <p className="ml-2 font-mono text-[9px] uppercase tracking-label text-ink-mute mt-0.5">
                  {platformLabel(platform)} · {formatMinutes(item.durationMinutes)}
                </p>
              </button>
            );
          })
        )}
      </div>

      <hr className="my-2 border-rule" />

      <p className={clsx(
        'font-mono text-[10px] uppercase tracking-label',
        isOff ? 'italic text-ink-mute' : free > 0 ? 'text-outcome-done-easy' : 'text-ink-mute',
      )}>
        {isOff ? '—' : `free ${free}m`}
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: green. If `detectPlatform`/`platformLabel`/`formatTimeLocal`/`formatMinutes` paths are wrong, fix and rerun (project pattern from `day-list.tsx`).

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/admin/plan-editor/week-day-card.tsx
git commit -m "feat(plan-editor): WeekDayCard component"
```

### Task 9: `WeekPreview` component

**Files:**
- Create: `apps/web/components/admin/plan-editor/week-preview.tsx`

Assembles 7 `WeekDayCard`s with a section header. Pure: receives placements/items, derives day cards.

- [ ] **Step 1: Write the component**

```tsx
'use client';
import { useMemo } from 'react';
import { WeekDayCard, type DayCardItem, type DayCardSlot } from './week-day-card';
import { SectionLabel } from '../../ui/section-label';
import type { WeeklyPlanItem } from '../../../lib/queries/admin-plan-editor';
import type { SchedulingPlacement } from '../../../lib/queries/admin-plan-preview';

type WeekAvailability = {
  timezone: string;
  capByWeekday: (number | null)[];               // length 7, idx 0 = Mon
  slotsByWeekday: DayCardSlot[][];               // length 7, sorted
};

export type WeekPreviewProps = {
  weekStart: string;                              // ISO of Monday
  availability: WeekAvailability;
  placements: SchedulingPlacement[];
  items: WeeklyPlanItem[];
  overflowItemIds: Set<string>;
  isUpdating?: boolean;
  isStale?: boolean;
  onItemClick?: (libraryItemId: string) => void;
};

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function dayIdxOf(iso: string, weekStartIso: string): number {
  const date = new Date(iso);
  const start = new Date(weekStartIso);
  const diff = Math.floor((date.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  return Math.max(0, Math.min(6, diff));
}

export function WeekPreview(props: WeekPreviewProps) {
  const itemsByLibId = useMemo(() => {
    const map = new Map<string, WeeklyPlanItem>();
    for (const i of props.items) map.set(i.libraryItemId, i);
    return map;
  }, [props.items]);

  const cards = useMemo(() => {
    const buckets: DayCardItem[][] = [[], [], [], [], [], [], []];
    const dayHasOverflow = [false, false, false, false, false, false, false];

    for (const p of props.placements) {
      const idx = dayIdxOf(p.scheduledAt, props.weekStart);
      const item = itemsByLibId.get(p.itemId);
      if (!item) continue;
      buckets[idx]!.push({
        itemId: item.id,
        libraryItemId: item.libraryItemId,
        title: item.libraryItem.title,
        format: item.libraryItem.format,
        url: item.libraryItem.url ?? null,
        outcome: item.outcome,
        scheduledAt: p.scheduledAt,
        durationMinutes: p.durationMinutes,
      });
      if (props.overflowItemIds.has(p.itemId)) dayHasOverflow[idx] = true;
    }
    for (const bucket of buckets) bucket.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
    return { buckets, dayHasOverflow };
  }, [props.placements, props.weekStart, itemsByLibId, props.overflowItemIds]);

  const totalMinutes = props.placements.reduce((sum, p) => sum + p.durationMinutes, 0);

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between">
        <SectionLabel>Semana · preview</SectionLabel>
        <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-label text-ink-mute">
          <span>Total: {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m</span>
          {props.isUpdating && <span className="italic">atualizando…</span>}
          {props.isStale && !props.isUpdating && <span className="italic">preview defasado</span>}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {DAY_LABELS.map((label, idx) => {
          const dayDate = new Date(props.weekStart);
          dayDate.setUTCDate(dayDate.getUTCDate() + idx);
          const dateLabel = `${dayDate.getUTCDate()} ${dayDate.toLocaleString('en', { month: 'short', timeZone: 'UTC' })}`;
          return (
            <WeekDayCard
              key={label}
              label={label}
              dateLabel={dateLabel}
              capMinutes={props.availability.capByWeekday[idx] ?? null}
              slots={props.availability.slotsByWeekday[idx] ?? []}
              items={cards.buckets[idx]!}
              contributesOverflow={cards.dayHasOverflow[idx]}
              onItemClick={props.onItemClick}
            />
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: green.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/admin/plan-editor/week-preview.tsx
git commit -m "feat(plan-editor): WeekPreview component (7 day cards)"
```

### Task 10: `UnscheduledSection` component

**Files:**
- Create: `apps/web/components/admin/plan-editor/unscheduled-section.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';
import { AlertTriangle } from 'lucide-react';
import { SectionLabel } from '../../ui/section-label';
import { detectPlatform, platformLabel } from '../../../lib/format/platform';
import { formatMinutes } from '../../../lib/format/time';
import type { WeeklyPlanItem } from '../../../lib/queries/admin-plan-editor';

export type UnscheduledSectionProps = {
  overflow: Array<{ itemId: string; minutesRequired: number }>;
  items: WeeklyPlanItem[];
  memberId: string;
};

export function UnscheduledSection({ overflow, items, memberId }: UnscheduledSectionProps) {
  if (overflow.length === 0) return null;

  const itemsByLibId = new Map(items.map((i) => [i.libraryItemId, i]));
  const rows = overflow
    .map((o) => ({ overflow: o, item: itemsByLibId.get(o.itemId) }))
    .filter((r): r is { overflow: typeof overflow[number]; item: WeeklyPlanItem } => Boolean(r.item));

  return (
    <section className="mt-8 rounded-card border border-outcome-stuck/40 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <SectionLabel>
          <AlertTriangle className="inline h-3 w-3 mr-1 text-outcome-stuck" strokeWidth={1.5} />
          Unscheduled · {overflow.length} {overflow.length === 1 ? 'item' : 'items'}
        </SectionLabel>
      </div>
      <p className="mb-3 font-sans text-sm text-ink-soft italic">
        Não cabem na disponibilidade declarada esta semana.
      </p>
      <ul className="space-y-2 mb-3">
        {rows.map(({ overflow, item }) => {
          const platform = detectPlatform(item.libraryItem.url ?? null, item.libraryItem.format);
          return (
            <li key={overflow.itemId} className="border-l-[3px] pl-2 py-0.5"
                style={{ borderLeftColor: `var(--platform-${platform})` }}>
              <p className="font-sans text-sm text-ink">{item.libraryItem.title}</p>
              <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                {platformLabel(platform)} · {formatMinutes(item.libraryItem.estimatedMinutes)} · faltam {overflow.minutesRequired}min
              </p>
            </li>
          );
        })}
      </ul>
      <div className="font-mono text-[10px] uppercase tracking-label text-ink-mute space-y-1">
        <p>Possíveis soluções:</p>
        <ul className="ml-3 space-y-0.5">
          <li>• Aumentar cap diário ou adicionar slot · <a className="text-focus hover:underline" href={`/admin/member/${memberId}/availability`} target="_blank" rel="noreferrer">Abrir availability</a></li>
          <li>• Deixar items pro próximo plano (vira carry-over)</li>
          <li>• Forçar publicação no modal de scheduling (rolam pra próxima semana)</li>
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `pnpm --filter @ics-select/web typecheck`

```bash
git add apps/web/components/admin/plan-editor/unscheduled-section.tsx
git commit -m "feat(plan-editor): UnscheduledSection component"
```

### Task 11: `ContextStrip` component

**Files:**
- Create: `apps/web/components/admin/plan-editor/context-strip.tsx`

Absorbs the retro + topic-coverage content from the current `ContextPanel` into a chip strip with single-open accordion. The existing `ContextPanel` has the structure to copy — read it before writing.

- [ ] **Step 1: Read existing context panel**

Open `apps/web/components/admin/plan-editor/context-panel.tsx` — note the retro display and `TopicCoverageHeatmap` usage. Copy those subtrees as the accordion content.

- [ ] **Step 2: Write the component**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { TopicCoverageHeatmap } from '../../member/topic-coverage-heatmap';
import type { AdminPlanContextResponse } from '../../../lib/queries/admin-plan-context';

type Chip = 'retro' | 'coverage' | null;

const LS_KEY = 'plan-editor-context-open';

export type ContextStripProps = {
  data: AdminPlanContextResponse;
};

export function ContextStrip({ data }: ContextStripProps) {
  const [open, setOpen] = useState<Chip>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(LS_KEY);
    if (stored === 'retro' || stored === 'coverage') setOpen(stored);
  }, []);

  function toggle(chip: Chip) {
    const next = open === chip ? null : chip;
    setOpen(next);
    if (typeof window !== 'undefined') {
      if (next) window.localStorage.setItem(LS_KEY, next);
      else window.localStorage.removeItem(LS_KEY);
    }
  }

  const retroLabel = data.lastRetro
    ? `Retro · week ${data.lastRetro.weekNumber ?? ''}`.trim()
    : 'No retro yet';
  const coverageLabel = `Topic coverage · ${data.topicCoverage?.length ?? 0} topics`;
  const cycleLabel = data.cycle
    ? `Cycle wk ${data.cycle.weekNumber}/${data.cycle.totalWeeks} · ${data.cycle.daysLeftInWeek}d left`
    : null;
  const budgetLabel = data.availability
    ? `Budget ${data.availability.avgDailyMinutes}m/day · ${data.availability.activeDays.join('/')}`
    : 'Budget — · sem availability';

  return (
    <section className="mb-4">
      <div className="flex flex-wrap items-center gap-2 px-1">
        <Chip active={open === 'retro'} clickable={Boolean(data.lastRetro)} onClick={() => toggle('retro')}>
          {retroLabel}
        </Chip>
        <Chip active={open === 'coverage'} clickable onClick={() => toggle('coverage')}>
          {coverageLabel}
        </Chip>
        {cycleLabel && <Chip>{cycleLabel}</Chip>}
        <Chip>{budgetLabel}</Chip>
      </div>

      {open === 'retro' && data.lastRetro && (
        <div className="mt-3 rounded-card border border-rule bg-paper-warm p-4 space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute">
            {data.lastRetro.feeling ?? 'Retro'}
          </p>
          {data.lastRetro.note && (
            <blockquote className="font-serif-tool text-sm italic text-ink-soft border-l-2 border-accent pl-3">
              {data.lastRetro.note}
            </blockquote>
          )}
        </div>
      )}

      {open === 'coverage' && (data.topicCoverage?.length ?? 0) > 0 && (
        <div className="mt-3 rounded-card border border-rule bg-paper-warm p-4">
          <TopicCoverageHeatmap topics={data.topicCoverage} tileSize={18} />
        </div>
      )}
    </section>
  );
}

function Chip(props: { children: React.ReactNode; clickable?: boolean; active?: boolean; onClick?: () => void }) {
  const Tag = props.clickable ? 'button' : ('span' as const);
  return (
    <Tag
      type={props.clickable ? 'button' : undefined}
      onClick={props.onClick}
      className={clsx(
        'inline-flex items-center gap-1 rounded-pill border px-3 py-1 font-mono text-[10px] uppercase tracking-label transition-colors',
        props.active
          ? 'border-ink bg-ink text-paper'
          : props.clickable
            ? 'border-rule bg-surface text-ink-soft hover:border-ink-soft hover:bg-paper-warm'
            : 'border-rule bg-surface text-ink-mute cursor-default',
      )}
    >
      {props.children}
      {props.clickable && <ChevronDown className="h-3 w-3" strokeWidth={1.5} />}
    </Tag>
  );
}
```

**Note on `AdminPlanContextResponse`:** the actual type may name things differently (`weekNumber`, `feeling`, etc.). Read `apps/web/lib/queries/admin-plan-context.ts` and adjust accessors to match — do not invent fields. If a chip's data source is missing in the existing context type, fall back to a static label or hide the chip.

- [ ] **Step 3: Reconcile the type**

Run: `grep -n 'export type\|export interface' apps/web/lib/queries/admin-plan-context.ts`

Read the actual shape and replace `data.lastRetro`, `data.cycle`, `data.availability`, `data.topicCoverage` access with real paths from that type. If `avgDailyMinutes` doesn't exist, compute it inline: average of `[mondayMinutes, …, sundayMinutes]` excluding nulls.

- [ ] **Step 4: Typecheck + commit**

Run: `pnpm --filter @ics-select/web typecheck`

```bash
git add apps/web/components/admin/plan-editor/context-strip.tsx
git commit -m "feat(plan-editor): ContextStrip with collapsible retro + coverage"
```

### Task 12: `AiSuggestDrawer` component

**Files:**
- Create: `apps/web/components/admin/plan-editor/ai-suggest-drawer.tsx`

Wraps the HeroUI `Drawer`. Houses the brief textarea + draft results (empty + loading + result states). Absorbs the responsibilities of the to-be-deleted `ai-draft-panel.tsx` + `regenerate-brief-modal.tsx`.

- [ ] **Step 1: Confirm HeroUI Drawer is in scope**

Run: `grep -rn 'from "@heroui/react"' apps/web/components/ | head -5`

Check the project pattern. Then:

```bash
node -e 'console.log(Object.keys(require("@heroui/react")).filter(k => /drawer/i.test(k)))'
```

Expected: `[ 'Drawer', 'DrawerContent', 'DrawerHeader', 'DrawerBody', 'DrawerFooter' ]` (or similar). If missing, fall back to HeroUI's `Modal` with `placement="right"` styled to fill height.

- [ ] **Step 2: Write the drawer**

```tsx
'use client';
import { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerBody } from '@heroui/react';
import { Sparkles, Zap } from 'lucide-react';
import { clsx } from 'clsx';
import { Eyebrow } from '../../ui/eyebrow';
import { SectionLabel } from '../../ui/section-label';
import type { AiDraft } from '../../../lib/queries/admin-plan-editor';
import type { LibraryItem } from '../../../lib/queries/library-search';

export type AiSuggestDrawerProps = {
  open: boolean;
  onClose: () => void;
  draft: AiDraft | null;
  libraryById: Map<string, LibraryItem>;
  topicNameById: Map<string, string>;
  carryOverLibraryItemIds: Set<string>;
  addedLibraryItemIds: Set<string>;
  loading: boolean;
  onGenerate: (brief?: string) => void;
  onAddItem: (libraryItemId: string) => void;
};

export function AiSuggestDrawer(props: AiSuggestDrawerProps) {
  const [brief, setBrief] = useState('');
  const [briefOpen, setBriefOpen] = useState(false);

  const visibleItems = (props.draft?.items ?? [])
    .filter((i) => !props.addedLibraryItemIds.has(i.libraryItemId))
    .sort((a, b) => a.order - b.order);
  const visibleAlternates = (props.draft?.alternates ?? []).filter(
    (a) => !props.addedLibraryItemIds.has(a.libraryItemId),
  );

  return (
    <Drawer isOpen={props.open} onClose={props.onClose} placement="right" size="md">
      <DrawerContent>
        <DrawerHeader className="flex items-center gap-2 border-b border-rule">
          <Sparkles className="h-4 w-4 text-accent" strokeWidth={1.5} />
          <Eyebrow>AI Draft · GPT-5.4-mini</Eyebrow>
        </DrawerHeader>
        <DrawerBody className="space-y-6">
          {props.loading ? (
            <p className="font-mono text-xs uppercase tracking-label text-ink-mute text-center py-12">
              Gerando… (10-20s)
            </p>
          ) : !props.draft ? (
            <EmptyForm brief={brief} setBrief={setBrief} onGenerate={() => props.onGenerate(brief.trim() || undefined)} />
          ) : (
            <>
              <p className="font-serif-tool text-base italic text-ink leading-relaxed">{props.draft.narrative}</p>
              <p className="font-mono text-[11px] text-ink-mute">
                {props.draft.items.length} items · {props.draft.totalMinutes} min
              </p>
              <details open={briefOpen} onToggle={(e) => setBriefOpen((e.target as HTMLDetailsElement).open)}>
                <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-label text-ink-soft hover:text-ink">
                  ⟲ Regenerar com nova direção
                </summary>
                <div className="mt-3 space-y-2">
                  <textarea
                    value={brief}
                    onChange={(e) => setBrief(e.target.value.slice(0, 200))}
                    rows={3}
                    placeholder="Ex: quero todos os vídeos de foundations."
                    className="w-full rounded-input border border-rule bg-paper p-3 font-sans text-sm resize-none focus:outline-none focus:ring-2 focus:ring-focus/40"
                  />
                  <button
                    type="button"
                    onClick={() => props.onGenerate(brief.trim() || undefined)}
                    className="inline-flex items-center gap-1.5 rounded-pill bg-ink text-paper px-4 py-1.5 font-mono text-[11px] uppercase tracking-label hover:opacity-90"
                  >
                    <Zap className="h-3 w-3" strokeWidth={1.5} />
                    Regenerar
                  </button>
                </div>
              </details>

              <section>
                <SectionLabel>Suggested · {visibleItems.length}</SectionLabel>
                <div className="mt-3 space-y-3">
                  {visibleItems.map((suggested, idx) => {
                    const item = props.libraryById.get(suggested.libraryItemId);
                    if (!item) return null;
                    const isCarried = props.carryOverLibraryItemIds.has(suggested.libraryItemId);
                    const topicName = item.topicId ? props.topicNameById.get(item.topicId) ?? null : null;
                    return (
                      <div key={suggested.libraryItemId} className={clsx(
                        'rounded-card border p-3',
                        isCarried ? 'bg-paper-warm border-accent/40' : 'bg-surface border-rule',
                      )}>
                        <div className="flex items-start gap-3">
                          <span className="font-serif-tool text-base font-semibold text-ink-mute min-w-[1.5ch]">{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            {isCarried && (
                              <span className="inline-block mb-1 font-mono text-[9px] uppercase tracking-label text-accent px-1.5 py-0.5 border border-accent/40 rounded-pill">
                                carried over
                              </span>
                            )}
                            <p className="font-serif-tool text-sm font-semibold text-ink">{item.title}</p>
                            <p className="mt-0.5 font-mono text-[10px] uppercase tracking-label text-ink-mute">
                              {item.format}{topicName ? ` · ${topicName}` : ''} · {item.estimatedMinutes}m
                            </p>
                            <blockquote className="mt-2 border-l-2 border-accent pl-2 py-0.5 font-serif-tool text-xs italic text-ink-soft">
                              <span className="font-mono text-[9px] uppercase tracking-eyebrow text-accent not-italic mr-1">why</span>
                              {suggested.rationale}
                            </blockquote>
                          </div>
                          <button
                            type="button"
                            onClick={() => props.onAddItem(suggested.libraryItemId)}
                            className="font-mono text-[11px] text-focus hover:underline underline-offset-2 whitespace-nowrap"
                          >
                            Add →
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {visibleAlternates.length > 0 && (
                <details>
                  <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute font-semibold hover:text-ink">
                    Or consider · {visibleAlternates.length}
                  </summary>
                  <div className="mt-3 space-y-2">
                    {visibleAlternates.map((alt) => {
                      const item = props.libraryById.get(alt.libraryItemId);
                      if (!item) return null;
                      return (
                        <div key={alt.libraryItemId} className="rounded-card border border-rule bg-paper px-3 py-2 flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-serif-tool text-sm font-semibold text-ink">{item.title}</p>
                            <p className="mt-0.5 font-mono text-[10px] text-ink-mute">{alt.rationale}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => props.onAddItem(alt.libraryItemId)}
                            className="font-mono text-[11px] text-focus hover:underline underline-offset-2 whitespace-nowrap"
                          >
                            Add →
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </details>
              )}
            </>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}

function EmptyForm(props: { brief: string; setBrief: (v: string) => void; onGenerate: () => void }) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <h2 className="font-serif-tool text-xl font-semibold text-ink">Sugerir um plano</h2>
        <p className="font-sans text-sm text-ink-soft">
          Usa últimas 4 semanas, retro, topic coverage, carry-overs e a track do membro.
        </p>
      </div>
      <div className="space-y-1">
        <label className="font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute">Direção (opcional)</label>
        <textarea
          value={props.brief}
          onChange={(e) => props.setBrief(e.target.value.slice(0, 200))}
          rows={3}
          placeholder="Ex: quero todos os vídeos de foundations."
          className="w-full rounded-input border border-rule bg-paper p-3 font-sans text-sm resize-none focus:outline-none focus:ring-2 focus:ring-focus/40"
        />
        <p className="font-mono text-[10px] text-ink-mute text-right">{props.brief.length} / 200</p>
      </div>
      <button
        type="button"
        onClick={props.onGenerate}
        className="inline-flex items-center gap-2 bg-ink text-paper rounded-pill px-5 py-2.5 font-mono text-xs uppercase tracking-label hover:opacity-90"
      >
        <Zap className="h-4 w-4" strokeWidth={1.5} />
        Gerar
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm --filter @ics-select/web typecheck`

```bash
git add apps/web/components/admin/plan-editor/ai-suggest-drawer.tsx
git commit -m "feat(plan-editor): AiSuggestDrawer (HeroUI side drawer)"
```

---

## Phase 6 · Frontend: rewire the editor page

### Task 13: Strip context/AI imports from `EditablePlanPanel`

**Files:**
- Modify: `apps/web/components/admin/plan-editor/editable-plan-panel.tsx`

Read the file first. Drop any imports of the old `ContextPanel`/`AiDraftPanel`/`RegenerateBriefModal`. Most likely there are no such imports here (the page composes them) — if so, this task collapses to a no-op and you can skip the commit.

- [ ] **Step 1: Inspect**

Run: `grep -n 'context-panel\|ai-draft-panel\|regenerate-brief' apps/web/components/admin/plan-editor/editable-plan-panel.tsx`

- [ ] **Step 2: Remove matches if any, typecheck, commit**

If grep returns matches, delete those import lines and their usages. Typecheck. Commit:

```bash
git add apps/web/components/admin/plan-editor/editable-plan-panel.tsx
git commit -m "refactor(plan-editor): drop legacy context/ai panel imports from editor"
```

If grep returns nothing, skip to the next task.

### Task 14: Rewrite the plan editor page layout

**Files:**
- Modify: `apps/web/app/(admin)/admin/member/[id]/plan/[planId]/page.tsx`

This is the largest single edit. Replace the `<div className="grid grid-cols-12 gap-6">` block (~lines 580–635) with the new layout. Keep all existing handlers (`handleAddItem`, `handlePublish`, `handleApplyEdit`, etc.) — only the JSX changes.

- [ ] **Step 1: Add new imports**

At the top, replace:
```ts
import { ContextPanel } from '…/context-panel';
import { AiDraftPanel } from '…/ai-draft-panel';
```

with:
```ts
import { ContextStrip } from '../../../../../../../components/admin/plan-editor/context-strip';
import { AiSuggestDrawer } from '../../../../../../../components/admin/plan-editor/ai-suggest-drawer';
import { WeekPreview } from '../../../../../../../components/admin/plan-editor/week-preview';
import { UnscheduledSection } from '../../../../../../../components/admin/plan-editor/unscheduled-section';
import { CarryOverList } from '../../../../../../../components/admin/plan-editor/carry-over-list'; // adjust if filename differs
import { useSchedulingPreview, type PreviewItem } from '../../../../../../../lib/queries/admin-plan-preview';
import { Sparkles } from 'lucide-react';
```

Remove the unused `briefOpen` state and the `RegenerateBriefModal` JSX/import (the drawer absorbs both).

- [ ] **Step 2: Add `aiDrawerOpen` state**

Near the other `useState` calls:

```ts
const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
```

- [ ] **Step 3: Wire the preview hook**

After `plan` is resolved:

```ts
const previewItems: PreviewItem[] = useMemo(
  () =>
    (plan?.items ?? []).map((i) => ({
      libraryItemId: i.libraryItemId,
      order: i.order,
      estimatedMinutes: i.libraryItem.estimatedMinutes,
    })),
  [plan?.items],
);

const previewEnabled = Boolean(
  plan &&
    plan.status === 'DRAFT' &&
    previewItems.length > 0 &&
    context?.availability,
);

const preview = useSchedulingPreview(plan?.id ?? null, previewItems, previewEnabled);
```

- [ ] **Step 4: Compute the week props (DRAFT vs PUBLISHED)**

```ts
const placements = useMemo(() => {
  if (!plan) return [];
  if (plan.status === 'DRAFT') return preview.data?.placements ?? [];
  // Published / Completed / Archived: read persisted scheduledAt/scheduledMinutes off items.
  return plan.items
    .filter((i) => i.scheduledAt && i.scheduledMinutes)
    .map((i) => ({
      itemId: i.libraryItemId,
      scheduledAt: i.scheduledAt!,
      durationMinutes: i.scheduledMinutes!,
    }));
}, [plan, preview.data]);

const overflow = plan?.status === 'DRAFT' ? (preview.data?.overflow ?? []) : [];
const overflowItemIds = useMemo(() => new Set(overflow.map((o) => o.itemId)), [overflow]);

const weekAvailability = useMemo(() => {
  if (!context?.availability) {
    return { timezone: 'America/Sao_Paulo', capByWeekday: [null,null,null,null,null,null,null], slotsByWeekday: [[],[],[],[],[],[],[]] };
  }
  // The shape of context.availability depends on the existing query.
  // Map mondayMinutes…sundayMinutes into capByWeekday (idx 0=Mon).
  // Map slots[] into slotsByWeekday by dayOfWeek.
  // Read apps/web/lib/queries/admin-plan-context.ts to find the exact field names.
  return mapAvailability(context.availability);
}, [context]);
```

Define `mapAvailability` locally (or as a helper in `admin-plan-context.ts`) once you've confirmed the field names. It's pure shape translation.

- [ ] **Step 5: Replace the JSX inside the `<div className="hidden xl:block">` block**

Replace the old `<div className="grid grid-cols-12 gap-6">…</div>` (the three-column section that renders ContextPanel/AiDraftPanel/EditablePlanPanel) with:

```tsx
<>
  <ContextStrip data={context} />

  <div className="grid grid-cols-12 gap-6">
    <div className="col-span-8">
      <EditablePlanPanel
        plan={plan}
        context={context}
        topicNameById={topicNameById}
        carryOverLibraryItemIds={carryOverLibraryItemIds}
        onItemsChange={handleItemsChange}
        onAdminNotesChange={handleAdminNotesChange}
        onAddLibraryItem={(id) => { void handleAddItem(id); }}
        onSaveDraft={() => { void handleSaveDraft(); }}
        onPublish={(options) => { void handlePublish(options); }}
        onApplyEdit={() => { void handleApplyEdit(); }}
        saving={updatePlan.isPending}
        publishing={publishPlan.isPending || autoSchedule.isPending}
        applyingEdit={editPublished.isPending}
      />
    </div>
    {plan.status === 'DRAFT' && context.carryOverCandidates.length > 0 && (
      <aside className="col-span-4">
        <CarryOverList
          candidates={context.carryOverCandidates}
          selectedIds={carryOverIds}
          onChange={setCarryOverIds}
        />
      </aside>
    )}
  </div>

  <div className="mt-8">
    {context.availability ? (
      <WeekPreview
        weekStart={plan.weekStart}
        availability={weekAvailability}
        placements={placements}
        items={plan.items}
        overflowItemIds={overflowItemIds}
        isUpdating={plan.status === 'DRAFT' && preview.isFetching}
        isStale={plan.status === 'DRAFT' && Boolean(preview.error)}
        onItemClick={(libId) => {
          const el = document.getElementById(`plan-item-${libId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-2', 'ring-focus/40');
            setTimeout(() => el.classList.remove('ring-2', 'ring-focus/40'), 2000);
          }
        }}
      />
    ) : (
      <NoAvailabilityBanner memberId={memberId} />
    )}
  </div>

  <UnscheduledSection overflow={overflow} items={plan.items} memberId={memberId} />
</>
```

Add a small inline component at the bottom of the file:

```tsx
function NoAvailabilityBanner({ memberId }: { memberId: string }) {
  return (
    <div className="rounded-card border border-outcome-stuck/40 p-6">
      <p className="font-serif-tool text-base text-ink mb-2">Membro não configurou disponibilidade</p>
      <p className="font-sans text-sm text-ink-soft mb-4">Não dá pra prever a agenda sem isso.</p>
      <a
        href={`/admin/member/${memberId}/availability`}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1.5 rounded-pill bg-ink text-paper px-3 py-1.5 font-mono text-[11px] uppercase tracking-label hover:opacity-90"
      >
        Abrir availability
      </a>
    </div>
  );
}
```

- [ ] **Step 6: Add the AI button to the header**

In the existing `<header className="mb-6 flex items-center gap-3">` block, before the `Reschedule pending`/`Delete plan` buttons, add (only for DRAFT):

```tsx
{plan && plan.status === 'DRAFT' && (
  <button
    type="button"
    onClick={() => setAiDrawerOpen(true)}
    className="ml-auto inline-flex items-center gap-1.5 rounded-pill border border-rule px-3 py-1 font-mono text-[10px] uppercase tracking-label text-ink-soft hover:border-ink-soft hover:bg-paper-warm"
  >
    <Sparkles className="h-3 w-3" strokeWidth={1.5} />
    Sugerir com IA
  </button>
)}
```

Remove the `ml-auto` from whichever neighboring button currently has it so the AI button takes the spacer role on DRAFT pages. Keep `ml-auto` on the rightmost button for PUBLISHED.

- [ ] **Step 7: Mount the drawer**

At the bottom of the page JSX (next to `RegenerateBriefModal` / `SchedulingModal`):

```tsx
<AiSuggestDrawer
  open={aiDrawerOpen}
  onClose={() => setAiDrawerOpen(false)}
  draft={aiDraft}
  libraryById={libraryItems}
  topicNameById={topicNameById}
  carryOverLibraryItemIds={carryOverLibraryItemIds}
  addedLibraryItemIds={new Set(plan?.items.map((i) => i.libraryItemId) ?? [])}
  loading={draftMutation.isPending}
  onGenerate={(brief) => { void generateDraft(brief); }}
  onAddItem={(id) => { void handleAddItem(id); }}
/>
```

Delete the `RegenerateBriefModal` JSX block (it's absorbed by the drawer).

- [ ] **Step 8: Ensure stable DOM ids on editor list rows**

Open `apps/web/components/admin/plan-editor/editable-plan-panel.tsx` (or wherever the editor renders each item row, likely `item-card.tsx`). Find the row element and add `id={`plan-item-${item.libraryItemId}`}`. Use `libraryItemId` (not `item.id`) because preview placements key off `libraryItemId`.

- [ ] **Step 9: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: green. Triage any errors caused by stale references to deleted/renamed symbols.

- [ ] **Step 10: Manual visual check**

Run: `pnpm --filter @ics-select/web dev` and open `/admin/member/<test-user>/plan/new` in the browser. Verify:
- The 5-region layout renders.
- The AI drawer opens from the right.
- The week preview renders 7 day cards.
- Adding items via library picker triggers (after ~500ms) a fresh placement render.

- [ ] **Step 11: Commit**

```bash
git add apps/web/app/\(admin\)/admin/member/\[id\]/plan/\[planId\]/page.tsx apps/web/components/admin/plan-editor/editable-plan-panel.tsx apps/web/components/admin/plan-editor/item-card.tsx
git commit -m "feat(plan-editor): new 5-region layout with week preview + ai drawer"
```

(Adjust the staged file list to include only the files you actually modified — `item-card.tsx` only if you added the DOM id there.)

### Task 15: Delete the legacy components

**Files:**
- Delete: `apps/web/components/admin/plan-editor/context-panel.tsx`
- Delete: `apps/web/components/admin/plan-editor/ai-draft-panel.tsx`
- Delete: `apps/web/components/admin/plan-editor/regenerate-brief-modal.tsx`

- [ ] **Step 1: Verify no remaining imports**

Run:
```bash
grep -rn 'context-panel\|ai-draft-panel\|regenerate-brief-modal' apps/web/ | grep -v node_modules
```

Expected: empty. If anything matches, fix and re-grep.

- [ ] **Step 2: Delete**

```bash
git rm apps/web/components/admin/plan-editor/context-panel.tsx \
       apps/web/components/admin/plan-editor/ai-draft-panel.tsx \
       apps/web/components/admin/plan-editor/regenerate-brief-modal.tsx
```

- [ ] **Step 3: Typecheck + commit**

Run: `pnpm --filter @ics-select/web typecheck`

```bash
git commit -m "chore(plan-editor): remove legacy context/ai panels (absorbed into strip + drawer)"
```

---

## Phase 7 · Verification

### Task 16: Playwright smoke test

**Files:**
- Create or modify: `apps/web/tests/admin-plan-editor.spec.ts`

Smoke check the new flow against the dev server. Snapshot the editor for visual regression.

- [ ] **Step 1: Inspect an existing Playwright spec for setup pattern**

Open `apps/web/tests/admin-cockpit.spec.ts` and note: how it authenticates (likely via cookie injection), how it mocks API endpoints, and how it takes snapshots.

- [ ] **Step 2: Write the spec**

Write a Playwright test that:
1. Mocks `GET /plans/:id` to return a DRAFT plan with two items already in it.
2. Mocks `POST /plans/:id/preview-scheduling` to return two placements on different days.
3. Mocks `GET /admin/plans/.../context` (or whatever powers `useAdminPlanContext`) to return one carry-over candidate.
4. Visits `/admin/member/<id>/plan/<planId>`.
5. Snapshots the editor for `plan-editor-draft-chromium-darwin.png`.
6. Clicks the `Sugerir com IA` button, waits for the drawer, snapshots `plan-editor-ai-drawer-chromium-darwin.png`.

Mirror the auth/mocking pattern from the cockpit spec exactly — don't invent a new one.

- [ ] **Step 3: Generate the snapshot baselines**

Run: `pnpm --filter @ics-select/web test:update -- admin-plan-editor.spec.ts`

Inspect the generated PNGs at `apps/web/tests/admin-plan-editor.spec.ts-snapshots/` and confirm they look correct.

- [ ] **Step 4: Run the test against the baselines**

Run: `pnpm --filter @ics-select/web test admin-plan-editor.spec.ts`

Expected: green.

- [ ] **Step 5: Commit**

```bash
git add apps/web/tests/admin-plan-editor.spec.ts apps/web/tests/admin-plan-editor.spec.ts-snapshots/
git commit -m "test(plan-editor): playwright snapshots for new layout"
```

### Task 17: End-to-end run-throughs in the browser

This is a manual review — no automated test substitutes for it given the design system requirements documented in `CLAUDE.md` (HeroUI styling silently fails if the Tailwind content path is wrong).

- [ ] **Step 1: Start dev**

Run: `pnpm --filter @ics-select/web dev`

- [ ] **Step 2: Walk the DRAFT path**

Open a DRAFT plan in the browser. Check:
- Context strip chips render; clicking `Retro` toggles the accordion; clicking again closes it; reloading the page restores the last open state.
- Carry-over sidebar shows checkboxes; toggling one updates the chip on matching items in the editor.
- Adding an item via the library picker triggers a week preview refresh ~500ms later (look for "atualizando…" in the section header).
- Day cards render with caps, slots, items, and `free Xm`.
- Clicking an item in a day card scrolls the editor row into view and highlights it for 2s.
- The AI drawer opens from the right and the brief textarea works.

- [ ] **Step 3: Walk the PUBLISHED path**

Open an already-PUBLISHED plan. Check:
- AI button is hidden.
- Carry-over sidebar is hidden.
- Week preview renders persisted `scheduledAt`/`scheduledMinutes` placements.
- Items with `outcome !== PENDING` show a lock icon (if you added that affordance — confirm with the spec; if not, item rows just render normally).

- [ ] **Step 4: Walk the no-availability path**

Manually wipe a test member's `MemberAvailability` row in the local DB (or pick a member that doesn't have one). Reload the plan editor. Verify:
- Budget chip reads `— · sem availability`.
- Where the week would render, the banner appears with `Abrir availability` linking to a new tab.

- [ ] **Step 5: Verify nothing regressed**

Spot-check `/admin/library`, `/admin/cycle/[id]`, and `/me` to confirm unrelated pages still work. Run the existing Playwright suite once:

Run: `pnpm --filter @ics-select/web test`

Expected: green except snapshots that may need refreshing for incidental layout changes — refresh only those that visibly match the new design.

- [ ] **Step 6: Final commit (if anything from the manual walk needed a fix)**

If you spotted an issue and patched it, commit the fix as its own bite (e.g. `fix(plan-editor): correct chip toggle persistence`). If nothing changed, skip.

### Task 18: Final hygiene

- [ ] **Step 1: Lint + typecheck across both packages**

Run in parallel:
- `pnpm --filter @ics-select/api lint && pnpm --filter @ics-select/api typecheck`
- `pnpm --filter @ics-select/web lint && pnpm --filter @ics-select/web typecheck`

Expected: green.

- [ ] **Step 2: Full test pass**

Run: `pnpm test`

Expected: green.

- [ ] **Step 3: Confirm no orphan files**

Run:
```bash
git status
grep -rn 'context-panel\|ai-draft-panel\|regenerate-brief' apps/ | grep -v node_modules
```

Expected: working tree clean; no stale references.

---

## Spec coverage check

| Spec section | Implementing task |
|---|---|
| Layout · 5 stacked regions (header, context strip, editor+carry-over, week preview, unscheduled) | Tasks 11, 13, 14, 9, 10 |
| Context strip with chip accordion + localStorage | Task 11 |
| AI side drawer (HeroUI) | Task 12 + Task 14 (wiring) |
| Editor preserves order-driven list semantics | Task 14 (layout keeps `EditablePlanPanel` intact) |
| Carry-over sidebar inline with editor, hides when empty | Task 14 |
| Week preview (7 day cards · cap · slots · items · free) | Tasks 8, 9, 14 |
| Real-time dry-run debounced 500ms | Tasks 6, 7, 14 |
| POST /plans/:id/preview-scheduling | Tasks 2, 3, 4 |
| GET /plans/:id exposes scheduledAt/scheduledMinutes | Task 5 (frontend type; backend already returns) |
| Click item → highlight editor row | Task 14 step 8 + step 5 inline handler |
| Edge case: 0 items | Task 14 (empty editor state guarded; preview disabled) |
| Edge case: no availability | Task 14 step 5 (`NoAvailabilityBanner`) |
| Edge case: PUBLISHED hides AI + carry-over | Task 14 conditional blocks |
| Stale preview header label | Task 9 (`isStale` prop) + Task 14 (passes `Boolean(preview.error)`) |
| Unscheduled banner | Task 10, Task 14 |
| Delete legacy panels | Task 15 |

## Risk register

- **HeroUI Drawer styling silently fails** if the pnpm Tailwind `content` path doesn't pick it up (see `CLAUDE.md`). Mitigation: Task 17 manual visual check.
- **`AdminPlanContextResponse` field names** in `ContextStrip` are speculative — Task 11 step 3 forces reconciliation before commit.
- **The scheduler treats `ItemInput.id` as opaque**; we pass `libraryItemId`. If two plan items reference the same `libraryItemId`, placements collide. The current data model treats this as invalid (the picker dedupes adds), but a defensive runtime check in Task 3 step 2 (`if (plan.items.some((i) => i.libraryItemId === libraryItemId)) return;`) is already in the page — keep that.
- **Playwright snapshot baselines** may shift on different machines. Mitigation: Task 16 runs `test:update` locally on the same env that runs CI.

## What's deliberately not in this plan

- Drag-and-drop pinning of items to days (would require scheduler changes).
- Reconciliation of Google Calendar drift (member moves an event after publish).
- Multi-admin edit conflict resolution.
- Restructuring `EditablePlanPanel` itself (it stays as the order-driven list).

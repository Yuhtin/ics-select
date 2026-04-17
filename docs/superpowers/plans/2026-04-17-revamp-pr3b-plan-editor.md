# PR 3b — Plan Editor 3-panel (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the plan editor at `/admin/member/[id]/plan/[planId]`. Three panels (Context · AI Draft · Editable Plan) let the admin go from "empty week" to "published plan with Calendar events" in one screen. The AI panel uses an enhanced prompt (retro + topic coverage + track + carry-over) — tool calling stays deferred to PR 4.

**Architecture:**

- **Context panel (read-only)** is computed by a new `PlanContextService` from existing data: last week's outcomes, STUCK/DOUBTS items as carry-over candidates, current retro, topic coverage heatmap, cached AI diagnose. One round of Prisma calls.
- **AI draft panel** calls the existing `DraftPlanService` (panel 2). We rewrite its prompt to include track, last 4 weeks of outcomes, retro text, topic coverage, and any admin-selected carry-over IDs. Tool calling **is NOT added in this PR** — the LLM still receives a pre-fetched candidate pool and chooses from it. The new contract: the endpoint accepts `{ memberId, weekStart, weekEnd, carryOverItemIds?, briefText? }` and returns `{ draft, usage }` where the draft items now carry per-item `rationale` strings.
- **Editable plan panel** operates on the real `WeeklyPlan` via `PATCH /plans/:id` (already exists) and `POST /plans/:id/publish` (already exists). New endpoints: `POST /admin/members/:id/plan-drafts` (get-or-create a draft for a given week so the URL `/admin/member/[id]/plan/[planId]` can be bootstrapped) and `POST /admin/library/search` (already exists — library search is public-ish; we just reuse).
- **Budget badge** is purely frontend: sum `estimatedMinutes` vs declared weekly budget (read from `MemberAvailability`). Green/amber/red. The authoritative overflow check still happens server-side at publish.
- **Publish flow** reuses `publication.autoSchedule` (wired to Google free/busy in PR 3a). The 409 `PLAN_OVERFLOW` surfaces as a modal with `[Adjust] [Force publish]` buttons.
- **Admin member gate** — the page lives under the new `(admin)` shell but the member detail page itself (`/admin/member/[id]`) is PR 3c. The plan editor works standalone — user lands at `/admin/member/[id]/plan/[planId]` from the triage page or cycle grid. If the member or plan is missing → error view + back button.

**Tech stack:** NestJS 10 + Prisma 5 · Next.js 15 App Router + TanStack Query · `Source Serif 4` (font-serif-tool) everywhere on this page · lucide-react icons · design language from `docs/design-system.md`. No new dependencies.

**Reference spec:** `docs/superpowers/specs/2026-04-16-revamp-design.md` §5.4 (Plan Editor), §6.2 (AI use cases), §8 (API changes).

**Out of scope (deferred):**

- **PR 3c**: library UI (typeahead server is reused but the full `/admin/library` page), topics management UI, `/admin/cycles` list, `/admin/ai-usage`, `/admin/member/[id]` detail page, classes management, members list.
- **PR 4**: tool calling (`search_library` as a real LLM tool), retro cron (Fri 18h), WhatsApp purge cron, ChatContextUseCase UI.

---

## File Structure

### Created (Backend)

- `apps/api/src/topics/topics.service.ts`
- `apps/api/src/topics/topics.service.spec.ts`
- `apps/api/src/topics/topics.controller.ts`
- `apps/api/src/topics/topics.module.ts`
- `apps/api/src/topics/dto.ts`
- `apps/api/src/admin/plan-context/plan-context.service.ts`
- `apps/api/src/admin/plan-context/plan-context.service.spec.ts`
- `apps/api/src/admin/plan-context/plan-context.controller.ts`
- `apps/api/src/admin/plan-context/plan-context.module.ts`
- `apps/api/src/admin/plan-drafts/plan-drafts.service.ts`
- `apps/api/src/admin/plan-drafts/plan-drafts.service.spec.ts`
- `apps/api/src/admin/plan-drafts/plan-drafts.controller.ts`
- `apps/api/src/admin/plan-drafts/plan-drafts.module.ts`

### Modified (Backend)

- `apps/api/src/admin/admin.module.ts` (import PlanContextModule + PlanDraftsModule)
- `apps/api/src/app.module.ts` (import TopicsModule)
- `apps/api/src/ai/draft-plan.service.ts` (enhanced prompt + accepts carryOverItemIds + weekStart/weekEnd)
- `apps/api/src/ai/draft-plan.service.spec.ts`
- `apps/api/src/ai/brief-plan.service.ts` (re-align with new draft signature so both use the same prompt scaffolding)
- `apps/api/src/ai/brief-plan.service.spec.ts`
- `apps/api/src/ai/ai.controller.ts` (widen `DraftInputSchema` and `BriefInputSchema`)

### Created (Frontend)

- `apps/web/lib/queries/admin-plan-context.ts`
- `apps/web/lib/queries/admin-plan-editor.ts`
- `apps/web/lib/queries/admin-topics.ts`
- `apps/web/lib/queries/library-search.ts`
- `apps/web/components/admin/plan-editor/context-panel.tsx`
- `apps/web/components/admin/plan-editor/ai-draft-panel.tsx`
- `apps/web/components/admin/plan-editor/editable-plan-panel.tsx`
- `apps/web/components/admin/plan-editor/budget-badge.tsx`
- `apps/web/components/admin/plan-editor/topic-coverage-mini.tsx`
- `apps/web/components/admin/plan-editor/carry-over-list.tsx`
- `apps/web/components/admin/plan-editor/item-card.tsx`
- `apps/web/components/admin/plan-editor/add-item-typeahead.tsx`
- `apps/web/components/admin/plan-editor/regenerate-brief-modal.tsx`
- `apps/web/components/admin/plan-editor/overflow-modal.tsx`
- `apps/web/app/(admin)/admin/member/[id]/plan/[planId]/page.tsx`

### Collision check

- The legacy plan editor lives at `apps/web/app/(app)/admin/plans/[memberId]/page.tsx` (resolves to `/admin/plans/:memberId`). The new editor is at `/admin/member/[id]/plan/[planId]` — **no path collision**. Legacy stays untouched until PR 3c wipes the entire legacy admin tree.

---

## Tasks

### Task 1: Topics CRUD service + tests

**Files:**
- Create: `apps/api/src/topics/topics.service.ts`
- Create: `apps/api/src/topics/topics.service.spec.ts`

**Goal:** Minimal CRUD over the `Topic` Prisma model. The plan-context service and any future topic-management UI reuse this. Scope is intentionally narrow: list, create, update, delete, reorder. No UI built yet — that's PR 3c.

The `Topic` model (from schema.prisma line 185) has `id`, `name` (unique), `order` (Int), `createdAt`, and an implicit back-relation `libraryItems`.

- [ ] **Step 1: Write the spec**

Create `apps/api/src/topics/topics.service.spec.ts`:

```typescript
import { TopicsService } from './topics.service';

function makePrisma() {
  const topics = new Map<string, { id: string; name: string; order: number; createdAt: Date }>();
  let nextId = 1;
  return {
    topics,
    topic: {
      findMany: jest.fn(async () =>
        Array.from(topics.values()).sort((a, b) => a.order - b.order),
      ),
      create: jest.fn(async ({ data }: any) => {
        const id = `t-${nextId++}`;
        const rec = { id, createdAt: new Date(), ...data };
        topics.set(id, rec);
        return rec;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const cur = topics.get(where.id)!;
        const next = { ...cur, ...data };
        topics.set(where.id, next);
        return next;
      }),
      delete: jest.fn(async ({ where }: any) => {
        const row = topics.get(where.id)!;
        topics.delete(where.id);
        return row;
      }),
    },
  };
}

describe('TopicsService', () => {
  it('lists topics in order', async () => {
    const prisma = makePrisma();
    await prisma.topic.create({ data: { name: 'dp', order: 1 } });
    await prisma.topic.create({ data: { name: 'arrays', order: 0 } });
    const svc = new TopicsService(prisma as any);
    const list = await svc.list();
    expect(list.map((t: any) => t.name)).toEqual(['arrays', 'dp']);
  });

  it('creates a topic with the next order value', async () => {
    const prisma = makePrisma();
    await prisma.topic.create({ data: { name: 'arrays', order: 0 } });
    const svc = new TopicsService(prisma as any);
    const created = await svc.create({ name: 'dp' });
    expect(created.order).toBe(1);
  });

  it('updates a topic name', async () => {
    const prisma = makePrisma();
    const row = await prisma.topic.create({ data: { name: 'dp', order: 0 } });
    const svc = new TopicsService(prisma as any);
    const updated = await svc.update(row.id, { name: 'dynamic programming' });
    expect(updated.name).toBe('dynamic programming');
  });

  it('deletes a topic', async () => {
    const prisma = makePrisma();
    const row = await prisma.topic.create({ data: { name: 'dp', order: 0 } });
    const svc = new TopicsService(prisma as any);
    await svc.delete(row.id);
    expect(prisma.topics.size).toBe(0);
  });
});
```

Run: `pnpm --filter @ics-select/api test -- --testPathPattern topics.service`. Expected: fails (no implementation).

- [ ] **Step 2: Implement**

Create `apps/api/src/topics/topics.service.ts`:

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';

type CreateInput = { name: string; order?: number };
type UpdateInput = { name?: string; order?: number };

@Injectable()
export class TopicsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.topic.findMany({ orderBy: { order: 'asc' } });
  }

  async create(input: CreateInput) {
    const order = input.order ?? (await this.nextOrder());
    return this.prisma.topic.create({ data: { name: input.name, order } });
  }

  async update(id: string, input: UpdateInput) {
    const existing = await this.prisma.topic.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('topic not found');
    return this.prisma.topic.update({ where: { id }, data: input });
  }

  async delete(id: string) {
    const existing = await this.prisma.topic.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('topic not found');
    return this.prisma.topic.delete({ where: { id } });
  }

  private async nextOrder(): Promise<number> {
    const last = await this.prisma.topic.findFirst({ orderBy: { order: 'desc' } });
    return (last?.order ?? -1) + 1;
  }
}
```

Run tests again: 4/4 pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/topics/topics.service.ts apps/api/src/topics/topics.service.spec.ts
git commit -m "feat(api): TopicsService — list/create/update/delete with auto order"
```

---

### Task 2: Topics controller + module + wire into AppModule

**Files:**
- Create: `apps/api/src/topics/dto.ts`
- Create: `apps/api/src/topics/topics.controller.ts`
- Create: `apps/api/src/topics/topics.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: DTO**

Create `apps/api/src/topics/dto.ts`:

```typescript
import { z } from 'zod';

export const CreateTopicSchema = z.object({
  name: z.string().min(1).max(40),
  order: z.number().int().min(0).optional(),
});

export const UpdateTopicSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  order: z.number().int().min(0).optional(),
});
```

- [ ] **Step 2: Controller**

Create `apps/api/src/topics/topics.controller.ts`:

```typescript
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { TopicsService } from './topics.service.js';
import { CreateTopicSchema, UpdateTopicSchema } from './dto.js';

@Roles('ADMIN')
@Controller('topics')
export class TopicsController {
  constructor(private readonly topics: TopicsService) {}

  @Get()
  list() {
    return this.topics.list();
  }

  @Post()
  create(@Body() body: unknown) {
    const parsed = CreateTopicSchema.parse(body);
    return this.topics.create(parsed);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateTopicSchema.parse(body);
    return this.topics.update(id, parsed);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.topics.delete(id);
  }
}
```

- [ ] **Step 3: Module**

Create `apps/api/src/topics/topics.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { TopicsService } from './topics.service.js';
import { TopicsController } from './topics.controller.js';

@Module({
  providers: [TopicsService],
  controllers: [TopicsController],
  exports: [TopicsService],
})
export class TopicsModule {}
```

- [ ] **Step 4: Wire into `AppModule`**

Add to `apps/api/src/app.module.ts`:
- `import { TopicsModule } from './topics/topics.module.js';` at the top
- `TopicsModule` in `imports: [...]` (near CyclesModule for semantic grouping)

- [ ] **Step 5: Run tests**

```bash
pnpm --filter @ics-select/api test
pnpm --filter @ics-select/api typecheck
```

Expected: 141 prior + 4 new = 145 tests.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/topics apps/api/src/app.module.ts
git commit -m "feat(api): CRUD /topics endpoints (admin-only)"
```

---

### Task 3: PlanContextService + tests

**Files:**
- Create: `apps/api/src/admin/plan-context/plan-context.service.ts`
- Create: `apps/api/src/admin/plan-context/plan-context.service.spec.ts`

**Goal:** Compute everything Panel 1 needs in one call. Takes `{ memberId, weekStart }` and returns:

```ts
type PlanContextResponse = {
  member: { id: string; name: string; pictureUrl: string | null; track: string | null };
  cycle: { id: string; name: string; weekNumber: number; weeksTotal: number };
  lastWeek: {
    weekStart: string | null;
    outcomes: { done_easy: number; done_hard: number; doubts: number; stuck: number; pending: number };
    items: Array<{
      id: string;
      libraryItemId: string;
      title: string;
      outcome: 'PENDING' | 'DONE_EASY' | 'DONE_HARD' | 'DOUBTS' | 'STUCK';
      reflection: string | null;
    }>;
  };
  carryOverCandidates: Array<{
    id: string;                // WeeklyPlanItem.id from previous week
    libraryItemId: string;
    title: string;
    outcome: 'PENDING' | 'DOUBTS' | 'STUCK';
    reflection: string | null;
    topicId: string | null;
    topicName: string | null;
    estimatedMinutes: number;
  }>;
  retro: {
    whatClicked: string | null;
    whatStuck: string | null;
    nextWeekWish: string | null;
    submittedAt: string;
  } | null;
  topicCoverage: Array<{
    topicId: string;
    topicName: string;
    order: number;
    itemsPlanned: number;      // how many items of this topic were in this cycle's plans so far
    itemsDone: number;         // with DONE_EASY or DONE_HARD
    coveragePct: number;       // 0..100 rounded
  }>;
  availability: {
    mondayMinutes: number; tuesdayMinutes: number; wednesdayMinutes: number;
    thursdayMinutes: number; fridayMinutes: number; saturdayMinutes: number; sundayMinutes: number;
    preferredSessionMinutes: number;
    weeklyBudgetMinutes: number;   // sum of 7 day fields
    timezone: string;
  };
};
```

**Rules:**
- `lastWeek`: the member's PUBLISHED plan whose `weekStart` = input `weekStart - 7 days`. If none exists, `lastWeek = { weekStart: null, outcomes: { all zeros }, items: [] }`.
- `carryOverCandidates`: from the previous-week plan's items where `outcome ∈ {PENDING, DOUBTS, STUCK}`.
- `retro`: `WeeklyRetro` rows where `userId = memberId` and `weekStart = input weekStart - 7 days`.
- `topicCoverage`: loop over all `Topic` rows. For each, count how many `WeeklyPlanItem`s in any plan in this cycle link (through `libraryItem.topicId`) to this topic. Same count but filtered to positive outcomes = `itemsDone`. `coveragePct = total === 0 ? 0 : round(100 * done / total)`.
- `availability`: read `MemberAvailability` with the DEFAULT_AVAILABILITY fallback (same constant shape as `publication.service.ts`).

Throws `NotFoundException` if member is not found or if member has no active-cycle membership.

- [ ] **Step 1: Write the spec**

Create `apps/api/src/admin/plan-context/plan-context.service.spec.ts` with at least 5 tests:

1. Throws NotFoundException when member not found.
2. Returns empty `lastWeek` when no plan exists for previous week.
3. Builds `carryOverCandidates` from previous week's STUCK/DOUBTS/PENDING items only (filters out DONE_EASY/DONE_HARD).
4. `retro` populated when prior-week retro exists.
5. `topicCoverage` computed correctly: 2 items of a topic planned this cycle, 1 done → 50%.
6. `availability.weeklyBudgetMinutes` = sum of 7 day fields; defaults when `MemberAvailability` missing.

Use the mock-heavy pattern from `triage.service.spec.ts`.

- [ ] **Step 2: Implement**

Create `apps/api/src/admin/plan-context/plan-context.service.ts` (one file, no more than ~350 lines, private helper methods per concern).

Interface:

```ts
async getContext(input: { memberId: string; weekStart: Date }): Promise<PlanContextResponse>
```

Fetch all data in parallel: member, active-cycle membership (with track), cycle info, last week's plan + items, this-cycle plans + items (for coverage), previous-week retro, member availability, all topics.

**Topic coverage counting logic (in pseudocode):**
```
for each topic:
  for each plan in cycle.plans:
    for each item in plan.items:
      if item.libraryItem.topicId === topic.id:
        itemsPlanned++
        if item.outcome in {DONE_EASY, DONE_HARD}: itemsDone++
```

Run tests; iterate until all pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/admin/plan-context
git commit -m "feat(api): PlanContextService — panel 1 data for plan editor"
```

---

### Task 4: PlanContextController + module + wire

**Files:**
- Create: `apps/api/src/admin/plan-context/plan-context.controller.ts`
- Create: `apps/api/src/admin/plan-context/plan-context.module.ts`
- Modify: `apps/api/src/admin/admin.module.ts`

- [ ] **Step 1: Controller**

Create `plan-context.controller.ts`:

```typescript
import { Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { PlanContextService } from './plan-context.service.js';

@Roles('ADMIN')
@Controller('admin/member')
export class PlanContextController {
  constructor(private readonly context: PlanContextService) {}

  @Get(':id/plan-context')
  getContext(@Param('id') id: string, @Query('weekStart') weekStart: string) {
    return this.context.getContext({ memberId: id, weekStart: new Date(weekStart) });
  }
}
```

- [ ] **Step 2: Module**

```typescript
import { Module } from '@nestjs/common';
import { PlanContextService } from './plan-context.service.js';
import { PlanContextController } from './plan-context.controller.js';

@Module({
  providers: [PlanContextService],
  controllers: [PlanContextController],
})
export class PlanContextModule {}
```

- [ ] **Step 3: Wire into AdminModule**

Add `PlanContextModule` to `AdminModule.imports`.

- [ ] **Step 4: Run + commit**

```bash
pnpm --filter @ics-select/api test
pnpm --filter @ics-select/api typecheck
git add apps/api/src/admin/plan-context apps/api/src/admin/admin.module.ts
git commit -m "feat(api): GET /admin/member/:id/plan-context?weekStart=... "
```

---

### Task 5: PlanDraftsService + tests (get-or-create draft per week)

**Files:**
- Create: `apps/api/src/admin/plan-drafts/plan-drafts.service.ts`
- Create: `apps/api/src/admin/plan-drafts/plan-drafts.service.spec.ts`

**Goal:** Admin navigates to `/admin/member/[id]/plan/[planId]`. If `planId === 'new'` (or the frontend explicitly calls "make me a draft for week X"), the backend returns-or-creates a DRAFT plan for the given `weekStart`. Idempotent — if a DRAFT already exists for that (userId, weekStart), return it. If a PUBLISHED plan exists, throw `CONFLICT` (admin must explicitly create a fresh plan — out of scope here, just surface the conflict).

Interface:

```ts
async getOrCreateDraft(input: {
  memberId: string;
  weekStart: Date;
}): Promise<WeeklyPlan>
```

**Rules:**
- Find the active cycle the member belongs to. Throw `NotFoundException` if none.
- Compute `weekEnd = weekStart + 7 days - 1ms`.
- Validate `weekStart` falls within the cycle's range (`cycle.startsAt..cycle.endsAt`). Throw `CONFLICT` with code `PLAN_OUTSIDE_CYCLE` if not.
- Find existing `WeeklyPlan` with `{ userId, weekStart }`. 
  - If exists with status DRAFT → return.
  - If exists with status PUBLISHED → throw `CONFLICT` with code `PLAN_ALREADY_PUBLISHED`.
- Else create DRAFT plan with `items: []`. Return with `items` and `libraryItem` included.

- [ ] **Step 1: Write the spec**

Cover:
1. Returns existing DRAFT when one exists for (userId, weekStart).
2. Creates a new empty DRAFT when none exists.
3. Throws NotFoundException when member has no active-cycle membership.
4. Throws ConflictException `PLAN_OUTSIDE_CYCLE` when weekStart is outside cycle bounds.
5. Throws ConflictException `PLAN_ALREADY_PUBLISHED` when a PUBLISHED plan already exists for that week.

- [ ] **Step 2: Implement**

```ts
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';

@Injectable()
export class PlanDraftsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateDraft(input: { memberId: string; weekStart: Date }) {
    const membership = await this.prisma.cycleMembership.findFirst({
      where: { userId: input.memberId, cycle: { status: 'ACTIVE' } },
      include: { cycle: true },
    });
    if (!membership) throw new NotFoundException('member has no active cycle');
    const cycle = (membership as any).cycle;
    const weekEnd = new Date(input.weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    if (input.weekStart < cycle.startsAt || weekEnd > cycle.endsAt) {
      throw new ConflictException({
        error: {
          code: 'PLAN_OUTSIDE_CYCLE',
          message: 'Semana fora do intervalo do ciclo',
        },
      });
    }
    const existing = await this.prisma.weeklyPlan.findFirst({
      where: { userId: input.memberId, weekStart: input.weekStart },
      include: { items: { include: { libraryItem: true }, orderBy: { order: 'asc' } } },
    });
    if (existing) {
      if (existing.status === 'PUBLISHED') {
        throw new ConflictException({
          error: { code: 'PLAN_ALREADY_PUBLISHED', message: 'Essa semana já tem plano publicado' },
        });
      }
      return existing;
    }
    return this.prisma.weeklyPlan.create({
      data: {
        userId: input.memberId,
        cycleId: cycle.id,
        weekStart: input.weekStart,
        weekEnd,
        status: 'DRAFT',
      },
      include: { items: { include: { libraryItem: true }, orderBy: { order: 'asc' } } },
    });
  }
}
```

Run spec, iterate, all pass.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/admin/plan-drafts/plan-drafts.service.ts apps/api/src/admin/plan-drafts/plan-drafts.service.spec.ts
git commit -m "feat(api): PlanDraftsService — get-or-create DRAFT for (member, week)"
```

---

### Task 6: PlanDrafts controller + module + wire

**Files:**
- Create: `apps/api/src/admin/plan-drafts/plan-drafts.controller.ts`
- Create: `apps/api/src/admin/plan-drafts/plan-drafts.module.ts`
- Modify: `apps/api/src/admin/admin.module.ts`

- [ ] **Step 1: DTO**

Inline Zod in controller:

```ts
import { z } from 'zod';
const GetOrCreateSchema = z.object({ weekStart: z.coerce.date() });
```

- [ ] **Step 2: Controller**

```typescript
import { Body, Controller, Param, Post } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { PlanDraftsService } from './plan-drafts.service.js';
import { z } from 'zod';

const GetOrCreateSchema = z.object({ weekStart: z.coerce.date() });

@Roles('ADMIN')
@Controller('admin/member')
export class PlanDraftsController {
  constructor(private readonly drafts: PlanDraftsService) {}

  @Post(':id/plan-drafts')
  getOrCreate(@Param('id') id: string, @Body() body: unknown) {
    const { weekStart } = GetOrCreateSchema.parse(body);
    return this.drafts.getOrCreateDraft({ memberId: id, weekStart });
  }
}
```

- [ ] **Step 3: Module**

```typescript
import { Module } from '@nestjs/common';
import { PlanDraftsService } from './plan-drafts.service.js';
import { PlanDraftsController } from './plan-drafts.controller.js';

@Module({
  providers: [PlanDraftsService],
  controllers: [PlanDraftsController],
})
export class PlanDraftsModule {}
```

- [ ] **Step 4: Wire into AdminModule**

Add `PlanDraftsModule` to `AdminModule.imports`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/admin/plan-drafts/plan-drafts.controller.ts apps/api/src/admin/plan-drafts/plan-drafts.module.ts apps/api/src/admin/admin.module.ts
git commit -m "feat(api): POST /admin/member/:id/plan-drafts (get-or-create DRAFT)"
```

---

### Task 7: Enhance DraftPlanService — new signature + enhanced prompt

**Files:**
- Modify: `apps/api/src/ai/draft-plan.service.ts`
- Modify: `apps/api/src/ai/draft-plan.service.spec.ts`
- Modify: `apps/api/src/ai/ai.controller.ts`

**Goal:** Widen the input shape and rewrite the prompt to use track, last 4 weeks of outcomes, retro text, topic coverage, and carry-over selections. Still no tool calling — candidates are pre-fetched and inlined.

**New signature:**

```ts
async run(input: {
  memberId: string;
  weekStart: Date;
  weekEnd: Date;
  carryOverItemIds?: string[];  // WeeklyPlanItem ids from previous week
  briefText?: string;            // admin's "regenerate with brief"
}): Promise<{ draft: Draft; usage: {...} }>

type Draft = {
  items: Array<{ libraryItemId: string; order: number; rationale: string }>;
  alternates: Array<{ libraryItemId: string; rationale: string }>;  // 3 alt picks
  narrative: string;
  totalMinutes: number;
};
```

- [ ] **Step 1: Update `ai.controller.ts` schema**

```ts
const DraftInputSchema = z.object({
  memberId: z.string().min(1),
  weekStart: z.coerce.date(),
  weekEnd: z.coerce.date(),
  carryOverItemIds: z.array(z.string()).optional(),
  briefText: z.string().optional(),
});

const BriefInputSchema = z.object({
  memberId: z.string().min(1),
  weekStart: z.coerce.date(),
  weekEnd: z.coerce.date(),
  briefText: z.string().min(1),
  carryOverItemIds: z.array(z.string()).optional(),
});
```

- [ ] **Step 2: Rewrite `draft-plan.service.ts`**

Fetch:
- Member (with active-cycle membership including track)
- Last 4 weeks of PUBLISHED plans with items, outcomes, reflections, `libraryItem.title`
- Current retro (weekStart - 7 days)
- Topic coverage (reuse logic from PlanContextService — for now inline a simpler version: count items per topic across all plans in this cycle)
- Carry-over items if `carryOverItemIds` non-empty (resolve to full library item data)
- Candidate pool: `library.search({ tracks: [memberTrack], limit: 30 })` if track set, else `library.list()` limited to 30

**Prompt** (pt-BR system + pt-BR user context):

```
System:
Você é o copiloto do Diretor Educacional do ICS Select. Sua tarefa é montar um plano semanal
de 4 a 7 itens para um membro, baseado em:
- o track do membro (big tech / consulting / competitive / startup / outro)
- as últimas 4 semanas de resultados (outcomes + reflexões)
- o retrô mais recente (se houver)
- a cobertura de tópicos do ciclo (onde o membro está atrasado)
- carry-overs que o admin já marcou pra trazer de volta
- brief opcional do admin com direção extra

Responda APENAS com JSON válido:
{
  "items": [{"libraryItemId": "<id>", "order": <int>, "rationale": "1-2 frases em pt-BR"}],
  "alternates": [{"libraryItemId": "<id>", "rationale": "..."}],
  "narrative": "1 parágrafo curto em pt-BR resumindo o foco da semana",
  "totalMinutes": <sum of estimatedMinutes>
}

Regras:
- Não invente IDs. Use apenas IDs da lista de candidatos.
- Carry-overs DEVEM aparecer em "items" (não em "alternates") se o admin os marcou.
- Ordem pedagógica: fundamentos antes de avançado. Difícil depois de médio.
- "alternates" tem 3 items: opções extras que o admin pode querer.
- "rationale" de cada item deve ligar o item ao contexto (ex: "DP é gap do ciclo, e a reflexão
  do Item X mostrou que recursão ainda engasga — este problema força o pattern").
```

User prompt: concatenate sections:
- `MEMBRO: <name> — track: <track>`
- `ÚLTIMAS 4 SEMANAS (outcomes + reflexões):` listing each item as `[OUTCOME] <title> — <reflection>`
- `RETRÔ (semana anterior):` whatClicked / whatStuck / nextWeekWish
- `COBERTURA DE TÓPICOS:` list: `<topicName>: X itens planejados, Y concluídos (Z%)`
- `CARRY-OVER SELECIONADO PELO ADMIN:` list items chosen (or "nenhum")
- `BRIEF DO ADMIN:` briefText or "nenhum"
- `CANDIDATOS DO ACERVO:` list: `id=<id> "<title>" topic=<topic> format=<format> difficulty=<difficulty> minutes=<minutes>`

Call `chat.callJson<Draft>({ system, messages: [{ role: 'user', content: user }], maxTokens: 2000 })`.

Log usage via `UsageLoggerService` with `purpose: 'draft_plan'` (existing).

Return `{ draft: result.data, usage: result.usage }`.

- [ ] **Step 3: Update `draft-plan.service.spec.ts`**

Ensure tests cover:
1. Calls `chat.callJson` with a system + user message pair (basic smoke).
2. Includes `carryOverItemIds` in the user prompt when provided.
3. Includes `briefText` when provided.
4. Does NOT include retro section when retro is null.
5. Returns `{ draft, usage }`.

Mock the `chat.callJson` to resolve to a fake `Draft`. Do NOT attempt to reach OpenAI.

Existing spec file has some coverage — update it to match the new signature and rewrite tests as needed.

- [ ] **Step 4: Run tests**

```bash
pnpm --filter @ics-select/api test
pnpm --filter @ics-select/api typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ai/draft-plan.service.ts apps/api/src/ai/draft-plan.service.spec.ts apps/api/src/ai/ai.controller.ts
git commit -m "feat(ai): enhanced DraftPlanService prompt (retro + topic coverage + track + carry-over)"
```

---

### Task 8: Align BriefPlanService with new DraftPlanService

**Files:**
- Modify: `apps/api/src/ai/brief-plan.service.ts`
- Modify: `apps/api/src/ai/brief-plan.service.spec.ts`

**Goal:** `BriefPlanService` is the "Regenerate with brief" flow. Simplest option: it's a thin wrapper that calls `DraftPlanService.run` with `briefText` set. Spec originally distinguished them but behaviorally they're identical once `DraftPlanService` accepts `briefText`. Collapse them.

- [ ] **Step 1: Reduce `BriefPlanService` to a delegator**

```ts
import { Injectable } from '@nestjs/common';
import { DraftPlanService } from './draft-plan.service.js';

@Injectable()
export class BriefPlanService {
  constructor(private readonly draft: DraftPlanService) {}

  run(input: {
    memberId: string;
    weekStart: Date;
    weekEnd: Date;
    briefText: string;
    carryOverItemIds?: string[];
  }) {
    return this.draft.run(input);
  }
}
```

- [ ] **Step 2: Update spec**

One test: `BriefPlanService.run` forwards to `DraftPlanService.run` with the same args. Mock `DraftPlanService`.

- [ ] **Step 3: Typecheck + commit**

```bash
pnpm --filter @ics-select/api typecheck
git add apps/api/src/ai/brief-plan.service.ts apps/api/src/ai/brief-plan.service.spec.ts
git commit -m "refactor(ai): BriefPlanService delegates to DraftPlanService.run with briefText"
```

---

### Task 9: Admin plan-editor data hooks (frontend)

**Files:**
- Create: `apps/web/lib/queries/admin-plan-context.ts`
- Create: `apps/web/lib/queries/admin-plan-editor.ts`
- Create: `apps/web/lib/queries/library-search.ts`
- Create: `apps/web/lib/queries/admin-topics.ts`

**`admin-plan-context.ts`:**

```typescript
'use client';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type PlanContextResponse = {
  member: { id: string; name: string; pictureUrl: string | null; track: string | null };
  cycle: { id: string; name: string; weekNumber: number; weeksTotal: number };
  lastWeek: {
    weekStart: string | null;
    outcomes: {
      done_easy: number; done_hard: number; doubts: number; stuck: number; pending: number;
    };
    items: Array<{
      id: string;
      libraryItemId: string;
      title: string;
      outcome: 'PENDING' | 'DONE_EASY' | 'DONE_HARD' | 'DOUBTS' | 'STUCK';
      reflection: string | null;
    }>;
  };
  carryOverCandidates: Array<{
    id: string;
    libraryItemId: string;
    title: string;
    outcome: 'PENDING' | 'DOUBTS' | 'STUCK';
    reflection: string | null;
    topicId: string | null;
    topicName: string | null;
    estimatedMinutes: number;
  }>;
  retro: {
    whatClicked: string | null;
    whatStuck: string | null;
    nextWeekWish: string | null;
    submittedAt: string;
  } | null;
  topicCoverage: Array<{
    topicId: string;
    topicName: string;
    order: number;
    itemsPlanned: number;
    itemsDone: number;
    coveragePct: number;
  }>;
  availability: {
    mondayMinutes: number; tuesdayMinutes: number; wednesdayMinutes: number;
    thursdayMinutes: number; fridayMinutes: number; saturdayMinutes: number; sundayMinutes: number;
    preferredSessionMinutes: number;
    weeklyBudgetMinutes: number;
    timezone: string;
  };
};

export function useAdminPlanContext(memberId: string, weekStart: string | null) {
  return useQuery({
    queryKey: ['admin', 'plan-context', memberId, weekStart],
    queryFn: () =>
      apiFetch<PlanContextResponse>(
        `/admin/member/${memberId}/plan-context?weekStart=${encodeURIComponent(weekStart!)}`,
      ),
    enabled: Boolean(weekStart),
  });
}
```

**`admin-plan-editor.ts`:**

Hooks for: `useGetOrCreateDraft`, `useUpdatePlan`, `useDraftAiPlan`, `useBriefAiPlan`, `usePublishPlan`, `useAutoSchedulePlan`.

```typescript
'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type WeeklyPlan = {
  id: string;
  userId: string;
  cycleId: string;
  weekStart: string;
  weekEnd: string;
  status: 'DRAFT' | 'PUBLISHED';
  adminNotes: string | null;
  items: Array<{
    id: string;
    libraryItemId: string;
    order: number;
    outcome: string;
    libraryItem: { id: string; title: string; estimatedMinutes: number; format: string; url?: string; topicId: string | null; tags?: string[] };
  }>;
};

export type AiDraft = {
  items: Array<{ libraryItemId: string; order: number; rationale: string }>;
  alternates: Array<{ libraryItemId: string; rationale: string }>;
  narrative: string;
  totalMinutes: number;
};

export function useGetOrCreateDraft() {
  return useMutation({
    mutationFn: (input: { memberId: string; weekStart: string }) =>
      apiFetch<WeeklyPlan>(`/admin/member/${input.memberId}/plan-drafts`, {
        method: 'POST',
        body: JSON.stringify({ weekStart: input.weekStart }),
      }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      planId: string;
      adminNotes?: string;
      items?: Array<{ libraryItemId: string; order: number }>;
    }) =>
      apiFetch<WeeklyPlan>(`/plans/${input.planId}`, {
        method: 'PATCH',
        body: JSON.stringify({ adminNotes: input.adminNotes, items: input.items }),
      }),
    onSuccess: (plan) => {
      qc.invalidateQueries({ queryKey: ['plan', plan.id] });
    },
  });
}

export function usePlan(planId: string | null | undefined) {
  // inline: same pattern as useAdminCycleOverview
  // (move to useQuery if the rest of the page calls via GET /plans/:id)
}

export function useDraftAiPlan() {
  return useMutation({
    mutationFn: (input: {
      memberId: string;
      weekStart: string;
      weekEnd: string;
      carryOverItemIds?: string[];
      briefText?: string;
    }) =>
      apiFetch<{ draft: AiDraft; usage: unknown }>(`/ai/draft-plan`, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
  });
}

export function usePublishPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { planId: string }) =>
      apiFetch<WeeklyPlan>(`/plans/${input.planId}/publish`, { method: 'POST' }),
    onSuccess: (plan) => qc.invalidateQueries({ queryKey: ['plan', plan.id] }),
  });
}

export function useAutoSchedulePlan() {
  return useMutation({
    mutationFn: (input: { planId: string; force?: boolean }) =>
      apiFetch<{ sessionsCreated: number; overflow: Array<{ itemId: string; minutesRequired: number }> }>(
        `/plans/${input.planId}/auto-schedule${input.force ? '?force=true' : ''}`,
        { method: 'POST' },
      ),
  });
}
```

**Important:** `apiFetch` surfaces a 409 `PLAN_OVERFLOW` as a thrown `Error` with `.cause` or similar — check the existing client. Mutation `onError` should expose the overflow payload. If `apiFetch` doesn't do this naturally, use `useMutation`'s `onError` + re-throw with the parsed JSON body.

Inspect `apps/web/lib/api/client.ts` to see how errors are thrown. Align.

**`library-search.ts`:**

```typescript
'use client';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type LibraryItem = {
  id: string;
  title: string;
  url?: string;
  format: string;
  difficulty: string;
  estimatedMinutes: number;
  tags?: string[];
  topicId: string | null;
};

export function useLibrarySearch(query: string, filters?: { tracks?: string[]; topicId?: string }) {
  return useQuery({
    queryKey: ['library-search', query, filters],
    queryFn: () =>
      apiFetch<{ data: LibraryItem[] }>(`/library/search`, {
        method: 'POST',
        body: JSON.stringify({ query, ...filters, limit: 20 }),
      }),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });
}
```

**`admin-topics.ts`:**

```typescript
'use client';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type Topic = { id: string; name: string; order: number };

export function useTopics() {
  return useQuery({
    queryKey: ['topics'],
    queryFn: () => apiFetch<Topic[]>('/topics'),
  });
}
```

- [ ] **Step 1: Create the 4 files above**

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @ics-select/web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/queries/admin-plan-context.ts apps/web/lib/queries/admin-plan-editor.ts apps/web/lib/queries/library-search.ts apps/web/lib/queries/admin-topics.ts
git commit -m "feat(web): admin plan-editor data hooks (context, plan, draft/brief, publish, library search, topics)"
```

---

### Task 10: ContextPanel component (left panel)

**Files:**
- Create: `apps/web/components/admin/plan-editor/topic-coverage-mini.tsx`
- Create: `apps/web/components/admin/plan-editor/carry-over-list.tsx`
- Create: `apps/web/components/admin/plan-editor/context-panel.tsx`

**Design rules (from spec §5.4 + `docs/design-system.md`):**

- Whole panel uses `font-serif-tool` for headings, `font-sans` for body, `font-mono` for labels/numbers.
- Section headers: `SectionLabel` component (already exists).
- Outcomes grid: 2×3 layout. Each cell shows a colored `OutcomeDot` + label (`NAILED IT` / `GOT IT · HARD` / `HAD DOUBTS` / `STUCK` / `PENDING`) + big mono number.
- Carry-over list: checkboxes with item title + outcome dot + topic pill. Default state: all checked. `CarryOverList` exposes `onChange(selectedIds: string[])` up to the parent.
- Retro: 3 blockquotes stacked. Serif italic, soft bg (`paper-warm/40`), `border-l-2 border-accent pl-4 py-2`. Each has a label above in mono.
- Topic coverage: 6-column grid — one row per topic. Left: topic name (mono 11px). Right: small horizontal bar with coveragePct, next to the `<X/Y>` tabular nums. Inspired by cohort-heatmap but per-topic.
- Diagnose: `<details><summary>AI DIAGNOSE ▸</summary>` expanding to show markdown. Defer rendering until expanded.

**`topic-coverage-mini.tsx`:**

```tsx
import { clsx } from 'clsx';
import type { PlanContextResponse } from '../../../lib/queries/admin-plan-context';

type Topic = PlanContextResponse['topicCoverage'][number];

function shade(pct: number): string {
  if (pct === 0) return 'bg-rule';
  if (pct <= 25) return 'bg-ink/20';
  if (pct <= 50) return 'bg-ink/40';
  if (pct <= 80) return 'bg-ink/70';
  return 'bg-ink';
}

export function TopicCoverageMini({ topics }: { topics: Topic[] }) {
  if (topics.length === 0) return <p className="font-mono text-xs text-ink-mute">No topics defined.</p>;
  return (
    <ul className="space-y-1.5">
      {topics.map((t) => (
        <li key={t.topicId} className="flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-label text-ink-soft w-24 truncate">
            {t.topicName}
          </span>
          <div className="relative flex-1 h-2 bg-paper-warm rounded-sm overflow-hidden">
            <div
              className={clsx('absolute left-0 top-0 h-full transition-all', shade(t.coveragePct))}
              style={{ width: `${t.coveragePct}%` }}
            />
          </div>
          <span className="font-mono text-[11px] tabular-nums text-ink-mute">
            {t.itemsDone}/{t.itemsPlanned}
          </span>
        </li>
      ))}
    </ul>
  );
}
```

**`carry-over-list.tsx`:**

```tsx
'use client';
import { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import type { PlanContextResponse } from '../../../lib/queries/admin-plan-context';

type Candidate = PlanContextResponse['carryOverCandidates'][number];
const DOT_BY_OUTCOME = {
  PENDING: 'bg-outcome-pending',
  DOUBTS: 'bg-outcome-doubts',
  STUCK: 'bg-outcome-stuck',
} as const;

export function CarryOverList({
  candidates,
  value,
  onChange,
}: {
  candidates: Candidate[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    const next = value.includes(id) ? value.filter((x) => x !== id) : [...value, id];
    onChange(next);
  };
  if (candidates.length === 0) {
    return <p className="font-mono text-xs text-ink-mute">No unfinished items to carry over.</p>;
  }
  return (
    <ul className="space-y-2">
      {candidates.map((c) => {
        const checked = value.includes(c.id);
        return (
          <li key={c.id}>
            <label className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                className="mt-1 accent-ink"
                checked={checked}
                onChange={() => toggle(c.id)}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={clsx('inline-block h-2 w-2 rounded-full', DOT_BY_OUTCOME[c.outcome])} />
                  <span className="font-serif-tool text-sm font-semibold text-ink group-hover:text-ink">
                    {c.title}
                  </span>
                </div>
                {c.reflection && (
                  <p className="mt-1 font-sans text-xs text-ink-soft italic line-clamp-2">
                    "{c.reflection}"
                  </p>
                )}
                <div className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-label text-ink-mute">
                  {c.topicName && <span>{c.topicName}</span>}
                  <span>{c.estimatedMinutes}m</span>
                </div>
              </div>
            </label>
          </li>
        );
      })}
    </ul>
  );
}
```

**`context-panel.tsx`:**

Render in this order, each as a section with `SectionLabel` header, separated by `pt-8 border-t border-rule`:

1. Member title (track pill + cycle position)
2. `LAST WEEK · N OUTCOMES` grid (2×3 outcome counts)
3. `CARRY-OVER CANDIDATES` → `<CarryOverList>` (props come from parent)
4. `RETRO · SUBMITTED <date>` → 3 blockquotes or "No retro submitted" message
5. `TOPIC COVERAGE · THIS CYCLE` → `<TopicCoverageMini>`
6. `AI DIAGNOSE` → `<details>` (defer implementation — just show a "Loading…" or button "Generate diagnose ▸" stub, backend stays unchanged here; actual diagnose call happens on demand in PR 4)

Full component interface:

```tsx
interface ContextPanelProps {
  data: PlanContextResponse;
  carryOverIds: string[];
  onCarryOverChange: (ids: string[]) => void;
}
```

- [ ] **Step 1-3:** Implement the 3 files.

- [ ] **Step 4: Typecheck**

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/admin/plan-editor/topic-coverage-mini.tsx apps/web/components/admin/plan-editor/carry-over-list.tsx apps/web/components/admin/plan-editor/context-panel.tsx
git commit -m "feat(web): plan-editor ContextPanel (outcomes + carry-over + retro + topic coverage)"
```

---

### Task 11: AI Draft Panel (center)

**Files:**
- Create: `apps/web/components/admin/plan-editor/regenerate-brief-modal.tsx`
- Create: `apps/web/components/admin/plan-editor/ai-draft-panel.tsx`

**Design:**

- Top: eyebrow `AI DRAFT · GPT-5.4-MINI`, H2 in `font-serif-tool` showing narrative (italic).
- `Regenerate with brief ⟳` button (pill, `bg-paper-warm`, `text-ink-soft`). Click opens modal.
- Suggested items list:
  - White card `bg-surface border border-rule`, if `carried over` overlay `bg-paper-warm border-accent/40`.
  - Order number in serif-tool top-left.
  - `carried over` pill (terracotta bg) when applicable.
  - Title in `font-serif-tool text-base font-semibold`.
  - Meta pills (`platform`, `topic`, `Xm`).
  - Rationale block: `border-l-2 border-accent pl-3 py-1`, italic serif text.
  - `Add to plan →` button, right-aligned, `text-focus hover:underline`.
- `OR CONSIDER` section at bottom: 3 collapsed alternates with expand-on-click (use `<details>`).

**`regenerate-brief-modal.tsx`:**

Simple modal. Textarea (200 char max), placeholder `Ex: foca mais em hard, tá faltando velocidade, inclui mais DP`. Cancel / Regenerate buttons.

```tsx
'use client';
import { useState } from 'react';

export function RegenerateBriefModal({
  open,
  onClose,
  onSubmit,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (brief: string) => void;
  loading: boolean;
}) {
  const [brief, setBrief] = useState('');
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div className="w-full max-w-lg rounded-card bg-surface border border-rule p-6 shadow-modal">
        <h3 className="font-serif-tool text-xl font-semibold text-ink">Regenerate with brief</h3>
        <p className="mt-1 font-sans text-sm text-ink-soft">
          Dá uma direção extra pro plano — foco, dificuldade, o que evitar.
        </p>
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value.slice(0, 200))}
          rows={4}
          placeholder="Ex: foca mais em hard, tá faltando velocidade."
          className="mt-4 w-full rounded-input border border-rule bg-paper p-3 font-sans text-sm resize-none focus:outline-none focus:ring-2 focus:ring-focus/40"
        />
        <p className="mt-1 font-mono text-[10px] text-ink-mute text-right">{brief.length} / 200</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-label px-4 py-2 text-ink-soft hover:bg-paper-warm rounded-pill"
          >
            Cancel
          </button>
          <button
            disabled={brief.trim().length === 0 || loading}
            onClick={() => onSubmit(brief.trim())}
            className="font-mono text-xs uppercase tracking-label px-4 py-2 bg-ink text-paper rounded-pill disabled:opacity-40"
          >
            {loading ? 'Regenerating…' : 'Regenerate'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**`ai-draft-panel.tsx`:**

Full interface:

```tsx
interface AiDraftPanelProps {
  draft: AiDraft | null;          // null = not generated yet
  libraryById: Map<string, LibraryItem>;  // lookup of candidates returned from draft
  topicNameById: Map<string, string>;
  carryOverIds: string[];
  loading: boolean;
  onGenerate: (briefText?: string) => void;  // regenerate with optional brief
  onAddItem: (libraryItemId: string) => void;
}
```

Behavior:
- If `draft === null` and not loading: show a big centered button `⚡ Generate AI draft` that calls `onGenerate()`.
- If loading: `font-mono text-xs uppercase tracking-label text-ink-mute` "Generating… (may take 10-20s)".
- If draft present: render as described above.
- `Add to plan →` click triggers `onAddItem(libraryItemId)` — parent manages "already added → hide from panel".

Parent component (the page) owns the current plan items list and filters out already-added item IDs before passing into this panel (or AiDraftPanel hides items whose `libraryItemId` is in a prop `addedIds: Set<string>`). Go with `addedIds: Set<string>` passed as prop for simplicity.

- [ ] **Step 1-2**: Write both components.

- [ ] **Step 3**: Typecheck + commit

```bash
git add apps/web/components/admin/plan-editor/regenerate-brief-modal.tsx apps/web/components/admin/plan-editor/ai-draft-panel.tsx
git commit -m "feat(web): plan-editor AiDraftPanel + RegenerateBriefModal"
```

---

### Task 12: Editable Plan Panel (right)

**Files:**
- Create: `apps/web/components/admin/plan-editor/budget-badge.tsx`
- Create: `apps/web/components/admin/plan-editor/item-card.tsx`
- Create: `apps/web/components/admin/plan-editor/add-item-typeahead.tsx`
- Create: `apps/web/components/admin/plan-editor/editable-plan-panel.tsx`

**Design:**

- Title: `Week X · {weekStart M/D} — {weekEnd M/D}` (serif-tool) + meta `N items · M min` mono.
- `BudgetBadge` inline: green (≤80%) / amber (81-100%) / red (>100%) based on planned minutes vs `availability.weeklyBudgetMinutes`.
- Items list:
  - `⋮⋮` drag handle icon (lucide `GripVertical`). **No actual drag-drop in this PR** — just show the handle visually. Reordering happens via `↑ ↓` buttons on hover. (Keep implementation simple; drag-drop in PR 4 if needed.)
  - Order number (serif-tool).
  - Title (serif-tool semibold).
  - Meta pills (platform, topic, `Xm`).
  - `×` remove button.
- `+ Add from library — type to search…` text input with typeahead suggestions beneath it.
- `ADMIN NOTES · PRIVATE` textarea at the bottom.
- Publication section at bottom: two checkboxes (`Create Calendar events` default true, `Send WhatsApp notification` default true — note WhatsApp is currently a no-op stub, but surface the control).
- Header buttons: `Save draft` ghost, `Publish & schedule` primary.

**`budget-badge.tsx`:**

```tsx
import { clsx } from 'clsx';

export function BudgetBadge({
  plannedMinutes,
  budgetMinutes,
}: {
  plannedMinutes: number;
  budgetMinutes: number;
}) {
  if (budgetMinutes === 0) {
    return (
      <span className="font-mono text-xs text-ink-mute">No availability declared yet.</span>
    );
  }
  const pct = Math.round((plannedMinutes / budgetMinutes) * 100);
  const tone =
    pct <= 80 ? 'text-outcome-done-easy' : pct <= 100 ? 'text-outcome-done-hard' : 'text-outcome-stuck';
  const label = pct <= 80 ? 'Fits availability' : pct <= 100 ? 'Near limit' : 'Over budget';
  return (
    <span className={clsx('font-mono text-xs tabular-nums', tone)}>
      {label} · {plannedMinutes} / {budgetMinutes} min ({pct}%)
    </span>
  );
}
```

**`item-card.tsx`:**

```tsx
'use client';
import { GripVertical, X } from 'lucide-react';
import { clsx } from 'clsx';
import type { WeeklyPlan } from '../../../lib/queries/admin-plan-editor';

type Item = WeeklyPlan['items'][number];

export function ItemCard({
  item,
  order,
  onMoveUp,
  onMoveDown,
  onRemove,
  isCarriedOver,
  topicName,
}: {
  item: Item;
  order: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  isCarriedOver: boolean;
  topicName: string | null;
}) {
  return (
    <div
      className={clsx(
        'group flex items-start gap-3 border rounded-card p-3 transition-colors',
        isCarriedOver
          ? 'bg-paper-warm border-accent/40'
          : 'bg-surface border-rule hover:bg-paper-warm/60',
      )}
    >
      <span className="font-serif-tool text-lg font-semibold text-ink-mute min-w-[1.5ch]">
        {order + 1}
      </span>
      <GripVertical className="h-4 w-4 text-ink-faint mt-1" strokeWidth={1.5} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <p className="font-serif-tool text-base font-semibold text-ink truncate">
            {item.libraryItem.title}
          </p>
          {isCarriedOver && (
            <span className="inline-block font-mono text-[9px] uppercase tracking-label text-accent px-1.5 py-0.5 border border-accent/40 rounded-pill">
              carried over
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center gap-2 font-mono text-[10px] uppercase tracking-label text-ink-mute">
          <span>{item.libraryItem.format}</span>
          {topicName && <><span>·</span><span>{topicName}</span></>}
          <span>·</span>
          <span>{item.libraryItem.estimatedMinutes}m</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onMoveUp} className="text-ink-mute hover:text-ink" aria-label="Move up">↑</button>
        <button onClick={onMoveDown} className="text-ink-mute hover:text-ink" aria-label="Move down">↓</button>
        <button onClick={onRemove} className="text-ink-mute hover:text-outcome-stuck" aria-label="Remove">
          <X className="h-3 w-3" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
```

**`add-item-typeahead.tsx`:**

Debounced input (300ms). Shows up to 8 suggestions in a dropdown. Click a suggestion calls `onAdd(libraryItemId)` and clears the input.

Use `useLibrarySearch` hook. Track focus + suggestion visibility.

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { useLibrarySearch } from '../../../lib/queries/library-search';

export function AddItemTypeahead({
  memberTrack,
  onAdd,
}: {
  memberTrack: string | null;
  onAdd: (libraryItemId: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [focus, setFocus] = useState(false);
  const { data } = useLibrarySearch(debounced, memberTrack ? { tracks: [memberTrack] } : undefined);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        placeholder="+ Add from library — type to search…"
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setTimeout(() => setFocus(false), 150)}
        className="w-full rounded-input border border-rule bg-paper px-3 py-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-focus/40"
      />
      {focus && data && data.data && data.data.length > 0 && debounced.length >= 2 && (
        <ul className="absolute left-0 right-0 top-full mt-1 max-h-80 overflow-auto rounded-card border border-rule bg-surface z-10">
          {data.data.slice(0, 8).map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  onAdd(item.id);
                  setQuery('');
                  setDebounced('');
                }}
                className="w-full text-left px-3 py-2 hover:bg-paper-warm border-b border-rule last:border-0"
              >
                <p className="font-serif-tool text-sm font-semibold text-ink truncate">{item.title}</p>
                <p className="font-mono text-[10px] uppercase tracking-label text-ink-mute">
                  {item.format} · {item.estimatedMinutes}m
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

**`editable-plan-panel.tsx`:**

```tsx
'use client';
import { useMemo, useState } from 'react';
import { BudgetBadge } from './budget-badge';
import { ItemCard } from './item-card';
import { AddItemTypeahead } from './add-item-typeahead';
import type { WeeklyPlan } from '../../../lib/queries/admin-plan-editor';
import type { PlanContextResponse } from '../../../lib/queries/admin-plan-context';
import type { LibraryItem } from '../../../lib/queries/library-search';

type Item = WeeklyPlan['items'][number];

interface EditablePlanPanelProps {
  plan: WeeklyPlan;
  context: PlanContextResponse;
  topicNameById: Map<string, string>;
  onItemsChange: (items: Item[]) => void;
  onAdminNotesChange: (notes: string) => void;
  onAddLibraryItem: (libraryItemId: string) => Promise<LibraryItem | null>;
  onSaveDraft: () => void;
  onPublish: () => void;
  saving: boolean;
  publishing: boolean;
}
```

Internal state: track `createCalendarEvents` (bool), `sendWhatsapp` (bool).

Derived: `plannedMinutes = sum(items.libraryItem.estimatedMinutes)`, `budgetMinutes = context.availability.weeklyBudgetMinutes`.

Render items with `ItemCard` via map. `onMoveUp`/`onMoveDown` reorder the array and call `onItemsChange`. `onRemove` filters out the item.

Admin notes textarea bound to `plan.adminNotes` (via `onAdminNotesChange`).

Footer: `Save draft` + `Publish & schedule` buttons.

- [ ] **Steps 1-4**: Write the four files.

- [ ] **Step 5**: Typecheck

- [ ] **Step 6**: Commit

```bash
git add apps/web/components/admin/plan-editor/budget-badge.tsx apps/web/components/admin/plan-editor/item-card.tsx apps/web/components/admin/plan-editor/add-item-typeahead.tsx apps/web/components/admin/plan-editor/editable-plan-panel.tsx
git commit -m "feat(web): plan-editor EditablePlanPanel (budget + items + typeahead)"
```

---

### Task 13: OverflowModal component

**Files:**
- Create: `apps/web/components/admin/plan-editor/overflow-modal.tsx`

**Design:**

Shown when `auto-schedule` returns `409 PLAN_OVERFLOW`. Two buttons: `Adjust` (closes, admin can edit) / `Force publish` (retries with `force=true`).

```tsx
'use client';

interface OverflowItem {
  itemId: string;
  minutesRequired: number;
}

export function OverflowModal({
  open,
  overflow,
  memberName,
  onClose,
  onForce,
  pending,
}: {
  open: boolean;
  overflow: OverflowItem[];
  memberName: string;
  onClose: () => void;
  onForce: () => void;
  pending: boolean;
}) {
  if (!open) return null;
  const total = overflow.reduce((s, o) => s + o.minutesRequired, 0);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4">
      <div className="w-full max-w-md rounded-card bg-surface border border-rule p-6 shadow-modal">
        <h3 className="font-serif-tool text-xl font-semibold text-outcome-stuck">
          Plan doesn't fit {memberName}'s availability.
        </h3>
        <p className="mt-3 font-sans text-sm text-ink-soft">
          Overflow: {overflow.length} item{overflow.length === 1 ? '' : 's'} ({total} min).
        </p>
        <p className="mt-2 font-sans text-sm text-ink-soft">
          Adjust the plan or force publish — Calendar events will be created but conflicts may remain.
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="font-mono text-xs uppercase tracking-label px-4 py-2 text-ink-soft hover:bg-paper-warm rounded-pill"
          >
            Adjust
          </button>
          <button
            disabled={pending}
            onClick={onForce}
            className="font-mono text-xs uppercase tracking-label px-4 py-2 bg-outcome-stuck text-paper rounded-pill disabled:opacity-40"
          >
            {pending ? 'Forcing…' : 'Force publish'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Steps 1-2**: Write + typecheck.

- [ ] **Step 3**: Commit

```bash
git add apps/web/components/admin/plan-editor/overflow-modal.tsx
git commit -m "feat(web): plan-editor OverflowModal (Adjust / Force publish)"
```

---

### Task 14: 3-panel page layout

**Files:**
- Create: `apps/web/app/(admin)/admin/member/[id]/plan/[planId]/page.tsx`

**Goal:** Tie everything together. The URL carries `memberId` and `planId`. When `planId === 'new'`, call `useGetOrCreateDraft` on mount to create a fresh draft for the current week. Otherwise, fetch plan by id.

**Layout:**

Desktop-only — show a "Please use a desktop screen (≥1280px)" message on mobile (visible via Tailwind breakpoint, no JS needed).

```tsx
<div className="hidden xl:block">
  {/* 3-column grid */}
</div>
<div className="xl:hidden p-12 text-center">
  <p className="font-serif-tool text-xl font-semibold">Plan editor is desktop-only</p>
  <p className="mt-2 font-sans text-sm text-ink-soft">Resize to at least 1280px width.</p>
</div>
```

Grid: `grid-cols-12 gap-6` with col-span-4 / col-span-4 / col-span-4 each panel in its own `overflow-y-auto max-h-[calc(100vh-6rem)]`.

**Data flow (parent):**

```tsx
const { data: context } = useAdminPlanContext(memberId, plan?.weekStart);
const { plan, setPlan, updatePlan, isUpdating } = usePlanController(planId, memberId);
const [carryOverIds, setCarryOverIds] = useState<string[]>([]);
const [aiDraft, setAiDraft] = useState<AiDraft | null>(null);
const draft = useDraftAiPlan();
const publish = usePublishPlan();
const autoSchedule = useAutoSchedulePlan();
const [overflowState, setOverflowState] = useState<OverflowState>({ open: false, overflow: [] });
```

Initialize `carryOverIds` to ALL candidate IDs when context first loads (default: all checked).

When admin clicks `Add to plan →` in panel 2, append that libraryItem to `plan.items` with `order = plan.items.length`. If the item was in carry-over, note it for the visual treatment.

When admin clicks `Save draft`: call `useUpdatePlan` with items.

When admin clicks `Publish & schedule`:
1. Call `useUpdatePlan` (save) first — catch errors.
2. Call `usePublishPlan` (flips to PUBLISHED).
3. Call `useAutoSchedulePlan` with `force: false`.
4. If response has `overflow.length > 0` → show `OverflowModal`.
5. If modal `Force publish`: call `useAutoSchedulePlan` with `force: true`, close modal on success.

**`usePlanController`** — small helper hook local to this page (not in `lib/queries` — it couples state with mutations):

Actually: don't extract. Just do it inline in the page; it's fine at this scope.

**Structure skeleton:**

```tsx
'use client';
import { use, useEffect, useMemo, useState } from 'react';
import { ContextPanel } from '../../../../../../components/admin/plan-editor/context-panel';
import { AiDraftPanel } from '../../../../../../components/admin/plan-editor/ai-draft-panel';
import { EditablePlanPanel } from '../../../../../../components/admin/plan-editor/editable-plan-panel';
import { OverflowModal } from '../../../../../../components/admin/plan-editor/overflow-modal';
import { useAdminPlanContext } from '../../../../../../lib/queries/admin-plan-context';
import { useGetOrCreateDraft, useUpdatePlan, useDraftAiPlan, usePublishPlan, useAutoSchedulePlan, type WeeklyPlan, type AiDraft } from '../../../../../../lib/queries/admin-plan-editor';
import { useTopics } from '../../../../../../lib/queries/admin-topics';

export default function PlanEditorPage({ params }: { params: Promise<{ id: string; planId: string }> }) {
  const { id: memberId, planId } = use(params);
  // ... hooks ...
  // ... return layout ...
}
```

Handle these states:
- `planId === 'new'` → call `useGetOrCreateDraft` once with `weekStart = nextMonday` to bootstrap, then render with the returned plan.
- Plan loading / missing → show error view.
- AI draft not yet generated → panel 2 shows the generate CTA.

**Resolving `nextMonday` when `planId === 'new'`:** pick next week's Monday (relative to today). Helper:

```ts
function nextMondayUTC(now = new Date()): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  const daysAhead = day === 1 ? 7 : (8 - day) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + daysAhead);
  return d;
}
```

Defaulting to *next* week's Monday means clicking `start draft →` from Thursday creates the draft for the upcoming week — matches admin intent.

- [ ] **Steps 1-4**: Build the page.

- [ ] **Step 5**: Typecheck + build

```bash
pnpm --filter @ics-select/web typecheck
pnpm --filter @ics-select/web build
```

Expected: build succeeds, `/admin/member/[id]/plan/[planId]` appears as a dynamic route.

- [ ] **Step 6**: Commit

```bash
git add 'apps/web/app/(admin)/admin/member'
git commit -m "feat(web): /admin/member/:id/plan/:planId 3-panel editor page"
```

---

### Task 15: Final regression gate

**Files:** verification only.

- [ ] **Step 1: Run gates**

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all clean. API tests ~150+ (141 from PR 3a + new tests from Tasks 1/3/5/7/8).

- [ ] **Step 2: Verify routes**

Confirm `apps/web/build` output includes:
- `/admin/member/[id]/plan/[planId]` (dynamic)
- `/topics` API (admin-only)
- `/admin/member/:id/plan-context` (admin-only)
- `/admin/member/:id/plan-drafts` (admin-only)

- [ ] **Step 3: Spot-check in dev**

Start `pnpm dev`. As ADMIN, navigate to `/admin` → cycle page → a member card → click takes you to `/admin/member/<id>/plan/new`. Expected: loading → draft created → 3 panels render. Generate AI draft → items appear in panel 2 → `Add to plan →` puts them in panel 3 → Publish & schedule → Calendar events created.

If Google OAuth tokens are stale locally, a Calendar error is acceptable; the plan still flips to PUBLISHED.

- [ ] **Step 4: Capture commit list**

```bash
git log --oneline main..HEAD
```

- [ ] **Step 5: Report.**

---

## Self-review

**Spec coverage:**
- §5.4 Panel 1 (Context) — Tasks 3, 10 ✅
- §5.4 Panel 2 (AI Draft) — Tasks 7, 8, 11 ✅ (tool calling deferred to PR 4)
- §5.4 Panel 3 (Editable) — Task 12 ✅
- §5.4 Budget badge — Task 12 ✅
- §5.4 Publish flow with overflow modal — Tasks 13, 14 ✅
- §5.4 ICS ID embedding — inherited from PR 3a ✅
- §6.2 Enhanced prompt with retro + topic coverage + track + carry-over — Task 7 ✅
- §7 Topic model exposure — Tasks 1, 2, 9 (hooks) ✅

**Placeholder scan:**
- Dismiss of `diagnose` in Panel 1 is deliberate: the spec wants diagnose in the expander; the actual diagnose call is an existing service but wiring it into this panel is cheap — Task 10 shows a stub button. The actual wiring to `GET /members/:id/diagnose` can happen later in PR 4 or as a tiny follow-up.
- Drag-and-drop for reorder is reduced to `↑ ↓` hover buttons (Task 12). Spec asks for `⋮⋮` handle — handle is shown visually but non-draggable.

**Type consistency:**
- `AiDraft` shape in `admin-plan-editor.ts` matches `DraftPlanService.run`'s return (`{ items: [{ libraryItemId, order, rationale }], alternates, narrative, totalMinutes }`).
- `PlanContextResponse.availability` matches `MemberAvailability` Prisma model + `weeklyBudgetMinutes` derived field.
- `WeeklyPlan.items[].libraryItem` includes `topicId` so `ItemCard` can resolve topic name via the `topicNameById` map (supplied by parent from `useTopics`).

**Ambiguities flagged during implementation:**
- Verify `apiFetch` error shape for `409 PLAN_OVERFLOW` — need `.overflow` accessible in `.onError`. If not, extend `apiFetch` in a small side commit. This is a pre-existing concern the PR 3b implementer needs to solve before Task 13.
- `BriefPlanService` collapse (Task 8) is a refactor — verify no other callers are broken. Search for `BriefPlanService` usages beyond `ai.controller.ts`.
- The admin member page `/admin/member/[id]` doesn't exist yet (PR 3c) — back-navigation from the editor will 404. Acceptable; the editor can link back to `/admin/cycle/[cycleId]` instead once we have the cycleId in context (already returned in `PlanContextResponse.cycle`).

**Out-of-scope correctly deferred:**
- Tool calling (`search_library` as real LLM tool) — PR 4.
- Full library / topics / cycles-list / ai-usage / member-detail — PR 3c.
- Retro reminder cron — PR 4.
- WhatsApp actual delivery — PR 4.
- Drag-drop reorder — not in scope.

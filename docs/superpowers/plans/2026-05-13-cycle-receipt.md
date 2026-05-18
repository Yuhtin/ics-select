# Cycle Receipt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin-only `/admin/cycle/[id]/receipt` view that renders a screenshot-friendly snapshot of cycle state with as-of date selection, two render modes (Thermal Receipt + Wrapped), a reusable `<CohortKnowledgeGrid>` component, and a PNG download.

**Architecture:** New NestJS module `cycle-receipt` exposes `GET /admin/cycle/:id/receipt?asOf=YYYY-MM-DD` returning a fully-aggregated payload. Frontend has a dedicated Next.js route under `(admin)` with a custom layout that excludes the admin shell. View ramifies thermal vs wrapped from server-decided `mode` field (overridable via `?mode=` query). Knowledge grid is built as a reusable component used in both modes plus future surfaces.

**Tech Stack:** NestJS 10, Prisma 5, jest, Next.js 15 App Router, TanStack Query, Tailwind 3, lucide-react, `html-to-image` (new dep, ~50KB).

**Spec:** [`docs/superpowers/specs/2026-05-13-cycle-receipt-design.md`](../specs/2026-05-13-cycle-receipt-design.md)

---

## Phase 1 · Backend

### Task 1: Module scaffolding + response types + streak helper

**Files:**
- Create: `apps/api/src/admin/cycle-receipt/cycle-receipt.types.ts`
- Create: `apps/api/src/admin/cycle-receipt/streak.ts`
- Create: `apps/api/src/admin/cycle-receipt/streak.spec.ts`
- Create: `apps/api/src/admin/cycle-receipt/cycle-receipt.module.ts`

- [ ] **Step 1: Write the types file**

```ts
// apps/api/src/admin/cycle-receipt/cycle-receipt.types.ts
export type ReceiptMode = 'thermal' | 'wrapped';

export type ReceiptMember = {
  userId: string;
  name: string;
  pictureUrl: string | null;
};

export type CycleReceiptResponse = {
  cycle: {
    id: string;
    name: string;
    weekNumber: number;
    weeksTotal: number;
    startsAt: string;
    endsAt: string;
    status: 'UPCOMING' | 'ACTIVE' | 'ARCHIVED';
  };
  asOf: string;
  mode: ReceiptMode;

  totals: {
    members: number;
    totalMinutes: number;
    avgMinutesPerMember: number;
    itemsCompleted: number;
    retros: number;
    classesHeld: number;
    classesTotal: number;
    attendanceRate: number;
  };

  byTopic: Array<{
    topicId: string;
    slug: string;
    label: string;
    order: number;
    membersReached: number;
    itemsCompleted: number;
    coveragePct: number;
  }>;

  knowledgeGrid: {
    members: ReceiptMember[];
    topics: Array<{ topicId: string; slug: string; label: string; order: number }>;
    cells: Array<{ userId: string; topicId: string; itemsDone: number; hasStuckOrDoubts: boolean }>;
  };

  topMovers: Array<ReceiptMember & {
    deltaItems: number;
    topTopics: string[];
  }>;

  cycleTopMover: (ReceiptMember & {
    deltaItems: number;
    topTopics: string[];
  }) | null;

  streakChampion: (ReceiptMember & { streakDays: number }) | null;
  retroChampions: Array<ReceiptMember & { retros: number }>;
  perfectAttendance: ReceiptMember[];
};
```

- [ ] **Step 2: Write streak helper test**

```ts
// apps/api/src/admin/cycle-receipt/streak.spec.ts
import { computeStreakDays } from './streak.js';

describe('computeStreakDays', () => {
  const asOf = new Date('2026-05-13T23:59:59Z'); // 20:59 BRT, May 13

  it('returns 0 when no completions', () => {
    expect(computeStreakDays([], asOf)).toBe(0);
  });

  it('counts consecutive BRT calendar days ending at asOf', () => {
    // BRT = UTC-3. May 12 20:00 BRT = May 12 23:00 UTC. May 13 18:00 BRT = May 13 21:00 UTC.
    const items = [
      { completedAt: new Date('2026-05-13T21:00:00Z') }, // May 13 BRT
      { completedAt: new Date('2026-05-12T23:00:00Z') }, // May 12 BRT
      { completedAt: new Date('2026-05-11T15:00:00Z') }, // May 11 BRT
    ];
    expect(computeStreakDays(items, asOf)).toBe(3);
  });

  it('breaks on a missing day', () => {
    const items = [
      { completedAt: new Date('2026-05-13T21:00:00Z') }, // May 13
      { completedAt: new Date('2026-05-11T15:00:00Z') }, // May 11 (gap on May 12)
    ];
    expect(computeStreakDays(items, asOf)).toBe(1);
  });

  it('handles BRT-day-edge boundary correctly', () => {
    // 23:00 UTC on May 11 = 20:00 BRT May 11 — still May 11 BRT, not May 12.
    const items = [
      { completedAt: new Date('2026-05-13T21:00:00Z') },
      { completedAt: new Date('2026-05-12T03:00:00Z') }, // 00:00 BRT May 12
      { completedAt: new Date('2026-05-11T23:00:00Z') }, // 20:00 BRT May 11
    ];
    expect(computeStreakDays(items, asOf)).toBe(3);
  });

  it('ignores completions after asOf', () => {
    const items = [
      { completedAt: new Date('2026-05-14T10:00:00Z') }, // after asOf
      { completedAt: new Date('2026-05-13T21:00:00Z') },
    ];
    expect(computeStreakDays(items, asOf)).toBe(1);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern streak.spec`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement streak helper**

```ts
// apps/api/src/admin/cycle-receipt/streak.ts
const BRT_OFFSET_MINUTES = -3 * 60;

function brtDateKey(d: Date): string {
  const shifted = new Date(d.getTime() + BRT_OFFSET_MINUTES * 60_000);
  return shifted.toISOString().slice(0, 10); // YYYY-MM-DD in BRT
}

export function computeStreakDays(
  items: Array<{ completedAt: Date | null }>,
  asOf: Date,
): number {
  const asOfKey = brtDateKey(asOf);
  const days = new Set<string>();
  for (const it of items) {
    if (!it.completedAt) continue;
    const key = brtDateKey(it.completedAt);
    if (key > asOfKey) continue;
    days.add(key);
  }
  if (days.size === 0) return 0;

  let streak = 0;
  let cursor = asOfKey;
  while (days.has(cursor)) {
    streak += 1;
    const [y, m, d] = cursor.split('-').map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d - 1));
    cursor = prev.toISOString().slice(0, 10);
  }
  return streak;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern streak.spec`
Expected: PASS (5/5).

- [ ] **Step 6: Write the empty module file**

```ts
// apps/api/src/admin/cycle-receipt/cycle-receipt.module.ts
import { Module } from '@nestjs/common';

@Module({
  providers: [],
  controllers: [],
})
export class CycleReceiptModule {}
```

(Service + controller filled in subsequent tasks.)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/admin/cycle-receipt/
git commit -m "feat(receipt): scaffold cycle-receipt module + streak helper"
```

---

### Task 2: Service — cycle metadata + membership resolution

**Files:**
- Create: `apps/api/src/admin/cycle-receipt/cycle-receipt.service.ts`
- Create: `apps/api/src/admin/cycle-receipt/cycle-receipt.service.spec.ts`

- [ ] **Step 1: Look at sibling pattern for Prisma mocking**

Read `apps/api/src/admin/cycle/cycle-overview.service.spec.ts` to understand the existing Prisma mock setup. Mimic the structure (mock `PrismaService` with `jest.fn()` per used method, build fixtures inline per test).

- [ ] **Step 2: Write the first service test for cycle metadata**

```ts
// apps/api/src/admin/cycle-receipt/cycle-receipt.service.spec.ts
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CycleReceiptService } from './cycle-receipt.service.js';

const mockPrisma = () => ({
  cycle: { findUnique: jest.fn() },
  weeklyPlanItem: { findMany: jest.fn().mockResolvedValue([]) },
  weeklyRetro: { groupBy: jest.fn().mockResolvedValue([]) },
  classSession: { findMany: jest.fn().mockResolvedValue([]) },
  classAttendance: { findMany: jest.fn().mockResolvedValue([]) },
});

describe('CycleReceiptService — cycle metadata', () => {
  it('throws NotFoundException when cycle does not exist', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(null);
    const svc = new CycleReceiptService(prisma as any);
    await expect(svc.build('nonexistent', new Date())).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException for UPCOMING cycle that has not started', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'Ciclo 5',
      status: 'UPCOMING',
      startsAt: new Date('2026-06-01T00:00:00Z'),
      endsAt: new Date('2026-08-01T00:00:00Z'),
      memberships: [],
    });
    const svc = new CycleReceiptService(prisma as any);
    await expect(svc.build('c1', new Date('2026-05-13'))).rejects.toThrow(ConflictException);
  });

  it('throws BadRequestException when asOf is out of range', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'Ciclo 4',
      status: 'ACTIVE',
      startsAt: new Date('2026-04-01T00:00:00Z'),
      endsAt: new Date('2026-06-01T00:00:00Z'),
      memberships: [],
    });
    const svc = new CycleReceiptService(prisma as any);
    await expect(svc.build('c1', new Date('2026-03-15'))).rejects.toThrow(BadRequestException);
    await expect(svc.build('c1', new Date('2026-06-15'))).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern cycle-receipt.service`
Expected: FAIL — service not implemented.

- [ ] **Step 4: Implement service skeleton with cycle metadata + validations**

```ts
// apps/api/src/admin/cycle-receipt/cycle-receipt.service.ts
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CycleReceiptResponse, ReceiptMode } from './cycle-receipt.types.js';

@Injectable()
export class CycleReceiptService {
  constructor(private readonly prisma: PrismaService) {}

  async build(cycleId: string, asOf: Date): Promise<CycleReceiptResponse> {
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { user: { select: { id: true, name: true, pictureUrl: true } } },
        },
      },
    });
    if (!cycle) throw new NotFoundException('Cycle not found');

    const now = new Date();
    if (cycle.status === 'UPCOMING' && cycle.startsAt > now) {
      throw new ConflictException({ error: { code: 'CYCLE_NOT_STARTED' } });
    }

    const minAsOf = cycle.startsAt;
    const maxAsOf = new Date(Math.min(now.getTime(), cycle.endsAt.getTime()));
    if (asOf < minAsOf || asOf > maxAsOf) {
      throw new BadRequestException({ error: { code: 'INVALID_AS_OF' } });
    }

    // Subsequent tasks fill in the aggregations below.
    return this.assembleResponse(cycle, asOf);
  }

  private async assembleResponse(cycle: any, asOf: Date): Promise<CycleReceiptResponse> {
    const mode = this.decideMode(cycle, asOf);
    return {
      cycle: {
        id: cycle.id,
        name: cycle.name,
        weekNumber: 0,    // task 6
        weeksTotal: 0,    // task 6
        startsAt: cycle.startsAt.toISOString(),
        endsAt: cycle.endsAt.toISOString(),
        status: cycle.status,
      },
      asOf: asOf.toISOString(),
      mode,
      totals: { members: cycle.memberships.length, totalMinutes: 0, avgMinutesPerMember: 0, itemsCompleted: 0, retros: 0, classesHeld: 0, classesTotal: 0, attendanceRate: 0 },
      byTopic: [],
      knowledgeGrid: { members: [], topics: [], cells: [] },
      topMovers: [],
      cycleTopMover: null,
      streakChampion: null,
      retroChampions: [],
      perfectAttendance: [],
    };
  }

  private decideMode(cycle: any, asOf: Date): ReceiptMode {
    if (cycle.status === 'ARCHIVED') return 'wrapped';
    const asOfKey = asOf.toISOString().slice(0, 10);
    const endKey = (cycle.endsAt as Date).toISOString().slice(0, 10);
    if (asOfKey === endKey) return 'wrapped';
    return 'thermal';
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern cycle-receipt.service`
Expected: PASS (3/3).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/admin/cycle-receipt/
git commit -m "feat(receipt): cycle metadata fetch and as-of validation"
```

---

### Task 3: Service — totals + byTopic aggregation

**Files:**
- Modify: `apps/api/src/admin/cycle-receipt/cycle-receipt.service.ts`
- Modify: `apps/api/src/admin/cycle-receipt/cycle-receipt.service.spec.ts`

- [ ] **Step 1: Write tests for totals + byTopic**

Append to spec file:

```ts
describe('CycleReceiptService — totals + byTopic', () => {
  const cycleBase = {
    id: 'c1',
    name: 'Ciclo 4',
    status: 'ACTIVE' as const,
    startsAt: new Date('2026-04-01T00:00:00Z'),
    endsAt: new Date('2026-06-01T00:00:00Z'),
    memberships: [
      { userId: 'u1', user: { id: 'u1', name: 'Alice', pictureUrl: null } },
      { userId: 'u2', user: { id: 'u2', name: 'Bob', pictureUrl: null } },
    ],
  };

  it('sums estimatedMinutes (not actualMinutes) for items with positive outcome', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    prisma.weeklyPlanItem.findMany.mockResolvedValue([
      { outcome: 'DONE_EASY', completedAt: new Date('2026-04-10T15:00:00Z'),
        actualMinutes: 999, libraryItem: { estimatedMinutes: 60, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] }, weeklyPlan: { userId: 'u1' } },
      { outcome: 'DONE_HARD', completedAt: new Date('2026-04-12T15:00:00Z'),
        actualMinutes: null, libraryItem: { estimatedMinutes: 30, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] }, weeklyPlan: { userId: 'u2' } },
    ]);
    const svc = new CycleReceiptService(prisma as any);
    const r = await svc.build('c1', new Date('2026-05-13'));
    expect(r.totals.totalMinutes).toBe(90);  // 60 + 30, ignores actualMinutes
    expect(r.totals.itemsCompleted).toBe(2);
    expect(r.totals.avgMinutesPerMember).toBe(45);
  });

  it('cross-topic items count for every topic they cover', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    prisma.weeklyPlanItem.findMany.mockResolvedValue([
      { outcome: 'DONE_EASY', completedAt: new Date('2026-04-10T15:00:00Z'),
        libraryItem: { estimatedMinutes: 60, topics: [
          { topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } },
          { topicId: 't2', topic: { id: 't2', slug: 'tree', label: 'Tree', order: 2 } },
        ] }, weeklyPlan: { userId: 'u1' } },
    ]);
    const svc = new CycleReceiptService(prisma as any);
    const r = await svc.build('c1', new Date('2026-05-13'));
    expect(r.byTopic.find(t => t.slug === 'hashmap')?.itemsCompleted).toBe(1);
    expect(r.byTopic.find(t => t.slug === 'tree')?.itemsCompleted).toBe(1);
    expect(r.byTopic.find(t => t.slug === 'hashmap')?.membersReached).toBe(1);
    expect(r.byTopic.find(t => t.slug === 'tree')?.membersReached).toBe(1);
  });

  it('byTopic sorted by coveragePct desc, ties by Topic.order asc, excludes zero-coverage', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    prisma.weeklyPlanItem.findMany.mockResolvedValue([
      // both members touched 'tree' (order 2), only u1 touched 'hashmap' (order 1)
      { outcome: 'DONE_EASY', completedAt: new Date('2026-04-10T15:00:00Z'),
        libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] }, weeklyPlan: { userId: 'u1' } },
      { outcome: 'DONE_EASY', completedAt: new Date('2026-04-10T15:00:00Z'),
        libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't2', topic: { id: 't2', slug: 'tree', label: 'Tree', order: 2 } }] }, weeklyPlan: { userId: 'u1' } },
      { outcome: 'DONE_EASY', completedAt: new Date('2026-04-10T15:00:00Z'),
        libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't2', topic: { id: 't2', slug: 'tree', label: 'Tree', order: 2 } }] }, weeklyPlan: { userId: 'u2' } },
    ]);
    const svc = new CycleReceiptService(prisma as any);
    const r = await svc.build('c1', new Date('2026-05-13'));
    expect(r.byTopic.map(t => t.slug)).toEqual(['tree', 'hashmap']); // tree 100%, hashmap 50%
  });

  it('excludes items with non-positive outcomes', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    prisma.weeklyPlanItem.findMany.mockResolvedValue([]); // service must pass POSITIVE_OUTCOMES filter
    const svc = new CycleReceiptService(prisma as any);
    await svc.build('c1', new Date('2026-05-13'));
    const args = prisma.weeklyPlanItem.findMany.mock.calls[0][0];
    expect(args.where.outcome.in).toEqual(expect.arrayContaining(['DONE_EASY','DONE_HARD','DOUBTS','SKIPPED']));
    expect(args.where.outcome.in).not.toContain('PENDING');
    expect(args.where.outcome.in).not.toContain('STUCK');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern cycle-receipt.service`
Expected: 4 new FAILs (existing 3 still PASS).

- [ ] **Step 3: Implement totals + byTopic aggregation**

Add to `cycle-receipt.service.ts`, replacing the stub `assembleResponse`:

```ts
import { POSITIVE_OUTCOMES } from '@ics-select/shared';

// ... inside the class:

private async fetchItems(cycleId: string, startsAt: Date, asOf: Date) {
  const asOfEnd = new Date(asOf);
  asOfEnd.setUTCHours(23, 59, 59, 999);
  return this.prisma.weeklyPlanItem.findMany({
    where: {
      weeklyPlan: { cycleId },
      completedAt: { gte: startsAt, lte: asOfEnd },
      outcome: { in: Array.from(POSITIVE_OUTCOMES) },
    },
    include: {
      libraryItem: { include: { topics: { include: { topic: true } } } },
      weeklyPlan: { select: { userId: true } },
    },
  });
}

private computeTotals(items: any[], memberCount: number) {
  const totalMinutes = items.reduce((s, it) => s + (it.libraryItem.estimatedMinutes ?? 0), 0);
  return {
    totalMinutes,
    itemsCompleted: items.length,
    avgMinutesPerMember: memberCount > 0 ? Math.round(totalMinutes / memberCount) : 0,
  };
}

private computeByTopic(items: any[], memberCount: number) {
  const acc = new Map<string, {
    topicId: string; slug: string; label: string; order: number;
    members: Set<string>; itemsCompleted: number;
  }>();
  for (const it of items) {
    const userId = it.weeklyPlan.userId;
    for (const lt of it.libraryItem.topics) {
      const t = lt.topic;
      let bucket = acc.get(t.id);
      if (!bucket) {
        bucket = { topicId: t.id, slug: t.slug, label: t.label, order: t.order, members: new Set(), itemsCompleted: 0 };
        acc.set(t.id, bucket);
      }
      bucket.members.add(userId);
      bucket.itemsCompleted += 1;
    }
  }
  const rows = Array.from(acc.values())
    .filter(b => b.members.size > 0)
    .map(b => ({
      topicId: b.topicId, slug: b.slug, label: b.label, order: b.order,
      membersReached: b.members.size,
      itemsCompleted: b.itemsCompleted,
      coveragePct: memberCount > 0 ? b.members.size / memberCount : 0,
    }))
    .sort((a, b) => b.coveragePct - a.coveragePct || a.order - b.order);
  return rows;
}
```

Update `assembleResponse` to call them:

```ts
private async assembleResponse(cycle: any, asOf: Date): Promise<CycleReceiptResponse> {
  const items = await this.fetchItems(cycle.id, cycle.startsAt, asOf);
  const memberCount = cycle.memberships.length;
  const totalsBase = this.computeTotals(items, memberCount);
  const byTopic = this.computeByTopic(items, memberCount);
  const mode = this.decideMode(cycle, asOf);

  return {
    cycle: {
      id: cycle.id, name: cycle.name,
      weekNumber: 0, weeksTotal: 0,    // task 6 wires week math
      startsAt: cycle.startsAt.toISOString(),
      endsAt: cycle.endsAt.toISOString(),
      status: cycle.status,
    },
    asOf: asOf.toISOString(),
    mode,
    totals: {
      members: memberCount, ...totalsBase,
      retros: 0, classesHeld: 0, classesTotal: 0, attendanceRate: 0,
    },
    byTopic,
    knowledgeGrid: { members: [], topics: [], cells: [] },
    topMovers: [], cycleTopMover: null,
    streakChampion: null, retroChampions: [], perfectAttendance: [],
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern cycle-receipt.service`
Expected: 7/7 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/admin/cycle-receipt/
git commit -m "feat(receipt): totals and byTopic aggregation"
```

---

### Task 4: Service — knowledgeGrid construction

**Files:**
- Modify: `apps/api/src/admin/cycle-receipt/cycle-receipt.service.ts`
- Modify: `apps/api/src/admin/cycle-receipt/cycle-receipt.service.spec.ts`

- [ ] **Step 1: Write tests for knowledgeGrid**

Append to spec:

```ts
describe('CycleReceiptService — knowledgeGrid', () => {
  const cycleBase = {
    id: 'c1', name: 'Ciclo 4', status: 'ACTIVE' as const,
    startsAt: new Date('2026-04-01T00:00:00Z'),
    endsAt: new Date('2026-06-01T00:00:00Z'),
    memberships: [
      { userId: 'u1', user: { id: 'u1', name: 'Alice', pictureUrl: null } },
      { userId: 'u2', user: { id: 'u2', name: 'Bob', pictureUrl: null } },
    ],
  };

  it('builds cells with itemsDone per (user, topic)', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    prisma.weeklyPlanItem.findMany.mockResolvedValue([
      { outcome: 'DONE_EASY', completedAt: new Date('2026-04-10T15:00:00Z'),
        libraryItem: { estimatedMinutes: 60, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] }, weeklyPlan: { userId: 'u1' } },
      { outcome: 'DONE_HARD', completedAt: new Date('2026-04-11T15:00:00Z'),
        libraryItem: { estimatedMinutes: 60, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] }, weeklyPlan: { userId: 'u1' } },
    ]);
    const svc = new CycleReceiptService(prisma as any);
    const r = await svc.build('c1', new Date('2026-05-13'));
    expect(r.knowledgeGrid.cells).toEqual([
      { userId: 'u1', topicId: 't1', itemsDone: 2, hasStuckOrDoubts: false },
    ]);
  });

  it('marks hasStuckOrDoubts=true when member has STUCK or DOUBTS on a topic item', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    // Service must run a separate query that includes STUCK + DOUBTS, NOT only positive outcomes.
    prisma.weeklyPlanItem.findMany.mockImplementation((args: any) => {
      const isFlagQuery = args.where.outcome?.in?.includes('STUCK');
      if (isFlagQuery) {
        return Promise.resolve([
          { outcome: 'STUCK', libraryItem: { topics: [{ topicId: 't1', topic: { id: 't1' } }] }, weeklyPlan: { userId: 'u1' } },
        ]);
      }
      return Promise.resolve([
        { outcome: 'DONE_EASY', completedAt: new Date('2026-04-10T15:00:00Z'),
          libraryItem: { estimatedMinutes: 60, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] }, weeklyPlan: { userId: 'u1' } },
      ]);
    });
    const svc = new CycleReceiptService(prisma as any);
    const r = await svc.build('c1', new Date('2026-05-13'));
    expect(r.knowledgeGrid.cells[0].hasStuckOrDoubts).toBe(true);
  });

  it('lists members in alphabetical order, excluding removed members', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue({
      ...cycleBase,
      memberships: [
        { userId: 'u2', user: { id: 'u2', name: 'Bob', pictureUrl: null } },
        { userId: 'u1', user: { id: 'u1', name: 'Alice', pictureUrl: null } },
      ],
    });
    const svc = new CycleReceiptService(prisma as any);
    const r = await svc.build('c1', new Date('2026-05-13'));
    expect(r.knowledgeGrid.members.map(m => m.name)).toEqual(['Alice', 'Bob']);
  });

  it('lists topics in Topic.order ascending', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    prisma.weeklyPlanItem.findMany.mockResolvedValue([
      { outcome: 'DONE_EASY', completedAt: new Date('2026-04-10T15:00:00Z'),
        libraryItem: { estimatedMinutes: 60, topics: [
          { topicId: 't2', topic: { id: 't2', slug: 'tree', label: 'Tree', order: 2 } },
          { topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } },
        ] }, weeklyPlan: { userId: 'u1' } },
    ]);
    const svc = new CycleReceiptService(prisma as any);
    const r = await svc.build('c1', new Date('2026-05-13'));
    expect(r.knowledgeGrid.topics.map(t => t.slug)).toEqual(['hashmap', 'tree']);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern cycle-receipt.service`
Expected: 4 new FAILs.

- [ ] **Step 3: Implement knowledgeGrid**

Add to service:

```ts
private async fetchStuckOrDoubtsItems(cycleId: string, startsAt: Date, asOf: Date) {
  const asOfEnd = new Date(asOf);
  asOfEnd.setUTCHours(23, 59, 59, 999);
  return this.prisma.weeklyPlanItem.findMany({
    where: {
      weeklyPlan: { cycleId },
      OR: [
        { outcome: 'STUCK' },
        { outcome: 'DOUBTS', completedAt: { gte: startsAt, lte: asOfEnd } },
      ],
    },
    include: {
      libraryItem: { include: { topics: { select: { topicId: true, topic: { select: { id: true } } } } } },
      weeklyPlan: { select: { userId: true } },
    },
  });
}

private buildKnowledgeGrid(cycle: any, items: any[], stuckItems: any[]) {
  const members = cycle.memberships
    .map((m: any) => ({ userId: m.userId, name: m.user.name, pictureUrl: m.user.pictureUrl }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name));

  // collect topics from positive items
  const topicMap = new Map<string, { topicId: string; slug: string; label: string; order: number }>();
  for (const it of items) for (const lt of it.libraryItem.topics) {
    if (!topicMap.has(lt.topic.id)) topicMap.set(lt.topic.id, { topicId: lt.topic.id, slug: lt.topic.slug, label: lt.topic.label, order: lt.topic.order });
  }
  const topics = Array.from(topicMap.values()).sort((a, b) => a.order - b.order);

  // cells map (user,topic) -> itemsDone
  const counts = new Map<string, number>();
  const memberSet = new Set(members.map((m: any) => m.userId));
  for (const it of items) {
    const u = it.weeklyPlan.userId;
    if (!memberSet.has(u)) continue;
    for (const lt of it.libraryItem.topics) {
      const key = `${u}|${lt.topic.id}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  // stuck/doubts flag map
  const stuckSet = new Set<string>();
  for (const it of stuckItems) {
    const u = it.weeklyPlan.userId;
    if (!memberSet.has(u)) continue;
    for (const lt of it.libraryItem.topics) {
      stuckSet.add(`${u}|${lt.topic.id}`);
    }
  }

  // Cell exists only where itemsDone > 0 OR stuck/doubts present in a known topic
  const cells: any[] = [];
  const allKeys = new Set<string>([...counts.keys(), ...stuckSet]);
  for (const key of allKeys) {
    const [userId, topicId] = key.split('|');
    if (!topicMap.has(topicId)) continue;  // only topics touched positively by the cohort
    cells.push({
      userId, topicId,
      itemsDone: counts.get(key) ?? 0,
      hasStuckOrDoubts: stuckSet.has(key),
    });
  }

  return { members, topics, cells };
}
```

Wire `buildKnowledgeGrid` in `assembleResponse`:

```ts
const stuckItems = await this.fetchStuckOrDoubtsItems(cycle.id, cycle.startsAt, asOf);
const knowledgeGrid = this.buildKnowledgeGrid(cycle, items, stuckItems);
// ...
return { ..., knowledgeGrid, ... };
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern cycle-receipt.service`
Expected: 11/11 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/admin/cycle-receipt/
git commit -m "feat(receipt): knowledge grid with stuck/doubts flag"
```

---

### Task 5: Service — topMovers, cycleTopMover, streakChampion, retroChampions, perfectAttendance

**Files:**
- Modify: `apps/api/src/admin/cycle-receipt/cycle-receipt.service.ts`
- Modify: `apps/api/src/admin/cycle-receipt/cycle-receipt.service.spec.ts`

- [ ] **Step 1: Write tests for each nominal block**

Append:

```ts
describe('CycleReceiptService — nominal blocks', () => {
  const cycleBase = {
    id: 'c1', name: 'Ciclo 4', status: 'ACTIVE' as const,
    startsAt: new Date('2026-04-01T00:00:00Z'),
    endsAt: new Date('2026-06-01T00:00:00Z'),
    memberships: [
      { userId: 'u1', user: { id: 'u1', name: 'Alice', pictureUrl: null } },
      { userId: 'u2', user: { id: 'u2', name: 'Bob', pictureUrl: null } },
    ],
  };

  it('topMovers uses 7-day window ending at asOf', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    const asOf = new Date('2026-05-13T20:00:00Z');
    prisma.weeklyPlanItem.findMany.mockImplementation((args: any) => {
      // detect the "7-day window" query by the gte close to asOf-7d
      const gte: Date = args.where.completedAt.gte;
      const isWindow = (asOf.getTime() - gte.getTime()) < 8 * 24 * 60 * 60 * 1000 &&
                        (asOf.getTime() - gte.getTime()) > 6 * 24 * 60 * 60 * 1000;
      if (isWindow) {
        return Promise.resolve([
          { libraryItem: { topics: [{ topic: { label: 'Hashmap' } }] }, weeklyPlan: { userId: 'u1' } },
          { libraryItem: { topics: [{ topic: { label: 'Hashmap' } }] }, weeklyPlan: { userId: 'u1' } },
          { libraryItem: { topics: [{ topic: { label: 'Tree' } }] }, weeklyPlan: { userId: 'u2' } },
        ]);
      }
      return Promise.resolve([]); // other queries (cumulative, stuck) return empty
    });
    const svc = new CycleReceiptService(prisma as any);
    const r = await svc.build('c1', asOf);
    expect(r.topMovers.map(m => ({ userId: m.userId, deltaItems: m.deltaItems }))).toEqual([
      { userId: 'u1', deltaItems: 2 },
      { userId: 'u2', deltaItems: 1 },
    ]);
  });

  it('cycleTopMover uses cumulative cycle items', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    prisma.weeklyPlanItem.findMany.mockImplementation((args: any) => {
      const isPositive = args.where.outcome?.in?.includes('DONE_EASY');
      const gte: Date = args.where.completedAt?.gte;
      const isCumulative = isPositive && gte?.getTime() === cycleBase.startsAt.getTime();
      if (isCumulative) {
        return Promise.resolve([
          { libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] }, weeklyPlan: { userId: 'u2' }, completedAt: new Date('2026-04-05T10:00:00Z'), outcome: 'DONE_EASY' },
          { libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] }, weeklyPlan: { userId: 'u2' }, completedAt: new Date('2026-04-06T10:00:00Z'), outcome: 'DONE_EASY' },
          { libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] }, weeklyPlan: { userId: 'u2' }, completedAt: new Date('2026-04-07T10:00:00Z'), outcome: 'DONE_EASY' },
          { libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] }, weeklyPlan: { userId: 'u1' }, completedAt: new Date('2026-04-08T10:00:00Z'), outcome: 'DONE_EASY' },
        ]);
      }
      return Promise.resolve([]);
    });
    const svc = new CycleReceiptService(prisma as any);
    const r = await svc.build('c1', new Date('2026-05-13T20:00:00Z'));
    expect(r.cycleTopMover?.userId).toBe('u2');
    expect(r.cycleTopMover?.deltaItems).toBe(3);
  });

  it('streakChampion uses BRT-day-aware streak from completions', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    const asOf = new Date('2026-05-13T23:59:00Z');
    prisma.weeklyPlanItem.findMany.mockImplementation((args: any) => {
      if (args.where.outcome?.in?.includes('DONE_EASY') && args.where.completedAt?.gte?.getTime() === cycleBase.startsAt.getTime()) {
        return Promise.resolve([
          { libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'h', label: 'H', order: 1 } }] }, weeklyPlan: { userId: 'u1' }, completedAt: new Date('2026-05-13T21:00:00Z'), outcome: 'DONE_EASY' },
          { libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'h', label: 'H', order: 1 } }] }, weeklyPlan: { userId: 'u1' }, completedAt: new Date('2026-05-12T21:00:00Z'), outcome: 'DONE_EASY' },
          { libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'h', label: 'H', order: 1 } }] }, weeklyPlan: { userId: 'u2' }, completedAt: new Date('2026-05-10T21:00:00Z'), outcome: 'DONE_EASY' },
        ]);
      }
      return Promise.resolve([]);
    });
    const svc = new CycleReceiptService(prisma as any);
    const r = await svc.build('c1', asOf);
    expect(r.streakChampion?.userId).toBe('u1');
    expect(r.streakChampion?.streakDays).toBe(2);
  });

  it('retroChampions returns top 3 by count', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    prisma.weeklyRetro.groupBy.mockResolvedValue([
      { userId: 'u1', _count: 5 },
      { userId: 'u2', _count: 3 },
    ]);
    const svc = new CycleReceiptService(prisma as any);
    const r = await svc.build('c1', new Date('2026-05-13T20:00:00Z'));
    expect(r.retroChampions.map(c => ({ userId: c.userId, retros: c.retros }))).toEqual([
      { userId: 'u1', retros: 5 },
      { userId: 'u2', retros: 3 },
    ]);
    expect(r.totals.retros).toBe(8);
  });

  it('perfectAttendance lists members present at ALL classes held', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    prisma.classSession.findMany.mockResolvedValue([
      { id: 's1', scheduledAt: new Date('2026-04-10T20:00:00Z') },
      { id: 's2', scheduledAt: new Date('2026-04-17T20:00:00Z') },
      { id: 's3', scheduledAt: new Date('2026-06-30T20:00:00Z') }, // future, won't count
    ]);
    prisma.classAttendance.findMany.mockResolvedValue([
      { classSessionId: 's1', userId: 'u1', status: 'PRESENT' },
      { classSessionId: 's2', userId: 'u1', status: 'PRESENT' },
      { classSessionId: 's1', userId: 'u2', status: 'PRESENT' },
      { classSessionId: 's2', userId: 'u2', status: 'ABSENT' },
    ]);
    const svc = new CycleReceiptService(prisma as any);
    const r = await svc.build('c1', new Date('2026-05-13T20:00:00Z'));
    expect(r.totals.classesHeld).toBe(2);
    expect(r.totals.classesTotal).toBe(3);
    expect(r.totals.attendanceRate).toBeCloseTo(3 / (2 * 2));
    expect(r.perfectAttendance.map(m => m.userId)).toEqual(['u1']);
  });

  it('perfectAttendance is empty when no classes held yet', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    prisma.classSession.findMany.mockResolvedValue([]);
    const svc = new CycleReceiptService(prisma as any);
    const r = await svc.build('c1', new Date('2026-05-13T20:00:00Z'));
    expect(r.perfectAttendance).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failures**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern cycle-receipt.service`
Expected: 6 new FAILs.

- [ ] **Step 3: Implement the nominal blocks**

Add to the service:

```ts
import { computeStreakDays } from './streak.js';

private async fetchWindowItems(cycleId: string, asOf: Date) {
  const gte = new Date(asOf.getTime() - 7 * 24 * 60 * 60 * 1000);
  const lte = new Date(asOf);
  lte.setUTCHours(23, 59, 59, 999);
  return this.prisma.weeklyPlanItem.findMany({
    where: {
      weeklyPlan: { cycleId },
      completedAt: { gte, lte },
      outcome: { in: Array.from(POSITIVE_OUTCOMES) },
    },
    include: {
      libraryItem: { include: { topics: { include: { topic: true } } } },
      weeklyPlan: { select: { userId: true } },
    },
  });
}

private computeMovers(items: any[], members: any[]) {
  const memberLookup = new Map(members.map(m => [m.userId, m]));
  const acc = new Map<string, { delta: number; topicCounts: Map<string, number> }>();
  for (const it of items) {
    const u = it.weeklyPlan.userId;
    if (!memberLookup.has(u)) continue;
    let bucket = acc.get(u);
    if (!bucket) { bucket = { delta: 0, topicCounts: new Map() }; acc.set(u, bucket); }
    bucket.delta += 1;
    for (const lt of it.libraryItem.topics) {
      const label = lt.topic.label;
      bucket.topicCounts.set(label, (bucket.topicCounts.get(label) ?? 0) + 1);
    }
  }
  return Array.from(acc.entries())
    .filter(([, b]) => b.delta > 0)
    .map(([userId, b]) => {
      const m = memberLookup.get(userId);
      const topTopics = Array.from(b.topicCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([label]) => label);
      return { userId, name: m.name, pictureUrl: m.pictureUrl, deltaItems: b.delta, topTopics };
    })
    .sort((a, b) => b.deltaItems - a.deltaItems || a.name.localeCompare(b.name));
}

private async fetchRetros(cycleId: string, asOf: Date) {
  const asOfEnd = new Date(asOf);
  asOfEnd.setUTCHours(23, 59, 59, 999);
  return this.prisma.weeklyRetro.groupBy({
    by: ['userId'],
    _count: true,
    where: { weeklyPlan: { cycleId }, createdAt: { lte: asOfEnd } },
  } as any);
}

private async fetchClasses(cycleId: string, asOf: Date) {
  const asOfEnd = new Date(asOf);
  asOfEnd.setUTCHours(23, 59, 59, 999);
  const sessions = await this.prisma.classSession.findMany({
    where: { cycleId },
    select: { id: true, scheduledAt: true },
  });
  const held = sessions.filter(s => s.scheduledAt <= asOfEnd);
  const attendance = await this.prisma.classAttendance.findMany({
    where: { classSessionId: { in: held.map(s => s.id) } },
    select: { classSessionId: true, userId: true, status: true },
  });
  return { sessions, held, attendance };
}
```

Update `assembleResponse` to wire everything:

```ts
private async assembleResponse(cycle: any, asOf: Date): Promise<CycleReceiptResponse> {
  const items = await this.fetchItems(cycle.id, cycle.startsAt, asOf);
  const stuckItems = await this.fetchStuckOrDoubtsItems(cycle.id, cycle.startsAt, asOf);
  const windowItems = await this.fetchWindowItems(cycle.id, asOf);
  const retros = await this.fetchRetros(cycle.id, asOf);
  const classes = await this.fetchClasses(cycle.id, asOf);

  const memberCount = cycle.memberships.length;
  const members = cycle.memberships
    .map((m: any) => ({ userId: m.userId, name: m.user.name, pictureUrl: m.user.pictureUrl }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name));
  const memberSet = new Set(members.map((m: any) => m.userId));

  const totalsBase = this.computeTotals(items, memberCount);
  const byTopic = this.computeByTopic(items, memberCount);
  const knowledgeGrid = this.buildKnowledgeGrid(cycle, items, stuckItems);

  const allMovers = this.computeMovers(items, members);  // cumulative
  const windowMovers = this.computeMovers(windowItems, members); // last-7d
  const topMovers = windowMovers.slice(0, 3);
  const cycleTopMover = allMovers[0] ?? null;

  // streak champion
  const itemsByUser = new Map<string, Array<{ completedAt: Date | null }>>();
  for (const it of items) {
    const u = it.weeklyPlan.userId;
    if (!memberSet.has(u)) continue;
    if (!itemsByUser.has(u)) itemsByUser.set(u, []);
    itemsByUser.get(u)!.push({ completedAt: it.completedAt });
  }
  const streaks = members
    .map((m: any) => ({
      ...m,
      streakDays: computeStreakDays(itemsByUser.get(m.userId) ?? [], asOf),
      itemCount: itemsByUser.get(m.userId)?.length ?? 0,
    }))
    .sort((a: any, b: any) => b.streakDays - a.streakDays || b.itemCount - a.itemCount);
  const streakChampion = streaks[0] && streaks[0].streakDays > 0
    ? { userId: streaks[0].userId, name: streaks[0].name, pictureUrl: streaks[0].pictureUrl, streakDays: streaks[0].streakDays }
    : null;

  // retros
  const retroCountByUser = new Map<string, number>();
  for (const r of retros) {
    const cnt = (r as any)._count?.userId ?? (r as any)._count;
    retroCountByUser.set((r as any).userId, typeof cnt === 'number' ? cnt : Number(cnt));
  }
  const totalRetros = Array.from(retroCountByUser.values()).reduce((s, n) => s + n, 0);
  const retroChampions = members
    .map((m: any) => ({ ...m, retros: retroCountByUser.get(m.userId) ?? 0 }))
    .filter((m: any) => m.retros > 0)
    .sort((a: any, b: any) => b.retros - a.retros || a.name.localeCompare(b.name))
    .slice(0, 3);

  // classes / attendance
  const classesHeld = classes.held.length;
  const classesTotal = classes.sessions.length;
  const presents = classes.attendance.filter(a => a.status === 'PRESENT');
  const attendanceRate = classesHeld > 0 && memberCount > 0
    ? presents.length / (classesHeld * memberCount)
    : 0;
  const presentsByUser = new Map<string, Set<string>>();
  for (const a of presents) {
    if (!presentsByUser.has(a.userId)) presentsByUser.set(a.userId, new Set());
    presentsByUser.get(a.userId)!.add(a.classSessionId);
  }
  const perfectAttendance = classesHeld > 0
    ? members.filter((m: any) => (presentsByUser.get(m.userId)?.size ?? 0) === classesHeld)
    : [];

  const mode = this.decideMode(cycle, asOf);
  return {
    cycle: {
      id: cycle.id, name: cycle.name,
      weekNumber: 0, weeksTotal: 0,        // task 6
      startsAt: cycle.startsAt.toISOString(),
      endsAt: cycle.endsAt.toISOString(),
      status: cycle.status,
    },
    asOf: asOf.toISOString(),
    mode,
    totals: {
      members: memberCount, ...totalsBase,
      retros: totalRetros, classesHeld, classesTotal, attendanceRate,
    },
    byTopic, knowledgeGrid,
    topMovers, cycleTopMover,
    streakChampion, retroChampions, perfectAttendance,
  };
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern cycle-receipt.service`
Expected: 17/17 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/admin/cycle-receipt/
git commit -m "feat(receipt): nominal blocks — movers, streak, retros, attendance"
```

---

### Task 6: Service — week math + mode decision tests + in-memory cache

**Files:**
- Modify: `apps/api/src/admin/cycle-receipt/cycle-receipt.service.ts`
- Modify: `apps/api/src/admin/cycle-receipt/cycle-receipt.service.spec.ts`

- [ ] **Step 1: Add tests for week math, mode decision, and cache**

```ts
describe('CycleReceiptService — week math + mode + cache', () => {
  const cycleBase = {
    id: 'c1', name: 'Ciclo 4', status: 'ACTIVE' as const,
    startsAt: new Date('2026-04-13T00:00:00Z'),  // Monday
    endsAt: new Date('2026-06-08T00:00:00Z'),    // 8 weeks
    memberships: [],
  };

  it('weekNumber reflects asOf position from cycle.startsAt', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    const svc = new CycleReceiptService(prisma as any);
    const r1 = await svc.build('c1', new Date('2026-04-13T00:00:00Z')); // week 1
    expect(r1.cycle.weekNumber).toBe(1);
    expect(r1.cycle.weeksTotal).toBe(8);
    const r4 = await svc.build('c1', new Date('2026-05-04T00:00:00Z')); // week 4
    expect(r4.cycle.weekNumber).toBe(4);
  });

  it('mode is wrapped on cycle.endsAt date', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    const svc = new CycleReceiptService(prisma as any);
    const r = await svc.build('c1', cycleBase.endsAt);
    expect(r.mode).toBe('wrapped');
  });

  it('mode is wrapped on ARCHIVED cycle regardless of asOf', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue({ ...cycleBase, status: 'ARCHIVED' });
    const svc = new CycleReceiptService(prisma as any);
    const r = await svc.build('c1', new Date('2026-05-04T00:00:00Z'));
    expect(r.mode).toBe('wrapped');
  });

  it('cache reuses computed result within 5 minutes', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    const svc = new CycleReceiptService(prisma as any);
    const asOf = new Date('2026-05-04T00:00:00Z');
    await svc.build('c1', asOf);
    await svc.build('c1', asOf);
    expect(prisma.cycle.findUnique).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run to verify failures**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern cycle-receipt.service`
Expected: 4 new FAILs (cache test failure means findUnique called twice; week math is 0 from stub).

- [ ] **Step 3: Implement week math + cache**

Add a private cache and `computeWeekNumber`:

```ts
private readonly cache = new Map<string, { at: number; value: CycleReceiptResponse }>();
private readonly CACHE_TTL_MS = 5 * 60 * 1000;

async build(cycleId: string, asOf: Date): Promise<CycleReceiptResponse> {
  const cacheKey = `${cycleId}|${asOf.toISOString().slice(0, 10)}`;
  const cached = this.cache.get(cacheKey);
  if (cached && Date.now() - cached.at < this.CACHE_TTL_MS) return cached.value;

  // ... existing validation + assembleResponse ...

  this.cache.set(cacheKey, { at: Date.now(), value: result });
  return result;
}
```

Where `result` is the variable holding the value from `assembleResponse`. Update accordingly:

```ts
const result = await this.assembleResponse(cycle, asOf);
this.cache.set(cacheKey, { at: Date.now(), value: result });
return result;
```

Add week math in `assembleResponse`:

```ts
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
const weeksTotal = Math.max(1, Math.ceil((cycle.endsAt.getTime() - cycle.startsAt.getTime()) / MS_PER_WEEK));
const weeksElapsed = Math.floor((asOf.getTime() - cycle.startsAt.getTime()) / MS_PER_WEEK);
const weekNumber = Math.max(1, Math.min(weeksTotal, weeksElapsed + 1));
```

Replace the `weekNumber: 0, weeksTotal: 0` placeholders in the returned object with these.

- [ ] **Step 4: Run all service tests**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern cycle-receipt.service`
Expected: 21/21 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/admin/cycle-receipt/
git commit -m "feat(receipt): week math, mode decision, 5min in-memory cache"
```

---

### Task 7: Controller + module registration + e2e

**Files:**
- Create: `apps/api/src/admin/cycle-receipt/cycle-receipt.controller.ts`
- Modify: `apps/api/src/admin/cycle-receipt/cycle-receipt.module.ts`
- Modify: `apps/api/src/admin/admin.module.ts`
- Create: `apps/api/test/cycle-receipt.e2e-spec.ts`

- [ ] **Step 1: Look at sibling controller for auth patterns**

Read `apps/api/src/admin/cycle/cycle-overview.controller.ts` to confirm the `@Roles('ADMIN')` + `@CurrentUser()` setup. Mimic.

- [ ] **Step 2: Write the controller**

```ts
// apps/api/src/admin/cycle-receipt/cycle-receipt.controller.ts
import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../../auth/roles.decorator.js';
import { CycleReceiptService } from './cycle-receipt.service.js';

@Controller('admin/cycle/:id/receipt')
@Roles('ADMIN')
export class CycleReceiptController {
  constructor(private readonly service: CycleReceiptService) {}

  @Get()
  async get(@Param('id') id: string, @Query('asOf') asOf?: string) {
    const asOfDate = asOf ? new Date(asOf) : new Date();
    if (isNaN(asOfDate.getTime())) {
      throw new BadRequestException({ error: { code: 'INVALID_AS_OF' } });
    }
    return this.service.build(id, asOfDate);
  }
}
```

- [ ] **Step 3: Wire module**

```ts
// apps/api/src/admin/cycle-receipt/cycle-receipt.module.ts
import { Module } from '@nestjs/common';
import { CycleReceiptService } from './cycle-receipt.service.js';
import { CycleReceiptController } from './cycle-receipt.controller.js';

@Module({
  providers: [CycleReceiptService],
  controllers: [CycleReceiptController],
})
export class CycleReceiptModule {}
```

- [ ] **Step 4: Register in admin.module.ts**

Open `apps/api/src/admin/admin.module.ts`, add `CycleReceiptModule` to the `imports` array (mirror existing sibling modules).

```ts
import { CycleReceiptModule } from './cycle-receipt/cycle-receipt.module.js';

@Module({
  imports: [/* ...existing..., */ CycleReceiptModule],
})
export class AdminModule {}
```

- [ ] **Step 5: Write e2e test**

```ts
// apps/api/test/cycle-receipt.e2e-spec.ts
import { Test } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { JwtAuthGuard } from '../src/auth/jwt-auth.guard.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('GET /admin/cycle/:id/receipt (e2e)', () => {
  let app: INestApplication;
  let prisma: any;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: (ctx: ExecutionContext) => {
        const req = ctx.switchToHttp().getRequest();
        req.user = { sub: 'admin-1', role: 'ADMIN' };
        return true;
      } })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        cycle: { findUnique: jest.fn() },
        weeklyPlanItem: { findMany: jest.fn().mockResolvedValue([]) },
        weeklyRetro: { groupBy: jest.fn().mockResolvedValue([]) },
        classSession: { findMany: jest.fn().mockResolvedValue([]) },
        classAttendance: { findMany: jest.fn().mockResolvedValue([]) },
      })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(() => app.close());

  it('returns 200 with payload when cycle and asOf are valid', async () => {
    prisma.cycle.findUnique.mockResolvedValue({
      id: 'c1', name: 'Ciclo 4', status: 'ACTIVE',
      startsAt: new Date('2026-04-01T00:00:00Z'),
      endsAt: new Date('2026-06-01T00:00:00Z'),
      memberships: [],
    });
    const res = await request(app.getHttpServer())
      .get('/admin/cycle/c1/receipt?asOf=2026-05-13')
      .expect(200);
    expect(res.body).toMatchObject({
      cycle: { id: 'c1' },
      mode: 'thermal',
      totals: { members: 0 },
    });
  });

  it('returns 400 when asOf is out of range', async () => {
    prisma.cycle.findUnique.mockResolvedValue({
      id: 'c2', name: 'Ciclo 4', status: 'ACTIVE',
      startsAt: new Date('2026-04-01T00:00:00Z'),
      endsAt: new Date('2026-06-01T00:00:00Z'),
      memberships: [],
    });
    await request(app.getHttpServer())
      .get('/admin/cycle/c2/receipt?asOf=2026-01-01')
      .expect(400);
  });

  it('returns 409 when cycle is UPCOMING and has not started', async () => {
    prisma.cycle.findUnique.mockResolvedValue({
      id: 'c3', name: 'Ciclo 5', status: 'UPCOMING',
      startsAt: new Date('2030-01-01T00:00:00Z'),
      endsAt: new Date('2030-03-01T00:00:00Z'),
      memberships: [],
    });
    await request(app.getHttpServer())
      .get('/admin/cycle/c3/receipt')
      .expect(409);
  });
});
```

- [ ] **Step 6: Run e2e**

Run: `pnpm --filter @ics-select/api test:e2e -- --testPathPattern cycle-receipt`
Expected: 3/3 PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/admin/cycle-receipt/ apps/api/src/admin/admin.module.ts apps/api/test/cycle-receipt.e2e-spec.ts
git commit -m "feat(receipt): GET /admin/cycle/:id/receipt endpoint + e2e"
```

---

## Phase 2 · Reusable component

### Task 8: `<CohortKnowledgeGrid>` component

**Files:**
- Create: `apps/web/components/admin/cohort-knowledge-grid.tsx`

- [ ] **Step 1: Implement the component**

```tsx
// apps/web/components/admin/cohort-knowledge-grid.tsx
'use client';

type Member = { userId: string; name: string; pictureUrl: string | null };
type Topic = { topicId: string; slug: string; label: string; order: number };
type Cell = { userId: string; topicId: string; itemsDone: number; hasStuckOrDoubts: boolean };

export type CohortKnowledgeGridProps = {
  members: Member[];
  topics: Topic[];
  cells: Cell[];
  variant?: 'thermal' | 'inverted';
  showTotals?: boolean;
  onMemberClick?: (userId: string) => void;
  onCellClick?: (userId: string, topicId: string) => void;
};

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function CohortKnowledgeGrid({
  members, topics, cells, variant = 'thermal', showTotals = true,
  onMemberClick, onCellClick,
}: CohortKnowledgeGridProps) {
  const cellMap = new Map<string, Cell>();
  for (const c of cells) cellMap.set(`${c.userId}|${c.topicId}`, c);

  const inverted = variant === 'inverted';
  const cellColor = (c: Cell | undefined) => {
    if (!c || c.itemsDone === 0) return inverted ? 'text-white/30' : 'text-ink-faint';
    if (c.hasStuckOrDoubts) return 'text-outcome-stuck';
    if (c.itemsDone === 1) return inverted ? 'text-white/70' : 'text-ink-soft';
    return inverted ? 'text-white' : 'text-ink';
  };
  const cellGlyph = (c: Cell | undefined) => {
    if (!c || c.itemsDone === 0) return '·';
    if (c.itemsDone === 1) return '●';
    return '●●';
  };

  if (members.length === 0) {
    return (
      <div className={`font-mono text-xs ${inverted ? 'text-white/60' : 'text-ink-mute'}`}>
        No members in this cycle.
      </div>
    );
  }
  if (topics.length === 0) {
    return (
      <div className={`font-mono text-xs ${inverted ? 'text-white/60' : 'text-ink-mute'}`}>
        Nothing studied yet.
      </div>
    );
  }

  const totals = topics.map(t =>
    members.reduce((s, m) => s + ((cellMap.get(`${m.userId}|${t.topicId}`)?.itemsDone ?? 0) > 0 ? 1 : 0), 0)
  );

  return (
    <div className="overflow-x-auto">
      <table className="font-mono text-xs">
        <thead>
          <tr>
            <th className="w-[180px]" />
            {topics.map((t, i) => (
              <th
                key={t.topicId}
                className={`px-2 pb-2 align-bottom ${i > 0 && i % 4 === 0 ? (inverted ? 'border-l border-white/20' : 'border-l border-rule') : ''}`}
              >
                <div
                  className={`origin-bottom-left -rotate-45 whitespace-nowrap text-[10px] uppercase tracking-label ${inverted ? 'text-white/70' : 'text-ink-soft'}`}
                  title={t.label}
                >
                  {truncate(t.label, 14)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {members.map(m => (
            <tr key={m.userId} className={inverted ? 'hover:bg-white/5' : 'hover:bg-paper-warm'}>
              <td
                className={`pr-3 ${onMemberClick ? 'cursor-pointer underline-offset-2 hover:underline' : ''}`}
                onClick={onMemberClick ? () => onMemberClick(m.userId) : undefined}
                title={m.name}
              >
                {truncate(m.name, 22)}
              </td>
              {topics.map((t, i) => {
                const c = cellMap.get(`${m.userId}|${t.topicId}`);
                return (
                  <td
                    key={t.topicId}
                    className={`px-2 text-center ${cellColor(c)} ${i > 0 && i % 4 === 0 ? (inverted ? 'border-l border-white/20' : 'border-l border-rule') : ''} ${onCellClick ? 'cursor-pointer' : ''}`}
                    onClick={onCellClick ? () => onCellClick(m.userId, t.topicId) : undefined}
                    title={c?.hasStuckOrDoubts ? 'has stuck or doubts in this topic' : undefined}
                  >
                    {cellGlyph(c)}
                  </td>
                );
              })}
            </tr>
          ))}
          {showTotals && (
            <tr className={inverted ? 'border-t border-white/20' : 'border-t border-rule'}>
              <td className={`pt-2 pr-3 uppercase tracking-label text-[10px] ${inverted ? 'text-white/60' : 'text-ink-mute'}`}>
                Total
              </td>
              {totals.map((n, i) => (
                <td
                  key={i}
                  className={`pt-2 px-2 text-center ${inverted ? 'text-white/80' : 'text-ink-soft'} ${i > 0 && i % 4 === 0 ? (inverted ? 'border-l border-white/20' : 'border-l border-rule') : ''}`}
                >
                  {n}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 2: Sanity-render the component**

Add a temporary import in any admin page (e.g., `/admin/library/page.tsx`) with three hand-built members + topics + cells just to verify it renders. **Remove the import before committing.**

**Note on >20-topic split:** The spec calls for splitting the grid into two stacked sub-grids when `topics.length > 20`. The implementation above renders a single table with `overflow-x-auto`. This is acceptable for v1 since active cycles typically have <15 topics in scope. If a real cycle exceeds 20 topics, file a follow-up task to split — don't block this PR on it.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/admin/cohort-knowledge-grid.tsx
git commit -m "feat(receipt): reusable CohortKnowledgeGrid component"
```

---

## Phase 3 · Frontend foundations

### Task 9: Route layout (no AppShell) + query hook + types

**Files:**
- Create: `apps/web/app/(admin)/admin/cycle/[id]/receipt/layout.tsx`
- Create: `apps/web/lib/queries/admin-cycle-receipt.ts`

- [ ] **Step 1: Write the bare layout**

```tsx
// apps/web/app/(admin)/admin/cycle/[id]/receipt/layout.tsx
import type { ReactNode } from 'react';

export default function ReceiptLayout({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-paper">{children}</main>;
}
```

This file's location inside `(admin)` means the parent auth check still runs but the admin shell does NOT (Next.js nested layouts replace the parent at this level). Verify by reading `apps/web/app/(admin)/layout.tsx` and confirming the auth logic is at THIS file's level or higher, not inside the AppShell wrapper.

If the parent `(admin)/layout.tsx` wraps in AppShell, this child layout still inherits its tree — you may need to put the auth check directly in this new layout or in the `page.tsx`. **Read `(admin)/layout.tsx` first to confirm**, then either:
- Confirm auth lives in middleware / a parent and this layout is enough, OR
- Add a server-side auth check at the top of `receipt/page.tsx` (next task).

- [ ] **Step 2: Write the query hook + response type**

```tsx
// apps/web/lib/queries/admin-cycle-receipt.ts
'use client';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';

export type ReceiptMode = 'thermal' | 'wrapped';

export type ReceiptMember = {
  userId: string;
  name: string;
  pictureUrl: string | null;
};

export type CycleReceiptResponse = {
  cycle: {
    id: string;
    name: string;
    weekNumber: number;
    weeksTotal: number;
    startsAt: string;
    endsAt: string;
    status: 'UPCOMING' | 'ACTIVE' | 'ARCHIVED';
  };
  asOf: string;
  mode: ReceiptMode;
  totals: {
    members: number;
    totalMinutes: number;
    avgMinutesPerMember: number;
    itemsCompleted: number;
    retros: number;
    classesHeld: number;
    classesTotal: number;
    attendanceRate: number;
  };
  byTopic: Array<{ topicId: string; slug: string; label: string; order: number; membersReached: number; itemsCompleted: number; coveragePct: number }>;
  knowledgeGrid: {
    members: ReceiptMember[];
    topics: Array<{ topicId: string; slug: string; label: string; order: number }>;
    cells: Array<{ userId: string; topicId: string; itemsDone: number; hasStuckOrDoubts: boolean }>;
  };
  topMovers: Array<ReceiptMember & { deltaItems: number; topTopics: string[] }>;
  cycleTopMover: (ReceiptMember & { deltaItems: number; topTopics: string[] }) | null;
  streakChampion: (ReceiptMember & { streakDays: number }) | null;
  retroChampions: Array<ReceiptMember & { retros: number }>;
  perfectAttendance: ReceiptMember[];
};

export function useCycleReceipt(cycleId: string, asOf?: string) {
  return useQuery<CycleReceiptResponse>({
    queryKey: ['admin-cycle-receipt', cycleId, asOf ?? 'today'],
    queryFn: () => apiFetch(`/admin/cycle/${cycleId}/receipt${asOf ? `?asOf=${asOf}` : ''}`),
    staleTime: 60_000,
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(admin\)/admin/cycle/\[id\]/receipt/layout.tsx apps/web/lib/queries/admin-cycle-receipt.ts
git commit -m "feat(receipt): bare-bones route layout + query hook"
```

---

### Task 10: Receipt page + client wrapper

**Files:**
- Create: `apps/web/app/(admin)/admin/cycle/[id]/receipt/page.tsx`
- Create: `apps/web/app/(admin)/admin/cycle/[id]/receipt/receipt-client.tsx`

- [ ] **Step 1: Page (server component)**

```tsx
// apps/web/app/(admin)/admin/cycle/[id]/receipt/page.tsx
import { ReceiptClient } from './receipt-client';

export default function ReceiptPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { asOf?: string; mode?: 'thermal' | 'wrapped' };
}) {
  return (
    <ReceiptClient
      cycleId={params.id}
      asOf={searchParams.asOf}
      modeOverride={searchParams.mode}
    />
  );
}
```

- [ ] **Step 2: Client wrapper — selects view based on mode**

```tsx
// apps/web/app/(admin)/admin/cycle/[id]/receipt/receipt-client.tsx
'use client';
import { useCycleReceipt } from '../../../../../../lib/queries/admin-cycle-receipt';
import { ReceiptToolbar } from '../../../../../../components/admin/receipt/receipt-toolbar';
import { ThermalReceiptView } from '../../../../../../components/admin/receipt/thermal-receipt-view';
import { WrappedView } from '../../../../../../components/admin/receipt/wrapped-view';

type Props = { cycleId: string; asOf?: string; modeOverride?: 'thermal' | 'wrapped' };

export function ReceiptClient({ cycleId, asOf, modeOverride }: Props) {
  const { data, isLoading, error } = useCycleReceipt(cycleId, asOf);

  if (isLoading) return <div className="p-12 font-mono text-sm text-ink-mute">Loading receipt…</div>;
  if (error || !data) {
    const code = (error as any)?.body?.error?.code;
    const message =
      code === 'CYCLE_NOT_STARTED' ? "Cycle hasn't started yet." :
      code === 'INVALID_AS_OF' ? 'That date is outside the cycle range.' :
      'Failed to load receipt.';
    return <div className="p-12 font-mono text-sm text-ink-mute">{message}</div>;
  }

  const mode = modeOverride ?? data.mode;
  return (
    <>
      <ReceiptToolbar data={data} mode={mode} />
      {mode === 'wrapped' ? <WrappedView data={data} /> : <ThermalReceiptView data={data} />}
    </>
  );
}
```

- [ ] **Step 3: Stub view files so the page compiles**

```tsx
// apps/web/components/admin/receipt/thermal-receipt-view.tsx
'use client';
import type { CycleReceiptResponse } from '../../../lib/queries/admin-cycle-receipt';
export function ThermalReceiptView(_: { data: CycleReceiptResponse }) {
  return <div className="p-12 font-mono text-sm">Thermal Receipt (stub)</div>;
}
```

```tsx
// apps/web/components/admin/receipt/wrapped-view.tsx
'use client';
import type { CycleReceiptResponse } from '../../../lib/queries/admin-cycle-receipt';
export function WrappedView(_: { data: CycleReceiptResponse }) {
  return <div className="p-12 font-mono text-sm">Wrapped (stub)</div>;
}
```

```tsx
// apps/web/components/admin/receipt/receipt-toolbar.tsx
'use client';
import type { CycleReceiptResponse, ReceiptMode } from '../../../lib/queries/admin-cycle-receipt';
export function ReceiptToolbar(_: { data: CycleReceiptResponse; mode: ReceiptMode }) {
  return <div className="sticky top-0 z-50 bg-paper p-4 font-mono text-xs">Toolbar (stub)</div>;
}
```

- [ ] **Step 4: Smoke test in browser**

Run: `pnpm --filter @ics-select/web dev`. Visit `/admin/cycle/<an-existing-cycle-id>/receipt`. Expect stubs to render with toolbar visible and no admin shell sidebar.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(admin\)/admin/cycle/\[id\]/receipt/page.tsx apps/web/app/\(admin\)/admin/cycle/\[id\]/receipt/receipt-client.tsx apps/web/components/admin/receipt/
git commit -m "feat(receipt): page wiring with thermal/wrapped stubs"
```

---

### Task 11: Toolbar — date picker, mode pill, PNG button

**Files:**
- Modify: `apps/web/components/admin/receipt/receipt-toolbar.tsx`
- Add dependency: `html-to-image`

- [ ] **Step 1: Install dependency**

```bash
pnpm --filter @ics-select/web add html-to-image
```

- [ ] **Step 2: Implement toolbar**

```tsx
// apps/web/components/admin/receipt/receipt-toolbar.tsx
'use client';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useRef } from 'react';
import { toPng } from 'html-to-image';
import { ChevronLeft, Download } from 'lucide-react';
import type { CycleReceiptResponse, ReceiptMode } from '../../../lib/queries/admin-cycle-receipt';

export function ReceiptToolbar({ data, mode }: { data: CycleReceiptResponse; mode: ReceiptMode }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const cycle = data.cycle;
  const asOfValue = (sp.get('asOf') ?? data.asOf).slice(0, 10);
  const minDate = cycle.startsAt.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const endDate = cycle.endsAt.slice(0, 10);
  const maxDate = today < endDate ? today : endDate;

  const updateParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (value === null) next.delete(key); else next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`);
  };

  const showModeToggle = mode === 'wrapped' || cycle.status === 'ARCHIVED' || daysBetween(asOfValue, endDate) <= 2;

  const handleDownload = useCallback(async () => {
    const target = document.getElementById('receipt-capture-root');
    if (!target) return;
    const dataUrl = await toPng(target, { pixelRatio: 2, backgroundColor: '#FAFAF7' });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `cycle-${cycle.id.slice(-6)}-receipt-${asOfValue}.png`;
    a.click();
  }, [cycle.id, asOfValue]);

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 border-b border-rule bg-paper px-6 py-3">
      <Link href={`/admin/cycle/${cycle.id}`} className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-label text-ink-soft hover:text-ink">
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
        Back to cycle
      </Link>

      <div className="flex items-center gap-3">
        <label className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-label text-ink-mute">
          As of
          <input
            type="date"
            value={asOfValue}
            min={minDate}
            max={maxDate}
            onChange={e => updateParam('asOf', e.target.value)}
            className="border border-rule bg-surface px-2 py-1 font-mono text-xs text-ink"
          />
        </label>

        {showModeToggle && (
          <button
            type="button"
            onClick={() => updateParam('mode', mode === 'wrapped' ? 'thermal' : 'wrapped')}
            className="border border-rule px-3 py-1 font-mono text-xs uppercase tracking-label text-ink-soft hover:text-ink"
          >
            {mode === 'wrapped' ? 'Switch to thermal' : 'Switch to wrapped'}
          </button>
        )}

        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center gap-1 border border-ink bg-ink px-3 py-1 font-mono text-xs uppercase tracking-label text-paper hover:bg-ink-soft"
        >
          <Download className="h-3.5 w-3.5" strokeWidth={1.5} />
          Download PNG
        </button>
      </div>
    </div>
  );
}

function daysBetween(a: string, b: string) {
  const ta = new Date(a + 'T00:00:00Z').getTime();
  const tb = new Date(b + 'T00:00:00Z').getTime();
  return Math.abs(tb - ta) / (24 * 60 * 60 * 1000);
}
```

- [ ] **Step 3: Smoke test**

Run dev. Visit receipt page. Confirm date picker works (URL updates `?asOf=`), mode toggle pill appears near `endsAt`, Download PNG button visible.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/admin/receipt/receipt-toolbar.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(receipt): toolbar with as-of picker, mode toggle, PNG download"
```

---

## Phase 4 · Thermal Receipt view

### Task 12: Thermal primitives — paper, row, bar

**Files:**
- Create: `apps/web/components/admin/receipt/thermal-paper.tsx`
- Create: `apps/web/components/admin/receipt/thermal-row.tsx`
- Create: `apps/web/components/admin/receipt/thermal-bar.tsx`

- [ ] **Step 1: ThermalPaper wrapper**

```tsx
// apps/web/components/admin/receipt/thermal-paper.tsx
'use client';
import type { ReactNode } from 'react';

export function ThermalPaper({ children }: { children: ReactNode }) {
  return (
    <div className="relative mx-auto my-8" style={{ width: 720 }}>
      <div
        aria-hidden
        className="pointer-events-none absolute -left-3 top-0 flex h-full flex-col justify-between text-ink-faint"
        style={{ writingMode: 'vertical-rl' }}
      >
        {Array.from({ length: 40 }).map((_, i) => (<span key={i}>·</span>))}
      </div>
      <div
        aria-hidden
        className="pointer-events-none absolute -right-3 top-0 flex h-full flex-col justify-between text-ink-faint"
        style={{ writingMode: 'vertical-rl' }}
      >
        {Array.from({ length: 40 }).map((_, i) => (<span key={i}>·</span>))}
      </div>
      <div id="receipt-capture-root" className="bg-surface px-10 py-12 font-mono text-ink">
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: ThermalRow — leader-dot row**

```tsx
// apps/web/components/admin/receipt/thermal-row.tsx
'use client';

export function ThermalRow({ label, value }: { label: string; value: string }) {
  // Build the dotted leader by computing dots from the column width.
  const total = 44;
  const usable = Math.max(0, total - label.length - value.length - 2);
  const dots = '.'.repeat(usable);
  return (
    <div className="text-[13px] leading-6">
      <span>{label.toLowerCase()}</span>
      <span className="px-1 text-ink-faint">{dots}</span>
      <span>{value}</span>
    </div>
  );
}
```

- [ ] **Step 3: ThermalBar — unicode block bar**

```tsx
// apps/web/components/admin/receipt/thermal-bar.tsx
'use client';

const TOTAL = 12;
export function ThermalBar({ pct }: { pct: number }) {
  const filled = Math.max(0, Math.min(TOTAL, Math.round(pct * TOTAL)));
  const empty = TOTAL - filled;
  return <span className="font-mono">{'█'.repeat(filled)}{'░'.repeat(empty)}</span>;
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/admin/receipt/thermal-paper.tsx apps/web/components/admin/receipt/thermal-row.tsx apps/web/components/admin/receipt/thermal-bar.tsx
git commit -m "feat(receipt): thermal primitives (paper, row, bar)"
```

---

### Task 13: ThermalReceiptView assembly

**Files:**
- Modify: `apps/web/components/admin/receipt/thermal-receipt-view.tsx`

- [ ] **Step 1: Implement the full view**

```tsx
// apps/web/components/admin/receipt/thermal-receipt-view.tsx
'use client';
import type { CycleReceiptResponse } from '../../../lib/queries/admin-cycle-receipt';
import { ThermalPaper } from './thermal-paper';
import { ThermalRow } from './thermal-row';
import { ThermalBar } from './thermal-bar';
import { CohortKnowledgeGrid } from '../cohort-knowledge-grid';

const fmtHours = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
};
const fmtPct = (p: number) => `${Math.round(p * 100)}%`;
const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
};
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Sao_Paulo' });

const divider = '═══════════════════════════════════════════════════';
const dashed = '───────────────────────────────────────────────────';

export function ThermalReceiptView({ data }: { data: CycleReceiptResponse }) {
  const t = data.totals;
  const truncateTopic = (s: string) => (s.length > 22 ? s.slice(0, 21) + '…' : s);
  const topByTopic = data.byTopic.slice(0, 12);
  const remainingTopics = data.byTopic.length - topByTopic.length;
  const earlyInCycle = data.cycle.weekNumber <= 1 && data.totals.itemsCompleted < 5;

  return (
    <ThermalPaper>
      {earlyInCycle && (
        <div className="mb-4 border border-dashed border-ink-faint p-3 text-[11px] uppercase tracking-label text-ink-mute">
          early in the cycle — numbers will grow
        </div>
      )}

      <div className="text-center">
        <div className="text-2xl font-semibold tracking-wide">ICS · SELECT</div>
        <div className="mb-2 text-[11px] text-ink-soft">───────────────</div>
        <div className="text-sm uppercase tracking-wider">COHORT RECEIPT · {data.cycle.name.toUpperCase()}</div>
        <div className="mt-1 text-[11px] uppercase tracking-label text-ink-mute">
          {fmtDate(data.asOf)} · WK {data.cycle.weekNumber} of {data.cycle.weeksTotal} · {fmtTime(data.asOf)} BRT
        </div>
      </div>

      <div className="my-5 text-center text-ink-faint">{divider}</div>

      <ThermalRow label="members in cohort" value={String(t.members)} />
      <ThermalRow label="total hours studied" value={fmtHours(t.totalMinutes)} />
      <ThermalRow label="avg per member" value={fmtHours(t.avgMinutesPerMember)} />
      <ThermalRow label="items completed" value={String(t.itemsCompleted)} />
      <ThermalRow label="retros submitted" value={String(t.retros)} />
      <ThermalRow label="classes held" value={`${t.classesHeld} / ${t.classesTotal}`} />
      <ThermalRow label="attendance rate" value={fmtPct(t.attendanceRate)} />

      <div className="my-5 text-center text-ink-faint">{divider}</div>

      <div className="mb-1 text-sm uppercase tracking-wider">By topic</div>
      <div className="mb-3 text-ink-faint">{dashed}</div>
      {data.byTopic.length === 0 && (
        <div className="text-[12px] text-ink-mute">nothing studied yet</div>
      )}
      {topByTopic.map(b => (
        <div key={b.topicId} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-[13px] leading-6">
          <span>{truncateTopic(b.label.toLowerCase())}</span>
          <ThermalBar pct={b.coveragePct} />
          <span className="w-10 text-right">{fmtPct(b.coveragePct)}</span>
        </div>
      ))}
      {remainingTopics > 0 && (
        <div className="mt-1 text-[12px] text-ink-mute">+{remainingTopics} more topics</div>
      )}

      <div className="my-5 text-center text-ink-faint">{divider}</div>

      <div className="mb-1 text-sm uppercase tracking-wider">Knowledge grid</div>
      <div className="mb-3 text-ink-faint">{dashed}</div>
      <CohortKnowledgeGrid
        members={data.knowledgeGrid.members}
        topics={data.knowledgeGrid.topics}
        cells={data.knowledgeGrid.cells}
        variant="thermal"
      />

      {data.topMovers.length > 0 && (
        <>
          <div className="my-5 text-center text-ink-faint">{divider}</div>
          <div className="mb-1 text-sm uppercase tracking-wider">Top movers · last 7 days</div>
          <div className="mb-3 text-ink-faint">{dashed}</div>
          {data.topMovers.map(m => (
            <div key={m.userId} className="mb-2 text-[13px] leading-5">
              <div>▸ {m.name}     +{m.deltaItems} items</div>
              {m.topTopics.length > 0 && (
                <div className="pl-3 text-ink-mute">{m.topTopics.join(', ').toLowerCase()}</div>
              )}
            </div>
          ))}
        </>
      )}

      <div className="my-5 text-center text-ink-faint">{divider}</div>

      <div className="mb-1 text-sm uppercase tracking-wider">Hall of fame</div>
      <div className="mb-3 text-ink-faint">{dashed}</div>
      {data.streakChampion && (
        <div className="text-[13px] leading-5">
          streak champion   ▸ {data.streakChampion.name} · {data.streakChampion.streakDays}d
        </div>
      )}
      {data.retroChampions.length > 0 && (
        <div className="mt-2 text-[13px] leading-5">
          <div>retros            ▸ {data.retroChampions[0].name} · {data.retroChampions[0].retros}</div>
          {data.retroChampions.slice(1).map(c => (
            <div key={c.userId} className="pl-[18ch]">{c.name} · {c.retros}</div>
          ))}
        </div>
      )}
      {data.perfectAttendance.length > 0 && (
        <div className="mt-2 text-[13px] leading-5">
          perfect attend.   ▸ {data.perfectAttendance.map(m => m.name).join(', ')}
        </div>
      )}

      <div className="my-5 text-center text-ink-faint">{divider}</div>

      <div className="text-center text-[13px]">
        <div className="uppercase tracking-wider">Thank you for studying</div>
        <div className="mt-1 text-base">★ ★ ★ ★ ★</div>
        <div className="mt-3 text-ink-mute">─ keep going ─</div>
      </div>
    </ThermalPaper>
  );
}
```

- [ ] **Step 2: Visual test in browser**

Run `pnpm --filter @ics-select/web dev`. Visit the receipt page for an active cycle. Confirm:
- Header centered, perforations on sides
- Totals table aligned (dots between label and value)
- By Topic bars render
- Knowledge grid embedded
- Sections show/hide correctly based on data

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/admin/receipt/thermal-receipt-view.tsx
git commit -m "feat(receipt): thermal view assembly"
```

---

### Task 14: PNG download verification

**Files:** (no code changes — verification task)

- [ ] **Step 1: Test PNG download against real data**

In dev, load the receipt for an active cycle. Click `Download PNG`. Open the saved file. Verify:
- Receipt content present
- Toolbar NOT in the image
- Image width ≈1440px (720 × pixelRatio 2)
- Fonts render correctly (no fallback Times serifs)

- [ ] **Step 2: Common breakage — fonts**

If fonts fall back, the issue is `html-to-image` not having the fonts embedded. Fix by passing `fontEmbedCSS` option. Update `handleDownload` in toolbar:

```ts
import { toPng, getFontEmbedCSS } from 'html-to-image';
// ...
const fontCss = await getFontEmbedCSS(target);
const dataUrl = await toPng(target, { pixelRatio: 2, backgroundColor: '#FAFAF7', fontEmbedCSS: fontCss });
```

(Only apply this fix if step 1 reveals broken fonts.)

- [ ] **Step 3: Commit (if step 2 was needed)**

```bash
git add apps/web/components/admin/receipt/receipt-toolbar.tsx
git commit -m "fix(receipt): embed fonts in PNG export"
```

---

## Phase 5 · Wrapped mode

### Task 15: WrappedBlock primitive + gradients

**Files:**
- Create: `apps/web/components/admin/receipt/wrapped-block.tsx`

- [ ] **Step 1: Block component**

```tsx
// apps/web/components/admin/receipt/wrapped-block.tsx
'use client';
import type { ReactNode } from 'react';

export type WrappedGradient =
  | 'cover'        // purple → indigo
  | 'hours'        // terracotta → rose
  | 'topic'        // indigo → midnight
  | 'mover'        // gold → amber
  | 'grid'         // charcoal
  | 'fame'         // amber → orange
  | 'close';       // warm cream

const gradients: Record<WrappedGradient, string> = {
  cover: 'bg-gradient-to-br from-[#4C1D95] to-[#1E1B4B]',
  hours: 'bg-gradient-to-br from-[#C45D3A] to-[#9A1F47]',
  topic: 'bg-gradient-to-br from-[#3730A3] to-[#0F172A]',
  mover: 'bg-gradient-to-br from-[#D97706] to-[#92400E]',
  grid: 'bg-gradient-to-br from-[#1F2937] to-[#0B0F1A]',
  fame: 'bg-gradient-to-br from-[#F59E0B] to-[#C2410C]',
  close: 'bg-gradient-to-br from-[#FEF3C7] to-[#FAFAF7]',
};

const inkClasses: Record<WrappedGradient, string> = {
  cover: 'text-white',
  hours: 'text-white',
  topic: 'text-white',
  mover: 'text-white',
  grid: 'text-white',
  fame: 'text-white',
  close: 'text-ink',
};

export function WrappedBlock({
  gradient,
  children,
}: {
  gradient: WrappedGradient;
  children: ReactNode;
}) {
  return (
    <section className={`flex min-h-screen flex-col items-center justify-center px-8 py-16 ${gradients[gradient]} ${inkClasses[gradient]}`}>
      <div className="max-w-2xl text-center">{children}</div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/admin/receipt/wrapped-block.tsx
git commit -m "feat(receipt): WrappedBlock with seven gradients"
```

---

### Task 16: WrappedView assembly

**Files:**
- Modify: `apps/web/components/admin/receipt/wrapped-view.tsx`

- [ ] **Step 1: Implement the view**

```tsx
// apps/web/components/admin/receipt/wrapped-view.tsx
'use client';
import type { CycleReceiptResponse } from '../../../lib/queries/admin-cycle-receipt';
import { WrappedBlock } from './wrapped-block';
import { CohortKnowledgeGrid } from '../cohort-knowledge-grid';

const fmtHours = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export function WrappedView({ data }: { data: CycleReceiptResponse }) {
  const topTopic = [...data.byTopic].sort(
    (a, b) => b.membersReached - a.membersReached || b.itemsCompleted - a.itemsCompleted
  )[0];

  return (
    <div id="receipt-capture-root">
      <WrappedBlock gradient="cover">
        <div className="font-mono text-xs uppercase tracking-label opacity-70">
          {data.cycle.weeksTotal} weeks · {data.totals.members} minds
        </div>
        <h1 className="font-serif mt-6 text-[64px] leading-none font-semibold">{data.cycle.name}</h1>
        <div className="mt-4 font-mono text-xs uppercase tracking-label opacity-80">
          ended {fmtDate(data.cycle.endsAt)}
        </div>
      </WrappedBlock>

      <WrappedBlock gradient="hours">
        <div className="font-mono text-xs uppercase tracking-label opacity-80">together you studied</div>
        <div className="font-serif mt-6 text-[112px] leading-none font-semibold">{fmtHours(data.totals.totalMinutes)}</div>
        <div className="mt-6 font-mono text-sm opacity-90">that's roughly an entire work month each.</div>
      </WrappedBlock>

      {topTopic && (
        <WrappedBlock gradient="topic">
          <div className="font-mono text-xs uppercase tracking-label opacity-80">most-grokked topic</div>
          <div className="font-serif mt-6 text-[80px] leading-none font-semibold">{topTopic.label}</div>
          <div className="mt-6 font-mono text-sm opacity-90">
            {topTopic.membersReached} of {data.totals.members} reached it · {topTopic.itemsCompleted} items completed
          </div>
        </WrappedBlock>
      )}

      {data.cycleTopMover && (
        <WrappedBlock gradient="mover">
          <div className="font-mono text-xs uppercase tracking-label opacity-80">this cycle's mover</div>
          <div className="font-serif mt-6 text-[64px] leading-none font-semibold">{data.cycleTopMover.name}</div>
          <div className="mt-6 font-mono text-sm opacity-90">
            +{data.cycleTopMover.deltaItems} items · {data.cycleTopMover.topTopics.join(', ').toLowerCase()}
          </div>
        </WrappedBlock>
      )}

      <WrappedBlock gradient="grid">
        <div className="mb-4 font-mono text-xs uppercase tracking-label opacity-80">the cohort</div>
        <div className="flex justify-center">
          <CohortKnowledgeGrid
            members={data.knowledgeGrid.members}
            topics={data.knowledgeGrid.topics}
            cells={data.knowledgeGrid.cells}
            variant="inverted"
          />
        </div>
      </WrappedBlock>

      <WrappedBlock gradient="fame">
        <div className="font-mono text-xs uppercase tracking-label opacity-80 mb-8">hall of fame</div>
        <div className="space-y-6 text-left">
          {data.streakChampion && (
            <div>
              <div className="font-mono text-[11px] uppercase tracking-label opacity-70">streak</div>
              <div className="font-serif text-[40px] leading-none font-semibold">{data.streakChampion.name}</div>
              <div className="font-mono text-xs opacity-80">{data.streakChampion.streakDays} days</div>
            </div>
          )}
          {data.retroChampions[0] && (
            <div>
              <div className="font-mono text-[11px] uppercase tracking-label opacity-70">retros</div>
              <div className="font-serif text-[40px] leading-none font-semibold">{data.retroChampions[0].name}</div>
              <div className="font-mono text-xs opacity-80">{data.retroChampions[0].retros} submitted</div>
            </div>
          )}
          {data.perfectAttendance.length > 0 && (
            <div>
              <div className="font-mono text-[11px] uppercase tracking-label opacity-70">perfect attendance</div>
              <div className="font-serif text-[28px] leading-tight font-semibold">
                {data.perfectAttendance.map(m => m.name).join(', ')}
              </div>
            </div>
          )}
        </div>
      </WrappedBlock>

      <WrappedBlock gradient="close">
        <div className="font-mono text-xs uppercase tracking-label opacity-70">{data.cycle.name}</div>
        <div className="font-serif mt-6 text-[64px] leading-none font-semibold">closed</div>
        <div className="mt-8 text-2xl">★ ★ ★ ★ ★</div>
        <div className="mt-8 font-mono text-xs uppercase tracking-label opacity-70">see you in the next cycle</div>
      </WrappedBlock>
    </div>
  );
}
```

- [ ] **Step 2: Visual test**

Visit `/admin/cycle/<id>/receipt?mode=wrapped` for an active cycle. Confirm 7 blocks render top-to-bottom, gradients distinct, type scale dramatic. Try PNG download — confirm single tall PNG covers all blocks.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/admin/receipt/wrapped-view.tsx
git commit -m "feat(receipt): wrapped view — seven gradient blocks"
```

---

## Phase 6 · Integration & tests

### Task 17: Ticket stub on cycle overview

**Files:**
- Modify: `apps/web/components/admin/cycle/cycle-overview-view.tsx`

- [ ] **Step 1: Add Receipt icon import + the stub**

In `cycle-overview-view.tsx`, near the other lucide imports (search for existing `lucide-react` import or add one):

```tsx
import { Receipt } from 'lucide-react';
```

Modify the Members section:

```tsx
<section>
  <SectionLabel>Members</SectionLabel>
  <Link
    href={`/admin/cycle/${data.cycle.id}/receipt`}
    className="group mb-4 inline-flex items-center gap-2 border border-dashed border-rule px-3 py-1.5 font-mono text-xs uppercase tracking-label text-ink-soft hover:border-ink hover:text-ink"
  >
    <Receipt className="h-3.5 w-3.5" strokeWidth={1.5} />
    Receipt
    <span className="text-ink-faint group-hover:text-ink">→</span>
  </Link>
  <CycleMembersGrid members={data.members} />
</section>
```

If `cycle.status === 'UPCOMING'` and `startsAt > now`, render a disabled span instead:

```tsx
{(() => {
  const notStarted = data.cycle.status === 'UPCOMING' && new Date(data.cycle.startsAt) > new Date();
  return notStarted ? (
    <span
      className="mb-4 inline-flex items-center gap-2 border border-dashed border-rule px-3 py-1.5 font-mono text-xs uppercase tracking-label text-ink-faint"
      title="Cycle hasn't started yet"
    >
      <Receipt className="h-3.5 w-3.5" strokeWidth={1.5} />
      Receipt
    </span>
  ) : (
    <Link
      href={`/admin/cycle/${data.cycle.id}/receipt`}
      className="group mb-4 inline-flex items-center gap-2 border border-dashed border-rule px-3 py-1.5 font-mono text-xs uppercase tracking-label text-ink-soft hover:border-ink hover:text-ink"
    >
      <Receipt className="h-3.5 w-3.5" strokeWidth={1.5} />
      Receipt
      <span className="text-ink-faint group-hover:text-ink">→</span>
    </Link>
  );
})()}
```

- [ ] **Step 2: Smoke test**

Visit `/admin/cycle/[id]`. Confirm the Receipt ticket stub appears under the MEMBERS label, above the grid. Clicking navigates to the receipt route.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/admin/cycle/cycle-overview-view.tsx
git commit -m "feat(receipt): ticket-stub entry on cycle overview"
```

---

### Task 18: Playwright tests

**Files:**
- Create: `apps/web/tests/cycle-receipt.spec.ts`

- [ ] **Step 1: Look at existing playwright pattern**

Read `apps/web/tests/auth-flow.spec.ts` (or any existing test) to understand the fixture/mocking approach (msw-based or direct mocking of `apiFetch`). Match the pattern.

- [ ] **Step 2: Write the test**

```ts
// apps/web/tests/cycle-receipt.spec.ts
import { test, expect } from '@playwright/test';

const adminCookie = { /* match pattern from auth-flow.spec.ts */ };

test('navigates from cycle overview to receipt and renders thermal mode', async ({ page }) => {
  await page.goto('/admin/cycle/c1');  // assumes a seeded cycle in test DB
  await page.getByRole('link', { name: /receipt/i }).click();
  await expect(page).toHaveURL(/\/admin\/cycle\/c1\/receipt/);
  await expect(page.locator('#receipt-capture-root')).toBeVisible();
  await expect(page.getByText(/COHORT RECEIPT/)).toBeVisible();
});

test('date picker updates URL with asOf', async ({ page }) => {
  await page.goto('/admin/cycle/c1/receipt');
  const input = page.locator('input[type="date"]');
  await input.fill('2026-05-01');
  await page.waitForURL(/asOf=2026-05-01/);
});

test('wrapped mode renders gradient blocks when ?mode=wrapped', async ({ page }) => {
  await page.goto('/admin/cycle/c1/receipt?mode=wrapped');
  await expect(page.getByText(/together you studied/i)).toBeVisible();
  await expect(page.getByText(/hall of fame/i)).toBeVisible();
});

test('receipt page has no admin sidebar', async ({ page }) => {
  await page.goto('/admin/cycle/c1/receipt');
  // The Sidebar component renders a nav. Confirm absence.
  await expect(page.locator('nav[aria-label="Admin sidebar"]')).toHaveCount(0);
});
```

(Note: this assumes the test setup is wired against a seeded test database or has API mocks. Adjust based on the existing pattern in step 1.)

- [ ] **Step 3: Run**

Run: `pnpm --filter @ics-select/web test cycle-receipt.spec.ts`
Expected: 4/4 PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/tests/cycle-receipt.spec.ts
git commit -m "test(receipt): playwright coverage for routing and modes"
```

---

## Phase 7 · Final verification

### Task 19: End-to-end manual verification

(No code changes — pre-merge checklist.)

- [ ] Run `pnpm typecheck` — clean across api + web.
- [ ] Run `pnpm test` — all jest + vitest + playwright suites green.
- [ ] Run `pnpm build` — both `api` and `web` build.
- [ ] Open `/admin/cycle/<active-cycle>/` and click the Receipt ticket stub.
- [ ] Adjust `As of` date back 7 days; confirm numbers shrink.
- [ ] Adjust `As of` to `cycle.endsAt` (or close); confirm "Switch to wrapped" pill appears.
- [ ] Force `?mode=wrapped`; confirm 7 gradient blocks render.
- [ ] Click `Download PNG` on each mode; confirm file is a single tall image.
- [ ] Open the saved PNG in an image viewer; confirm fonts render correctly (no Times fallback).
- [ ] Visit `/admin/cycle/<upcoming-cycle>/`; confirm Receipt button is disabled with tooltip.
- [ ] Visit `/admin/cycle/<archived-cycle>/receipt`; confirm Wrapped renders by default.

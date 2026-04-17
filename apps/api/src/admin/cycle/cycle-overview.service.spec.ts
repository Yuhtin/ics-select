import { NotFoundException } from '@nestjs/common';
import { CycleOverviewService } from './cycle-overview.service';
import { PrismaService } from '../../common/prisma/prisma.service';

type PrismaMock = {
  cycle: { findUnique: jest.Mock };
  weeklyPlan: { findMany: jest.Mock };
  weeklyPlanItem: { findMany: jest.Mock };
};

function makePrisma(overrides: Partial<any> = {}): PrismaMock {
  const base: PrismaMock = {
    cycle: { findUnique: jest.fn(async () => null) },
    weeklyPlan: { findMany: jest.fn(async () => []) },
    weeklyPlanItem: { findMany: jest.fn(async () => []) },
  };
  for (const key of Object.keys(overrides) as (keyof PrismaMock)[]) {
    base[key] = { ...base[key], ...(overrides[key] as any) };
  }
  return base;
}

function makeService(prisma: PrismaMock): CycleOverviewService {
  return new CycleOverviewService(prisma as unknown as PrismaService);
}

// NOW: Friday 2026-04-17T12:00:00Z → this Monday = 2026-04-13 UTC.
const NOW = new Date('2026-04-17T12:00:00Z');
const THIS_MONDAY = new Date('2026-04-13T00:00:00.000Z');

const memberA = {
  userId: 'user-a',
  track: 'BIG_TECH',
  user: { id: 'user-a', name: 'Alice', pictureUrl: 'https://example.com/a.png' },
};
const memberB = {
  userId: 'user-b',
  track: null,
  user: { id: 'user-b', name: 'Bob', pictureUrl: null },
};

const baseCycle = {
  id: 'cycle-1',
  name: '2026.1',
  startsAt: new Date('2026-04-06T00:00:00.000Z'),
  endsAt: new Date('2026-06-29T00:00:00.000Z'), // ~12 weeks
  status: 'ACTIVE' as const,
  rankingVisibleToMembers: true,
  memberships: [] as any[],
};

describe('CycleOverviewService', () => {
  it('throws NotFoundException when cycle does not exist', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await expect(service.getOverview('missing', NOW)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns empty members and heatmap rows when cycle has no memberships', async () => {
    const prisma = makePrisma({
      cycle: {
        findUnique: jest.fn(async () => ({ ...baseCycle, memberships: [] })),
      },
    });
    const service = makeService(prisma);
    const result = await service.getOverview('cycle-1', NOW);

    expect(result.members).toEqual([]);
    expect(result.heatmap.rows).toEqual([]);
    expect(result.heatmap.weeks).toHaveLength(6);
    expect(result.cycle.id).toBe('cycle-1');
    expect(result.cycle.status).toBe('ACTIVE');
    expect(result.cycle.rankingVisibleToMembers).toBe(true);
    // When memberships are empty we do not bother issuing plan/item queries.
    expect(prisma.weeklyPlan.findMany).not.toHaveBeenCalled();
    expect(prisma.weeklyPlanItem.findMany).not.toHaveBeenCalled();
  });

  it('computes percentThisWeek from current week PUBLISHED plan (2 of 4 → 50%)', async () => {
    const prisma = makePrisma({
      cycle: {
        findUnique: jest.fn(async () => ({
          ...baseCycle,
          memberships: [memberA],
        })),
      },
      weeklyPlan: {
        findMany: jest.fn(async () => [
          {
            id: 'plan-a',
            userId: 'user-a',
            weekStart: THIS_MONDAY,
            items: [
              { outcome: 'DONE_EASY', completedAt: new Date('2026-04-14T10:00:00Z'), weeklyPlanId: 'plan-a' },
              { outcome: 'DONE_HARD', completedAt: new Date('2026-04-15T10:00:00Z'), weeklyPlanId: 'plan-a' },
              { outcome: 'PENDING', completedAt: null, weeklyPlanId: 'plan-a' },
              { outcome: 'DOUBTS', completedAt: new Date('2026-04-16T10:00:00Z'), weeklyPlanId: 'plan-a' },
            ],
          },
        ]),
      },
    });
    const service = makeService(prisma);
    const result = await service.getOverview('cycle-1', NOW);

    expect(result.members).toHaveLength(1);
    const alice = result.members[0]!;
    expect(alice.userId).toBe('user-a');
    expect(alice.track).toBe('BIG_TECH');
    expect(alice.done).toBe(2);
    expect(alice.total).toBe(4);
    expect(alice.percentThisWeek).toBe(50);
    expect(alice.hasAlert).toBe(false);
  });

  it('builds a 6-week heatmap: oldest week first, cells 0..100, most recent holds positive%', async () => {
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    // Plan in oldest week (index 0) and current week (index 5).
    const oldestStart = new Date(THIS_MONDAY.getTime() - 5 * WEEK_MS);
    const prisma = makePrisma({
      cycle: {
        findUnique: jest.fn(async () => ({
          ...baseCycle,
          memberships: [memberA],
        })),
      },
      weeklyPlan: {
        findMany: jest.fn(async () => [
          {
            id: 'plan-oldest',
            userId: 'user-a',
            weekStart: oldestStart,
            items: [
              { outcome: 'DONE_EASY', completedAt: oldestStart, weeklyPlanId: 'plan-oldest' },
              { outcome: 'PENDING', completedAt: null, weeklyPlanId: 'plan-oldest' },
            ],
          },
          {
            id: 'plan-current',
            userId: 'user-a',
            weekStart: THIS_MONDAY,
            items: [
              { outcome: 'DONE_HARD', completedAt: new Date('2026-04-15T10:00:00Z'), weeklyPlanId: 'plan-current' },
              { outcome: 'DONE_EASY', completedAt: new Date('2026-04-16T10:00:00Z'), weeklyPlanId: 'plan-current' },
              { outcome: 'DONE_EASY', completedAt: new Date('2026-04-17T10:00:00Z'), weeklyPlanId: 'plan-current' },
              { outcome: 'PENDING', completedAt: null, weeklyPlanId: 'plan-current' },
            ],
          },
        ]),
      },
    });
    const service = makeService(prisma);
    const result = await service.getOverview('cycle-1', NOW);

    expect(result.heatmap.weeks).toHaveLength(6);
    expect(result.heatmap.weeks[0]!.index).toBe(0);
    expect(result.heatmap.weeks[5]!.index).toBe(5);
    // Oldest week Monday is 5 weeks before THIS_MONDAY (2026-03-09).
    expect(result.heatmap.weeks[0]!.startsAt).toBe(oldestStart.toISOString());
    expect(result.heatmap.weeks[5]!.startsAt).toBe(THIS_MONDAY.toISOString());
    // Label is "Mon D" UTC — e.g. "Mar 9" for oldest, "Apr 13" for current.
    expect(result.heatmap.weeks[0]!.label).toMatch(/Mar/);
    expect(result.heatmap.weeks[5]!.label).toMatch(/Apr/);

    expect(result.heatmap.rows).toHaveLength(1);
    const row = result.heatmap.rows[0]!;
    expect(row.cells).toHaveLength(6);
    // Index 0: 1 of 2 positive → 50.
    expect(row.cells[0]).toBe(50);
    // Indexes 1..4: no plan → 0.
    expect(row.cells.slice(1, 5)).toEqual([0, 0, 0, 0]);
    // Index 5: 3 of 4 positive → 75.
    expect(row.cells[5]).toBe(75);
    for (const cell of row.cells) {
      expect(cell).toBeGreaterThanOrEqual(0);
      expect(cell).toBeLessThanOrEqual(100);
    }
  });

  it('sets hasAlert=true when member has STUCK in last 72h; false otherwise', async () => {
    const prisma = makePrisma({
      cycle: {
        findUnique: jest.fn(async () => ({
          ...baseCycle,
          memberships: [memberA, memberB],
        })),
      },
      weeklyPlanItem: {
        findMany: jest.fn(async () => [
          { weeklyPlan: { userId: 'user-a' } },
        ]),
      },
    });
    const service = makeService(prisma);
    const result = await service.getOverview('cycle-1', NOW);

    const alice = result.members.find((m) => m.userId === 'user-a')!;
    const bob = result.members.find((m) => m.userId === 'user-b')!;
    expect(alice.hasAlert).toBe(true);
    expect(bob.hasAlert).toBe(false);
  });

  it('computes weekNumber and weeksTotal for a 12-week cycle in week 4', async () => {
    // NOW = 2026-04-17. Cycle start 2026-03-23 (Mon, 25 days before NOW UTC).
    // elapsed = ~25.5 days → ceil((elapsed+1)/7d) = 4.
    // End 2026-06-15 (12 weeks from start).
    const cycle12 = {
      ...baseCycle,
      startsAt: new Date('2026-03-23T00:00:00.000Z'),
      endsAt: new Date('2026-06-15T00:00:00.000Z'),
      memberships: [memberA],
    };
    const prisma = makePrisma({
      cycle: { findUnique: jest.fn(async () => cycle12) },
    });
    const service = makeService(prisma);
    const result = await service.getOverview('cycle-1', NOW);
    expect(result.cycle.weeksTotal).toBe(12);
    expect(result.cycle.weekNumber).toBe(4);
  });

  it('caps weekNumber at weeksTotal when now is past cycle end', async () => {
    const cycle = {
      ...baseCycle,
      startsAt: new Date('2026-01-05T00:00:00.000Z'),
      endsAt: new Date('2026-03-30T00:00:00.000Z'), // ended before NOW
      memberships: [memberA],
    };
    const prisma = makePrisma({
      cycle: { findUnique: jest.fn(async () => cycle) },
    });
    const service = makeService(prisma);
    const result = await service.getOverview('cycle-1', NOW);
    expect(result.cycle.weekNumber).toBe(result.cycle.weeksTotal);
  });
});

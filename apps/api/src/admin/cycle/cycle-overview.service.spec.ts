import { NotFoundException } from '@nestjs/common';
import { CycleOverviewService } from './cycle-overview.service';
import { PrismaService } from '../../common/prisma/prisma.service';

type PrismaMock = {
  cycle: { findUnique: jest.Mock };
  weeklyPlan: { findMany: jest.Mock };
  weeklyPlanItem: { findMany: jest.Mock };
  weeklyRetro: { findMany: jest.Mock };
  memberAvailability: { findMany: jest.Mock };
  $queryRawUnsafe: jest.Mock;
};

function makePrisma(overrides: Partial<any> = {}): PrismaMock {
  const base: PrismaMock = {
    cycle: { findUnique: jest.fn(async () => null) },
    weeklyPlan: { findMany: jest.fn(async () => []) },
    weeklyPlanItem: { findMany: jest.fn(async () => []) },
    weeklyRetro: { findMany: jest.fn(async () => []) },
    memberAvailability: { findMany: jest.fn(async () => []) },
    $queryRawUnsafe: jest.fn(async () => []) as any,
  };
  for (const key of Object.keys(overrides) as (keyof PrismaMock)[]) {
    if (key === '$queryRawUnsafe') {
      (base as any)[key] = (overrides as any)[key];
    } else {
      base[key] = { ...base[key], ...(overrides[key] as any) };
    }
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
    // baseCycle = 2026-04-06 (Mon) → 2026-06-29 (Mon): 12 full weeks + 1 inclusive = 13.
    expect(result.heatmap.weeks).toHaveLength(13);
    expect(result.cycle.id).toBe('cycle-1');
    expect(result.cycle.status).toBe('ACTIVE');
    expect(result.cycle.rankingVisibleToMembers).toBe(true);
    // When memberships are empty we do not bother issuing plan/item/retro queries.
    expect(prisma.weeklyPlan.findMany).not.toHaveBeenCalled();
    expect(prisma.weeklyPlanItem.findMany).not.toHaveBeenCalled();
    expect(prisma.weeklyRetro.findMany).not.toHaveBeenCalled();
    expect(result.feed).toEqual([]);
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
              { outcome: 'DONE_EASY', completedAt: new Date('2026-04-14T10:00:00Z'), weeklyPlanId: 'plan-a', libraryItem: { estimatedMinutes: 30 } },
              { outcome: 'DONE_HARD', completedAt: new Date('2026-04-15T10:00:00Z'), weeklyPlanId: 'plan-a', libraryItem: { estimatedMinutes: 30 } },
              { outcome: 'PENDING', completedAt: null, weeklyPlanId: 'plan-a', libraryItem: { estimatedMinutes: 30 } },
              { outcome: 'DOUBTS', completedAt: new Date('2026-04-16T10:00:00Z'), weeklyPlanId: 'plan-a', libraryItem: { estimatedMinutes: 30 } },
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
    // DOUBTS counts as done — the study was attempted to completion.
    expect(alice.done).toBe(3);
    expect(alice.total).toBe(4);
    expect(alice.percentThisWeek).toBe(75);
    expect(alice.hasAlert).toBe(false);
  });

  it('builds an all-cycle-weeks heatmap: index 0 = cycle week 0, cells hold positive%', async () => {
    // baseCycle: 2026-04-06 Mon (week 0) → 2026-06-29 Mon (week 12). 13 weeks total.
    // THIS_MONDAY (NOW's week) = 2026-04-13 → week index 1 of the cycle.
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const week0Start = new Date('2026-04-06T00:00:00.000Z');
    const week1Start = new Date(week0Start.getTime() + 1 * WEEK_MS); // 2026-04-13
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
            id: 'plan-w0',
            userId: 'user-a',
            weekStart: week0Start,
            items: [
              { outcome: 'DONE_EASY', completedAt: week0Start, weeklyPlanId: 'plan-w0', libraryItem: { estimatedMinutes: 30 } },
              { outcome: 'PENDING', completedAt: null, weeklyPlanId: 'plan-w0', libraryItem: { estimatedMinutes: 30 } },
            ],
          },
          {
            id: 'plan-w1',
            userId: 'user-a',
            weekStart: week1Start,
            items: [
              { outcome: 'DONE_HARD', completedAt: new Date('2026-04-15T10:00:00Z'), weeklyPlanId: 'plan-w1', libraryItem: { estimatedMinutes: 30 } },
              { outcome: 'DONE_EASY', completedAt: new Date('2026-04-16T10:00:00Z'), weeklyPlanId: 'plan-w1', libraryItem: { estimatedMinutes: 30 } },
              { outcome: 'DONE_EASY', completedAt: new Date('2026-04-17T10:00:00Z'), weeklyPlanId: 'plan-w1', libraryItem: { estimatedMinutes: 30 } },
              { outcome: 'PENDING', completedAt: null, weeklyPlanId: 'plan-w1', libraryItem: { estimatedMinutes: 30 } },
            ],
          },
        ]),
      },
    });
    const service = makeService(prisma);
    const result = await service.getOverview('cycle-1', NOW);

    expect(result.heatmap.weeks).toHaveLength(13);
    expect(result.heatmap.weeks[0]!.index).toBe(0);
    expect(result.heatmap.weeks[12]!.index).toBe(12);
    expect(result.heatmap.weeks[0]!.startsAt).toBe(week0Start.toISOString());
    expect(result.heatmap.weeks[1]!.startsAt).toBe(week1Start.toISOString());

    expect(result.heatmap.rows).toHaveLength(1);
    const row = result.heatmap.rows[0]!;
    expect(row.cells).toHaveLength(13);
    // Week 0: 1 of 2 positive → 50.
    expect(row.cells[0]).toBe(50);
    // Week 1 (current): 3 of 4 positive → 75.
    expect(row.cells[1]).toBe(75);
    // All other weeks: no plan → 0.
    expect(row.cells.slice(2)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
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

  it('returns availability stats per member (allocated minutes vs declared budget)', async () => {
    const prisma = makePrisma({
      cycle: {
        findUnique: jest.fn(async () => ({
          ...baseCycle,
          memberships: [memberA, memberB],
        })),
      },
      weeklyPlan: {
        findMany: jest.fn(async () => [
          {
            id: 'plan-a',
            userId: 'user-a',
            weekStart: THIS_MONDAY,
            items: [
              // 30 + 30 + 30 = 90 allocated min (SKIPPED excluded).
              { outcome: 'DONE_EASY', completedAt: new Date(), weeklyPlanId: 'plan-a', libraryItem: { estimatedMinutes: 30 } },
              { outcome: 'PENDING', completedAt: null, weeklyPlanId: 'plan-a', libraryItem: { estimatedMinutes: 30 } },
              { outcome: 'PENDING', completedAt: null, weeklyPlanId: 'plan-a', libraryItem: { estimatedMinutes: 30 } },
            ],
          },
        ]),
      },
      memberAvailability: {
        findMany: jest.fn(async () => [
          {
            userId: 'user-a',
            mondayMinutes: 60,
            tuesdayMinutes: 60,
            wednesdayMinutes: 60,
            thursdayMinutes: 60,
            fridayMinutes: 60,
            saturdayMinutes: 0,
            sundayMinutes: 0,
          },
        ]),
      },
    });
    const service = makeService(prisma);
    const result = await service.getOverview('cycle-1', NOW);

    const alice = result.members.find((m) => m.userId === 'user-a')!;
    expect(alice.availability).toEqual({
      itemsCount: 3,
      plannedMinutes: 90,
      budgetMinutes: 300,
    });
    // Bob has no plan and no availability row → defaults to DEFAULT_AVAILABILITY budget (300).
    const bob = result.members.find((m) => m.userId === 'user-b')!;
    expect(bob.availability).toEqual({
      itemsCount: 0,
      plannedMinutes: 0,
      budgetMinutes: 300,
    });
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

  it('returns engagement ranking ordered by score with breakdown and alert flag', async () => {
    const prisma = makePrisma({
      cycle: {
        findUnique: jest.fn(async () => ({
          ...baseCycle,
          memberships: [memberA, memberB],
        })),
      },
      weeklyPlanItem: {
        findMany: jest.fn(async () => [
          { weeklyPlan: { userId: 'user-a' } }, // STUCK proxy → alert
        ]),
      },
      $queryRawUnsafe: jest.fn(async () => [
        {
          userId: 'user-a',
          daysActive: 10,
          itemsDone: 12,
          itemsPlanned: 12,
          retrosSubmitted: 2,
          daysSinceLastSession: 1,
        },
        {
          userId: 'user-b',
          daysActive: 2,
          itemsDone: 1,
          itemsPlanned: 12,
          retrosSubmitted: 0,
          daysSinceLastSession: 10,
        },
      ]),
    });
    const service = makeService(prisma);
    const result = await service.getOverview('cycle-1', NOW);

    expect(result.ranking).toHaveLength(2);
    expect(result.ranking[0]!.userId).toBe('user-a');
    expect(result.ranking[1]!.userId).toBe('user-b');
    expect(result.ranking[0]!.score).toBeGreaterThan(result.ranking[1]!.score);
    expect(result.ranking[0]!.breakdown).toHaveLength(6);
    expect(result.ranking[0]!.hasAlert).toBe(true);
    expect(result.ranking[1]!.hasAlert).toBe(false);
  });

  it('returns empty ranking when cohort has no memberships', async () => {
    const prisma = makePrisma({
      cycle: {
        findUnique: jest.fn(async () => ({ ...baseCycle, memberships: [] })),
      },
    });
    const service = makeService(prisma);
    const result = await service.getOverview('cycle-1', NOW);
    expect(result.ranking).toEqual([]);
  });
});

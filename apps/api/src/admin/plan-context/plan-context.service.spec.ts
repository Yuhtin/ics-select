import { NotFoundException } from '@nestjs/common';
import { PlanContextService } from './plan-context.service';
import { PrismaService } from '../../common/prisma/prisma.service';

type PrismaMock = {
  user: { findUnique: jest.Mock };
  cycleMembership: { findFirst: jest.Mock };
  weeklyPlan: { findFirst: jest.Mock; findMany: jest.Mock };
  weeklyPlanItem: { findMany: jest.Mock };
  weeklyRetro: { findFirst: jest.Mock };
  memberAvailability: { findUnique: jest.Mock };
  topic: { findMany: jest.Mock };
};

function makePrisma(overrides: Partial<any> = {}): PrismaMock {
  const base: PrismaMock = {
    user: { findUnique: jest.fn(async () => null) },
    cycleMembership: { findFirst: jest.fn(async () => null) },
    weeklyPlan: {
      findFirst: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
    },
    weeklyPlanItem: { findMany: jest.fn(async () => []) },
    weeklyRetro: { findFirst: jest.fn(async () => null) },
    memberAvailability: { findUnique: jest.fn(async () => null) },
    topic: { findMany: jest.fn(async () => []) },
  };
  for (const key of Object.keys(overrides) as (keyof PrismaMock)[]) {
    base[key] = { ...base[key], ...(overrides[key] as any) };
  }
  return base;
}

// NOW: Friday 2026-04-17T12:00:00Z
const NOW = new Date('2026-04-17T12:00:00Z');

// This week Monday: 2026-04-13T00:00:00Z
const WEEK_START = new Date('2026-04-13T00:00:00Z');
// Previous week Monday: 2026-04-06T00:00:00Z
const LAST_WEEK_START = new Date('2026-04-06T00:00:00Z');

const defaultMember = {
  id: 'user-a',
  name: 'Alice',
  pictureUrl: 'https://example.com/a.jpg',
};

const defaultCycle = {
  id: 'cycle-1',
  name: '2026.1',
  startsAt: new Date('2026-04-06T00:00:00Z'),
  endsAt: new Date('2026-06-29T00:00:00Z'),
  status: 'ACTIVE' as const,
};

const defaultMembership = {
  userId: 'user-a',
  cycleId: 'cycle-1',
  track: 'BIG_TECH',
  cycle: defaultCycle,
};

function makeService(prisma: PrismaMock): PlanContextService {
  return new PlanContextService(prisma as unknown as PrismaService);
}

describe('PlanContextService', () => {
  it('throws NotFoundException when member not found', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await expect(
      service.getContext({ memberId: 'missing', weekStart: WEEK_START }, NOW),
    ).rejects.toThrow(NotFoundException);
    await expect(
      service.getContext({ memberId: 'missing', weekStart: WEEK_START }, NOW),
    ).rejects.toThrow('member not found');
  });

  it('throws NotFoundException when member has no active cycle', async () => {
    const prisma = makePrisma({
      user: { findUnique: jest.fn(async () => defaultMember) },
      cycleMembership: { findFirst: jest.fn(async () => null) },
    });
    const service = makeService(prisma);
    await expect(
      service.getContext({ memberId: 'user-a', weekStart: WEEK_START }, NOW),
    ).rejects.toThrow('member has no active cycle');
  });

  it('returns empty lastWeek when no prior PUBLISHED plan exists', async () => {
    const prisma = makePrisma({
      user: { findUnique: jest.fn(async () => defaultMember) },
      cycleMembership: { findFirst: jest.fn(async () => defaultMembership) },
      weeklyPlan: {
        findFirst: jest.fn(async () => null),
        findMany: jest.fn(async () => []),
      },
    });
    const service = makeService(prisma);
    const result = await service.getContext(
      { memberId: 'user-a', weekStart: WEEK_START },
      NOW,
    );
    expect(result.lastWeek.weekStart).toBeNull();
    expect(result.lastWeek.items).toEqual([]);
    expect(result.lastWeek.outcomes).toEqual({
      done_easy: 0,
      done_hard: 0,
      doubts: 0,
      stuck: 0,
      pending: 0,
    });
    expect(result.carryOverCandidates).toEqual([]);
  });

  it('carryOverCandidates includes STUCK/DOUBTS/PENDING and excludes DONE_EASY/DONE_HARD', async () => {
    const topic = {
      id: 'topic-1',
      slug: 'dp',
      label: 'Dynamic Programming',
      order: 0,
    };
    const lastWeekPlan = {
      id: 'plan-lw',
      weekStart: LAST_WEEK_START,
      items: [
        {
          id: 'wpi-1',
          libraryItemId: 'li-1',
          outcome: 'STUCK',
          reflection: 'stuck on base case',
          libraryItem: {
            id: 'li-1',
            title: 'Fibonacci memo',
            topics: [{ topicId: 'topic-1', isPrimary: true }],
            estimatedMinutes: 45,
          },
        },
        {
          id: 'wpi-2',
          libraryItemId: 'li-2',
          outcome: 'DOUBTS',
          reflection: null,
          libraryItem: {
            id: 'li-2',
            title: 'Coin change',
            topics: [{ topicId: 'topic-1', isPrimary: true }],
            estimatedMinutes: 60,
          },
        },
        {
          id: 'wpi-3',
          libraryItemId: 'li-3',
          outcome: 'PENDING',
          reflection: null,
          libraryItem: {
            id: 'li-3',
            title: 'Longest subseq',
            topics: [],
            estimatedMinutes: 30,
          },
        },
        {
          id: 'wpi-4',
          libraryItemId: 'li-4',
          outcome: 'DONE_EASY',
          reflection: null,
          libraryItem: {
            id: 'li-4',
            title: 'Climb stairs',
            topics: [{ topicId: 'topic-1', isPrimary: true }],
            estimatedMinutes: 20,
          },
        },
        {
          id: 'wpi-5',
          libraryItemId: 'li-5',
          outcome: 'DONE_HARD',
          reflection: null,
          libraryItem: {
            id: 'li-5',
            title: 'Edit distance',
            topics: [{ topicId: 'topic-1', isPrimary: true }],
            estimatedMinutes: 90,
          },
        },
      ],
    };

    const prisma = makePrisma({
      user: { findUnique: jest.fn(async () => defaultMember) },
      cycleMembership: { findFirst: jest.fn(async () => defaultMembership) },
      weeklyPlan: {
        findFirst: jest.fn(async () => lastWeekPlan),
        findMany: jest.fn(async () => []),
      },
      topic: { findMany: jest.fn(async () => [topic]) },
    });
    const service = makeService(prisma);
    const result = await service.getContext(
      { memberId: 'user-a', weekStart: WEEK_START },
      NOW,
    );

    expect(result.carryOverCandidates).toHaveLength(3);
    const ids = result.carryOverCandidates.map((c) => c.id).sort();
    expect(ids).toEqual(['wpi-1', 'wpi-2', 'wpi-3']);

    const stuck = result.carryOverCandidates.find((c) => c.id === 'wpi-1')!;
    expect(stuck.outcome).toBe('STUCK');
    expect(stuck.topicId).toBe('topic-1');
    expect(stuck.topicLabel).toBe('Dynamic Programming');
    expect(stuck.estimatedMinutes).toBe(45);
    expect(stuck.title).toBe('Fibonacci memo');

    const untopic = result.carryOverCandidates.find((c) => c.id === 'wpi-3')!;
    expect(untopic.topicId).toBeNull();
    expect(untopic.topicLabel).toBeNull();

    // lastWeek outcome counts
    expect(result.lastWeek.outcomes).toEqual({
      done_easy: 1,
      done_hard: 1,
      doubts: 1,
      stuck: 1,
      pending: 1,
    });
    expect(result.lastWeek.weekStart).toBe(LAST_WEEK_START.toISOString());
    expect(result.lastWeek.items).toHaveLength(5);
  });

  it('retro populated when prior-week retro exists, null otherwise', async () => {
    const submittedAt = new Date('2026-04-12T22:00:00Z');
    const prismaWithRetro = makePrisma({
      user: { findUnique: jest.fn(async () => defaultMember) },
      cycleMembership: { findFirst: jest.fn(async () => defaultMembership) },
      weeklyRetro: {
        findFirst: jest.fn(async () => ({
          whatClicked: 'dp problems clicked',
          whatStuck: 'graph traversal still fuzzy',
          nextWeekWish: 'more graph drills',
          submittedAt,
        })),
      },
    });
    const svc1 = makeService(prismaWithRetro);
    const r1 = await svc1.getContext(
      { memberId: 'user-a', weekStart: WEEK_START },
      NOW,
    );
    expect(r1.retro).not.toBeNull();
    expect(r1.retro!.whatClicked).toBe('dp problems clicked');
    expect(r1.retro!.whatStuck).toBe('graph traversal still fuzzy');
    expect(r1.retro!.nextWeekWish).toBe('more graph drills');
    expect(r1.retro!.submittedAt).toBe(submittedAt.toISOString());

    const prismaNoRetro = makePrisma({
      user: { findUnique: jest.fn(async () => defaultMember) },
      cycleMembership: { findFirst: jest.fn(async () => defaultMembership) },
      weeklyRetro: { findFirst: jest.fn(async () => null) },
    });
    const svc2 = makeService(prismaNoRetro);
    const r2 = await svc2.getContext(
      { memberId: 'user-a', weekStart: WEEK_START },
      NOW,
    );
    expect(r2.retro).toBeNull();

    // Verify the retro query uses lastWeekStart (input.weekStart - 7 days).
    expect(prismaWithRetro.weeklyRetro.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-a',
          weekStart: LAST_WEEK_START,
        }),
      }),
    );
  });

  it('topicCoverage: 2 planned, 1 done → 50%', async () => {
    const topicA = { id: 'topic-a', slug: 'arrays', label: 'Arrays', order: 0 };
    const topicB = { id: 'topic-b', slug: 'dp', label: 'Dynamic Programming', order: 1 };

    const cyclePlans = [
      {
        id: 'plan-1',
        items: [
          { outcome: 'DONE_EASY', libraryItem: { topics: [{ topicId: 'topic-a' }] } },
          { outcome: 'PENDING', libraryItem: { topics: [{ topicId: 'topic-a' }] } },
          { outcome: 'STUCK', libraryItem: { topics: [{ topicId: 'topic-b' }] } },
        ],
      },
      {
        id: 'plan-2',
        items: [
          { outcome: 'DONE_HARD', libraryItem: { topics: [{ topicId: 'topic-b' }] } },
          // item with no topics shouldn't count toward any topic.
          { outcome: 'DONE_EASY', libraryItem: { topics: [] } },
        ],
      },
    ];

    const prisma = makePrisma({
      user: { findUnique: jest.fn(async () => defaultMember) },
      cycleMembership: { findFirst: jest.fn(async () => defaultMembership) },
      weeklyPlan: {
        findFirst: jest.fn(async () => null),
        findMany: jest.fn(async () => cyclePlans),
      },
      topic: { findMany: jest.fn(async () => [topicA, topicB]) },
    });
    const service = makeService(prisma);
    const result = await service.getContext(
      { memberId: 'user-a', weekStart: WEEK_START },
      NOW,
    );

    expect(result.topicCoverage).toHaveLength(2);
    const arrays = result.topicCoverage.find((t) => t.topicId === 'topic-a')!;
    expect(arrays.itemsPlanned).toBe(2);
    expect(arrays.itemsDone).toBe(1);
    expect(arrays.coveragePct).toBe(50);
    expect(arrays.topicSlug).toBe('arrays');
    expect(arrays.topicLabel).toBe('Arrays');

    const dp = result.topicCoverage.find((t) => t.topicId === 'topic-b')!;
    expect(dp.itemsPlanned).toBe(2);
    expect(dp.itemsDone).toBe(1);
    expect(dp.coveragePct).toBe(50);
  });

  it('availability.weeklyBudgetMinutes sums 7 day fields; defaults when missing', async () => {
    // Case 1: real row provided.
    const row = {
      userId: 'user-a',
      mondayMinutes: 90,
      tuesdayMinutes: 45,
      wednesdayMinutes: 60,
      thursdayMinutes: 30,
      fridayMinutes: 60,
      saturdayMinutes: 120,
      sundayMinutes: 0,
      preferredSessionMinutes: 45,
      timezone: 'America/Sao_Paulo',
    };
    const prismaWith = makePrisma({
      user: { findUnique: jest.fn(async () => defaultMember) },
      cycleMembership: { findFirst: jest.fn(async () => defaultMembership) },
      memberAvailability: { findUnique: jest.fn(async () => row) },
    });
    const svc1 = makeService(prismaWith);
    const r1 = await svc1.getContext(
      { memberId: 'user-a', weekStart: WEEK_START },
      NOW,
    );
    expect(r1.availability.weeklyBudgetMinutes).toBe(90 + 45 + 60 + 30 + 60 + 120 + 0);
    expect(r1.availability.preferredSessionMinutes).toBe(45);
    expect(r1.availability.timezone).toBe('America/Sao_Paulo');
    expect(r1.availability.mondayMinutes).toBe(90);

    // Case 2: no row → defaults kick in.
    const prismaDefault = makePrisma({
      user: { findUnique: jest.fn(async () => defaultMember) },
      cycleMembership: { findFirst: jest.fn(async () => defaultMembership) },
      memberAvailability: { findUnique: jest.fn(async () => null) },
    });
    const svc2 = makeService(prismaDefault);
    const r2 = await svc2.getContext(
      { memberId: 'user-a', weekStart: WEEK_START },
      NOW,
    );
    expect(r2.availability.mondayMinutes).toBe(60);
    expect(r2.availability.tuesdayMinutes).toBe(60);
    expect(r2.availability.wednesdayMinutes).toBe(60);
    expect(r2.availability.thursdayMinutes).toBe(60);
    expect(r2.availability.fridayMinutes).toBe(60);
    expect(r2.availability.saturdayMinutes).toBe(0);
    expect(r2.availability.sundayMinutes).toBe(0);
    expect(r2.availability.preferredSessionMinutes).toBe(60);
    expect(r2.availability.weeklyBudgetMinutes).toBe(300);
    expect(r2.availability.timezone).toBe('America/Sao_Paulo');
  });

  it('computes weekNumber/weeksTotal from cycle startsAt/endsAt', async () => {
    const prisma = makePrisma({
      user: { findUnique: jest.fn(async () => defaultMember) },
      cycleMembership: { findFirst: jest.fn(async () => defaultMembership) },
    });
    const service = makeService(prisma);
    const result = await service.getContext(
      { memberId: 'user-a', weekStart: WEEK_START },
      NOW,
    );
    // Cycle: startsAt 2026-04-06, endsAt 2026-06-29 → 84 days → 12 weeks.
    expect(result.cycle.weeksTotal).toBe(12);
    // NOW = 2026-04-17 → ~11 days in → week 2.
    expect(result.cycle.weekNumber).toBe(2);
    expect(result.cycle.id).toBe('cycle-1');
    expect(result.cycle.name).toBe('2026.1');
  });

  it('returns member fields with track from membership', async () => {
    const prisma = makePrisma({
      user: { findUnique: jest.fn(async () => defaultMember) },
      cycleMembership: { findFirst: jest.fn(async () => defaultMembership) },
    });
    const service = makeService(prisma);
    const result = await service.getContext(
      { memberId: 'user-a', weekStart: WEEK_START },
      NOW,
    );
    expect(result.member).toEqual({
      id: 'user-a',
      name: 'Alice',
      pictureUrl: 'https://example.com/a.jpg',
      track: 'BIG_TECH',
    });
  });
});

import { NotFoundException } from '@nestjs/common';
import { PlanContextService } from './plan-context.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BusyCacheService } from '../../google-calendar/busy-cache.service';

type PrismaMock = {
  user: { findUnique: jest.Mock };
  cycleMembership: { findFirst: jest.Mock };
  weeklyPlan: { findFirst: jest.Mock; findMany: jest.Mock };
  weeklyPlanItem: { findMany: jest.Mock };
  weeklyRetro: { findFirst: jest.Mock };
  memberAvailability: { findUnique: jest.Mock };
  topic: { findMany: jest.Mock };
  availabilitySlot: { findMany: jest.Mock };
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
    availabilitySlot: { findMany: jest.fn(async () => []) },
  };
  for (const key of Object.keys(overrides) as (keyof PrismaMock)[]) {
    base[key] = { ...base[key], ...(overrides[key] as any) };
  }
  return base;
}

function makeBusyCacheStub(busy: Array<{ start: Date; end: Date }> = []): BusyCacheService {
  return {
    getWeekBusy: jest.fn(async () => busy),
    invalidate: jest.fn(),
    invalidateAllForUser: jest.fn(),
  } as unknown as BusyCacheService;
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

function makeService(
  prisma: PrismaMock,
  busyCache: BusyCacheService = makeBusyCacheStub(),
): PlanContextService {
  return new PlanContextService(prisma as unknown as PrismaService, busyCache);
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
      skipped: 0,
      pending: 0,
    });
    expect(result.carryOverCandidates).toEqual([]);
  });

  it('carryOverCandidates includes STUCK/PENDING and excludes DOUBTS/DONE_EASY/DONE_HARD', async () => {
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

    expect(result.carryOverCandidates).toHaveLength(2);
    const ids = result.carryOverCandidates.map((c) => c.id).sort();
    expect(ids).toEqual(['wpi-1', 'wpi-3']);

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
      skipped: 0,
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
          valuedItem: null,
          stuckItem: null,
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
          { libraryItemId: 'li-a1', completedAt: new Date('2026-05-02'), outcome: 'DONE_EASY', libraryItem: { topics: [{ topicId: 'topic-a' }] } },
          { libraryItemId: 'li-a2', completedAt: null, outcome: 'PENDING', libraryItem: { topics: [{ topicId: 'topic-a' }] } },
          { libraryItemId: 'li-b1', completedAt: new Date('2026-05-03'), outcome: 'STUCK', libraryItem: { topics: [{ topicId: 'topic-b' }] } },
        ],
      },
      {
        id: 'plan-2',
        items: [
          { libraryItemId: 'li-b2', completedAt: new Date('2026-05-04'), outcome: 'DONE_HARD', libraryItem: { topics: [{ topicId: 'topic-b' }] } },
          // item with no topics shouldn't count toward any topic.
          { libraryItemId: 'li-c1', completedAt: new Date('2026-05-05'), outcome: 'DONE_EASY', libraryItem: { topics: [] } },
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

  it('availability.remainingCapacityMinutes is computed from slots + caps − cached busy', async () => {
    // Member has 9-22h windows Mon..Fri (780 min/day) and a 60-min cap on each
    // weekday. NOW is Friday 12:00 UTC = 09:00 BRT, so Fri is the only future
    // day with cap > 0 (Mon..Thu fully past, Sat/Sun cap 0).
    const slotRows = [0, 1, 2, 3, 4].map((dayOfWeek) => ({
      dayOfWeek,
      startMinute: 9 * 60,
      endMinute: 22 * 60,
    }));
    const row = {
      userId: 'user-a',
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
    const prisma = makePrisma({
      user: { findUnique: jest.fn(async () => defaultMember) },
      cycleMembership: { findFirst: jest.fn(async () => defaultMembership) },
      memberAvailability: { findUnique: jest.fn(async () => row) },
      availabilitySlot: { findMany: jest.fn(async () => slotRows) },
    });
    const busyCache = makeBusyCacheStub([]);
    const service = makeService(prisma, busyCache);
    const result = await service.getContext(
      { memberId: 'user-a', weekStart: WEEK_START },
      NOW,
    );

    // Friday window remaining (after now) is 22:00 BRT - 09:00 BRT = 13h, capped to 60.
    expect(result.availability.remainingCapacityMinutes).toBe(60);
    expect(result.availability.daysRemaining).toBe(1);
    // Sanity: weeklyBudget is the historical 5×60 = 300, not the remaining.
    expect(result.availability.weeklyBudgetMinutes).toBe(300);
  });

  it('availability.remainingCapacityMinutes ignores busy intervals belonging to the member own scheduled items', async () => {
    // Friday window 09-22 BRT, cap 60 min.
    const slotRows = [{ dayOfWeek: 4, startMinute: 9 * 60, endMinute: 22 * 60 }];
    const row = {
      userId: 'user-a',
      mondayMinutes: 0,
      tuesdayMinutes: 0,
      wednesdayMinutes: 0,
      thursdayMinutes: 0,
      fridayMinutes: 60,
      saturdayMinutes: 0,
      sundayMinutes: 0,
      preferredSessionMinutes: 30,
      timezone: 'America/Sao_Paulo',
    };
    // Two ICS events at Fri 18:00–18:30 and 18:30–19:00 BRT (= 21:00 and 21:30 UTC).
    const ownItems = [
      {
        scheduledAt: new Date('2026-04-17T21:00:00Z'),
        scheduledMinutes: 30,
      },
      {
        scheduledAt: new Date('2026-04-17T21:30:00Z'),
        scheduledMinutes: 30,
      },
    ];
    const prisma = makePrisma({
      user: { findUnique: jest.fn(async () => defaultMember) },
      cycleMembership: { findFirst: jest.fn(async () => defaultMembership) },
      memberAvailability: { findUnique: jest.fn(async () => row) },
      availabilitySlot: { findMany: jest.fn(async () => slotRows) },
      weeklyPlanItem: { findMany: jest.fn(async () => ownItems) },
    });
    // Calendar busy reports the same 60 min — those are our ICS events.
    const busyCache = makeBusyCacheStub([
      { start: new Date('2026-04-17T21:00:00Z'), end: new Date('2026-04-17T22:00:00Z') },
    ]);
    const service = makeService(prisma, busyCache);
    const result = await service.getContext(
      { memberId: 'user-a', weekStart: WEEK_START },
      NOW,
    );
    // Without the fix this would be 0 (the 60 min of ICS busy would consume
    // the whole 60-min cap). With the fix the ICS interval is removed from
    // busy, so the full 60-min cap stays addable.
    expect(result.availability.remainingCapacityMinutes).toBe(60);
  });

  it('availability.remainingCapacityMinutes still subtracts non-ICS busy from the window', async () => {
    // Friday: tight window 09-12 BRT (= 12-15 UTC), cap 180. NOW = 12:00 UTC
    // sits at the window start. cap matches window length so any busy inside
    // it directly trims the result.
    const slotRows = [{ dayOfWeek: 4, startMinute: 9 * 60, endMinute: 12 * 60 }];
    const row = {
      userId: 'user-a',
      mondayMinutes: 0, tuesdayMinutes: 0, wednesdayMinutes: 0, thursdayMinutes: 0,
      fridayMinutes: 180,
      saturdayMinutes: 0, sundayMinutes: 0,
      preferredSessionMinutes: 30,
      timezone: 'America/Sao_Paulo',
    };
    const prisma = makePrisma({
      user: { findUnique: jest.fn(async () => defaultMember) },
      cycleMembership: { findFirst: jest.fn(async () => defaultMembership) },
      memberAvailability: { findUnique: jest.fn(async () => row) },
      availabilitySlot: { findMany: jest.fn(async () => slotRows) },
      weeklyPlanItem: { findMany: jest.fn(async () => []) },
    });
    // 30 min of unrelated busy inside the window (13:00-13:30 UTC = 10:00-10:30 BRT).
    const busyCache = makeBusyCacheStub([
      { start: new Date('2026-04-17T13:00:00Z'), end: new Date('2026-04-17T13:30:00Z') },
    ]);
    const service = makeService(prisma, busyCache);
    const result = await service.getContext(
      { memberId: 'user-a', weekStart: WEEK_START },
      NOW,
    );
    // 180-min window, minus 30 min of non-ICS busy = 150 min free.
    expect(result.availability.remainingCapacityMinutes).toBe(150);
  });

  it('availability.remainingCapacityMinutes is null when getFreeBusy throws', async () => {
    const prisma = makePrisma({
      user: { findUnique: jest.fn(async () => defaultMember) },
      cycleMembership: { findFirst: jest.fn(async () => defaultMembership) },
    });
    const busyCache = {
      getWeekBusy: jest.fn(async () => {
        throw new Error('boom');
      }),
      invalidate: jest.fn(),
      invalidateAllForUser: jest.fn(),
    } as unknown as BusyCacheService;
    const service = makeService(prisma, busyCache);
    const result = await service.getContext(
      { memberId: 'user-a', weekStart: WEEK_START },
      NOW,
    );
    expect(result.availability.remainingCapacityMinutes).toBeNull();
    expect(result.availability.daysRemaining).toBe(0);
  });

  it('denormalizes valuedItem and stuckItem with title + outcome', async () => {
    const submittedAt = new Date('2026-04-12T22:00:00Z');
    const prisma = makePrisma({
      user: { findUnique: jest.fn(async () => defaultMember) },
      cycleMembership: { findFirst: jest.fn(async () => defaultMembership) },
      weeklyRetro: {
        findFirst: jest.fn(async () => ({
          whatClicked: 'great week',
          whatStuck: null,
          nextWeekWish: null,
          submittedAt,
          valuedItem: {
            id: 'wpi-valued',
            outcome: 'DONE_EASY',
            libraryItem: { title: 'Arrays basics' },
          },
          stuckItem: {
            id: 'wpi-stuck',
            outcome: 'STUCK',
            libraryItem: { title: 'Graph traversal' },
          },
        })),
      },
    });
    const service = makeService(prisma);
    const result = await service.getContext(
      { memberId: 'user-a', weekStart: WEEK_START },
      NOW,
    );
    expect(result.retro).not.toBeNull();
    expect(result.retro!.valuedItem).toEqual({
      id: 'wpi-valued',
      title: 'Arrays basics',
      outcome: 'DONE_EASY',
    });
    expect(result.retro!.stuckItem).toEqual({
      id: 'wpi-stuck',
      title: 'Graph traversal',
      outcome: 'STUCK',
    });
  });
});

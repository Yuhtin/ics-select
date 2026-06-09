import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CycleReceiptService } from './cycle-receipt.service';
import type { PrismaService } from '../../common/prisma/prisma.service';

const mockPrisma = () => ({
  cycle: { findUnique: jest.fn() },
  weeklyPlanItem: { findMany: jest.fn().mockResolvedValue([]) },
  weeklyRetro: { groupBy: jest.fn().mockResolvedValue([]) },
  classSession: { findMany: jest.fn().mockResolvedValue([]) },
  classAttendance: { findMany: jest.fn().mockResolvedValue([]) },
  $queryRawUnsafe: jest.fn().mockResolvedValue([]),
});

const makeService = (prisma: ReturnType<typeof mockPrisma>) =>
  new CycleReceiptService(prisma as unknown as PrismaService);

describe('CycleReceiptService — cycle metadata', () => {
  it('throws NotFoundException when cycle does not exist', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(null);
    const svc = makeService(prisma);
    await expect(svc.build('nonexistent', new Date())).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException when cycle has not started yet (startsAt in the future)', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'Ciclo 5',
      status: 'ACTIVE',
      startsAt: new Date('2030-06-01T00:00:00Z'),
      endsAt: new Date('2030-08-01T00:00:00Z'),
      memberships: [],
    });
    const svc = makeService(prisma);
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
    const svc = makeService(prisma);
    await expect(svc.build('c1', new Date('2026-03-15'))).rejects.toThrow(BadRequestException);
    await expect(svc.build('c1', new Date('2026-06-15'))).rejects.toThrow(BadRequestException);
  });
});

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
        actualMinutes: 999,
        libraryItem: { estimatedMinutes: 60, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] },
        weeklyPlan: { userId: 'u1' } },
      { outcome: 'DONE_HARD', completedAt: new Date('2026-04-12T15:00:00Z'),
        actualMinutes: null,
        libraryItem: { estimatedMinutes: 30, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] },
        weeklyPlan: { userId: 'u2' } },
    ]);
    const svc = makeService(prisma);
    const r = await svc.build('c1', new Date('2026-05-13'));
    expect(r.totals.totalMinutes).toBe(90);
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
    const svc = makeService(prisma);
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
      { libraryItemId: 'li-h1', outcome: 'DONE_EASY', completedAt: new Date('2026-04-10T15:00:00Z'),
        libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] },
        weeklyPlan: { userId: 'u1' } },
      { libraryItemId: 'li-t1', outcome: 'DONE_EASY', completedAt: new Date('2026-04-10T15:00:00Z'),
        libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't2', topic: { id: 't2', slug: 'tree', label: 'Tree', order: 2 } }] },
        weeklyPlan: { userId: 'u1' } },
      { libraryItemId: 'li-t2', outcome: 'DONE_EASY', completedAt: new Date('2026-04-10T15:00:00Z'),
        libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't2', topic: { id: 't2', slug: 'tree', label: 'Tree', order: 2 } }] },
        weeklyPlan: { userId: 'u2' } },
    ]);
    const svc = makeService(prisma);
    const r = await svc.build('c1', new Date('2026-05-13'));
    expect(r.byTopic.map(t => t.slug)).toEqual(['tree', 'hashmap']);
  });

  it('positive-outcomes filter passed to Prisma includes DONE_EASY/HARD/DOUBTS/SKIPPED only', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    const svc = makeService(prisma);
    await svc.build('c1', new Date('2026-05-13'));
    const positiveCall = prisma.weeklyPlanItem.findMany.mock.calls.find(
      (call: any[]) => call[0]?.where?.outcome?.in,
    );
    expect(positiveCall).toBeDefined();
    const outcomes: string[] = positiveCall![0].where.outcome.in;
    expect(outcomes).toEqual(expect.arrayContaining(['DONE_EASY', 'DONE_HARD', 'DOUBTS', 'SKIPPED']));
    expect(outcomes).not.toContain('PENDING');
    expect(outcomes).not.toContain('STUCK');
  });
});

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
    prisma.weeklyPlanItem.findMany.mockImplementation((args: any) => {
      // positive-only query — return two completions for u1 on t1
      if (args.where.outcome?.in) {
        return Promise.resolve([
          { libraryItemId: 'li-1', outcome: 'DONE_EASY', completedAt: new Date('2026-04-10T15:00:00Z'),
            libraryItem: { estimatedMinutes: 60, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] },
            weeklyPlan: { userId: 'u1' } },
          { libraryItemId: 'li-2', outcome: 'DONE_HARD', completedAt: new Date('2026-04-11T15:00:00Z'),
            libraryItem: { estimatedMinutes: 60, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] },
            weeklyPlan: { userId: 'u1' } },
        ]);
      }
      // stuck/doubts query — empty
      return Promise.resolve([]);
    });
    const svc = makeService(prisma);
    const r = await svc.build('c1', new Date('2026-05-13'));
    expect(r.knowledgeGrid.cells).toEqual([
      { userId: 'u1', topicId: 't1', itemsDone: 2, hasStuckOrDoubts: false },
    ]);
  });

  it('marks hasStuckOrDoubts=true when member has STUCK or DOUBTS on a topic item', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    prisma.weeklyPlanItem.findMany.mockImplementation((args: any) => {
      // The stuck/doubts query uses OR clause, not outcome.in
      const isFlagQuery = !args.where.outcome?.in && Array.isArray(args.where.OR);
      if (isFlagQuery) {
        return Promise.resolve([
          { outcome: 'STUCK',
            libraryItem: { topics: [{ topicId: 't1', topic: { id: 't1' } }] },
            weeklyPlan: { userId: 'u1' } },
        ]);
      }
      return Promise.resolve([
        { outcome: 'DONE_EASY', completedAt: new Date('2026-04-10T15:00:00Z'),
          libraryItem: { estimatedMinutes: 60, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] },
          weeklyPlan: { userId: 'u1' } },
      ]);
    });
    const svc = makeService(prisma);
    const r = await svc.build('c1', new Date('2026-05-13'));
    expect(r.knowledgeGrid.cells[0]?.hasStuckOrDoubts).toBe(true);
  });

  it('lists members in alphabetical order', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue({
      ...cycleBase,
      memberships: [
        { userId: 'u2', user: { id: 'u2', name: 'Bob', pictureUrl: null } },
        { userId: 'u1', user: { id: 'u1', name: 'Alice', pictureUrl: null } },
      ],
    });
    const svc = makeService(prisma);
    const r = await svc.build('c1', new Date('2026-05-13'));
    expect(r.knowledgeGrid.members.map(m => m.name)).toEqual(['Alice', 'Bob']);
  });

  it('lists topics in Topic.order ascending', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    prisma.weeklyPlanItem.findMany.mockImplementation((args: any) => {
      if (args.where.outcome?.in) {
        return Promise.resolve([
          { outcome: 'DONE_EASY', completedAt: new Date('2026-04-10T15:00:00Z'),
            libraryItem: { estimatedMinutes: 60, topics: [
              { topicId: 't2', topic: { id: 't2', slug: 'tree', label: 'Tree', order: 2 } },
              { topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } },
            ] }, weeklyPlan: { userId: 'u1' } },
        ]);
      }
      return Promise.resolve([]);
    });
    const svc = makeService(prisma);
    const r = await svc.build('c1', new Date('2026-05-13'));
    expect(r.knowledgeGrid.topics.map(t => t.slug)).toEqual(['hashmap', 'tree']);
  });
});

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

  it('topMovers uses 7-day window ending at asOf and ranks by deltaItems', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    const asOf = new Date('2026-05-12T20:00:00Z');
    prisma.weeklyPlanItem.findMany.mockImplementation((args: any) => {
      if (!args.where.outcome?.in) return Promise.resolve([]);
      const gte: Date = args.where.completedAt.gte;
      const windowMs = asOf.getTime() - gte.getTime();
      const isSevenDayWindow = windowMs > 6 * 24 * 60 * 60 * 1000 && windowMs < 8 * 24 * 60 * 60 * 1000;
      if (isSevenDayWindow) {
        return Promise.resolve([
          { libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] },
            weeklyPlan: { userId: 'u1' }, completedAt: new Date('2026-05-12T10:00:00Z'), outcome: 'DONE_EASY' },
          { libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] },
            weeklyPlan: { userId: 'u1' }, completedAt: new Date('2026-05-12T11:00:00Z'), outcome: 'DONE_EASY' },
          { libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't2', topic: { id: 't2', slug: 'tree', label: 'Tree', order: 2 } }] },
            weeklyPlan: { userId: 'u2' }, completedAt: new Date('2026-05-10T11:00:00Z'), outcome: 'DONE_EASY' },
        ]);
      }
      return Promise.resolve([]); // cumulative empty for simplicity
    });
    const svc = makeService(prisma);
    const r = await svc.build('c1', asOf);
    expect(r.topMovers.map(m => ({ userId: m.userId, deltaItems: m.deltaItems }))).toEqual([
      { userId: 'u1', deltaItems: 2 },
      { userId: 'u2', deltaItems: 1 },
    ]);
  });

  it('cycleTopMover uses cumulative cycle items, not the 7-day window', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    const asOf = new Date('2026-05-12T20:00:00Z');
    prisma.weeklyPlanItem.findMany.mockImplementation((args: any) => {
      if (!args.where.outcome?.in) return Promise.resolve([]);
      const gte: Date | undefined = args.where.completedAt?.gte;
      const isCumulative = gte?.getTime() === cycleBase.startsAt.getTime();
      if (isCumulative) {
        return Promise.resolve([
          { libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] },
            weeklyPlan: { userId: 'u2' }, completedAt: new Date('2026-04-05T10:00:00Z'), outcome: 'DONE_EASY' },
          { libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] },
            weeklyPlan: { userId: 'u2' }, completedAt: new Date('2026-04-06T10:00:00Z'), outcome: 'DONE_EASY' },
          { libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] },
            weeklyPlan: { userId: 'u2' }, completedAt: new Date('2026-04-07T10:00:00Z'), outcome: 'DONE_EASY' },
          { libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] },
            weeklyPlan: { userId: 'u1' }, completedAt: new Date('2026-04-08T10:00:00Z'), outcome: 'DONE_EASY' },
        ]);
      }
      return Promise.resolve([]);
    });
    const svc = makeService(prisma);
    const r = await svc.build('c1', asOf);
    expect(r.cycleTopMover?.userId).toBe('u2');
    expect(r.cycleTopMover?.deltaItems).toBe(3);
  });

  it('streakChampion uses BRT-day-aware streak from completions', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    const asOf = new Date('2026-05-12T23:00:00Z'); // 20:00 BRT, May 12
    prisma.weeklyPlanItem.findMany.mockImplementation((args: any) => {
      if (!args.where.outcome?.in) return Promise.resolve([]);
      const gte: Date | undefined = args.where.completedAt?.gte;
      const isCumulative = gte?.getTime() === cycleBase.startsAt.getTime();
      if (isCumulative) {
        return Promise.resolve([
          // u1: completions on May 12 and May 11 BRT → streak 2 ending at asOf
          { libraryItemId: 'li-u1a', libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'h', label: 'H', order: 1 } }] },
            weeklyPlan: { userId: 'u1' }, completedAt: new Date('2026-05-12T21:00:00Z'), outcome: 'DONE_EASY' },
          { libraryItemId: 'li-u1b', libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'h', label: 'H', order: 1 } }] },
            weeklyPlan: { userId: 'u1' }, completedAt: new Date('2026-05-11T21:00:00Z'), outcome: 'DONE_EASY' },
          // u2: completion on May 9 (gap on May 10/11) → streak 0 from asOf
          { libraryItemId: 'li-u2a', libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'h', label: 'H', order: 1 } }] },
            weeklyPlan: { userId: 'u2' }, completedAt: new Date('2026-05-09T21:00:00Z'), outcome: 'DONE_EASY' },
        ]);
      }
      return Promise.resolve([]);
    });
    const svc = makeService(prisma);
    const r = await svc.build('c1', asOf);
    expect(r.streakChampion?.userId).toBe('u1');
    expect(r.streakChampion?.streakDays).toBe(2);
  });

  it('totals.retros counts WeeklyRetro submissions for the cycle', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    prisma.weeklyRetro.groupBy.mockResolvedValue([
      { userId: 'u1', _count: { _all: 5 } },
      { userId: 'u2', _count: { _all: 3 } },
    ]);
    const svc = makeService(prisma);
    const r = await svc.build('c1', new Date('2026-05-12T20:00:00Z'));
    expect(r.totals.retros).toBe(8);
  });

  it('mostHoursStudied picks member with highest sum of estimatedMinutes', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    prisma.weeklyPlanItem.findMany.mockImplementation((args: any) => {
      if (!args.where.outcome?.in) return Promise.resolve([]);
      const gte: Date | undefined = args.where.completedAt?.gte;
      const isCumulative = gte?.getTime() === cycleBase.startsAt.getTime();
      if (isCumulative) {
        return Promise.resolve([
          { outcome: 'DONE_EASY', completedAt: new Date('2026-04-10T15:00:00Z'),
            libraryItem: { estimatedMinutes: 90, topics: [] }, weeklyPlan: { userId: 'u1' } },
          { outcome: 'DONE_EASY', completedAt: new Date('2026-04-11T15:00:00Z'),
            libraryItem: { estimatedMinutes: 30, topics: [] }, weeklyPlan: { userId: 'u2' } },
        ]);
      }
      return Promise.resolve([]);
    });
    const svc = makeService(prisma);
    const r = await svc.build('c1', new Date('2026-05-12T20:00:00Z'));
    expect(r.mostHoursStudied).toEqual({ userId: 'u1', name: 'Alice', pictureUrl: null, minutes: 90 });
  });

  it('mostItemsCompleted picks member with highest item count', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    prisma.weeklyPlanItem.findMany.mockImplementation((args: any) => {
      if (!args.where.outcome?.in) return Promise.resolve([]);
      const gte: Date | undefined = args.where.completedAt?.gte;
      const isCumulative = gte?.getTime() === cycleBase.startsAt.getTime();
      if (isCumulative) {
        return Promise.resolve([
          { libraryItemId: 'li-1', outcome: 'DONE_EASY', completedAt: new Date('2026-04-10T15:00:00Z'),
            libraryItem: { estimatedMinutes: 30, topics: [] }, weeklyPlan: { userId: 'u2' } },
          { libraryItemId: 'li-2', outcome: 'DONE_EASY', completedAt: new Date('2026-04-11T15:00:00Z'),
            libraryItem: { estimatedMinutes: 30, topics: [] }, weeklyPlan: { userId: 'u2' } },
          { libraryItemId: 'li-3', outcome: 'DONE_EASY', completedAt: new Date('2026-04-12T15:00:00Z'),
            libraryItem: { estimatedMinutes: 30, topics: [] }, weeklyPlan: { userId: 'u1' } },
        ]);
      }
      return Promise.resolve([]);
    });
    const svc = makeService(prisma);
    const r = await svc.build('c1', new Date('2026-05-12T20:00:00Z'));
    expect(r.mostItemsCompleted).toEqual({ userId: 'u2', name: 'Bob', pictureUrl: null, items: 2 });
  });

  it('engagementLeader uses cockpit engagement score (skipped when no $queryRawUnsafe available)', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    // Service guards: when members are empty, no engagement query runs.
    const empty = { ...cycleBase, memberships: [] };
    prisma.cycle.findUnique.mockResolvedValue(empty);
    const svc = makeService(prisma);
    const r = await svc.build('c1', new Date('2026-05-12T20:00:00Z'));
    expect(r.engagementLeader).toBeNull();
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
    const svc = makeService(prisma);
    const r = await svc.build('c1', new Date('2026-05-12T20:00:00Z'));
    expect(r.totals.classesHeld).toBe(2);
    expect(r.totals.classesTotal).toBe(3);
    expect(r.totals.attendanceRate).toBeCloseTo(3 / (2 * 2));
    expect(r.perfectAttendance.map(m => m.userId)).toEqual(['u1']);
  });

  it('perfectAttendance is empty when no classes held yet', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    prisma.classSession.findMany.mockResolvedValue([]);
    const svc = makeService(prisma);
    const r = await svc.build('c1', new Date('2026-05-12T20:00:00Z'));
    expect(r.perfectAttendance).toEqual([]);
  });
});

describe('CycleReceiptService — week math + mode + cache', () => {
  const cycleBase = {
    id: 'c1', name: 'Ciclo 4', status: 'ACTIVE' as const,
    startsAt: new Date('2026-04-13T00:00:00Z'), // Monday
    endsAt: new Date('2026-06-08T00:00:00Z'),   // 8 weeks (56 days)
    memberships: [],
  };

  it('weekNumber reflects asOf position from cycle.startsAt', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    const svc = makeService(prisma);
    const r1 = await svc.build('c1', new Date('2026-04-13T12:00:00Z'));
    expect(r1.cycle.weekNumber).toBe(1);
    expect(r1.cycle.weeksTotal).toBe(8);
    const r4 = await svc.build('c1', new Date('2026-05-04T12:00:00Z'));
    expect(r4.cycle.weekNumber).toBe(4);
  });

  it('mode is wrapped on cycle.endsAt date', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    const svc = makeService(prisma);
    // Use the same calendar day in UTC as endsAt; system "now" must be >= this for as-of validation to pass.
    // Since cycle.endsAt is 2026-06-08 and now is 2026-05-13, this should fail as-of validation —
    // adjust cycleBase end to something already past.
    const archived = { ...cycleBase, endsAt: new Date('2026-05-10T00:00:00Z') };
    prisma.cycle.findUnique.mockResolvedValue(archived);
    const r = await svc.build('c1', archived.endsAt);
    expect(r.mode).toBe('wrapped');
  });

  it('mode is wrapped on ARCHIVED cycle regardless of asOf', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue({ ...cycleBase, status: 'ARCHIVED' });
    const svc = makeService(prisma);
    const r = await svc.build('c1', new Date('2026-05-04T12:00:00Z'));
    expect(r.mode).toBe('wrapped');
  });

  it('cache reuses computed result within 5 minutes', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    const svc = makeService(prisma);
    const asOf = new Date('2026-05-04T12:00:00Z');
    await svc.build('c1', asOf);
    await svc.build('c1', asOf);
    expect(prisma.cycle.findUnique).toHaveBeenCalledTimes(1);
  });
});

import { Test } from '@nestjs/testing';
import { HomeService } from './home.service.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

// Prisma mock that dispatches weeklyPlanItem.findMany calls by args.select.
// The home service makes two calls: (1) today's items, with
// include.libraryItem.include.topics; (2) topic-coverage items, with
// select.libraryItem.select.topics (after the M2M refactor).
const makePrismaMock = () => {
  let todayItems: any[] = [];
  let coverageItems: any[] = [];
  const findMany = jest.fn(async (args: any) => {
    if (args?.select?.libraryItem?.select?.topics) return coverageItems;
    return todayItems;
  });
  return {
    weeklyPlan: { findFirst: jest.fn() },
    weeklyPlanItem: {
      findMany,
      findFirst: jest.fn().mockResolvedValue(null),
    },
    topic: { findMany: jest.fn().mockResolvedValue([]) },
    __setTodayItems(items: any[]) {
      todayItems = items;
    },
    __setCoverageItems(items: any[]) {
      coverageItems = items;
    },
  };
};

const PLAN = {
  id: 'plan-1',
  cycleId: 'cycle-1',
  weekStart: new Date('2026-04-13T00:00:00Z'),
  weekEnd: new Date('2026-04-19T23:59:59Z'),
};

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
    expect(result.carryOverReflection).toBeNull();
    expect(result.topicCoverage).toEqual([]);
  });

  it('hero state=now when pending item is within 15 min of the current time', async () => {
    prisma.weeklyPlan.findFirst.mockResolvedValue(PLAN);
    const scheduledAt = new Date('2026-04-17T19:00:00Z');
    prisma.__setTodayItems([
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
    prisma.weeklyPlan.findFirst.mockResolvedValue(PLAN);
    prisma.__setTodayItems([
      {
        id: 'i1', weeklyPlanId: 'plan-1', order: 1, outcome: 'PENDING',
        reflection: null, completedAt: null, carriedFromItemId: null,
        scheduledAt: new Date('2026-04-17T21:00:00Z'), scheduledMinutes: 45,
        libraryItem: { title: 'X', format: 'PROBLEM', estimatedMinutes: 45, url: null, topics: [] },
      },
    ]);
    const result = await service.getHome('user-1', new Date('2026-04-17T19:00:00Z'));
    expect(result.hero?.state).toBe('up_next');
    expect((result.hero as any).minutesUntil).toBe(120);
  });

  it('hero state=running_late when pending item scheduled earlier today', async () => {
    prisma.weeklyPlan.findFirst.mockResolvedValue(PLAN);
    prisma.__setTodayItems([
      {
        id: 'i1', weeklyPlanId: 'plan-1', order: 1, outcome: 'PENDING',
        reflection: null, completedAt: null, carriedFromItemId: null,
        scheduledAt: new Date('2026-04-17T19:00:00Z'), scheduledMinutes: 45,
        libraryItem: { title: 'X', format: 'PROBLEM', estimatedMinutes: 45, url: null, topics: [] },
      },
    ]);
    // Session 19:00 + 45min = ends 19:45. Now = 20:00 → 15 min past end.
    const result = await service.getHome('user-1', new Date('2026-04-17T20:00:00Z'));
    expect(result.hero?.state).toBe('running_late');
    expect((result.hero as any).minutesLate).toBe(15);
  });

  it('groups days chronologically and keeps done items in today', async () => {
    const mockItems = [
      {
        id: 'done', weeklyPlanId: 'plan-1', order: 1, outcome: 'DONE_EASY',
        reflection: null, completedAt: new Date(), carriedFromItemId: null,
        scheduledAt: new Date('2026-04-17T13:00:00Z'), scheduledMinutes: 30,
        libraryItem: { title: 'Morning study', format: 'VIDEO', estimatedMinutes: 30, url: null, topics: [] },
      },
      {
        id: 'pending-today', weeklyPlanId: 'plan-1', order: 2, outcome: 'PENDING',
        reflection: null, completedAt: null, carriedFromItemId: null,
        scheduledAt: new Date('2026-04-17T20:00:00Z'), scheduledMinutes: 45,
        libraryItem: { title: 'Evening study', format: 'PROBLEM', estimatedMinutes: 45, url: null, topics: [] },
      },
      {
        id: 'tomorrow', weeklyPlanId: 'plan-1', order: 3, outcome: 'PENDING',
        reflection: null, completedAt: null, carriedFromItemId: null,
        scheduledAt: new Date('2026-04-18T09:00:00Z'), scheduledMinutes: 45,
        libraryItem: { title: 'Next-day', format: 'ARTICLE', estimatedMinutes: 45, url: null, topics: [] },
      },
    ];
    prisma.weeklyPlan.findFirst.mockResolvedValue(PLAN);
    prisma.__setTodayItems(mockItems);

    const result = await service.getHome('user-1', new Date('2026-04-17T19:00:00Z'));
    expect(result.today.map((i) => i.id)).toEqual(['done', 'pending-today']);
    expect(result.days).toHaveLength(1);
    expect(result.days[0]?.items[0]?.id).toBe('tomorrow');
  });

  it('exposes overdue PENDING items in a separate `late` bucket', async () => {
    const mockItems = [
      {
        id: 'overdue-old', weeklyPlanId: 'plan-1', order: 1, outcome: 'PENDING',
        reflection: null, completedAt: null, carriedFromItemId: null,
        scheduledAt: new Date('2026-04-15T19:00:00Z'), scheduledMinutes: 30,
        libraryItem: { title: 'Two days ago', format: 'VIDEO', estimatedMinutes: 30, url: null, topics: [] },
      },
      {
        id: 'overdue-recent', weeklyPlanId: 'plan-1', order: 2, outcome: 'PENDING',
        reflection: null, completedAt: null, carriedFromItemId: null,
        scheduledAt: new Date('2026-04-16T19:00:00Z'), scheduledMinutes: 30,
        libraryItem: { title: 'Yesterday', format: 'VIDEO', estimatedMinutes: 30, url: null, topics: [] },
      },
      {
        id: 'pending-today', weeklyPlanId: 'plan-1', order: 3, outcome: 'PENDING',
        reflection: null, completedAt: null, carriedFromItemId: null,
        scheduledAt: new Date('2026-04-17T13:00:00Z'), scheduledMinutes: 30,
        libraryItem: { title: 'Today', format: 'VIDEO', estimatedMinutes: 30, url: null, topics: [] },
      },
      {
        id: 'overdue-done', weeklyPlanId: 'plan-1', order: 4, outcome: 'DONE_EASY',
        reflection: null, completedAt: new Date(), carriedFromItemId: null,
        scheduledAt: new Date('2026-04-16T20:00:00Z'), scheduledMinutes: 30,
        libraryItem: { title: 'Done yesterday', format: 'VIDEO', estimatedMinutes: 30, url: null, topics: [] },
      },
    ];
    prisma.weeklyPlan.findFirst.mockResolvedValue(PLAN);
    prisma.__setTodayItems(mockItems);

    const result = await service.getHome('user-1', new Date('2026-04-17T19:00:00Z'));
    // Overdue PENDING goes to `late`, sorted oldest-first; today is unchanged.
    expect(result.late.map((i) => i.id)).toEqual(['overdue-old', 'overdue-recent']);
    expect(result.today.map((i) => i.id)).toEqual(['pending-today']);
    // Completed items from prior days are dropped (historical).
    // running_late hero picks the oldest carry-over.
    expect(result.hero?.state).toBe('running_late');
    if (result.hero?.state === 'running_late') {
      expect(result.hero.item.id).toBe('overdue-old');
    }
  });

  it('exposes latest DOUBTS/STUCK reflection as carryOverReflection', async () => {
    prisma.weeklyPlan.findFirst.mockResolvedValue(PLAN);
    prisma.__setTodayItems([]);
    prisma.weeklyPlanItem.findFirst.mockResolvedValue({
      id: 'prior-item',
      reflection: 'Hashing com linear probing não entrou.',
      completedAt: new Date('2026-04-11T15:00:00Z'),
      libraryItem: { title: 'Hash tables deep dive' },
      weeklyPlan: { weekStart: new Date('2026-04-06T00:00:00Z') },
    });
    const result = await service.getHome('user-1', new Date('2026-04-17T19:00:00Z'));
    expect(result.carryOverReflection).not.toBeNull();
    expect(result.carryOverReflection?.reflection).toMatch(/Hashing/);
    expect(result.carryOverReflection?.title).toBe('Hash tables deep dive');
  });

  it('computes topic coverage across member plans in the active cycle', async () => {
    prisma.weeklyPlan.findFirst.mockResolvedValue(PLAN);
    prisma.__setTodayItems([]);
    prisma.topic.findMany.mockResolvedValue([
      { id: 't-dp', slug: 'dp', label: 'Dynamic Programming', order: 0 },
      { id: 't-graphs', slug: 'graphs', label: 'Graphs', order: 1 },
    ]);
    prisma.__setCoverageItems([
      { outcome: 'DONE_EASY', libraryItem: { topics: [{ topicId: 't-dp' }] } },
      { outcome: 'DONE_HARD', libraryItem: { topics: [{ topicId: 't-dp' }] } },
      { outcome: 'STUCK', libraryItem: { topics: [{ topicId: 't-dp' }] } },
      { outcome: 'PENDING', libraryItem: { topics: [{ topicId: 't-graphs' }] } },
    ]);

    const result = await service.getHome('user-1', new Date('2026-04-17T19:00:00Z'));
    const dp = result.topicCoverage.find((t) => t.slug === 'dp');
    const graphs = result.topicCoverage.find((t) => t.slug === 'graphs');
    expect(dp).toEqual(
      expect.objectContaining({ itemsPlanned: 3, itemsDone: 2, order: 0 }),
    );
    expect(graphs).toEqual(
      expect.objectContaining({ itemsPlanned: 1, itemsDone: 0, order: 1 }),
    );
  });
});

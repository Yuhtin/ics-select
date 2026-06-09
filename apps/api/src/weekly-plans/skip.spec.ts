import { PrismaService } from '../common/prisma/prisma.service';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';
import { BusyCacheService } from '../google-calendar/busy-cache.service';
import { WeeklyPlansService } from './weekly-plans.service';

const stubBusyCache = {
  getWeekBusy: jest.fn(),
  invalidate: jest.fn(),
  invalidateAllForUser: jest.fn(),
} as unknown as BusyCacheService;

describe('WeeklyPlansService.setItemOutcome — SKIPPED', () => {
  const calendar = { deleteEvent: jest.fn() };
  // Calendar reconciliation runs fire-and-forget after the outcome update
  // returns, so assertions on calendar.deleteEvent / deleteMany must await
  // a microtask flush. Same pattern as the `remove` tests below.
  const flushMicrotasks = () => new Promise((r) => setImmediate(r));

  const buildPrisma = (item: {
    planId: string;
    userId: string;
    planStatus: 'DRAFT' | 'PUBLISHED';
    topicSlugs: string[];
    format?: string;
    calendarEvents?: Array<{ id: string; googleEventId: string }>;
  }) => ({
    weeklyPlanItem: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'item-1',
        weeklyPlan: {
          id: item.planId,
          userId: item.userId,
          status: item.planStatus,
          weekStart: new Date('2026-04-13T00:00:00Z'),
          weekEnd: new Date('2026-04-19T23:59:59Z'),
        },
        libraryItem: {
          format: item.format ?? 'ARTICLE',
          topics: item.topicSlugs.map((slug) => ({ topic: { slug } })),
        },
        calendarEvents: item.calendarEvents ?? [],
      }),
      update: jest.fn().mockResolvedValue({ id: 'item-1', outcome: 'SKIPPED' }),
    },
    weeklyPlanItemCalendarEvent: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
  });

  const build = (prisma: unknown) => {
    return new WeeklyPlansService(prisma as PrismaService, calendar as unknown as GoogleCalendarService, stubBusyCache);
  };

  beforeEach(() => {
    calendar.deleteEvent.mockReset();
    calendar.deleteEvent.mockResolvedValue(undefined);
  });

  it('rejects SKIPPED on a non-foundations, non-video item', async () => {
    const prisma = buildPrisma({
      planId: 'p1',
      userId: 'u1',
      planStatus: 'DRAFT',
      topicSlugs: ['sorting'],
    });
    const service = build(prisma);
    await expect(
      service.setItemOutcome('item-1', 'u1', { outcome: 'SKIPPED', actualMinutes: null }, new Date('2026-04-15T12:00:00Z')),
    ).rejects.toThrow(/only foundations or video items can be skipped/i);
  });

  it('accepts SKIPPED on a video item even when no topic is foundations', async () => {
    const prisma = buildPrisma({
      planId: 'p1',
      userId: 'u1',
      planStatus: 'DRAFT',
      topicSlugs: ['array'],
      format: 'VIDEO',
    });
    const service = build(prisma);
    await service.setItemOutcome('item-1', 'u1', { outcome: 'SKIPPED', actualMinutes: null }, new Date('2026-04-15T12:00:00Z'));
    expect(prisma.weeklyPlanItem.update).toHaveBeenCalled();
  });

  it('accepts SKIPPED on a foundations item and skips Calendar cleanup when no events exist', async () => {
    const prisma = buildPrisma({
      planId: 'p1',
      userId: 'u1',
      planStatus: 'DRAFT',
      topicSlugs: ['foundations'],
    });
    const service = build(prisma);
    await service.setItemOutcome('item-1', 'u1', { outcome: 'SKIPPED', actualMinutes: null }, new Date('2026-04-15T12:00:00Z'));
    expect(calendar.deleteEvent).not.toHaveBeenCalled();
    expect(prisma.weeklyPlanItemCalendarEvent.deleteMany).not.toHaveBeenCalled();
  });

  it('accepts SKIPPED on a foundations item in PUBLISHED plan and deletes the persisted Calendar events', async () => {
    const prisma = buildPrisma({
      planId: 'p1',
      userId: 'u1',
      planStatus: 'PUBLISHED',
      topicSlugs: ['sorting', 'foundations'],
      calendarEvents: [
        { id: 'row-1', googleEventId: 'evt-99' },
        { id: 'row-2', googleEventId: 'evt-100' },
      ],
    });
    const service = build(prisma);
    await service.setItemOutcome('item-1', 'u1', { outcome: 'SKIPPED', actualMinutes: null }, new Date('2026-04-15T12:00:00Z'));
    await flushMicrotasks();
    expect(calendar.deleteEvent).toHaveBeenCalledWith('u1', 'evt-99');
    expect(calendar.deleteEvent).toHaveBeenCalledWith('u1', 'evt-100');
    expect(prisma.weeklyPlanItemCalendarEvent.deleteMany).toHaveBeenCalledWith({
      where: { weeklyPlanItemId: 'item-1' },
    });
  });

  it('tolerates Calendar failure on PUBLISHED skip', async () => {
    const prisma = buildPrisma({
      planId: 'p1',
      userId: 'u1',
      planStatus: 'PUBLISHED',
      topicSlugs: ['foundations'],
      calendarEvents: [{ id: 'row-1', googleEventId: 'evt-99' }],
    });
    calendar.deleteEvent.mockRejectedValue(new Error('boom'));
    const service = build(prisma);
    await expect(
      service.setItemOutcome('item-1', 'u1', { outcome: 'SKIPPED', actualMinutes: null }, new Date('2026-04-15T12:00:00Z')),
    ).resolves.toBeDefined();
    await flushMicrotasks();
    expect(prisma.weeklyPlanItemCalendarEvent.deleteMany).toHaveBeenCalled();
  });
});

describe('plan read — skippable flag', () => {
  it('sets skippable=true when foundations is in item topics (primary OR cover), false otherwise', async () => {
    const stubCalendar = { deleteEvent: jest.fn() };

    const prisma = {
      weeklyPlan: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p1',
          userId: 'u1',
          weekStart: new Date('2026-04-13T00:00:00Z'),
          items: [
            {
              id: 'i1',
              libraryItem: { topics: [{ topic: { slug: 'sorting' } }] },
            },
            {
              id: 'i2',
              libraryItem: {
                topics: [{ topic: { slug: 'array' } }, { topic: { slug: 'foundations' } }],
              },
            },
          ],
        }),
      },
    };

    const service = new WeeklyPlansService(prisma as any, stubCalendar as any, stubBusyCache);
    const plan = await service.getById('p1');
    expect(plan!.items[0]!.skippable).toBe(false);
    expect(plan!.items[1]!.skippable).toBe(true);
  });

  it('listForMember sets skippable on each item', async () => {
    const stubCalendar = { deleteEvent: jest.fn() };

    const prisma = {
      weeklyPlan: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'p1',
            userId: 'u1',
            items: [
              {
                id: 'i1',
                libraryItem: { topics: [{ topic: { slug: 'foundations' } }] },
              },
              {
                id: 'i2',
                libraryItem: { topics: [{ topic: { slug: 'graph' } }] },
              },
            ],
          },
        ]),
      },
    };

    const service = new WeeklyPlansService(prisma as any, stubCalendar as any, stubBusyCache);
    const plans = await service.listForMember('u1');
    expect(plans[0]!.items[0]!.skippable).toBe(true);
    expect(plans[0]!.items[1]!.skippable).toBe(false);
  });
});

describe('WeeklyPlansService.remove (deletePlan)', () => {
  const calendar = { deleteEvent: jest.fn() };

  beforeEach(() => {
    calendar.deleteEvent.mockReset();
  });

  // Wait for queued microtasks (background fire-and-forget) to settle so we
  // can assert on the post-response cleanup.
  const flushMicrotasks = () => new Promise((r) => setImmediate(r));

  it('deletes a plan without persisted events without touching Calendar', async () => {
    const prisma: any = {
      weeklyPlan: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p1',
          userId: 'u1',
          weekStart: new Date('2026-04-13T00:00:00Z'),
          items: [
            { calendarEvents: [] },
            { calendarEvents: [] },
          ],
        }),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new WeeklyPlansService(prisma, calendar as any, stubBusyCache);
    await service.remove('p1');
    await flushMicrotasks();
    expect(calendar.deleteEvent).not.toHaveBeenCalled();
    expect(prisma.weeklyPlan.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });

  it('deletes the plan synchronously and cleans up Calendar events in background', async () => {
    const prisma: any = {
      weeklyPlan: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p1',
          userId: 'u1',
          weekStart: new Date('2026-04-13T00:00:00Z'),
          items: [
            { calendarEvents: [{ googleEventId: 'evt-1' }] },
            { calendarEvents: [{ googleEventId: 'evt-2' }] },
          ],
        }),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    calendar.deleteEvent.mockResolvedValue(undefined);
    const service = new WeeklyPlansService(prisma, calendar as any, stubBusyCache);
    await service.remove('p1');
    // The plan delete is awaited; the calendar deletes are not.
    expect(prisma.weeklyPlan.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    await flushMicrotasks();
    expect(calendar.deleteEvent).toHaveBeenCalledWith('u1', 'evt-1');
    expect(calendar.deleteEvent).toHaveBeenCalledWith('u1', 'evt-2');
    expect(calendar.deleteEvent).toHaveBeenCalledTimes(2);
  });

  it('throws NotFoundException when plan does not exist', async () => {
    const prisma: any = {
      weeklyPlan: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new WeeklyPlansService(prisma, calendar as any, stubBusyCache);
    await expect(service.remove('p1')).rejects.toThrow(/not found/i);
  });

  it('background Calendar errors do not bubble out of remove()', async () => {
    const prisma: any = {
      weeklyPlan: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p1',
          userId: 'u1',
          weekStart: new Date('2026-04-13T00:00:00Z'),
          items: [{ calendarEvents: [{ googleEventId: 'evt-1' }] }],
        }),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    calendar.deleteEvent.mockRejectedValue(new Error('boom'));
    const service = new WeeklyPlansService(prisma, calendar as any, stubBusyCache);
    await expect(service.remove('p1')).resolves.toBeUndefined();
    expect(prisma.weeklyPlan.delete).toHaveBeenCalled();
    await flushMicrotasks();
    // Background failure is logged, not thrown.
    expect(calendar.deleteEvent).toHaveBeenCalled();
  });
});

describe('SKIPPED counts as completed across weekly-plans helpers', () => {
  it('weekly-plans cohortProgress done-count includes SKIPPED', async () => {
    // Arrange: stub prisma so cohortProgress returns a plan with
    // outcomes [DONE_EASY, SKIPPED, PENDING] — expected done = 2.
    const cycleId = 'cycle-1';
    const userId = 'u1';
    const weekStart = new Date('2026-04-20');
    const prisma = {
      cycleMembership: {
        findMany: jest.fn().mockResolvedValue([
          { userId, cycleId, user: { id: userId, name: 'Alice', pictureUrl: null } },
        ]),
      },
      weeklyPlan: {
        groupBy: jest.fn().mockResolvedValue([
          { userId, _max: { weekStart } },
        ]),
        findMany: jest.fn().mockResolvedValue([
          {
            userId,
            items: [
              { outcome: 'DONE_EASY' },
              { outcome: 'SKIPPED' },
              { outcome: 'PENDING' },
            ],
          },
        ]),
      },
    };
    // resolveActiveMembership needs cycleMembership.findFirst
    (prisma as any).cycleMembership.findFirst = jest.fn().mockResolvedValue({
      cycleId,
      userId,
      cycle: { startsAt: new Date('2026-04-01'), endsAt: new Date('2026-06-30'), status: 'ACTIVE' },
    });

    const calendar = { deleteEvent: jest.fn() };

    const service = new WeeklyPlansService(prisma as any, calendar as any, stubBusyCache);
    const result = await service.cohortProgress(userId);

    expect(result).toHaveLength(1);
    const row = result[0]!;
    expect(row.done).toBe(2);
    expect(row.total).toBe(3);

    // Sanity: only one findMany call that actually fetches plans, scoped by
    // the (userId, weekStart) winners — not the whole cycle.
    expect(prisma.weeklyPlan.findMany).toHaveBeenCalledTimes(1);
    const findManyArgs = prisma.weeklyPlan.findMany.mock.calls[0]![0] as any;
    expect(findManyArgs.where.OR).toEqual([{ userId, weekStart }]);
  });
});

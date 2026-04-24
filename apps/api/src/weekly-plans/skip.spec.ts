import { PrismaService } from '../common/prisma/prisma.service';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service';
import { WeeklyPlansService } from './weekly-plans.service';

describe('WeeklyPlansService.setItemOutcome — SKIPPED', () => {
  const calendar = {
    findEventIdByIcsId: jest.fn(),
    deleteEvent: jest.fn(),
  };

  const buildPrisma = (item: {
    planId: string;
    userId: string;
    planStatus: 'DRAFT' | 'PUBLISHED';
    topicSlugs: string[];
    weekStartsAt: Date;
    weekEndsAt: Date;
  }) => ({
    weeklyPlanItem: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'item-1',
        weeklyPlan: {
          id: item.planId,
          userId: item.userId,
          status: item.planStatus,
          weekStart: item.weekStartsAt,
          weekEnd: item.weekEndsAt,
        },
        libraryItem: {
          topics: item.topicSlugs.map((slug) => ({ topic: { slug } })),
        },
      }),
      update: jest.fn().mockResolvedValue({ id: 'item-1', outcome: 'SKIPPED' }),
    },
  });

  const build = (prisma: unknown) => {
    return new WeeklyPlansService(prisma as PrismaService, calendar as unknown as GoogleCalendarService);
  };

  beforeEach(() => {
    calendar.findEventIdByIcsId.mockReset();
    calendar.deleteEvent.mockReset();
  });

  it('rejects SKIPPED on a non-foundations item', async () => {
    const prisma = buildPrisma({
      planId: 'p1',
      userId: 'u1',
      planStatus: 'DRAFT',
      topicSlugs: ['sorting'],
      weekStartsAt: new Date('2026-04-20'),
      weekEndsAt: new Date('2026-04-27'),
    });
    const service = build(prisma);
    await expect(
      service.setItemOutcome('item-1', 'u1', { outcome: 'SKIPPED' }),
    ).rejects.toThrow(/only foundations items can be skipped/i);
  });

  it('accepts SKIPPED on a foundations item and skips Calendar cleanup when plan is DRAFT', async () => {
    const prisma = buildPrisma({
      planId: 'p1',
      userId: 'u1',
      planStatus: 'DRAFT',
      topicSlugs: ['foundations'],
      weekStartsAt: new Date('2026-04-20'),
      weekEndsAt: new Date('2026-04-27'),
    });
    const service = build(prisma);
    await service.setItemOutcome('item-1', 'u1', { outcome: 'SKIPPED' });
    expect(calendar.findEventIdByIcsId).not.toHaveBeenCalled();
    expect(calendar.deleteEvent).not.toHaveBeenCalled();
  });

  it('accepts SKIPPED on a foundations item in PUBLISHED plan and deletes the Calendar event', async () => {
    const prisma = buildPrisma({
      planId: 'p1',
      userId: 'u1',
      planStatus: 'PUBLISHED',
      topicSlugs: ['sorting', 'foundations'],
      weekStartsAt: new Date('2026-04-20'),
      weekEndsAt: new Date('2026-04-27'),
    });
    calendar.findEventIdByIcsId.mockResolvedValue('evt-99');
    const service = build(prisma);
    await service.setItemOutcome('item-1', 'u1', { outcome: 'SKIPPED' });
    expect(calendar.findEventIdByIcsId).toHaveBeenCalledWith(
      'u1',
      'p1',
      'item-1',
      { start: expect.any(Date), end: expect.any(Date) },
    );
    expect(calendar.deleteEvent).toHaveBeenCalledWith('u1', 'evt-99');
  });

  it('tolerates missing Calendar event on PUBLISHED skip', async () => {
    const prisma = buildPrisma({
      planId: 'p1',
      userId: 'u1',
      planStatus: 'PUBLISHED',
      topicSlugs: ['foundations'],
      weekStartsAt: new Date('2026-04-20'),
      weekEndsAt: new Date('2026-04-27'),
    });
    calendar.findEventIdByIcsId.mockResolvedValue(null);
    const service = build(prisma);
    await expect(
      service.setItemOutcome('item-1', 'u1', { outcome: 'SKIPPED' }),
    ).resolves.toBeDefined();
    expect(calendar.deleteEvent).not.toHaveBeenCalled();
  });
});

describe('plan read — skippable flag', () => {
  it('sets skippable=true when foundations is in item topics (primary OR cover), false otherwise', async () => {
    const stubCalendar = { findEventIdByIcsId: jest.fn(), deleteEvent: jest.fn() };

    const prisma = {
      weeklyPlan: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p1',
          userId: 'u1',
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

    const service = new WeeklyPlansService(prisma as any, stubCalendar as any);
    const plan = await service.getById('p1');
    expect(plan!.items[0]!.skippable).toBe(false);
    expect(plan!.items[1]!.skippable).toBe(true);
  });

  it('listForMember sets skippable on each item', async () => {
    const stubCalendar = { findEventIdByIcsId: jest.fn(), deleteEvent: jest.fn() };

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

    const service = new WeeklyPlansService(prisma as any, stubCalendar as any);
    const plans = await service.listForMember('u1');
    expect(plans[0]!.items[0]!.skippable).toBe(true);
    expect(plans[0]!.items[1]!.skippable).toBe(false);
  });
});

describe('WeeklyPlansService.remove (deletePlan)', () => {
  const calendar = { findEventIdsByIcsIds: jest.fn(), deleteEvent: jest.fn() };

  beforeEach(() => {
    calendar.findEventIdsByIcsIds.mockReset();
    calendar.deleteEvent.mockReset();
  });

  it('deletes a DRAFT plan without calling Calendar', async () => {
    const prisma: any = {
      weeklyPlan: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p1', userId: 'u1', status: 'DRAFT',
          weekStart: new Date(), weekEnd: new Date(),
          items: [{ id: 'i1' }, { id: 'i2' }],
        }),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    const service = new WeeklyPlansService(prisma, calendar as any);
    await service.remove('p1');
    expect(calendar.findEventIdsByIcsIds).not.toHaveBeenCalled();
    expect(prisma.weeklyPlan.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
  });

  it('deletes a PUBLISHED plan and cleans up each item Calendar event', async () => {
    const prisma: any = {
      weeklyPlan: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p1', userId: 'u1', status: 'PUBLISHED',
          weekStart: new Date('2026-04-20'), weekEnd: new Date('2026-04-27'),
          items: [{ id: 'i1' }, { id: 'i2' }],
        }),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    calendar.findEventIdsByIcsIds.mockResolvedValueOnce(new Map([['i1', 'evt-1']]));
    const service = new WeeklyPlansService(prisma, calendar as any);
    await service.remove('p1');
    expect(calendar.findEventIdsByIcsIds).toHaveBeenCalledTimes(1);
    expect(calendar.findEventIdsByIcsIds).toHaveBeenCalledWith(
      'u1',
      'p1',
      ['i1', 'i2'],
      expect.objectContaining({ start: expect.any(Date), end: expect.any(Date) }),
    );
    expect(calendar.deleteEvent).toHaveBeenCalledWith('u1', 'evt-1');
    expect(calendar.deleteEvent).toHaveBeenCalledTimes(1);
    expect(prisma.weeklyPlan.delete).toHaveBeenCalled();
  });

  it('throws NotFoundException when plan does not exist', async () => {
    const prisma: any = {
      weeklyPlan: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const service = new WeeklyPlansService(prisma, calendar as any);
    await expect(service.remove('p1')).rejects.toThrow(/not found/i);
  });

  it('tolerates Calendar errors during cleanup', async () => {
    const prisma: any = {
      weeklyPlan: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'p1', userId: 'u1', status: 'PUBLISHED',
          weekStart: new Date(), weekEnd: new Date(),
          items: [{ id: 'i1' }],
        }),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    calendar.findEventIdsByIcsIds.mockRejectedValue(new Error('boom'));
    const service = new WeeklyPlansService(prisma, calendar as any);
    await expect(service.remove('p1')).resolves.toBeUndefined();
    expect(prisma.weeklyPlan.delete).toHaveBeenCalled();
  });
});

describe('SKIPPED counts as completed across weekly-plans helpers', () => {
  it('weekly-plans cohortProgress done-count includes SKIPPED', async () => {
    // Arrange: stub prisma so cohortProgress returns a plan with
    // outcomes [DONE_EASY, SKIPPED, PENDING] — expected done = 2.
    const cycleId = 'cycle-1';
    const userId = 'u1';
    const prisma = {
      cycleMembership: {
        findMany: jest.fn().mockResolvedValue([
          { userId, cycleId, user: { id: userId, name: 'Alice', pictureUrl: null } },
        ]),
      },
      weeklyPlan: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'plan-1',
            userId,
            cycleId,
            weekStart: new Date('2026-04-20'),
            items: [
              { id: 'i1', outcome: 'DONE_EASY' },
              { id: 'i2', outcome: 'SKIPPED' },
              { id: 'i3', outcome: 'PENDING' },
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

    const calendar = {
      findEventIdByIcsId: jest.fn(),
      deleteEvent: jest.fn(),
    };

    const service = new WeeklyPlansService(prisma as any, calendar as any);
    const result = await service.cohortProgress(userId);

    expect(result).toHaveLength(1);
    const row = result[0]!;
    expect(row.done).toBe(2);
    expect(row.total).toBe(3);
  });
});

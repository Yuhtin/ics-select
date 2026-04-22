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

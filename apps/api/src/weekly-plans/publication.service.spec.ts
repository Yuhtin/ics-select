import { ConflictException } from '@nestjs/common';
import { PublicationService, PlanOverflowError } from './publication.service';

function fakePrisma() {
  const plans = new Map<string, any>();
  const availability = {
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
  return {
    plans,
    availability,
    weeklyPlan: {
      findUnique: jest.fn(async ({ where }: any) => plans.get(where.id) ?? null),
      update: jest.fn(async ({ where, data }: any) => {
        const cur = plans.get(where.id);
        const next = { ...cur, ...data };
        plans.set(where.id, next);
        return next;
      }),
    },
    memberAvailability: {
      findUnique: jest.fn(async () => availability),
    },
    weeklyPlanItem: {
      update: jest.fn(async () => ({})),
    },
  };
}

const calendar = {
  getFreeBusy: jest.fn(async (): Promise<Array<{ start: Date; end: Date }>> => []),
  createEvent: jest.fn(async () => 'evt-1'),
  deleteEvent: jest.fn(async () => undefined),
  findEventIdByIcsId: jest.fn(async () => 'gcal-evt-1'),
};

const scheduler = {
  plan: jest.fn(),
};

describe('PublicationService.publish', () => {
  it('flips status to PUBLISHED without touching Calendar', async () => {
    const prisma = fakePrisma();
    prisma.plans.set('p-1', { id: 'p-1', userId: 'u-1', status: 'DRAFT' });
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any);
    const result = await svc.publish('p-1');
    expect(result.plan.status).toBe('PUBLISHED');
    expect(calendar.createEvent).not.toHaveBeenCalled();
  });
});

describe('PublicationService.autoSchedule', () => {
  beforeEach(() => {
    calendar.createEvent.mockClear();
    calendar.getFreeBusy.mockReset();
    calendar.getFreeBusy.mockResolvedValue([]);
    scheduler.plan.mockReset();
  });

  it('creates calendar events when scheduler returns no overflow', async () => {
    const prisma = fakePrisma();
    prisma.plans.set('p-1', {
      id: 'p-1',
      userId: 'u-1',
      cycleId: 'c-1',
      weekStart: new Date('2026-04-13T00:00:00-03:00'),
      weekEnd: new Date('2026-04-20T00:00:00-03:00'),
      status: 'PUBLISHED',
      items: [
        { id: 'wpi-1', libraryItemId: 'li-1', order: 0, libraryItem: { title: 'A', estimatedMinutes: 60 } },
      ],
    });
    scheduler.plan.mockReturnValue({
      sessions: [
        { itemId: 'wpi-1', scheduledAt: new Date('2026-04-13T11:00:00Z'), durationMinutes: 60 },
      ],
      overflow: [],
    });
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any);
    const result = await svc.autoSchedule('p-1', false);
    expect(result.sessionsCreated).toBe(1);
    expect(calendar.createEvent).toHaveBeenCalledTimes(1);
    expect(calendar.createEvent).toHaveBeenCalledWith(
      'u-1',
      expect.objectContaining({
        icsId: { planId: 'p-1', itemId: 'wpi-1' },
      }),
    );
    expect(prisma.weeklyPlanItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'wpi-1' },
        data: expect.objectContaining({
          scheduledAt: expect.any(Date),
          scheduledMinutes: expect.any(Number),
        }),
      }),
    );
  });

  it('throws PlanOverflowError when there is overflow and force is false', async () => {
    const prisma = fakePrisma();
    prisma.plans.set('p-1', {
      id: 'p-1',
      userId: 'u-1',
      cycleId: 'c-1',
      weekStart: new Date('2026-04-13T00:00:00-03:00'),
      weekEnd: new Date('2026-04-20T00:00:00-03:00'),
      status: 'PUBLISHED',
      items: [
        { id: 'wpi-1', libraryItemId: 'li-1', order: 0, libraryItem: { title: 'A', estimatedMinutes: 60 } },
      ],
    });
    scheduler.plan.mockReturnValue({
      sessions: [],
      overflow: [{ itemId: 'wpi-1', minutesRequired: 60 }],
    });
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any);
    await expect(svc.autoSchedule('p-1', false)).rejects.toBeInstanceOf(PlanOverflowError);
  });

  it('uses default availability when member has not defined one', async () => {
    const prisma = fakePrisma();
    prisma.memberAvailability.findUnique = jest.fn(async () => null) as any;
    prisma.plans.set('p-1', {
      id: 'p-1',
      userId: 'u-1',
      cycleId: 'c-1',
      weekStart: new Date('2026-04-13T00:00:00-03:00'),
      weekEnd: new Date('2026-04-20T00:00:00-03:00'),
      status: 'PUBLISHED',
      items: [
        { id: 'wpi-1', libraryItemId: 'li-1', order: 0, libraryItem: { title: 'A', estimatedMinutes: 60 } },
      ],
    });
    scheduler.plan.mockReturnValue({
      sessions: [
        { itemId: 'wpi-1', scheduledAt: new Date('2026-04-13T11:00:00Z'), durationMinutes: 60 },
      ],
      overflow: [],
    });
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any);
    const result = await svc.autoSchedule('p-1', false);
    expect(result.sessionsCreated).toBe(1);
  });

  it('nulls scheduledAt + scheduledMinutes for overflow items when force is true', async () => {
    const prisma = fakePrisma();
    prisma.plans.set('p-1', {
      id: 'p-1',
      userId: 'u-1',
      cycleId: 'c-1',
      weekStart: new Date('2026-04-13T00:00:00-03:00'),
      weekEnd: new Date('2026-04-20T00:00:00-03:00'),
      status: 'PUBLISHED',
      items: [
        { id: 'wpi-1', libraryItemId: 'li-1', order: 0, libraryItem: { title: 'A', estimatedMinutes: 60 } },
        { id: 'wpi-2', libraryItemId: 'li-2', order: 1, libraryItem: { title: 'B', estimatedMinutes: 60 } },
      ],
    });
    scheduler.plan.mockReturnValue({
      sessions: [
        { itemId: 'wpi-1', scheduledAt: new Date('2026-04-13T11:00:00Z'), durationMinutes: 60 },
      ],
      overflow: [{ itemId: 'wpi-2', minutesRequired: 60 }],
    });
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any);
    await svc.autoSchedule('p-1', true);
    // wpi-1 gets scheduledAt + scheduledMinutes
    expect(prisma.weeklyPlanItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'wpi-1' },
        data: expect.objectContaining({
          scheduledAt: expect.any(Date),
          scheduledMinutes: 60,
        }),
      }),
    );
    // wpi-2 (overflow) gets null for both fields
    expect(prisma.weeklyPlanItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'wpi-2' },
        data: expect.objectContaining({
          scheduledAt: null,
          scheduledMinutes: null,
        }),
      }),
    );
  });

  it('passes busy blocks to scheduler grouped by day', async () => {
    const prisma = fakePrisma();
    const weekStart = new Date('2026-04-13T00:00:00-03:00');
    prisma.plans.set('p-1', {
      id: 'p-1',
      userId: 'u-1',
      cycleId: 'c-1',
      weekStart,
      weekEnd: new Date('2026-04-20T00:00:00-03:00'),
      status: 'PUBLISHED',
      items: [
        { id: 'wpi-1', libraryItemId: 'li-1', order: 0, libraryItem: { title: 'A', estimatedMinutes: 60 } },
      ],
    });
    // Monday 09:00-10:00 (60 min) and Wednesday 14:00-14:30 (30 min)
    calendar.getFreeBusy.mockResolvedValueOnce([
      {
        start: new Date('2026-04-13T09:00:00-03:00'),
        end: new Date('2026-04-13T10:00:00-03:00'),
      },
      {
        start: new Date('2026-04-15T14:00:00-03:00'),
        end: new Date('2026-04-15T14:30:00-03:00'),
      },
    ]);
    scheduler.plan.mockReturnValue({ sessions: [], overflow: [] });
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any);
    await svc.autoSchedule('p-1', false);

    expect(scheduler.plan).toHaveBeenCalledTimes(1);
    const input = scheduler.plan.mock.calls[0]![0] as any;
    expect(input.busyByDay[0]).toHaveLength(1);
    expect(input.busyByDay[0][0].endMinute - input.busyByDay[0][0].startMinute).toBe(60);
    expect(input.busyByDay[2]).toHaveLength(1);
    expect(input.busyByDay[2][0].endMinute - input.busyByDay[2][0].startMinute).toBe(30);
    expect(input.busyByDay[1]).toEqual([]);
    expect(input.busyByDay[3]).toEqual([]);
    expect(input.busyByDay[4]).toEqual([]);
    expect(input.busyByDay[5]).toEqual([]);
    expect(input.busyByDay[6]).toEqual([]);
  });

  it('skips scheduling and Calendar creation for items with outcome SKIPPED', async () => {
    const prisma = fakePrisma();
    prisma.plans.set('p-1', {
      id: 'p-1',
      userId: 'u-1',
      cycleId: 'c-1',
      weekStart: new Date('2026-04-13T00:00:00-03:00'),
      weekEnd: new Date('2026-04-20T00:00:00-03:00'),
      status: 'PUBLISHED',
      items: [
        {
          id: 'wpi-pending',
          libraryItemId: 'li-1',
          order: 0,
          outcome: 'PENDING',
          libraryItem: { title: 'A', estimatedMinutes: 60, url: 'https://example.com/a' },
        },
        {
          id: 'wpi-skipped',
          libraryItemId: 'li-2',
          order: 1,
          outcome: 'SKIPPED',
          libraryItem: { title: 'B', estimatedMinutes: 60, url: 'https://example.com/b' },
        },
      ],
    });
    scheduler.plan.mockReturnValue({
      sessions: [
        { itemId: 'wpi-pending', scheduledAt: new Date('2026-04-13T11:00:00Z'), durationMinutes: 60 },
      ],
      overflow: [],
    });
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any);
    await svc.autoSchedule('p-1', false);

    // Scheduler must only receive the PENDING item — not the SKIPPED one
    expect(scheduler.plan).toHaveBeenCalledTimes(1);
    const input = scheduler.plan.mock.calls[0]![0] as any;
    expect(input.items).toHaveLength(1);
    expect(input.items[0].id).toBe('wpi-pending');
    expect(input.items.find((i: any) => i.id === 'wpi-skipped')).toBeUndefined();

    // createEvent must never be called for the SKIPPED item
    expect(calendar.createEvent).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ icsId: expect.objectContaining({ itemId: 'wpi-skipped' }) }),
    );
    // createEvent IS called for the PENDING item
    expect(calendar.createEvent).toHaveBeenCalledWith(
      'u-1',
      expect.objectContaining({ icsId: { planId: 'p-1', itemId: 'wpi-pending' } }),
    );
  });

  it('swallows getFreeBusy errors and treats week as empty', async () => {
    const prisma = fakePrisma();
    prisma.plans.set('p-1', {
      id: 'p-1',
      userId: 'u-1',
      cycleId: 'c-1',
      weekStart: new Date('2026-04-13T00:00:00-03:00'),
      weekEnd: new Date('2026-04-20T00:00:00-03:00'),
      status: 'PUBLISHED',
      items: [
        { id: 'wpi-1', libraryItemId: 'li-1', order: 0, libraryItem: { title: 'A', estimatedMinutes: 60 } },
      ],
    });
    calendar.getFreeBusy.mockRejectedValueOnce(new Error('calendar down'));
    scheduler.plan.mockReturnValue({
      sessions: [
        { itemId: 'wpi-1', scheduledAt: new Date('2026-04-13T11:00:00Z'), durationMinutes: 60 },
      ],
      overflow: [],
    });
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any);
    const result = await svc.autoSchedule('p-1', false);

    expect(result.sessionsCreated).toBe(1);
    expect(scheduler.plan).toHaveBeenCalledTimes(1);
    const input = scheduler.plan.mock.calls[0]![0] as any;
    expect(input.busyByDay[0]).toEqual([]);
    expect(input.busyByDay[1]).toEqual([]);
    expect(input.busyByDay[2]).toEqual([]);
    expect(input.busyByDay[3]).toEqual([]);
    expect(input.busyByDay[4]).toEqual([]);
    expect(input.busyByDay[5]).toEqual([]);
    expect(input.busyByDay[6]).toEqual([]);
  });
});

describe('PublicationService.reschedulePending', () => {
  const weekStart = new Date('2026-04-13T00:00:00-03:00');
  const weekEnd = new Date('2026-04-20T00:00:00-03:00');

  function makePlan(overrides: Record<string, any> = {}) {
    return {
      id: 'p-1',
      userId: 'u-1',
      cycleId: 'c-1',
      weekStart,
      weekEnd,
      status: 'PUBLISHED',
      items: [
        {
          id: 'wpi-pending',
          libraryItemId: 'li-1',
          order: 0,
          outcome: 'PENDING',
          libraryItem: { title: 'A', estimatedMinutes: 60, url: 'https://example.com/a' },
        },
        {
          id: 'wpi-done',
          libraryItemId: 'li-2',
          order: 1,
          outcome: 'DONE_EASY',
          libraryItem: { title: 'B', estimatedMinutes: 60, url: 'https://example.com/b' },
        },
      ],
      ...overrides,
    };
  }

  beforeEach(() => {
    calendar.createEvent.mockClear();
    calendar.deleteEvent.mockClear();
    calendar.findEventIdByIcsId.mockClear();
    calendar.getFreeBusy.mockReset();
    calendar.getFreeBusy.mockResolvedValue([]);
    calendar.findEventIdByIcsId.mockResolvedValue('gcal-evt-1');
    scheduler.plan.mockReset();
    scheduler.plan.mockReturnValue({
      sessions: [
        { itemId: 'wpi-pending', scheduledAt: new Date('2026-04-17T11:00:00Z'), durationMinutes: 60 },
      ],
      overflow: [],
    });
  });

  it('rejects non-PUBLISHED plans with ConflictException', async () => {
    const prisma = fakePrisma();
    prisma.plans.set('p-1', makePlan({ status: 'DRAFT' }));
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any);
    await expect(svc.reschedulePending('p-1')).rejects.toBeInstanceOf(ConflictException);
  });

  it('no-op when no PENDING items', async () => {
    const prisma = fakePrisma();
    prisma.plans.set('p-1', makePlan({
      items: [
        {
          id: 'wpi-done',
          libraryItemId: 'li-2',
          order: 0,
          outcome: 'DONE_EASY',
          libraryItem: { title: 'B', estimatedMinutes: 60, url: 'https://example.com/b' },
        },
      ],
    }));
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any);
    await svc.reschedulePending('p-1');
    expect(calendar.findEventIdByIcsId).not.toHaveBeenCalled();
    expect(scheduler.plan).not.toHaveBeenCalled();
  });

  it('cleans up existing events then schedules only PENDING items', async () => {
    const prisma = fakePrisma();
    prisma.plans.set('p-1', makePlan());
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any);
    await svc.reschedulePending('p-1');

    // findEventIdByIcsId only called for the PENDING item
    expect(calendar.findEventIdByIcsId).toHaveBeenCalledTimes(1);
    expect(calendar.findEventIdByIcsId).toHaveBeenCalledWith(
      'u-1', 'p-1', 'wpi-pending', expect.objectContaining({ start: weekStart, end: weekEnd }),
    );

    // deleteEvent called with the returned id
    expect(calendar.deleteEvent).toHaveBeenCalledTimes(1);
    expect(calendar.deleteEvent).toHaveBeenCalledWith('u-1', 'gcal-evt-1');

    // scheduler receives only the PENDING item
    expect(scheduler.plan).toHaveBeenCalledTimes(1);
    const input = scheduler.plan.mock.calls[0]![0] as any;
    expect(input.items).toHaveLength(1);
    expect(input.items[0].id).toBe('wpi-pending');

    // createEvent called for the new session
    expect(calendar.createEvent).toHaveBeenCalledTimes(1);
    expect(calendar.createEvent).toHaveBeenCalledWith(
      'u-1',
      expect.objectContaining({ icsId: { planId: 'p-1', itemId: 'wpi-pending' } }),
    );
  });

  it('clamps scheduling window to max(now, plan.weekStart) via now param', async () => {
    const prisma = fakePrisma();
    prisma.plans.set('p-1', makePlan());
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any);
    const midWeek = new Date('2026-04-16T10:00:00-03:00'); // Thursday
    await svc.reschedulePending('p-1', { now: midWeek });

    expect(scheduler.plan).toHaveBeenCalledTimes(1);
    const input = scheduler.plan.mock.calls[0]![0] as any;
    // now passed to scheduler should be the provided mid-week date
    expect(input.now).toEqual(midWeek);
  });

  it('throws PlanOverflowError when scheduler returns overflow', async () => {
    const prisma = fakePrisma();
    prisma.plans.set('p-1', makePlan());
    scheduler.plan.mockReturnValue({
      sessions: [],
      overflow: [{ itemId: 'wpi-pending', minutesRequired: 60 }],
    });
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any);
    await expect(svc.reschedulePending('p-1')).rejects.toBeInstanceOf(PlanOverflowError);
  });

  it('tolerates Calendar errors during cleanup and still creates new events', async () => {
    const prisma = fakePrisma();
    prisma.plans.set('p-1', makePlan());
    // Simulate findEventIdByIcsId throwing
    calendar.findEventIdByIcsId.mockRejectedValueOnce(new Error('calendar down'));
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any);
    await svc.reschedulePending('p-1');

    // deleteEvent should NOT have been called (threw before reaching it)
    expect(calendar.deleteEvent).not.toHaveBeenCalled();
    // But createEvent IS still called for the new session
    expect(calendar.createEvent).toHaveBeenCalledTimes(1);
    expect(calendar.createEvent).toHaveBeenCalledWith(
      'u-1',
      expect.objectContaining({ icsId: { planId: 'p-1', itemId: 'wpi-pending' } }),
    );
  });
});

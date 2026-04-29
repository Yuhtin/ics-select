import { ConflictException } from '@nestjs/common';
import {
  PublicationService,
  PlanOverflowError,
  allocatedMinutes,
} from './publication.service';

describe('allocatedMinutes', () => {
  it('rounds up to the next 15-min slot with 3-min tolerance', () => {
    expect(allocatedMinutes(13)).toBe(15);
    expect(allocatedMinutes(17)).toBe(15); // tolerance: 17 fits in 15-slot
    expect(allocatedMinutes(18)).toBe(15); // edge of tolerance
    expect(allocatedMinutes(19)).toBe(30); // outside tolerance → 30
    expect(allocatedMinutes(25)).toBe(30);
    expect(allocatedMinutes(30)).toBe(30);
    expect(allocatedMinutes(33)).toBe(30); // tolerance: 33 fits in 30-slot
    expect(allocatedMinutes(34)).toBe(45);
    expect(allocatedMinutes(45)).toBe(45);
    expect(allocatedMinutes(48)).toBe(45); // tolerance
    expect(allocatedMinutes(49)).toBe(60);
  });

  it('enforces a 15-minute minimum for very short items', () => {
    expect(allocatedMinutes(5)).toBe(15);
    expect(allocatedMinutes(7)).toBe(15);
    expect(allocatedMinutes(1)).toBe(15);
    expect(allocatedMinutes(0)).toBe(15);
  });

  it('doubles VIDEO durations before snapping to a slot', () => {
    expect(allocatedMinutes(13, 'VIDEO')).toBe(30); // 13×2=26 → 30
    expect(allocatedMinutes(8, 'VIDEO')).toBe(15); // 8×2=16 → 15 (tolerance)
    expect(allocatedMinutes(20, 'VIDEO')).toBe(45); // 20×2=40 → 45
    expect(allocatedMinutes(30, 'VIDEO')).toBe(60); // 30×2=60 → 60
    expect(allocatedMinutes(2, 'VIDEO')).toBe(15); // floor
  });

  it('keeps non-VIDEO formats at their raw length', () => {
    expect(allocatedMinutes(13, 'ARTICLE')).toBe(15);
    expect(allocatedMinutes(13, 'PROBLEM')).toBe(15);
    expect(allocatedMinutes(13, 'BOOK')).toBe(15);
    expect(allocatedMinutes(13, null)).toBe(15);
    expect(allocatedMinutes(13, undefined)).toBe(15);
  });
});

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
    availabilitySlot: {
      findMany: jest.fn(async () => []),
    },
    weeklyPlanItem: {
      update: jest.fn(async () => ({})),
      updateMany: jest.fn(async () => ({ count: 0 })),
    },
    weeklyPlanItemCalendarEvent: {
      create: jest.fn(async () => ({})),
      createMany: jest.fn(async () => ({ count: 0 })),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
  };
}

const calendar = {
  getFreeBusy: jest.fn(async (): Promise<Array<{ start: Date; end: Date }>> => []),
  createEvent: jest.fn(async () => 'evt-1'),
  deleteEvent: jest.fn(async () => undefined),
};

const scheduler = {
  plan: jest.fn(),
};

const whatsapp = {
  send: jest.fn(async () => undefined),
};

const templates = {
  render: jest.fn(async () => ({ text: 'rendered', enabled: true })),
};

describe('PublicationService.publish', () => {
  it('flips status to PUBLISHED without touching Calendar', async () => {
    const prisma = fakePrisma();
    prisma.plans.set('p-1', { id: 'p-1', userId: 'u-1', status: 'DRAFT' });
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any, whatsapp as any, templates as any);
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
        { id: 'wpi-1', libraryItemId: 'li-1', order: 0, calendarEvents: [], libraryItem: { title: 'A', estimatedMinutes: 60 } },
      ],
    });
    scheduler.plan.mockReturnValue({
      sessions: [
        { itemId: 'wpi-1', scheduledAt: new Date('2026-04-13T11:00:00Z'), durationMinutes: 60 },
      ],
      overflow: [],
    });
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any, whatsapp as any, templates as any);
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
        { id: 'wpi-1', libraryItemId: 'li-1', order: 0, calendarEvents: [], libraryItem: { title: 'A', estimatedMinutes: 60 } },
      ],
    });
    scheduler.plan.mockReturnValue({
      sessions: [],
      overflow: [{ itemId: 'wpi-1', minutesRequired: 60 }],
    });
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any, whatsapp as any, templates as any);
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
        { id: 'wpi-1', libraryItemId: 'li-1', order: 0, calendarEvents: [], libraryItem: { title: 'A', estimatedMinutes: 60 } },
      ],
    });
    scheduler.plan.mockReturnValue({
      sessions: [
        { itemId: 'wpi-1', scheduledAt: new Date('2026-04-13T11:00:00Z'), durationMinutes: 60 },
      ],
      overflow: [],
    });
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any, whatsapp as any, templates as any);
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
        { id: 'wpi-1', libraryItemId: 'li-1', order: 0, calendarEvents: [], libraryItem: { title: 'A', estimatedMinutes: 60 } },
        { id: 'wpi-2', libraryItemId: 'li-2', order: 1, calendarEvents: [], libraryItem: { title: 'B', estimatedMinutes: 60 } },
      ],
    });
    scheduler.plan.mockReturnValue({
      sessions: [
        { itemId: 'wpi-1', scheduledAt: new Date('2026-04-13T11:00:00Z'), durationMinutes: 60 },
      ],
      overflow: [{ itemId: 'wpi-2', minutesRequired: 60 }],
    });
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any, whatsapp as any, templates as any);
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
    // wpi-2 (overflow) gets null for both fields via a batched updateMany
    expect(prisma.weeklyPlanItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['wpi-2'] } },
        data: expect.objectContaining({
          scheduledAt: null,
          scheduledMinutes: null,
        }),
      }),
    );
  });

  it('passes raw busy blocks straight through to the scheduler', async () => {
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
        { id: 'wpi-1', libraryItemId: 'li-1', order: 0, calendarEvents: [], libraryItem: { title: 'A', estimatedMinutes: 60 } },
      ],
    });
    const monBusy = {
      start: new Date('2026-04-13T09:00:00-03:00'),
      end: new Date('2026-04-13T10:00:00-03:00'),
    };
    const wedBusy = {
      start: new Date('2026-04-15T14:00:00-03:00'),
      end: new Date('2026-04-15T14:30:00-03:00'),
    };
    calendar.getFreeBusy.mockResolvedValueOnce([monBusy, wedBusy]);
    scheduler.plan.mockReturnValue({ sessions: [], overflow: [] });
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any, whatsapp as any, templates as any);
    await svc.autoSchedule('p-1', false);

    expect(scheduler.plan).toHaveBeenCalledTimes(1);
    const input = scheduler.plan.mock.calls[0]![0] as any;
    expect(input.busyBlocks).toEqual([monBusy, wedBusy]);
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
          calendarEvents: [], libraryItem: { title: 'A', estimatedMinutes: 60, url: 'https://example.com/a' },
        },
        {
          id: 'wpi-skipped',
          libraryItemId: 'li-2',
          order: 1,
          outcome: 'SKIPPED',
          calendarEvents: [], libraryItem: { title: 'B', estimatedMinutes: 60, url: 'https://example.com/b' },
        },
      ],
    });
    scheduler.plan.mockReturnValue({
      sessions: [
        { itemId: 'wpi-pending', scheduledAt: new Date('2026-04-13T11:00:00Z'), durationMinutes: 60 },
      ],
      overflow: [],
    });
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any, whatsapp as any, templates as any);
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
        { id: 'wpi-1', libraryItemId: 'li-1', order: 0, calendarEvents: [], libraryItem: { title: 'A', estimatedMinutes: 60 } },
      ],
    });
    calendar.getFreeBusy.mockRejectedValueOnce(new Error('calendar down'));
    scheduler.plan.mockReturnValue({
      sessions: [
        { itemId: 'wpi-1', scheduledAt: new Date('2026-04-13T11:00:00Z'), durationMinutes: 60 },
      ],
      overflow: [],
    });
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any, whatsapp as any, templates as any);
    const result = await svc.autoSchedule('p-1', false);

    expect(result.sessionsCreated).toBe(1);
    expect(scheduler.plan).toHaveBeenCalledTimes(1);
    const input = scheduler.plan.mock.calls[0]![0] as any;
    expect(input.busyBlocks).toEqual([]);
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
          calendarEvents: [], libraryItem: { title: 'A', estimatedMinutes: 60, url: 'https://example.com/a' },
        },
        {
          id: 'wpi-done',
          libraryItemId: 'li-2',
          order: 1,
          outcome: 'DONE_EASY',
          calendarEvents: [], libraryItem: { title: 'B', estimatedMinutes: 60, url: 'https://example.com/b' },
        },
      ],
      ...overrides,
    };
  }

  beforeEach(() => {
    calendar.createEvent.mockClear();
    calendar.deleteEvent.mockClear();
    calendar.deleteEvent.mockResolvedValue(undefined);
    calendar.getFreeBusy.mockReset();
    calendar.getFreeBusy.mockResolvedValue([]);
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
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any, whatsapp as any, templates as any);
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
          calendarEvents: [], libraryItem: { title: 'B', estimatedMinutes: 60, url: 'https://example.com/b' },
        },
      ],
    }));
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any, whatsapp as any, templates as any);
    await svc.reschedulePending('p-1');
    expect(calendar.deleteEvent).not.toHaveBeenCalled();
    expect(scheduler.plan).not.toHaveBeenCalled();
  });

  it('cleans up persisted events for PENDING items then schedules only PENDING items', async () => {
    const prisma = fakePrisma();
    const plan = makePlan();
    (plan.items[0] as any).calendarEvents = [{ googleEventId: 'gcal-evt-1' }];
    prisma.plans.set('p-1', plan);
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any, whatsapp as any, templates as any);
    await svc.reschedulePending('p-1');

    // No events.list scan — delete by id directly from DB-tracked events.
    expect(calendar.deleteEvent).toHaveBeenCalledTimes(1);
    expect(calendar.deleteEvent).toHaveBeenCalledWith('u-1', 'gcal-evt-1');
    // The DB-side row is removed for PENDING items only (not DONE_EASY).
    expect(prisma.weeklyPlanItemCalendarEvent.deleteMany).toHaveBeenCalledWith({
      where: { weeklyPlanItemId: { in: ['wpi-pending'] } },
    });

    // scheduler receives only the PENDING item
    expect(scheduler.plan).toHaveBeenCalledTimes(1);
    const input = scheduler.plan.mock.calls[0]![0] as any;
    expect(input.items).toHaveLength(1);
    expect(input.items[0].id).toBe('wpi-pending');

    // createEvent called for the new session, and the new id is persisted
    expect(calendar.createEvent).toHaveBeenCalledTimes(1);
    expect(calendar.createEvent).toHaveBeenCalledWith(
      'u-1',
      expect.objectContaining({ icsId: { planId: 'p-1', itemId: 'wpi-pending' } }),
    );
    expect(prisma.weeklyPlanItemCalendarEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        weeklyPlanItemId: 'wpi-pending',
        googleEventId: expect.any(String),
      }),
    });
  });

  it('clamps scheduling window to max(now, plan.weekStart) via now param', async () => {
    const prisma = fakePrisma();
    prisma.plans.set('p-1', makePlan());
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any, whatsapp as any, templates as any);
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
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any, whatsapp as any, templates as any);
    await expect(svc.reschedulePending('p-1')).rejects.toBeInstanceOf(PlanOverflowError);
  });

  it('tolerates Calendar deleteEvent failure during cleanup and still creates new events', async () => {
    const prisma = fakePrisma();
    const plan = makePlan();
    (plan.items[0] as any).calendarEvents = [{ googleEventId: 'gcal-evt-1' }];
    prisma.plans.set('p-1', plan);
    calendar.deleteEvent.mockRejectedValueOnce(new Error('calendar down'));
    const svc = new PublicationService(prisma as any, scheduler as any, calendar as any, whatsapp as any, templates as any);
    await svc.reschedulePending('p-1');

    // The flaky delete is logged, not thrown.
    expect(calendar.deleteEvent).toHaveBeenCalledTimes(1);
    expect(calendar.createEvent).toHaveBeenCalledTimes(1);
    expect(calendar.createEvent).toHaveBeenCalledWith(
      'u-1',
      expect.objectContaining({ icsId: { planId: 'p-1', itemId: 'wpi-pending' } }),
    );
  });
});

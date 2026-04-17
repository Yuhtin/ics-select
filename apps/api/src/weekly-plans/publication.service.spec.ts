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
  getFreeBusy: jest.fn(async () => []),
  createEvent: jest.fn(async () => 'evt-1'),
  deleteEvent: jest.fn(async () => undefined),
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
});

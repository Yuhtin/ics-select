import { PublicationService, PlanOverflowError } from './publication.service';

function fakePrisma() {
  const plans = new Map<string, any>();
  const sessions = new Map<string, any>();
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
    sessions,
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
    studySession: {
      create: jest.fn(async ({ data }: any) => {
        const id = `s-${sessions.size + 1}`;
        const rec = { id, ...data };
        sessions.set(id, rec);
        return rec;
      }),
      deleteMany: jest.fn(async () => ({ count: 0 })),
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

  it('creates StudySessions and calendar events when scheduler returns no overflow', async () => {
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
});

import { SchedulerService } from '../scheduler/scheduler.service';
import { SchedulingPreviewService, NoAvailabilityError } from './scheduling-preview.service';
import { NotFoundException } from '@nestjs/common';

function fakePrisma(opts: {
  plan?: any;
  availability?: any;
  slots?: any[];
  items?: any[];
} = {}) {
  return {
    weeklyPlan: {
      findUnique: jest.fn(async () => opts.plan ?? null),
    },
    weeklyPlanItem: {
      findMany: jest.fn(async () => opts.items ?? []),
    },
    memberAvailability: {
      findUnique: jest.fn(async () => opts.availability ?? null),
    },
    availabilitySlot: {
      findMany: jest.fn(async () => opts.slots ?? []),
    },
  };
}

const busyCache = {
  getWeekBusy: jest.fn(async (): Promise<Array<{ start: Date; end: Date }>> => []),
  invalidate: jest.fn(),
  invalidateAllForUser: jest.fn(),
};

const PLAN = {
  id: 'plan-1',
  userId: 'user-1',
  weekStart: new Date('2026-05-18T00:00:00-03:00'),
  weekEnd: new Date('2026-05-25T00:00:00-03:00'),
  status: 'DRAFT',
};

const AVAILABILITY = {
  userId: 'user-1',
  mondayMinutes: 90,
  tuesdayMinutes: 90,
  wednesdayMinutes: 60,
  thursdayMinutes: null,
  fridayMinutes: null,
  saturdayMinutes: 60,
  sundayMinutes: null,
  preferredSessionMinutes: 45,
  timezone: 'America/Sao_Paulo',
};

const SLOTS = [
  { dayOfWeek: 0, startMinute: 17 * 60, endMinute: 19 * 60 },
  { dayOfWeek: 1, startMinute: 17 * 60, endMinute: 19 * 60 },
  { dayOfWeek: 2, startMinute: 17 * 60, endMinute: 18 * 60 },
  { dayOfWeek: 5, startMinute: 10 * 60, endMinute: 11 * 60 },
];

function buildService(prisma: any) {
  const scheduler = new SchedulerService();
  return new SchedulingPreviewService(prisma as any, scheduler, busyCache as any);
}

describe('SchedulingPreviewService', () => {
  beforeEach(() => {
    busyCache.getWeekBusy.mockClear();
  });

  it('returns empty placements when items array is empty', async () => {
    const prisma = fakePrisma({ plan: PLAN, availability: AVAILABILITY, slots: SLOTS });
    const svc = buildService(prisma);

    const result = await svc.preview('plan-1', { items: [] });

    expect(result.placements).toEqual([]);
    expect(result.overflow).toEqual([]);
    expect(result.busyBlocks).toEqual([]);
    expect(result.weekStart).toBe(PLAN.weekStart.toISOString());
    expect(result.weekEnd).toBe(PLAN.weekEnd.toISOString());
  });

  it('schedules items inside availability slots', async () => {
    const prisma = fakePrisma({ plan: PLAN, availability: AVAILABILITY, slots: SLOTS });
    const svc = buildService(prisma);

    const result = await svc.preview('plan-1', {
      items: [
        { libraryItemId: 'lib-A', order: 0, estimatedMinutes: 45 },
        { libraryItemId: 'lib-B', order: 1, estimatedMinutes: 30 },
      ],
    });

    expect(result.placements.length).toBeGreaterThan(0);
    expect(result.overflow).toEqual([]);
    expect(result.placements.every((p) => p.itemId.startsWith('lib-'))).toBe(true);
  });

  it('returns overflow when items exceed availability', async () => {
    const prisma = fakePrisma({ plan: PLAN, availability: AVAILABILITY, slots: SLOTS });
    const svc = buildService(prisma);

    const result = await svc.preview('plan-1', {
      items: Array.from({ length: 10 }, (_, idx) => ({
        libraryItemId: `lib-${idx}`,
        order: idx,
        estimatedMinutes: 90,
      })),
    });

    expect(result.overflow.length).toBeGreaterThan(0);
  });

  it('relaxOrder places at least as many items as strict order', async () => {
    // Setup: 5 items where strict order forces overflow because the first big
    // item consumes a slot that later items can't share. Relaxed FFD packs
    // larger first and should fit more.
    const prisma = fakePrisma({ plan: PLAN, availability: AVAILABILITY, slots: SLOTS });
    const svc = buildService(prisma);

    const items = [
      { libraryItemId: 'lib-A', order: 0, estimatedMinutes: 90 },
      { libraryItemId: 'lib-B', order: 1, estimatedMinutes: 30 },
      { libraryItemId: 'lib-C', order: 2, estimatedMinutes: 30 },
      { libraryItemId: 'lib-D', order: 3, estimatedMinutes: 60 },
      { libraryItemId: 'lib-E', order: 4, estimatedMinutes: 30 },
    ];

    const strict = await svc.preview('plan-1', { items, relaxOrder: false });
    const relaxed = await svc.preview('plan-1', { items, relaxOrder: true });

    expect(relaxed.placements.length).toBeGreaterThanOrEqual(strict.placements.length);
  });

  it('throws NotFoundException when plan is missing', async () => {
    const prisma = fakePrisma({ plan: null });
    const svc = buildService(prisma);
    await expect(svc.preview('plan-missing', { items: [] })).rejects.toThrow(NotFoundException);
  });

  it('throws NoAvailabilityError when member has no availability row', async () => {
    const prisma = fakePrisma({ plan: PLAN, availability: null, slots: [] });
    const svc = buildService(prisma);
    await expect(
      svc.preview('plan-1', {
        items: [{ libraryItemId: 'lib-A', order: 0, estimatedMinutes: 45 }],
      }),
    ).rejects.toThrow(NoAvailabilityError);
  });

  it('falls back to persisted items when body omits items', async () => {
    const prisma = fakePrisma({
      plan: PLAN,
      availability: AVAILABILITY,
      slots: SLOTS,
      items: [
        {
          libraryItemId: 'lib-A',
          order: 0,
          libraryItem: { estimatedMinutes: 45, format: 'ARTICLE' },
        },
      ],
    });
    const svc = buildService(prisma);
    const result = await svc.preview('plan-1', {});
    expect(prisma.weeklyPlanItem.findMany).toHaveBeenCalled();
    expect(result.placements.length).toBeGreaterThan(0);
  });
});

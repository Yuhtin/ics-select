import { WeeklyPlansService } from './weekly-plans.service';

function fakePrisma() {
  const plans = new Map<string, any>();
  const items = new Map<string, any>();
  let pid = 0;
  let iid = 0;
  return {
    plans,
    items,
    cycle: {
      findUnique: jest.fn(async () => ({
        id: 'c-1',
        startsAt: new Date('2026-04-01'),
        endsAt: new Date('2026-06-30'),
      })),
    },
    weeklyPlan: {
      create: jest.fn(async ({ data }: any) => {
        const id = `p-${++pid}`;
        const created = {
          id,
          userId: data.userId,
          cycleId: data.cycleId,
          weekStart: data.weekStart,
          weekEnd: data.weekEnd,
          adminNotes: data.adminNotes ?? null,
          status: data.status ?? 'DRAFT',
          publishedAt: null,
          items:
            data.items?.create?.map((i: any) => {
              const itemId = `i-${++iid}`;
              const item = { id: itemId, weeklyPlanId: id, ...i, outcome: 'PENDING' };
              items.set(itemId, item);
              return item;
            }) ?? [],
        };
        plans.set(id, created);
        return created;
      }),
      findUnique: jest.fn(async ({ where }: any) => plans.get(where.id) ?? null),
      update: jest.fn(async ({ where, data }: any) => {
        const cur = plans.get(where.id);
        const next = { ...cur, ...data };
        plans.set(where.id, next);
        return next;
      }),
      findMany: jest.fn(async () => Array.from(plans.values())),
    },
    weeklyPlanItem: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
      findUnique: jest.fn(async ({ where }: any) => {
        const item = items.get(where.id);
        if (!item) return null;
        const plan = plans.get(item.weeklyPlanId);
        return { ...item, weeklyPlan: plan ? { userId: plan.userId } : null };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const cur = items.get(where.id);
        const next = { ...cur, ...data };
        items.set(where.id, next);
        return next;
      }),
    },
  };
}

describe('WeeklyPlansService', () => {
  it('createDraft creates a DRAFT plan with ordered items', async () => {
    const prisma = fakePrisma();
    const svc = new WeeklyPlansService(prisma as any);
    const plan = await svc.createDraft({
      userId: 'u-1',
      cycleId: 'c-1',
      weekStart: new Date('2026-04-13'),
      weekEnd: new Date('2026-04-19'),
      items: [
        { libraryItemId: 'li-1', order: 0 },
        { libraryItemId: 'li-2', order: 1 },
      ],
    });
    expect(plan.status).toBe('DRAFT');
    expect(plan.items).toHaveLength(2);
  });

  describe('setItemOutcome', () => {
    it('sets outcome DONE_EASY and reflection, stamps completedAt', async () => {
      const prisma = fakePrisma();
      const svc = new WeeklyPlansService(prisma as any);
      const plan = await svc.createDraft({
        userId: 'u-1',
        cycleId: 'c-1',
        weekStart: new Date('2026-04-13'),
        weekEnd: new Date('2026-04-19'),
        items: [{ libraryItemId: 'li-1', order: 0 }],
      });
      const itemId = plan.items[0]!.id;

      const result = await svc.setItemOutcome(itemId, 'u-1', {
        outcome: 'DONE_EASY',
        reflection: 'foi tranquilo',
      });

      expect(prisma.weeklyPlanItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: itemId },
          data: expect.objectContaining({
            outcome: 'DONE_EASY',
            reflection: 'foi tranquilo',
            completedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.outcome).toBe('DONE_EASY');
    });

    it('leaves completedAt null when outcome is PENDING', async () => {
      const prisma = fakePrisma();
      const svc = new WeeklyPlansService(prisma as any);
      const plan = await svc.createDraft({
        userId: 'u-1',
        cycleId: 'c-1',
        weekStart: new Date('2026-04-13'),
        weekEnd: new Date('2026-04-19'),
        items: [{ libraryItemId: 'li-2', order: 0 }],
      });
      const itemId = plan.items[0]!.id;

      await svc.setItemOutcome(itemId, 'u-1', { outcome: 'PENDING' });

      expect(prisma.weeklyPlanItem.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            outcome: 'PENDING',
            completedAt: null,
          }),
        }),
      );
    });

    it('throws ForbiddenException when the caller does not own the item', async () => {
      const prisma = fakePrisma();
      const svc = new WeeklyPlansService(prisma as any);
      // Create plan owned by 'u-1'
      const plan = await svc.createDraft({
        userId: 'u-1',
        cycleId: 'c-1',
        weekStart: new Date('2026-04-13'),
        weekEnd: new Date('2026-04-19'),
        items: [{ libraryItemId: 'li-3', order: 0 }],
      });
      const itemId = plan.items[0]!.id;

      await expect(
        svc.setItemOutcome(itemId, 'someone-else', { outcome: 'DONE_EASY' }),
      ).rejects.toThrow(/forbidden/i);
    });
  });
});

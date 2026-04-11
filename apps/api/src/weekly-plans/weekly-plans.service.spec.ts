import { WeeklyPlansService } from './weekly-plans.service';

function fakePrisma() {
  const plans = new Map<string, any>();
  const items = new Map<string, any>();
  let pid = 0;
  let iid = 0;
  return {
    plans,
    items,
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
              const item = { id: itemId, weeklyPlanId: id, ...i, status: 'PENDING', sessions: [] };
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

  it('markItemDone updates status and stores rating + reflection', async () => {
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
    const updated = await svc.markItemDone(plan.id, itemId, 'u-1', {
      rating: 'HARD',
      reflection: 'Travei no passo 3',
    });
    expect(updated.status).toBe('DONE');
    expect(updated.difficultyRating).toBe('HARD');
    expect(updated.reflection).toBe('Travei no passo 3');
  });
});

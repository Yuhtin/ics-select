import { AdminDashboardService } from './admin-dashboard.service';

function fakePrisma() {
  const users = [
    { id: 'u-1', name: 'A', email: 'a@x.com', pictureUrl: null, role: 'MEMBER' },
    { id: 'u-2', name: 'B', email: 'b@x.com', pictureUrl: null, role: 'MEMBER' },
  ];
  const plans = [
    {
      id: 'p-1',
      userId: 'u-1',
      status: 'PUBLISHED',
      items: [
        { id: 'i-1', libraryItemId: 'li-1', completedAt: new Date('2026-05-02'), outcome: 'DONE_EASY', libraryItem: { tags: ['arrays'] } },
        { id: 'i-2', libraryItemId: 'li-2', completedAt: new Date('2026-05-03'), outcome: 'SKIPPED', libraryItem: { tags: ['dp'] } },
        { id: 'i-3', libraryItemId: 'li-3', completedAt: null, outcome: 'PENDING', libraryItem: { tags: ['graphs'] } },
      ],
    },
    {
      id: 'p-1-draft',
      userId: 'u-1',
      status: 'DRAFT',
      items: [],
    },
  ];
  return {
    user: {
      findMany: jest.fn(async () => users),
      findUnique: jest.fn(async ({ where }: any) => users.find((u) => u.id === where.id) ?? null),
    },
    weeklyPlan: {
      findMany: jest.fn(async ({ where }: any) => {
        if (where.userId) return plans.filter((p) => p.userId === where.userId);
        return plans;
      }),
      count: jest.fn(async ({ where }: any) => {
        return plans.filter(
          (p) => p.userId === where.userId && (where.status === undefined || p.status === where.status),
        ).length;
      }),
    },
    weeklyPlanItem: {
      count: jest.fn(async ({ where }: any) => {
        const rel = plans.filter((p) => p.userId === where.weeklyPlan.userId);
        const items = rel.flatMap((p) => p.items);
        if (where.outcome?.in) return items.filter((i) => where.outcome.in.includes(i.outcome)).length;
        if (typeof where.outcome === 'string') return items.filter((i) => i.outcome === where.outcome).length;
        return items.length;
      }),
      findMany: jest.fn(async ({ where }: any) => {
        const rel = plans.filter((p) => p.userId === where.weeklyPlan.userId);
        let items = rel.flatMap((p) => p.items);
        if (where.outcome?.in) items = items.filter((i) => where.outcome.in.includes(i.outcome));
        else if (typeof where.outcome === 'string') items = items.filter((i) => i.outcome === where.outcome);
        return items;
      }),
    },
  };
}

describe('AdminDashboardService', () => {
  it('getCohort returns per-user aggregated stats', async () => {
    const prisma = fakePrisma();
    const svc = new AdminDashboardService(prisma as any);
    const cohort = await svc.getCohort();
    expect(cohort).toHaveLength(2);
    const first = cohort.find((c) => c.id === 'u-1');
    expect(first?.stats.plansCount).toBe(1);
    // The DRAFT for u-1 should NOT be counted.
    // doneItems = positive outcomes (DONE_EASY + DONE_HARD + SKIPPED) = 2
    expect(first?.stats.doneItems).toBe(2);
    // skippedItems is a sub-breakdown of doneItems
    expect(first?.stats.skippedItems).toBe(1);
    expect(first?.stats.stuckItems).toBe(0);
  });
});

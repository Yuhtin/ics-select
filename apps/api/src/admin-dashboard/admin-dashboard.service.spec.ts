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
        { id: 'i-1', outcome: 'DONE_EASY', libraryItem: { tags: ['arrays'] } },
        { id: 'i-2', outcome: 'PENDING', libraryItem: { tags: ['dp'] } },
      ],
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
      count: jest.fn(async ({ where }: any) => plans.filter((p) => p.userId === where.userId).length),
    },
    weeklyPlanItem: {
      count: jest.fn(async ({ where }: any) => {
        const rel = plans.filter((p) => p.userId === where.weeklyPlan.userId);
        const items = rel.flatMap((p) => p.items);
        if (where.outcome?.in) return items.filter((i) => where.outcome.in.includes(i.outcome)).length;
        if (where.outcome === 'STUCK') return items.filter((i) => i.outcome === 'STUCK').length;
        return items.length;
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
    expect(first?.stats.doneItems).toBe(1);
    expect(first?.stats.stuckItems).toBe(0);
  });
});

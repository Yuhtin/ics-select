import { PlanDraftsService } from './plan-drafts.service';

function makePrisma() {
  return {
    cycleMembership: { findFirst: jest.fn() },
    weeklyPlan: { findFirst: jest.fn(), create: jest.fn() },
  };
}

describe('PlanDraftsService', () => {
  const WEEK_START = new Date('2026-04-20T00:00:00Z');

  it('throws NotFoundException when member has no active cycle', async () => {
    const prisma = makePrisma();
    prisma.cycleMembership.findFirst.mockResolvedValue(null);
    const svc = new PlanDraftsService(prisma as any);
    await expect(svc.getOrCreateDraft({ memberId: 'm1', weekStart: WEEK_START })).rejects.toThrow(/active cycle/);
  });

  it('throws ConflictException PLAN_OUTSIDE_CYCLE when weekStart is before cycle.startsAt', async () => {
    const prisma = makePrisma();
    prisma.cycleMembership.findFirst.mockResolvedValue({
      cycle: {
        id: 'c1',
        startsAt: new Date('2026-05-01T00:00:00Z'),
        endsAt: new Date('2026-07-31T23:59:59Z'),
      },
    });
    const svc = new PlanDraftsService(prisma as any);
    await expect(svc.getOrCreateDraft({ memberId: 'm1', weekStart: WEEK_START })).rejects.toMatchObject({
      response: { error: { code: 'PLAN_OUTSIDE_CYCLE' } },
    });
  });

  it('returns an existing DRAFT without creating anything', async () => {
    const prisma = makePrisma();
    prisma.cycleMembership.findFirst.mockResolvedValue({
      cycle: { id: 'c1', startsAt: new Date('2026-04-01'), endsAt: new Date('2026-07-31') },
    });
    const existing = { id: 'p1', userId: 'm1', status: 'DRAFT', weekStart: WEEK_START, items: [] };
    prisma.weeklyPlan.findFirst.mockResolvedValue(existing);
    const svc = new PlanDraftsService(prisma as any);
    const result = await svc.getOrCreateDraft({ memberId: 'm1', weekStart: WEEK_START });
    expect(result).toBe(existing);
    expect(prisma.weeklyPlan.create).not.toHaveBeenCalled();
  });

  it('returns an existing PUBLISHED plan so the editor can open it', async () => {
    const prisma = makePrisma();
    prisma.cycleMembership.findFirst.mockResolvedValue({
      cycle: { id: 'c1', startsAt: new Date('2026-04-01'), endsAt: new Date('2026-07-31') },
    });
    const existing = { id: 'p1', status: 'PUBLISHED', items: [] };
    prisma.weeklyPlan.findFirst.mockResolvedValue(existing);
    const svc = new PlanDraftsService(prisma as any);
    const result = await svc.getOrCreateDraft({ memberId: 'm1', weekStart: WEEK_START });
    expect(result).toBe(existing);
    expect(prisma.weeklyPlan.create).not.toHaveBeenCalled();
  });

  it('creates a new DRAFT when none exists for the week', async () => {
    const prisma = makePrisma();
    prisma.cycleMembership.findFirst.mockResolvedValue({
      cycle: { id: 'c1', startsAt: new Date('2026-04-01'), endsAt: new Date('2026-07-31') },
    });
    prisma.weeklyPlan.findFirst.mockResolvedValue(null);
    prisma.weeklyPlan.create.mockResolvedValue({ id: 'new-plan', status: 'DRAFT', items: [] });
    const svc = new PlanDraftsService(prisma as any);
    const result = await svc.getOrCreateDraft({ memberId: 'm1', weekStart: WEEK_START });
    expect(prisma.weeklyPlan.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: 'm1',
        cycleId: 'c1',
        weekStart: WEEK_START,
        status: 'DRAFT',
      }),
      include: expect.any(Object),
    }));
    expect(result.id).toBe('new-plan');
  });
});

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

  describe('auto-pick (no weekStart)', () => {
    // Cycle: Apr 23 – Jun 26 (Thu through Fri for easy Monday math)
    const cycle = {
      id: 'c-hot',
      startsAt: new Date('2026-04-23T00:00:00Z'),
      endsAt: new Date('2026-06-26T23:59:59Z'),
    };

    it('creates a draft starting at the cycle.startsAt Monday when today is before the cycle starts', async () => {
      const prisma = makePrisma();
      prisma.cycleMembership.findFirst.mockResolvedValue({ cycle });
      prisma.weeklyPlan.findFirst.mockResolvedValue(null);
      prisma.weeklyPlan.create.mockResolvedValue({ id: 'new-auto', status: 'DRAFT', items: [] });
      const svc = new PlanDraftsService(prisma as any);
      // Today = Apr 17 (Fri), cycle starts Thu Apr 23 — Monday of that week is Apr 20.
      await svc.getOrCreateDraft(
        { memberId: 'm1' },
        new Date('2026-04-17T12:00:00Z'),
      );
      const created = prisma.weeklyPlan.create.mock.calls[0][0].data;
      expect(created.weekStart.toISOString()).toBe('2026-04-20T00:00:00.000Z');
    });

    it('returns the existing DRAFT for the upcoming week instead of creating a duplicate', async () => {
      const prisma = makePrisma();
      prisma.cycleMembership.findFirst.mockResolvedValue({ cycle });
      const existing = { id: 'existing-draft', status: 'DRAFT', items: [] };
      prisma.weeklyPlan.findFirst.mockResolvedValue(existing);
      const svc = new PlanDraftsService(prisma as any);
      const result = await svc.getOrCreateDraft(
        { memberId: 'm1' },
        new Date('2026-04-17T12:00:00Z'),
      );
      expect(result).toBe(existing);
      expect(prisma.weeklyPlan.create).not.toHaveBeenCalled();
    });

    it('returns the existing PUBLISHED plan for the upcoming week instead of walking forward', async () => {
      const prisma = makePrisma();
      prisma.cycleMembership.findFirst.mockResolvedValue({ cycle });
      const existing = { id: 'existing-pub', status: 'PUBLISHED', items: [] };
      prisma.weeklyPlan.findFirst.mockResolvedValue(existing);
      const svc = new PlanDraftsService(prisma as any);
      const result = await svc.getOrCreateDraft(
        { memberId: 'm1' },
        new Date('2026-04-17T12:00:00Z'),
      );
      expect(result).toBe(existing);
      expect(prisma.weeklyPlan.create).not.toHaveBeenCalled();
      // findFirst is called exactly once (no walk).
      expect(prisma.weeklyPlan.findFirst).toHaveBeenCalledTimes(1);
    });

    it('falls back to the latest existing plan when the upcoming week is past cycle.endsAt', async () => {
      const prisma = makePrisma();
      // Today is after cycle.endsAt — next Monday is past the cycle.
      prisma.cycleMembership.findFirst.mockResolvedValue({ cycle });
      const latest = { id: 'latest', status: 'PUBLISHED', items: [] };
      // First findFirst is the fallback "latest plan in cycle" lookup.
      prisma.weeklyPlan.findFirst.mockResolvedValue(latest);
      const svc = new PlanDraftsService(prisma as any);
      const result = await svc.getOrCreateDraft(
        { memberId: 'm1' },
        new Date('2026-07-15T12:00:00Z'),
      );
      expect(result).toBe(latest);
      expect(prisma.weeklyPlan.create).not.toHaveBeenCalled();
    });

    it('throws PLAN_OUTSIDE_CYCLE when upcoming week is past cycle end and no plan exists', async () => {
      const prisma = makePrisma();
      prisma.cycleMembership.findFirst.mockResolvedValue({ cycle });
      prisma.weeklyPlan.findFirst.mockResolvedValue(null);
      const svc = new PlanDraftsService(prisma as any);
      await expect(
        svc.getOrCreateDraft({ memberId: 'm1' }, new Date('2026-07-15T12:00:00Z')),
      ).rejects.toMatchObject({
        response: { error: { code: 'PLAN_OUTSIDE_CYCLE' } },
      });
    });
  });
});

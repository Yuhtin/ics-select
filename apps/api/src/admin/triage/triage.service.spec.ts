import { TriageService } from './triage.service';
import { PrismaService } from '../../common/prisma/prisma.service';

type PrismaMock = {
  cycle: { findFirst: jest.Mock; findMany: jest.Mock };
  cycleMembership: { findMany: jest.Mock };
  weeklyPlan: { findMany: jest.Mock };
  weeklyPlanItem: { findMany: jest.Mock };
  weeklyRetro: { findMany: jest.Mock };
  dismissedAlert: { findMany: jest.Mock };
};

function makePrisma(overrides: Partial<any> = {}): PrismaMock {
  // Mirror the new resolveActiveCycle shape: it queries findMany with
  // include._count, then sorts in code. Tests that override `cycle.findFirst`
  // for the legacy single-active-cycle path also need findMany returning the
  // same row for the new path. We reflect findFirst's resolved value into
  // findMany so existing tests stay green without each opting in.
  const findFirstMock = jest.fn(async () => null);
  const findManyMock = jest.fn(async ({ include }: any = {}) => {
    const single = await findFirstMock();
    if (!single) return [];
    return include?._count?.select?.memberships
      ? [{ ...single, _count: { memberships: 0 } }]
      : [single];
  });
  const base: PrismaMock = {
    cycle: { findFirst: findFirstMock, findMany: findManyMock },
    cycleMembership: { findMany: jest.fn(async () => []) },
    weeklyPlan: { findMany: jest.fn(async () => []) },
    weeklyPlanItem: { findMany: jest.fn(async () => []) },
    weeklyRetro: { findMany: jest.fn(async () => []) },
    dismissedAlert: { findMany: jest.fn(async () => []) },
  };
  for (const key of Object.keys(overrides) as (keyof PrismaMock)[]) {
    base[key] = { ...base[key], ...(overrides[key] as any) };
  }
  // After overrides, re-link cycle.findMany so it pulls from whatever
  // findFirst is now resolving to (overrides commonly replace findFirst).
  if (!('findMany' in (overrides.cycle ?? {}))) {
    base.cycle.findMany = jest.fn(async ({ include }: any = {}) => {
      const single = await base.cycle.findFirst({});
      if (!single) return [];
      return include?._count?.select?.memberships
        ? [{ ...single, _count: { memberships: 0 } }]
        : [single];
    });
  }
  return base;
}

// NOW: Friday 2026-04-17T12:00:00Z
// week Monday: 2026-04-13T00:00:00Z
// week Sunday end: 2026-04-19T23:59:59.999Z
const NOW = new Date('2026-04-17T12:00:00Z');

const activeCycle = {
  id: 'cycle-1',
  name: '2026.1',
  startsAt: new Date('2026-04-06T00:00:00Z'),  // 2 weeks ago Monday
  endsAt: new Date('2026-06-29T00:00:00Z'),     // 12 weeks total approx
  status: 'ACTIVE' as const,
  rankingVisibleToMembers: true,
};

const memberA = {
  userId: 'user-a',
  cycleId: 'cycle-1',
  track: null,
  user: { id: 'user-a', name: 'Alice', pictureUrl: null },
};
const memberB = {
  userId: 'user-b',
  cycleId: 'cycle-1',
  track: null,
  user: { id: 'user-b', name: 'Bob', pictureUrl: null },
};

function makeService(prisma: PrismaMock): TriageService {
  return new TriageService(prisma as unknown as PrismaService);
}

describe('TriageService', () => {
  it('returns empty response when no active cycle', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    const result = await service.getTriage(NOW);
    expect(result).toEqual({ alerts: [], cohortStrip: [], cycleInfo: null });
  });

  it('emits STUCK_RECENT when a member has recent STUCK item', async () => {
    const stuckAt = new Date('2026-04-16T20:00:00Z'); // 16h ago
    const prisma = makePrisma({
      cycle: { findFirst: jest.fn(async () => activeCycle) },
      cycleMembership: { findMany: jest.fn(async () => [memberA]) },
      weeklyPlanItem: {
        findMany: jest.fn(async () => [
          {
            id: 'item-1',
            outcome: 'STUCK',
            completedAt: stuckAt,
            scheduledAt: new Date('2026-04-16T15:00:00Z'),
            weeklyPlan: {
              id: 'plan-1',
              userId: 'user-a',
              weekStart: new Date('2026-04-13T00:00:00Z'),
              weekEnd: new Date('2026-04-19T23:59:59.999Z'),
              user: memberA.user,
            },
          },
        ]),
      },
    });
    const service = makeService(prisma);
    const result = await service.getTriage(NOW);
    const stuckRecent = result.alerts.find((a) => a.type === 'STUCK_RECENT');
    expect(stuckRecent).toBeDefined();
    expect(stuckRecent!.severity).toBe('urgent');
    expect(stuckRecent!.member.id).toBe('user-a');
    expect(stuckRecent!.targetId).toBe('item-1');
    expect(stuckRecent!.occurredAt).toBe(stuckAt.toISOString());
    expect(stuckRecent!.id).toBe('STUCK_RECENT:item-1');
    expect(stuckRecent!.dismissKey).toBe(stuckRecent!.id);
  });

  it('emits FINISHED_EARLY when 100% and >=2 days remaining', async () => {
    // NOW = Fri 2026-04-17T12:00Z, weekEnd = Sun 2026-04-19T23:59:59Z → ~2.5 days left.
    const completedAt = new Date('2026-04-17T10:00:00Z');
    const prisma = makePrisma({
      cycle: { findFirst: jest.fn(async () => activeCycle) },
      cycleMembership: { findMany: jest.fn(async () => [memberA]) },
      weeklyPlan: {
        findMany: jest.fn(async () => [
          {
            id: 'plan-a',
            userId: 'user-a',
            cycleId: 'cycle-1',
            status: 'PUBLISHED',
            weekStart: new Date('2026-04-13T00:00:00Z'),
            weekEnd: new Date('2026-04-19T23:59:59.999Z'),
            items: [
              { id: 'i1', outcome: 'DONE_EASY', completedAt, scheduledAt: null },
              { id: 'i2', outcome: 'DONE_HARD', completedAt, scheduledAt: null },
            ],
          },
        ]),
      },
    });
    const service = makeService(prisma);
    const result = await service.getTriage(new Date('2026-04-17T12:00:00Z'));
    const finished = result.alerts.find((a) => a.type === 'FINISHED_EARLY');
    expect(finished).toBeDefined();
    expect(finished!.severity).toBe('attention');
    expect(finished!.member.id).toBe('user-a');
    expect(finished!.targetId).toBe('plan-a');
    expect(finished!.summary).toMatch(/antecipad|adiantad|cedo|finaliz/i);
  });

  it('emits PLAN_PENDING when week ends in <=3 days and no next plan', async () => {
    // NOW Fri → weekEnd Sun ≈ 2.5 days → triggers PLAN_PENDING.
    const prisma = makePrisma({
      cycle: { findFirst: jest.fn(async () => activeCycle) },
      cycleMembership: { findMany: jest.fn(async () => [memberA]) },
      weeklyPlan: {
        findMany: jest.fn(async () => [
          // Current-week plan only; no plan for next Monday.
          {
            id: 'plan-cur',
            userId: 'user-a',
            cycleId: 'cycle-1',
            status: 'PUBLISHED',
            weekStart: new Date('2026-04-13T00:00:00Z'),
            weekEnd: new Date('2026-04-19T23:59:59.999Z'),
            items: [],
          },
        ]),
      },
    });
    const service = makeService(prisma);
    const result = await service.getTriage(NOW);
    const pending = result.alerts.find((a) => a.type === 'PLAN_PENDING');
    expect(pending).toBeDefined();
    expect(pending!.severity).toBe('scheduled');
    expect(pending!.member.id).toBe('user-a');
    expect(pending!.targetId).toBe('user-a');
  });

  it('emits SKIPPED_RETROS when two prior weeks have no retro', async () => {
    const prisma = makePrisma({
      cycle: { findFirst: jest.fn(async () => activeCycle) },
      cycleMembership: { findMany: jest.fn(async () => [memberA]) },
      // Retros: empty → 2 prior weeks missed.
      weeklyRetro: { findMany: jest.fn(async () => []) },
    });
    const service = makeService(prisma);
    const result = await service.getTriage(NOW);
    const skipped = result.alerts.find((a) => a.type === 'SKIPPED_RETROS');
    expect(skipped).toBeDefined();
    expect(skipped!.severity).toBe('attention');
    expect(skipped!.member.id).toBe('user-a');
    expect(skipped!.targetId).toBe('user-a');
    // occurredAt = start of earliest skipped week = two Mondays before this week = 2026-03-30.
    expect(skipped!.occurredAt).toBe(new Date('2026-03-30T00:00:00.000Z').toISOString());
  });

  it('does NOT emit SKIPPED_RETROS when member submitted both recent retros', async () => {
    const prisma = makePrisma({
      cycle: { findFirst: jest.fn(async () => activeCycle) },
      cycleMembership: { findMany: jest.fn(async () => [memberA]) },
      weeklyRetro: {
        findMany: jest.fn(async () => [
          { userId: 'user-a', weekStart: new Date('2026-03-30T00:00:00.000Z'), submittedAt: new Date('2026-04-05T22:00:00Z') },
          { userId: 'user-a', weekStart: new Date('2026-04-06T00:00:00.000Z'), submittedAt: new Date('2026-04-12T22:00:00Z') },
        ]),
      },
    });
    const service = makeService(prisma);
    const result = await service.getTriage(NOW);
    expect(result.alerts.find((a) => a.type === 'SKIPPED_RETROS')).toBeUndefined();
  });

  it('filters out dismissed alerts matching adminUserId', async () => {
    const stuckAt = new Date('2026-04-16T20:00:00Z');
    const prisma = makePrisma({
      cycle: { findFirst: jest.fn(async () => activeCycle) },
      cycleMembership: { findMany: jest.fn(async () => [memberA]) },
      weeklyPlanItem: {
        findMany: jest.fn(async () => [
          {
            id: 'item-1',
            outcome: 'STUCK',
            completedAt: stuckAt,
            scheduledAt: null,
            weeklyPlan: {
              id: 'plan-1',
              userId: 'user-a',
              weekStart: new Date('2026-04-13T00:00:00Z'),
              weekEnd: new Date('2026-04-19T23:59:59.999Z'),
              user: memberA.user,
            },
          },
        ]),
      },
      dismissedAlert: {
        findMany: jest.fn(async () => [
          {
            userId: 'admin-1',
            alertType: 'STUCK_RECENT',
            targetId: 'item-1',
            expiresAt: new Date('2026-04-18T12:00:00Z'),
          },
        ]),
      },
    });
    const service = makeService(prisma);
    const result = await service.getTriage(NOW, 'admin-1');
    expect(result.alerts.find((a) => a.type === 'STUCK_RECENT')).toBeUndefined();
    expect(prisma.dismissedAlert.findMany).toHaveBeenCalled();
  });

  it('cohortStrip has one entry per member with percentThisWeek + hasAlert flag', async () => {
    const completedAt = new Date('2026-04-17T10:00:00Z');
    const stuckAt = new Date('2026-04-16T20:00:00Z');
    const prisma = makePrisma({
      cycle: { findFirst: jest.fn(async () => activeCycle) },
      cycleMembership: { findMany: jest.fn(async () => [memberA, memberB]) },
      weeklyPlan: {
        findMany: jest.fn(async () => [
          {
            id: 'plan-a',
            userId: 'user-a',
            cycleId: 'cycle-1',
            status: 'PUBLISHED',
            weekStart: new Date('2026-04-13T00:00:00Z'),
            weekEnd: new Date('2026-04-19T23:59:59.999Z'),
            items: [
              { id: 'ia1', outcome: 'DONE_EASY', completedAt, scheduledAt: null },
              { id: 'ia2', outcome: 'PENDING', completedAt: null, scheduledAt: null },
            ],
          },
          {
            id: 'plan-b',
            userId: 'user-b',
            cycleId: 'cycle-1',
            status: 'PUBLISHED',
            weekStart: new Date('2026-04-13T00:00:00Z'),
            weekEnd: new Date('2026-04-19T23:59:59.999Z'),
            items: [
              { id: 'ib1', outcome: 'STUCK', completedAt: stuckAt, scheduledAt: null },
              { id: 'ib2', outcome: 'PENDING', completedAt: null, scheduledAt: null },
            ],
          },
          // Next-week plans published for BOTH members (suppresses PLAN_PENDING).
          {
            id: 'plan-a-next',
            userId: 'user-a',
            cycleId: 'cycle-1',
            status: 'PUBLISHED',
            weekStart: new Date('2026-04-20T00:00:00Z'),
            weekEnd: new Date('2026-04-26T23:59:59.999Z'),
            items: [],
          },
          {
            id: 'plan-b-next',
            userId: 'user-b',
            cycleId: 'cycle-1',
            status: 'PUBLISHED',
            weekStart: new Date('2026-04-20T00:00:00Z'),
            weekEnd: new Date('2026-04-26T23:59:59.999Z'),
            items: [],
          },
        ]),
      },
      // Retros submitted by both members for prior 2 weeks (suppresses SKIPPED_RETROS).
      weeklyRetro: {
        findMany: jest.fn(async () => [
          { userId: 'user-a', weekStart: new Date('2026-03-30T00:00:00.000Z'), submittedAt: new Date('2026-04-05T22:00:00Z') },
          { userId: 'user-a', weekStart: new Date('2026-04-06T00:00:00.000Z'), submittedAt: new Date('2026-04-12T22:00:00Z') },
          { userId: 'user-b', weekStart: new Date('2026-03-30T00:00:00.000Z'), submittedAt: new Date('2026-04-05T22:00:00Z') },
          { userId: 'user-b', weekStart: new Date('2026-04-06T00:00:00.000Z'), submittedAt: new Date('2026-04-12T22:00:00Z') },
        ]),
      },
      weeklyPlanItem: {
        findMany: jest.fn(async () => [
          {
            id: 'ib1',
            outcome: 'STUCK',
            completedAt: stuckAt,
            scheduledAt: null,
            weeklyPlan: {
              id: 'plan-b',
              userId: 'user-b',
              weekStart: new Date('2026-04-13T00:00:00Z'),
              weekEnd: new Date('2026-04-19T23:59:59.999Z'),
              user: memberB.user,
            },
          },
        ]),
      },
    });
    const service = makeService(prisma);
    const result = await service.getTriage(NOW);
    expect(result.cohortStrip).toHaveLength(2);

    const aliceStrip = result.cohortStrip.find((s) => s.userId === 'user-a')!;
    const bobStrip = result.cohortStrip.find((s) => s.userId === 'user-b')!;

    expect(aliceStrip.percentThisWeek).toBe(50); // 1/2 positive
    expect(aliceStrip.hasAlert).toBe(false);
    expect(bobStrip.percentThisWeek).toBe(0); // 0/2 positive
    expect(bobStrip.hasAlert).toBe(true); // STUCK_RECENT

    expect(result.cycleInfo).toBeTruthy();
    expect(result.cycleInfo!.cycleId).toBe('cycle-1');
    expect(result.cycleInfo!.weekNumber).toBeGreaterThanOrEqual(1);
    expect(result.cycleInfo!.daysUntilWeekEnds).toBeGreaterThanOrEqual(0);
    expect(result.cycleInfo!.daysUntilWeekEnds).toBeLessThanOrEqual(6);
  });
});

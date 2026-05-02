import { CockpitService } from './cockpit.service.js';

type Mock = ReturnType<typeof buildPrisma>;

function buildPrisma() {
  return {
    user: { findUnique: jest.fn() },
    cycleMembership: { findFirst: jest.fn(), findMany: jest.fn() },
    weeklyPlan: { findMany: jest.fn() },
    weeklyRetro: { findMany: jest.fn() },
    classSession: { findMany: jest.fn() },
    userEvent: { findFirst: jest.fn(), findMany: jest.fn(), groupBy: jest.fn() },
    topic: { findMany: jest.fn() },
    $queryRawUnsafe: jest.fn(),
  };
}

const NOW = new Date('2026-05-02T12:00:00Z');
const CYCLE = {
  id: 'cy1',
  name: '2026.2',
  startsAt: new Date('2026-03-30T00:00:00Z'),
  endsAt: new Date('2026-06-01T00:00:00Z'),
  status: 'ACTIVE' as const,
};

function seedHappyPath(prisma: Mock): void {
  prisma.user.findUnique.mockResolvedValue({
    id: 'u1', name: 'Maria Clara', email: 'm@x', pictureUrl: null, whatsappPhone: null,
  });
  prisma.cycleMembership.findFirst.mockResolvedValue({
    cycleId: 'cy1', track: 'BIG_TECH', cycle: CYCLE,
  });
  prisma.cycleMembership.findMany.mockResolvedValue([
    { userId: 'u1' }, { userId: 'u2' }, { userId: 'u3' },
  ]);
  prisma.weeklyPlan.findMany.mockResolvedValue([
    {
      id: 'p1',
      weekStart: new Date('2026-04-27T00:00:00Z'),
      cycleId: 'cy1',
      status: 'PUBLISHED',
      publishedAt: new Date('2026-04-27T08:00:00Z'),
      items: [
        { id: 'i1', outcome: 'DONE_EASY', scheduledMinutes: 60, actualMinutes: 45, carriedFromItemId: null, libraryItem: { topics: [{ topicId: 't1', isPrimary: true }] } },
        { id: 'i2', outcome: 'STUCK',     scheduledMinutes: 90, actualMinutes: null, carriedFromItemId: null, libraryItem: { topics: [{ topicId: 't2', isPrimary: true }] } },
      ],
    },
  ]);
  prisma.weeklyRetro.findMany.mockResolvedValue([
    { id: 'r1', weekStart: new Date('2026-04-20T00:00:00Z'), submittedAt: new Date('2026-04-26T00:00:00Z') },
  ]);
  prisma.classSession.findMany.mockResolvedValue([]);
  prisma.userEvent.findFirst
    .mockResolvedValueOnce({ occurredAt: new Date('2026-04-18T00:00:00Z'), type: 'PLAN_VIEW', meta: { surface: '/me/plan' } })  // lastEvent
    .mockResolvedValueOnce({ occurredAt: new Date('2026-04-01T08:00:00Z') });                                                    // firstSession
  prisma.userEvent.findMany.mockResolvedValue([]);
  prisma.userEvent.groupBy.mockResolvedValue([]);
  prisma.topic.findMany.mockResolvedValue([
    { id: 't1', slug: 'foundations', label: 'Foundations', order: 1 },
    { id: 't2', slug: 'algorithms',  label: 'Algorithms', order: 2 },
  ]);
  prisma.$queryRawUnsafe.mockResolvedValue([]);
}

describe('CockpitService', () => {
  it('returns the member identity block', async () => {
    const prisma = buildPrisma();
    seedHappyPath(prisma);
    const svc = new CockpitService(prisma as never);
    const out = await svc.getCockpit('u1', null, 'cycle', NOW);
    expect(out.member.id).toBe('u1');
    expect(out.member.name).toBe('Maria Clara');
  });

  it('resolves the active cycle and reports week position', async () => {
    const prisma = buildPrisma();
    seedHappyPath(prisma);
    const svc = new CockpitService(prisma as never);
    const out = await svc.getCockpit('u1', null, 'cycle', NOW);
    expect(out.cycle?.id).toBe('cy1');
    expect(out.cycle?.weekNumber).toBeGreaterThan(0);
    expect(out.cycle?.weeksTotal).toBeGreaterThan(0);
  });

  it('items: total, planned, byOutcome, needsAttention', async () => {
    const prisma = buildPrisma();
    seedHappyPath(prisma);
    const svc = new CockpitService(prisma as never);
    const out = await svc.getCockpit('u1', null, 'cycle', NOW);
    expect(out.itemsCompleted.total).toBe(2);
    expect(out.itemsCompleted.planned).toBe(2);
    expect(out.itemsCompleted.byOutcome.STUCK).toBe(1);
    expect(out.itemsCompleted.byOutcome.DONE_EASY).toBe(1);
    expect(out.itemsCompleted.needsAttention.total).toBe(1);
    expect(out.itemsCompleted.needsAttention.stuck).toBe(1);
  });

  it('time invested: actualMinutes falls back to scheduledMinutes when null', async () => {
    const prisma = buildPrisma();
    seedHappyPath(prisma);
    const svc = new CockpitService(prisma as never);
    const out = await svc.getCockpit('u1', null, 'cycle', NOW);
    // i1: actual 45 used. i2: actual null, scheduled 90 used. Total 135.
    expect(out.timeInvested.actualMinutes).toBe(135);
    expect(out.timeInvested.scheduledMinutes).toBe(150);
    expect(out.timeInvested.naoSeiCount).toBe(1);
  });

  it('risk verdict is one of the three states', async () => {
    const prisma = buildPrisma();
    seedHappyPath(prisma);
    const svc = new CockpitService(prisma as never);
    const out = await svc.getCockpit('u1', null, 'cycle', NOW);
    expect(['ON_TRACK', 'WATCH', 'AT_RISK']).toContain(out.risk.status);
  });

  it('topicEngagement includes all topics, even untouched ones', async () => {
    const prisma = buildPrisma();
    seedHappyPath(prisma);
    const svc = new CockpitService(prisma as never);
    const out = await svc.getCockpit('u1', null, 'cycle', NOW);
    expect(out.topicEngagement.map((t) => t.topicId).sort()).toEqual(['t1', 't2']);
  });

  it('throws NotFound when member does not exist', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue(null);
    const svc = new CockpitService(prisma as never);
    await expect(svc.getCockpit('nope', null, 'cycle', NOW)).rejects.toThrow('member not found');
  });

  it('returns shell response when member has no membership', async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({ id: 'u1', name: 'M', email: 'm@x', pictureUrl: null, whatsappPhone: null });
    prisma.cycleMembership.findFirst.mockResolvedValue(null);
    const svc = new CockpitService(prisma as never);
    const out = await svc.getCockpit('u1', null, 'cycle', NOW);
    expect(out.cycle).toBeNull();
    expect(out.risk.status).toBe('ON_TRACK');
  });
});

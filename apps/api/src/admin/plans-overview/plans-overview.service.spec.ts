import { NotFoundException } from '@nestjs/common';
import { PlansOverviewService } from './plans-overview.service';

function makePrisma() {
  return {
    cycle: { findUnique: jest.fn() },
    weeklyPlan: { findMany: jest.fn() },
  };
}

const CYCLE = {
  id: 'c-1',
  name: '2026.2',
  startsAt: new Date('2026-04-13T00:00:00Z'),
  endsAt: new Date('2026-06-21T23:59:59Z'),
};

describe('PlansOverviewService', () => {
  it('throws NotFoundException for unknown cycleId', async () => {
    const prisma = makePrisma();
    prisma.cycle.findUnique.mockResolvedValue(null);
    const svc = new PlansOverviewService(prisma as any);
    await expect(svc.list('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns weeks: [] when cycle has no plans', async () => {
    const prisma = makePrisma();
    prisma.cycle.findUnique.mockResolvedValue(CYCLE);
    prisma.weeklyPlan.findMany.mockResolvedValue([]);
    const svc = new PlansOverviewService(prisma as any);
    const result = await svc.list('c-1');
    expect(result.cycle.id).toBe('c-1');
    expect(result.weeks).toEqual([]);
  });

  it('groups plans by weekStart desc and sorts members alphabetically within a week', async () => {
    const prisma = makePrisma();
    prisma.cycle.findUnique.mockResolvedValue(CYCLE);
    const week1 = new Date('2026-04-20T00:00:00Z');
    const week1End = new Date('2026-04-26T23:59:59.999Z');
    const week2 = new Date('2026-04-13T00:00:00Z');
    const week2End = new Date('2026-04-19T23:59:59.999Z');
    prisma.weeklyPlan.findMany.mockResolvedValue([
      {
        id: 'p-pedro-w1',
        status: 'PUBLISHED',
        weekStart: week1,
        weekEnd: week1End,
        publishedAt: new Date('2026-04-20T10:00:00Z'),
        createdAt: new Date('2026-04-19T12:00:00Z'),
        items: [
          { outcome: 'DONE_EASY' },
          { outcome: 'DONE_HARD' },
          { outcome: 'PENDING' },
        ],
        user: { id: 'u-pedro', name: 'Pedro', pictureUrl: null },
      },
      {
        id: 'p-maria-w1',
        status: 'DRAFT',
        weekStart: week1,
        weekEnd: week1End,
        publishedAt: null,
        createdAt: new Date('2026-04-15T08:00:00Z'),
        items: [],
        user: { id: 'u-maria', name: 'Maria', pictureUrl: null },
      },
      {
        id: 'p-maria-w2',
        status: 'PUBLISHED',
        weekStart: week2,
        weekEnd: week2End,
        publishedAt: new Date('2026-04-13T09:00:00Z'),
        createdAt: new Date('2026-04-12T20:00:00Z'),
        items: [{ outcome: 'DONE_EASY' }, { outcome: 'STUCK' }],
        user: { id: 'u-maria', name: 'Maria', pictureUrl: null },
      },
    ]);
    const svc = new PlansOverviewService(prisma as any);
    const result = await svc.list('c-1');

    expect(result.weeks).toHaveLength(2);
    // Newest week first.
    expect(result.weeks[0].weekStart).toBe(week1.toISOString());
    expect(result.weeks[1].weekStart).toBe(week2.toISOString());
    // Within week1, Maria comes before Pedro alphabetically.
    expect(result.weeks[0].plans.map((p) => p.user.name)).toEqual(['Maria', 'Pedro']);
    // Done counts are computed correctly.
    expect(result.weeks[0].plans[1]).toMatchObject({
      id: 'p-pedro-w1',
      status: 'PUBLISHED',
      items: { total: 3, done: 2 },
      lastActivityAt: '2026-04-20T10:00:00.000Z',
    });
    // For draft, lastActivityAt falls back to createdAt.
    expect(result.weeks[0].plans[0].lastActivityAt).toBe('2026-04-15T08:00:00.000Z');
  });

  it('filters by status=draft', async () => {
    const prisma = makePrisma();
    prisma.cycle.findUnique.mockResolvedValue(CYCLE);
    prisma.weeklyPlan.findMany.mockResolvedValue([]);
    const svc = new PlansOverviewService(prisma as any);
    await svc.list('c-1', 'draft');
    expect(prisma.weeklyPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ cycleId: 'c-1', status: 'DRAFT' }),
      }),
    );
  });

  it('filters by status=published', async () => {
    const prisma = makePrisma();
    prisma.cycle.findUnique.mockResolvedValue(CYCLE);
    prisma.weeklyPlan.findMany.mockResolvedValue([]);
    const svc = new PlansOverviewService(prisma as any);
    await svc.list('c-1', 'published');
    expect(prisma.weeklyPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ cycleId: 'c-1', status: 'PUBLISHED' }),
      }),
    );
  });

  it('does not filter by status when status=all', async () => {
    const prisma = makePrisma();
    prisma.cycle.findUnique.mockResolvedValue(CYCLE);
    prisma.weeklyPlan.findMany.mockResolvedValue([]);
    const svc = new PlansOverviewService(prisma as any);
    await svc.list('c-1', 'all');
    const arg = prisma.weeklyPlan.findMany.mock.calls[0][0];
    expect(arg.where).toEqual({ cycleId: 'c-1' });
  });
});

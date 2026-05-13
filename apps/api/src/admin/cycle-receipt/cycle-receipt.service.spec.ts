import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CycleReceiptService } from './cycle-receipt.service';
import type { PrismaService } from '../../common/prisma/prisma.service';

const mockPrisma = () => ({
  cycle: { findUnique: jest.fn() },
  weeklyPlanItem: { findMany: jest.fn().mockResolvedValue([]) },
  weeklyRetro: { groupBy: jest.fn().mockResolvedValue([]) },
  classSession: { findMany: jest.fn().mockResolvedValue([]) },
  classAttendance: { findMany: jest.fn().mockResolvedValue([]) },
});

const makeService = (prisma: ReturnType<typeof mockPrisma>) =>
  new CycleReceiptService(prisma as unknown as PrismaService);

describe('CycleReceiptService — cycle metadata', () => {
  it('throws NotFoundException when cycle does not exist', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(null);
    const svc = makeService(prisma);
    await expect(svc.build('nonexistent', new Date())).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException for UPCOMING cycle that has not started', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'Ciclo 5',
      status: 'UPCOMING',
      startsAt: new Date('2030-06-01T00:00:00Z'),
      endsAt: new Date('2030-08-01T00:00:00Z'),
      memberships: [],
    });
    const svc = makeService(prisma);
    await expect(svc.build('c1', new Date('2026-05-13'))).rejects.toThrow(ConflictException);
  });

  it('throws BadRequestException when asOf is out of range', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'Ciclo 4',
      status: 'ACTIVE',
      startsAt: new Date('2026-04-01T00:00:00Z'),
      endsAt: new Date('2026-06-01T00:00:00Z'),
      memberships: [],
    });
    const svc = makeService(prisma);
    await expect(svc.build('c1', new Date('2026-03-15'))).rejects.toThrow(BadRequestException);
    await expect(svc.build('c1', new Date('2026-06-15'))).rejects.toThrow(BadRequestException);
  });
});

describe('CycleReceiptService — totals + byTopic', () => {
  const cycleBase = {
    id: 'c1',
    name: 'Ciclo 4',
    status: 'ACTIVE' as const,
    startsAt: new Date('2026-04-01T00:00:00Z'),
    endsAt: new Date('2026-06-01T00:00:00Z'),
    memberships: [
      { userId: 'u1', user: { id: 'u1', name: 'Alice', pictureUrl: null } },
      { userId: 'u2', user: { id: 'u2', name: 'Bob', pictureUrl: null } },
    ],
  };

  it('sums estimatedMinutes (not actualMinutes) for items with positive outcome', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    prisma.weeklyPlanItem.findMany.mockResolvedValue([
      { outcome: 'DONE_EASY', completedAt: new Date('2026-04-10T15:00:00Z'),
        actualMinutes: 999,
        libraryItem: { estimatedMinutes: 60, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] },
        weeklyPlan: { userId: 'u1' } },
      { outcome: 'DONE_HARD', completedAt: new Date('2026-04-12T15:00:00Z'),
        actualMinutes: null,
        libraryItem: { estimatedMinutes: 30, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] },
        weeklyPlan: { userId: 'u2' } },
    ]);
    const svc = makeService(prisma);
    const r = await svc.build('c1', new Date('2026-05-13'));
    expect(r.totals.totalMinutes).toBe(90);
    expect(r.totals.itemsCompleted).toBe(2);
    expect(r.totals.avgMinutesPerMember).toBe(45);
  });

  it('cross-topic items count for every topic they cover', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    prisma.weeklyPlanItem.findMany.mockResolvedValue([
      { outcome: 'DONE_EASY', completedAt: new Date('2026-04-10T15:00:00Z'),
        libraryItem: { estimatedMinutes: 60, topics: [
          { topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } },
          { topicId: 't2', topic: { id: 't2', slug: 'tree', label: 'Tree', order: 2 } },
        ] }, weeklyPlan: { userId: 'u1' } },
    ]);
    const svc = makeService(prisma);
    const r = await svc.build('c1', new Date('2026-05-13'));
    expect(r.byTopic.find(t => t.slug === 'hashmap')?.itemsCompleted).toBe(1);
    expect(r.byTopic.find(t => t.slug === 'tree')?.itemsCompleted).toBe(1);
    expect(r.byTopic.find(t => t.slug === 'hashmap')?.membersReached).toBe(1);
    expect(r.byTopic.find(t => t.slug === 'tree')?.membersReached).toBe(1);
  });

  it('byTopic sorted by coveragePct desc, ties by Topic.order asc, excludes zero-coverage', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    prisma.weeklyPlanItem.findMany.mockResolvedValue([
      { outcome: 'DONE_EASY', completedAt: new Date('2026-04-10T15:00:00Z'),
        libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't1', topic: { id: 't1', slug: 'hashmap', label: 'Hashmap', order: 1 } }] },
        weeklyPlan: { userId: 'u1' } },
      { outcome: 'DONE_EASY', completedAt: new Date('2026-04-10T15:00:00Z'),
        libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't2', topic: { id: 't2', slug: 'tree', label: 'Tree', order: 2 } }] },
        weeklyPlan: { userId: 'u1' } },
      { outcome: 'DONE_EASY', completedAt: new Date('2026-04-10T15:00:00Z'),
        libraryItem: { estimatedMinutes: 1, topics: [{ topicId: 't2', topic: { id: 't2', slug: 'tree', label: 'Tree', order: 2 } }] },
        weeklyPlan: { userId: 'u2' } },
    ]);
    const svc = makeService(prisma);
    const r = await svc.build('c1', new Date('2026-05-13'));
    expect(r.byTopic.map(t => t.slug)).toEqual(['tree', 'hashmap']);
  });

  it('positive-outcomes filter passed to Prisma includes DONE_EASY/HARD/DOUBTS/SKIPPED only', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(cycleBase);
    const svc = makeService(prisma);
    await svc.build('c1', new Date('2026-05-13'));
    const positiveCall = prisma.weeklyPlanItem.findMany.mock.calls.find(
      (call: any[]) => call[0]?.where?.outcome?.in,
    );
    expect(positiveCall).toBeDefined();
    const outcomes: string[] = positiveCall![0].where.outcome.in;
    expect(outcomes).toEqual(expect.arrayContaining(['DONE_EASY', 'DONE_HARD', 'DOUBTS', 'SKIPPED']));
    expect(outcomes).not.toContain('PENDING');
    expect(outcomes).not.toContain('STUCK');
  });
});

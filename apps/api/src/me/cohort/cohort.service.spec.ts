import { Test } from '@nestjs/testing';
import { CohortService } from './cohort.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const makePrismaMock = () => ({
  cycleMembership: { findFirst: jest.fn() },
  cycle: { findUnique: jest.fn() },
  weeklyPlan: { findMany: jest.fn() },
  weeklyPlanItem: { findMany: jest.fn() },
  weeklyRetro: { findMany: jest.fn() },
  $queryRawUnsafe: jest.fn(async () => []) as any,
});

describe('CohortService', () => {
  let service: CohortService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    const mod = await Test.createTestingModule({
      providers: [CohortService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = mod.get(CohortService);
  });

  it('returns empty result when user has no active membership', async () => {
    prisma.cycleMembership.findFirst.mockResolvedValue(null);
    const result = await service.getCohort('user-1', new Date('2026-04-17T19:00:00Z'));
    expect(result.feed).toEqual([]);
    expect(result.ranking).toBeUndefined();
    expect(result.memberCount).toBe(0);
  });

  it('omits ranking when the cycle has rankingVisibleToMembers=false', async () => {
    prisma.cycleMembership.findFirst.mockResolvedValue({
      cycleId: 'c-1',
      cycle: {
        id: 'c-1',
        name: '2026.1',
        rankingVisibleToMembers: false,
        startsAt: new Date('2026-04-01T00:00:00Z'),
        endsAt: new Date('2026-06-30T00:00:00Z'),
      },
    } as any);
    prisma.cycle.findUnique.mockResolvedValue({
      id: 'c-1',
      name: '2026.1',
      rankingVisibleToMembers: false,
      startsAt: new Date('2026-04-01T00:00:00Z'),
      endsAt: new Date('2026-06-30T00:00:00Z'),
      memberships: [
        { userId: 'user-1', user: { id: 'user-1', name: 'Me', email: 'me@inteli.edu.br', pictureUrl: null } },
        { userId: 'user-2', user: { id: 'user-2', name: 'Alice', email: 'alice@inteli.edu.br', pictureUrl: null } },
      ],
    } as any);
    prisma.weeklyPlanItem.findMany.mockResolvedValue([]);
    prisma.weeklyRetro.findMany.mockResolvedValue([]);
    const result = await service.getCohort('user-1', new Date('2026-04-17T19:00:00Z'));
    expect(result.ranking).toBeUndefined();
    expect(result.memberCount).toBe(2);
  });

  it('includes sorted score-based ranking with isMe flag when visible', async () => {
    prisma.cycleMembership.findFirst.mockResolvedValue({
      cycleId: 'c-1',
      cycle: {
        id: 'c-1',
        name: '2026.1',
        rankingVisibleToMembers: true,
        startsAt: new Date('2026-04-01T00:00:00Z'),
        endsAt: new Date('2026-06-30T00:00:00Z'),
      },
    } as any);
    prisma.cycle.findUnique.mockResolvedValue({
      id: 'c-1',
      name: '2026.1',
      rankingVisibleToMembers: true,
      startsAt: new Date('2026-04-01T00:00:00Z'),
      endsAt: new Date('2026-06-30T00:00:00Z'),
      memberships: [
        { userId: 'user-1', user: { id: 'user-1', name: 'Me', email: 'me@inteli.edu.br', pictureUrl: null } },
        { userId: 'user-2', user: { id: 'user-2', name: 'Alice', email: 'alice@inteli.edu.br', pictureUrl: null } },
      ],
    } as any);
    prisma.weeklyPlanItem.findMany.mockResolvedValue([]);
    prisma.weeklyRetro.findMany.mockResolvedValue([]);
    // user-1 (Me) — high engagement; user-2 (Alice) — low engagement
    prisma.$queryRawUnsafe.mockResolvedValue([
      {
        userId: 'user-1',
        daysActive: 5,
        itemsDone: 5,
        itemsPlanned: 10,
        retrosSubmitted: 1,
        daysSinceLastSession: 2,
        classesAttended: 2,
        classesHeld: 2,
      },
      {
        userId: 'user-2',
        daysActive: 1,
        itemsDone: 1,
        itemsPlanned: 10,
        retrosSubmitted: 0,
        daysSinceLastSession: 10,
        classesAttended: 0,
        classesHeld: 2,
      },
    ]);

    const result = await service.getCohort('user-1', new Date('2026-04-17T19:00:00Z'));
    expect(result.ranking).toHaveLength(2);
    expect(result.ranking![0]!.userId).toBe('user-1');   // Me (higher engagement score)
    expect(result.ranking![1]!.userId).toBe('user-2');   // Alice (lower score)
    expect(result.ranking!.find((r) => r.isMe)?.userId).toBe('user-1');
  });

  it('returns ranking with score=0 for all members when $queryRawUnsafe returns empty', async () => {
    prisma.cycleMembership.findFirst.mockResolvedValue({
      cycleId: 'c-1',
      cycle: {
        id: 'c-1',
        name: '2026.1',
        rankingVisibleToMembers: true,
        startsAt: new Date('2026-04-01T00:00:00Z'),
        endsAt: new Date('2026-06-30T00:00:00Z'),
      },
    } as any);
    prisma.cycle.findUnique.mockResolvedValue({
      id: 'c-1',
      name: '2026.1',
      rankingVisibleToMembers: true,
      startsAt: new Date('2026-04-01T00:00:00Z'),
      endsAt: new Date('2026-06-30T00:00:00Z'),
      memberships: [
        { userId: 'user-1', user: { id: 'user-1', name: 'Me', email: 'me@inteli.edu.br', pictureUrl: null } },
      ],
    } as any);
    prisma.weeklyPlanItem.findMany.mockResolvedValue([]);
    prisma.weeklyRetro.findMany.mockResolvedValue([]);
    // Empty rows — no engagement data yet
    prisma.$queryRawUnsafe.mockResolvedValue([]);

    const result = await service.getCohort('user-1', new Date('2026-04-17T19:00:00Z'));
    expect(result.ranking).toBeDefined();
    expect(result.ranking!.every((r) => r.score === 0)).toBe(true);
  });

  it('builds feed from recent item outcomes + retros (last 24h)', async () => {
    prisma.cycleMembership.findFirst.mockResolvedValue({
      cycleId: 'c-1',
      cycle: {
        id: 'c-1',
        name: '2026.1',
        rankingVisibleToMembers: false,
        startsAt: new Date('2026-04-01T00:00:00Z'),
        endsAt: new Date('2026-06-30T00:00:00Z'),
      },
    } as any);
    prisma.cycle.findUnique.mockResolvedValue({
      id: 'c-1',
      name: '2026.1',
      rankingVisibleToMembers: false,
      startsAt: new Date('2026-04-01T00:00:00Z'),
      endsAt: new Date('2026-06-30T00:00:00Z'),
      memberships: [
        { userId: 'user-1', user: { id: 'user-1', name: 'Me', email: 'me@inteli.edu.br', pictureUrl: null } },
        { userId: 'user-2', user: { id: 'user-2', name: 'Alice', email: 'alice@inteli.edu.br', pictureUrl: null } },
      ],
    } as any);
    prisma.weeklyPlanItem.findMany.mockResolvedValue([
      {
        id: 'item-1', outcome: 'DONE_EASY',
        completedAt: new Date('2026-04-17T18:30:00Z'),
        libraryItem: { title: 'Arrays intro' },
        weeklyPlan: {
          userId: 'user-2',
          user: { id: 'user-2', name: 'Alice', pictureUrl: null },
        },
      },
      {
        id: 'item-2', outcome: 'STUCK',
        completedAt: new Date('2026-04-17T17:00:00Z'),
        libraryItem: { title: 'DP memo' },
        weeklyPlan: {
          userId: 'user-3',
          user: { id: 'user-3', name: 'Bob', pictureUrl: null },
        },
      },
    ] as any);
    prisma.weeklyRetro.findMany.mockResolvedValue([
      {
        id: 'retro-1',
        userId: 'user-2',
        submittedAt: new Date('2026-04-17T18:45:00Z'),
        user: { id: 'user-2', name: 'Alice', pictureUrl: null },
      },
    ] as any);

    const result = await service.getCohort('user-1', new Date('2026-04-17T19:00:00Z'));
    expect(result.feed).toHaveLength(3);
    // Most recent first
    expect(result.feed[0]!.kind).toBe('posted_retro');
    expect(result.feed[1]!.kind).toBe('finished');
    expect(result.feed[2]!.kind).toBe('got_stuck');
  });
});

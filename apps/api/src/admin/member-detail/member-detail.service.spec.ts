import { NotFoundException } from '@nestjs/common';
import { MemberDetailService } from './member-detail.service';
import { PrismaService } from '../../common/prisma/prisma.service';

type PrismaMock = {
  user: { findUnique: jest.Mock };
  cycleMembership: { findFirst: jest.Mock };
  weeklyPlan: { findMany: jest.Mock };
  weeklyRetro: { findMany: jest.Mock };
  topic: { findMany: jest.Mock };
};

function makePrisma(overrides: Partial<any> = {}): PrismaMock {
  const base: PrismaMock = {
    user: { findUnique: jest.fn(async () => null) },
    cycleMembership: { findFirst: jest.fn(async () => null) },
    weeklyPlan: { findMany: jest.fn(async () => []) },
    weeklyRetro: { findMany: jest.fn(async () => []) },
    topic: { findMany: jest.fn(async () => []) },
  };
  for (const key of Object.keys(overrides) as (keyof PrismaMock)[]) {
    base[key] = { ...base[key], ...(overrides[key] as any) };
  }
  return base;
}

function makeService(prisma: PrismaMock): MemberDetailService {
  return new MemberDetailService(prisma as unknown as PrismaService);
}

// NOW: Friday 2026-04-17T12:00:00Z
const NOW = new Date('2026-04-17T12:00:00Z');

const defaultMember = {
  id: 'user-a',
  name: 'Alice',
  email: 'alice@example.com',
  pictureUrl: 'https://example.com/a.jpg',
  whatsappPhone: '+5511999999999',
  role: 'MEMBER' as const,
};

const defaultCycle = {
  id: 'cycle-1',
  name: '2026.1',
  startsAt: new Date('2026-04-06T00:00:00Z'),
  endsAt: new Date('2026-06-29T00:00:00Z'),
  status: 'ACTIVE' as const,
};

const defaultMembership = {
  userId: 'user-a',
  cycleId: 'cycle-1',
  track: 'BIG_TECH' as const,
  cycle: defaultCycle,
};

describe('MemberDetailService', () => {
  it('throws NotFoundException when user not found', async () => {
    const prisma = makePrisma();
    const service = makeService(prisma);
    await expect(service.getDetail('missing', NOW)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getDetail('missing', NOW)).rejects.toThrow('member not found');
  });

  it('returns cycle = null and empty topicCoverage when no active-cycle membership', async () => {
    const prisma = makePrisma({
      user: { findUnique: jest.fn(async () => defaultMember) },
      cycleMembership: { findFirst: jest.fn(async () => null) },
    });
    const service = makeService(prisma);
    const result = await service.getDetail('user-a', NOW);
    expect(result.cycle).toBeNull();
    expect(result.topicCoverage).toEqual([]);
    // Other basics still populated.
    expect(result.member.id).toBe('user-a');
    expect(result.member.name).toBe('Alice');
    expect(result.member.email).toBe('alice@example.com');
    expect(result.member.whatsappPhone).toBe('+5511999999999');
    expect(result.member.pictureUrl).toBe('https://example.com/a.jpg');
    expect(result.member.role).toBe('MEMBER');
    expect(result.member.track).toBeNull();
    expect(result.timeline).toEqual([]);
    expect(result.retros).toEqual([]);
  });

  it('returns member.track from membership when present', async () => {
    const prisma = makePrisma({
      user: { findUnique: jest.fn(async () => defaultMember) },
      cycleMembership: { findFirst: jest.fn(async () => defaultMembership) },
    });
    const service = makeService(prisma);
    const result = await service.getDetail('user-a', NOW);
    expect(result.member.track).toBe('BIG_TECH');
    expect(result.cycle).not.toBeNull();
    expect(result.cycle!.id).toBe('cycle-1');
    expect(result.cycle!.name).toBe('2026.1');
    expect(result.cycle!.startsAt).toBe('2026-04-06T00:00:00.000Z');
    expect(result.cycle!.endsAt).toBe('2026-06-29T00:00:00.000Z');
    // Cycle: 84 days → 12 weeks.
    expect(result.cycle!.weeksTotal).toBe(12);
    // NOW = 2026-04-17 → ~11 days in → week 2.
    expect(result.cycle!.weekNumber).toBe(2);
  });

  it('timeline newest-first with outcomes + reflections + topicLabel flattened', async () => {
    const plans = [
      {
        id: 'plan-new',
        weekStart: new Date('2026-04-13T00:00:00Z'),
        weekEnd: new Date('2026-04-19T23:59:59Z'),
        status: 'PUBLISHED' as const,
        items: [
          {
            id: 'wpi-1',
            libraryItemId: 'li-1',
            outcome: 'DONE_EASY' as const,
            reflection: 'clicked fast',
            completedAt: new Date('2026-04-14T10:00:00Z'),
            libraryItem: {
              title: 'Arrays basics',
              topics: [{ isPrimary: true, topic: { label: 'Arrays' } }],
            },
          },
          {
            id: 'wpi-2',
            libraryItemId: 'li-2',
            outcome: 'STUCK' as const,
            reflection: null,
            completedAt: null,
            libraryItem: {
              title: 'Two sum',
              topics: [],
            },
          },
        ],
      },
      {
        id: 'plan-old',
        weekStart: new Date('2026-04-06T00:00:00Z'),
        weekEnd: new Date('2026-04-12T23:59:59Z'),
        status: 'PUBLISHED' as const,
        items: [
          {
            id: 'wpi-3',
            libraryItemId: 'li-3',
            outcome: 'DOUBTS' as const,
            reflection: 'partial understanding',
            completedAt: new Date('2026-04-08T09:00:00Z'),
            libraryItem: {
              title: 'Strings intro',
              topics: [{ isPrimary: true, topic: { label: 'Strings' } }],
            },
          },
        ],
      },
    ];

    const prisma = makePrisma({
      user: { findUnique: jest.fn(async () => defaultMember) },
      cycleMembership: { findFirst: jest.fn(async () => defaultMembership) },
      weeklyPlan: { findMany: jest.fn(async () => plans) },
    });
    const service = makeService(prisma);
    const result = await service.getDetail('user-a', NOW);

    expect(result.timeline).toHaveLength(2);
    expect(result.timeline[0]!.planId).toBe('plan-new');
    expect(result.timeline[1]!.planId).toBe('plan-old');
    expect(result.timeline[0]!.status).toBe('PUBLISHED');
    expect(result.timeline[0]!.weekStart).toBe('2026-04-13T00:00:00.000Z');
    expect(result.timeline[0]!.weekEnd).toBe('2026-04-19T23:59:59.000Z');

    const first = result.timeline[0]!;
    expect(first.items).toHaveLength(2);
    expect(first.items[0]!.id).toBe('wpi-1');
    expect(first.items[0]!.title).toBe('Arrays basics');
    expect(first.items[0]!.outcome).toBe('DONE_EASY');
    expect(first.items[0]!.reflection).toBe('clicked fast');
    expect(first.items[0]!.topicLabel).toBe('Arrays');
    expect(first.items[0]!.completedAt).toBe('2026-04-14T10:00:00.000Z');

    // Topic-less items flatten to null, completedAt null stays null.
    expect(first.items[1]!.topicLabel).toBeNull();
    expect(first.items[1]!.completedAt).toBeNull();
    expect(first.items[1]!.reflection).toBeNull();

    // Verify the newest-first orderBy + take: 6 and PUBLISHED filter.
    expect(prisma.weeklyPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-a', status: 'PUBLISHED' }),
        orderBy: { weekStart: 'desc' },
        take: 6,
      }),
    );
  });

  it('retros query is newest-first with take: 8', async () => {
    const submittedAt = new Date('2026-04-12T22:00:00Z');
    const retros = Array.from({ length: 8 }).map((_, i) => ({
      id: `retro-${i}`,
      weekStart: new Date(Date.UTC(2026, 3, 6 - i * 7)),
      whatClicked: `clicked ${i}`,
      whatStuck: `stuck ${i}`,
      nextWeekWish: `wish ${i}`,
      submittedAt: new Date(submittedAt.getTime() - i * 1000),
    }));

    const prisma = makePrisma({
      user: { findUnique: jest.fn(async () => defaultMember) },
      cycleMembership: { findFirst: jest.fn(async () => defaultMembership) },
      weeklyRetro: { findMany: jest.fn(async () => retros) },
    });
    const service = makeService(prisma);
    const result = await service.getDetail('user-a', NOW);

    expect(result.retros).toHaveLength(8);
    expect(result.retros[0]!.id).toBe('retro-0');
    expect(result.retros[0]!.whatClicked).toBe('clicked 0');
    expect(result.retros[0]!.whatStuck).toBe('stuck 0');
    expect(result.retros[0]!.nextWeekWish).toBe('wish 0');
    expect(result.retros[0]!.submittedAt).toBe(submittedAt.toISOString());

    expect(prisma.weeklyRetro.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-a' },
        orderBy: { submittedAt: 'desc' },
        take: 8,
      }),
    );
  });

  it('topicCoverage: 2 items of a topic in active cycle, 1 DONE_EASY + 1 STUCK → planned 2, done 1, 50%', async () => {
    const topicA = { id: 'topic-a', slug: 'arrays', label: 'Arrays', order: 0 };
    const topicB = { id: 'topic-b', slug: 'dp', label: 'Dynamic Programming', order: 1 };

    const cyclePlans = [
      {
        id: 'plan-1',
        items: [
          { outcome: 'DONE_EASY', libraryItem: { topics: [{ topicId: 'topic-a' }] } },
          { outcome: 'STUCK', libraryItem: { topics: [{ topicId: 'topic-a' }] } },
          { outcome: 'PENDING', libraryItem: { topics: [] } },
        ],
      },
    ];

    // weeklyPlan.findMany is called twice: once for timeline (PUBLISHED) and once
    // for coverage (active cycle). Return plans only for the coverage query.
    const findMany = jest.fn(async (args: any) => {
      if (args?.where?.status === 'PUBLISHED') return [];
      return cyclePlans;
    });

    const prisma = makePrisma({
      user: { findUnique: jest.fn(async () => defaultMember) },
      cycleMembership: { findFirst: jest.fn(async () => defaultMembership) },
      weeklyPlan: { findMany },
      topic: { findMany: jest.fn(async () => [topicA, topicB]) },
    });
    const service = makeService(prisma);
    const result = await service.getDetail('user-a', NOW);

    expect(result.topicCoverage).toHaveLength(2);
    const arrays = result.topicCoverage.find((t) => t.topicId === 'topic-a')!;
    expect(arrays.itemsPlanned).toBe(2);
    expect(arrays.itemsDone).toBe(1);
    expect(arrays.coveragePct).toBe(50);
    expect(arrays.topicSlug).toBe('arrays');
    expect(arrays.topicLabel).toBe('Arrays');
    expect(arrays.order).toBe(0);

    const dp = result.topicCoverage.find((t) => t.topicId === 'topic-b')!;
    expect(dp.itemsPlanned).toBe(0);
    expect(dp.itemsDone).toBe(0);
    expect(dp.coveragePct).toBe(0);
  });
});

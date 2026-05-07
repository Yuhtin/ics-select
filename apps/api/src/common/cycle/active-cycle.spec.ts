import {
  computeWeekPosition,
  resolveActiveCycle,
  resolveActiveMembership,
  resolveWaitlistTargetCycle,
} from './active-cycle';

function makePrisma() {
  const cycles: any[] = [];
  const memberships: any[] = [];
  const includesCycleFor = (row: any, where: any) => {
    const c = row.cycle;
    if (!c) return false;
    if (where.status && c.status !== where.status) return false;
    if (where.startsAt?.lte && c.startsAt > where.startsAt.lte) return false;
    if (where.startsAt?.gt && c.startsAt <= where.startsAt.gt) return false;
    if (where.endsAt?.gte && c.endsAt < where.endsAt.gte) return false;
    return true;
  };
  const matchesCycle = (c: any, where: any) => {
    if (where.status && c.status !== where.status) return false;
    if (where.startsAt?.lte && c.startsAt > where.startsAt.lte) return false;
    if (where.startsAt?.gt && c.startsAt <= where.startsAt.gt) return false;
    if (where.endsAt?.gte && c.endsAt < where.endsAt.gte) return false;
    return true;
  };
  return {
    cycles,
    memberships,
    cycle: {
      findFirst: jest.fn(async ({ where, orderBy }: any) => {
        const matches = cycles.filter((c) => matchesCycle(c, where));
        if (orderBy?.startsAt === 'asc') matches.sort((a, b) => a.startsAt - b.startsAt);
        if (orderBy?.startsAt === 'desc') matches.sort((a, b) => b.startsAt - a.startsAt);
        return matches[0] ?? null;
      }),
      findMany: jest.fn(async ({ where, orderBy, take, include }: any) => {
        let matches = cycles.filter((c) => matchesCycle(c, where));
        if (orderBy?.startsAt === 'asc') matches.sort((a, b) => a.startsAt - b.startsAt);
        if (orderBy?.startsAt === 'desc') matches.sort((a, b) => b.startsAt - a.startsAt);
        if (include?._count?.select?.memberships) {
          matches = matches.map((c) => ({
            ...c,
            _count: {
              memberships: memberships.filter(
                (m) => m.cycleId === c.id || m.cycle?.id === c.id,
              ).length,
            },
          }));
        }
        return take ? matches.slice(0, take) : matches;
      }),
    },
    cycleMembership: {
      findFirst: jest.fn(async ({ where, orderBy }: any) => {
        const matches = memberships.filter(
          (m) =>
            (!where.userId || m.userId === where.userId) &&
            includesCycleFor(m, where.cycle ?? {}),
        );
        if (orderBy?.cycle?.startsAt === 'asc')
          matches.sort((a, b) => a.cycle.startsAt - b.cycle.startsAt);
        if (orderBy?.cycle?.startsAt === 'desc')
          matches.sort((a, b) => b.cycle.startsAt - a.cycle.startsAt);
        return matches[0] ?? null;
      }),
    },
  };
}

const NOW = new Date('2026-04-17T12:00:00Z');

describe('resolveActiveCycle', () => {
  it('returns the cycle whose date range contains now', async () => {
    const prisma = makePrisma();
    prisma.cycles.push(
      {
        id: 'past',
        status: 'ACTIVE',
        startsAt: new Date('2026-01-01'),
        endsAt: new Date('2026-03-31'),
      },
      {
        id: 'current',
        status: 'ACTIVE',
        startsAt: new Date('2026-04-01'),
        endsAt: new Date('2026-06-30'),
      },
      {
        id: 'future',
        status: 'ACTIVE',
        startsAt: new Date('2026-07-01'),
        endsAt: new Date('2026-09-30'),
      },
    );
    const result = await resolveActiveCycle(prisma as any, NOW);
    expect(result?.id).toBe('current');
  });

  it('falls back to the nearest future cycle when no cycle contains now', async () => {
    const prisma = makePrisma();
    prisma.cycles.push(
      {
        id: 'past',
        status: 'ACTIVE',
        startsAt: new Date('2026-01-01'),
        endsAt: new Date('2026-03-31'),
      },
      {
        id: 'near-future',
        status: 'ACTIVE',
        startsAt: new Date('2026-05-01'),
        endsAt: new Date('2026-06-30'),
      },
      {
        id: 'far-future',
        status: 'ACTIVE',
        startsAt: new Date('2026-09-01'),
        endsAt: new Date('2026-11-30'),
      },
    );
    const result = await resolveActiveCycle(prisma as any, NOW);
    expect(result?.id).toBe('near-future');
  });

  it('ignores ARCHIVED cycles', async () => {
    const prisma = makePrisma();
    prisma.cycles.push({
      id: 'archived',
      status: 'ARCHIVED',
      startsAt: new Date('2026-04-01'),
      endsAt: new Date('2026-06-30'),
    });
    const result = await resolveActiveCycle(prisma as any, NOW);
    expect(result).toBeNull();
  });

  it('returns null when every active cycle is already past', async () => {
    const prisma = makePrisma();
    prisma.cycles.push({
      id: 'past',
      status: 'ACTIVE',
      startsAt: new Date('2026-01-01'),
      endsAt: new Date('2026-03-31'),
    });
    const result = await resolveActiveCycle(prisma as any, NOW);
    expect(result).toBeNull();
  });

  it('prefers the cycle with more memberships when two ACTIVE cycles overlap', async () => {
    const prisma = makePrisma();
    prisma.cycles.push(
      {
        id: 'main',
        status: 'ACTIVE',
        startsAt: new Date('2026-04-01'),
        endsAt: new Date('2026-06-30'),
      },
      {
        id: 'bench',
        status: 'ACTIVE',
        // Later startsAt — under the old `desc` rule, would have won.
        startsAt: new Date('2026-04-15'),
        endsAt: new Date('2026-06-30'),
      },
    );
    prisma.memberships.push(
      { id: 'm1', userId: 'u1', cycleId: 'main' },
      { id: 'm2', userId: 'u2', cycleId: 'main' },
      { id: 'm3', userId: 'u3', cycleId: 'main' },
      { id: 'm4', userId: 'u4', cycleId: 'bench' },
    );
    const result = await resolveActiveCycle(prisma as any, NOW);
    expect(result?.id).toBe('main');
  });

  it('uses earliest startsAt as tiebreak when membership counts are equal', async () => {
    const prisma = makePrisma();
    prisma.cycles.push(
      {
        id: 'older',
        status: 'ACTIVE',
        startsAt: new Date('2026-04-01'),
        endsAt: new Date('2026-06-30'),
      },
      {
        id: 'newer',
        status: 'ACTIVE',
        startsAt: new Date('2026-04-15'),
        endsAt: new Date('2026-06-30'),
      },
    );
    prisma.memberships.push(
      { id: 'm1', userId: 'u1', cycleId: 'older' },
      { id: 'm2', userId: 'u2', cycleId: 'newer' },
    );
    const result = await resolveActiveCycle(prisma as any, NOW);
    expect(result?.id).toBe('older');
  });

  it('does not leak the _count wrapper to callers', async () => {
    const prisma = makePrisma();
    prisma.cycles.push({
      id: 'current',
      status: 'ACTIVE',
      startsAt: new Date('2026-04-01'),
      endsAt: new Date('2026-06-30'),
    });
    const result = await resolveActiveCycle(prisma as any, NOW);
    expect(result).not.toHaveProperty('_count');
  });
});

describe('resolveActiveMembership', () => {
  it('prefers the membership whose cycle contains now', async () => {
    const prisma = makePrisma();
    prisma.memberships.push(
      {
        id: 'm-future',
        userId: 'u1',
        cycle: {
          id: 'future',
          status: 'ACTIVE',
          startsAt: new Date('2026-07-01'),
          endsAt: new Date('2026-09-30'),
        },
      },
      {
        id: 'm-current',
        userId: 'u1',
        cycle: {
          id: 'current',
          status: 'ACTIVE',
          startsAt: new Date('2026-04-01'),
          endsAt: new Date('2026-06-30'),
        },
      },
    );
    const result = await resolveActiveMembership(prisma as any, 'u1', NOW);
    expect(result?.id).toBe('m-current');
  });

  it('falls back to nearest upcoming membership when none are current', async () => {
    const prisma = makePrisma();
    prisma.memberships.push({
      id: 'm-upcoming',
      userId: 'u1',
      cycle: {
        id: 'upcoming',
        status: 'ACTIVE',
        startsAt: new Date('2026-05-01'),
        endsAt: new Date('2026-06-30'),
      },
    });
    const result = await resolveActiveMembership(prisma as any, 'u1', NOW);
    expect(result?.id).toBe('m-upcoming');
  });
});

describe('resolveWaitlistTargetCycle', () => {
  it('returns null when there are no cycles', async () => {
    const prisma = makePrisma();
    const result = await resolveWaitlistTargetCycle(prisma as any, NOW);
    expect(result).toBeNull();
  });

  it('returns null when only a running cycle exists and there is no upcoming one', async () => {
    const prisma = makePrisma();
    prisma.cycles.push({
      id: 'running',
      status: 'ACTIVE',
      startsAt: new Date('2026-04-01'),
      endsAt: new Date('2026-06-30'),
    });
    const result = await resolveWaitlistTargetCycle(prisma as any, NOW);
    expect(result).toBeNull();
  });

  it('returns the upcoming cycle when a running cycle exists', async () => {
    const prisma = makePrisma();
    prisma.cycles.push(
      { id: 'running',  status: 'ACTIVE', startsAt: new Date('2026-04-01'), endsAt: new Date('2026-06-30') },
      { id: 'upcoming', status: 'ACTIVE', startsAt: new Date('2026-07-01'), endsAt: new Date('2026-12-31') },
    );
    const result = await resolveWaitlistTargetCycle(prisma as any, NOW);
    expect(result?.id).toBe('upcoming');
  });

  it('returns null when only one upcoming cycle exists (it is the imminent one, already being selected for)', async () => {
    const prisma = makePrisma();
    prisma.cycles.push({
      id: 'imminent',
      status: 'ACTIVE',
      startsAt: new Date('2026-07-01'),
      endsAt: new Date('2026-12-31'),
    });
    const result = await resolveWaitlistTargetCycle(prisma as any, NOW);
    expect(result).toBeNull();
  });

  it('skips the imminent upcoming cycle and returns the second when no cycle is running', async () => {
    const prisma = makePrisma();
    prisma.cycles.push(
      { id: 'imminent', status: 'ACTIVE', startsAt: new Date('2026-05-01'), endsAt: new Date('2026-07-31') },
      { id: 'target',   status: 'ACTIVE', startsAt: new Date('2026-08-01'), endsAt: new Date('2026-11-30') },
      { id: 'later',    status: 'ACTIVE', startsAt: new Date('2026-12-01'), endsAt: new Date('2027-02-28') },
    );
    const result = await resolveWaitlistTargetCycle(prisma as any, NOW);
    expect(result?.id).toBe('target');
  });

  it('returns the earliest upcoming cycle after the running one when multiple exist', async () => {
    const prisma = makePrisma();
    prisma.cycles.push(
      { id: 'running', status: 'ACTIVE', startsAt: new Date('2026-04-01'), endsAt: new Date('2026-06-30') },
      { id: 'next',    status: 'ACTIVE', startsAt: new Date('2026-07-01'), endsAt: new Date('2026-09-30') },
      { id: 'later',   status: 'ACTIVE', startsAt: new Date('2026-10-01'), endsAt: new Date('2026-12-31') },
    );
    const result = await resolveWaitlistTargetCycle(prisma as any, NOW);
    expect(result?.id).toBe('next');
  });

  it('excludes ARCHIVED cycles', async () => {
    const prisma = makePrisma();
    prisma.cycles.push({
      id: 'archived',
      status: 'ARCHIVED',
      startsAt: new Date('2026-07-01'),
      endsAt: new Date('2026-12-31'),
    });
    const result = await resolveWaitlistTargetCycle(prisma as any, NOW);
    expect(result).toBeNull();
  });
});

describe('computeWeekPosition', () => {
  it('returns weekNumber=0 and daysUntilStart when the cycle is future', () => {
    const future = { id: 'f', startsAt: new Date('2026-04-20T00:00:00Z'), endsAt: new Date('2026-06-30T00:00:00Z') };
    const result = computeWeekPosition(future, NOW);
    expect(result.weekNumber).toBe(0);
    expect(result.hasStarted).toBe(false);
    expect(result.daysUntilStart).toBe(3);
    expect(result.daysUntilWeekEnds).toBe(0);
  });

  it('returns weekNumber=1 in the first week of a running cycle', () => {
    const running = { id: 'r', startsAt: new Date('2026-04-14T00:00:00Z'), endsAt: new Date('2026-07-14T00:00:00Z') };
    const result = computeWeekPosition(running, NOW);
    expect(result.weekNumber).toBe(1);
    expect(result.hasStarted).toBe(true);
    expect(result.daysUntilStart).toBe(0);
  });

  it('caps weekNumber at weeksTotal once the cycle is over', () => {
    const past = { id: 'p', startsAt: new Date('2026-01-01T00:00:00Z'), endsAt: new Date('2026-03-31T00:00:00Z') };
    const result = computeWeekPosition(past, NOW);
    expect(result.weekNumber).toBe(result.weeksTotal);
  });
});

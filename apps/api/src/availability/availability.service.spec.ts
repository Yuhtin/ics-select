import { AvailabilityService } from './availability.service';

type A = {
  id: string;
  userId: string;
  mondayMinutes: number;
  tuesdayMinutes: number;
  wednesdayMinutes: number;
  thursdayMinutes: number;
  fridayMinutes: number;
  saturdayMinutes: number;
  sundayMinutes: number;
  preferredSessionMinutes: number;
  timezone: string;
};

type UserRow = { id: string; whatsappPhone: string | null };
type MembershipRow = { id: string; userId: string; cycleId: string; track: string | null };
type CycleRow = { id: string; status: string; startsAt?: Date; endsAt?: Date };

function fakePrisma() {
  const rows = new Map<string, A>();
  const users = new Map<string, UserRow>();
  const memberships = new Map<string, MembershipRow>();
  const cycles = new Map<string, CycleRow>();

  return {
    rows,
    users,
    memberships,
    cycles,
    memberAvailability: {
      findUnique: jest.fn(async ({ where }: { where: { userId: string } }) =>
        rows.get(where.userId) ?? null,
      ),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = rows.get(where.userId);
        const next: A = existing
          ? { ...existing, ...update }
          : { id: `a-${rows.size + 1}`, ...create };
        rows.set(where.userId, next);
        return next;
      }),
    },
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) =>
        users.get(where.id) ?? null,
      ),
      update: jest.fn(async ({ where, data }: any) => {
        const existing = users.get(where.id) ?? { id: where.id, whatsappPhone: null };
        const next = { ...existing, ...data };
        users.set(where.id, next);
        return next;
      }),
    },
    cycleMembership: {
      findFirst: jest.fn(async ({ where }: any) => {
        for (const m of memberships.values()) {
          if (m.userId !== where.userId) continue;
          const cycle = cycles.get(m.cycleId);
          if (!cycle) continue;
          const cycleFilter = where.cycle ?? {};
          if (cycleFilter.status && cycle.status !== cycleFilter.status) continue;
          // Honor the date-range filters our helper uses.
          if (cycleFilter.startsAt?.lte && cycle.startsAt && cycle.startsAt > cycleFilter.startsAt.lte) continue;
          if (cycleFilter.startsAt?.gt && cycle.startsAt && cycle.startsAt <= cycleFilter.startsAt.gt) continue;
          if (cycleFilter.endsAt?.gte && cycle.endsAt && cycle.endsAt < cycleFilter.endsAt.gte) continue;
          return m;
        }
        return null;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const existing = memberships.get(where.id);
        if (!existing) return null;
        const next = { ...existing, ...data };
        memberships.set(where.id, next);
        return next;
      }),
    },
  };
}

describe('AvailabilityService', () => {
  it('upsert creates a new availability row with defaults', async () => {
    const prisma = fakePrisma();
    const svc = new AvailabilityService(prisma as any);
    const row = await svc.upsert('user-1', {
      mondayMinutes: 60,
      tuesdayMinutes: 60,
      wednesdayMinutes: 0,
      thursdayMinutes: 30,
      fridayMinutes: 0,
      saturdayMinutes: 90,
      sundayMinutes: 0,
      preferredSessionMinutes: 45,
      timezone: 'America/Sao_Paulo',
    });
    expect(row.mondayMinutes).toBe(60);
    expect(row.preferredSessionMinutes).toBe(45);
    expect(prisma.rows.get('user-1')?.saturdayMinutes).toBe(90);
  });

  it('get returns null when no row exists', async () => {
    const prisma = fakePrisma();
    const svc = new AvailabilityService(prisma as any);
    expect(await svc.get('u')).toBeNull();
  });
});

describe('AvailabilityService.updateProfile', () => {
  function makeFullPrisma() {
    const prisma = fakePrisma();
    prisma.users.set('user-1', { id: 'user-1', whatsappPhone: null });
    // Seed a cycle whose date range contains "now" so resolveActiveMembership
    // picks it in either contains-now or nearest-future branch.
    const nowMs = Date.now();
    prisma.cycles.set('cycle-1', {
      id: 'cycle-1',
      status: 'ACTIVE',
      startsAt: new Date(nowMs - 30 * 24 * 60 * 60 * 1000),
      endsAt: new Date(nowMs + 30 * 24 * 60 * 60 * 1000),
    });
    prisma.memberships.set('mem-1', {
      id: 'mem-1',
      userId: 'user-1',
      cycleId: 'cycle-1',
      track: null,
    });
    return prisma;
  }

  it('updates whatsappPhone on User', async () => {
    const prisma = makeFullPrisma();
    const svc = new AvailabilityService(prisma as any);
    const result = await svc.updateProfile('user-1', { whatsappPhone: '+5511999999999' });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { whatsappPhone: '+5511999999999' },
    });
    expect(result.user?.whatsappPhone).toBe('+5511999999999');
    expect(result.membership).toBeNull();
  });

  it('updates track on the active CycleMembership', async () => {
    const prisma = makeFullPrisma();
    const svc = new AvailabilityService(prisma as any);
    const result = await svc.updateProfile('user-1', { targetTrack: 'BIG_TECH' });
    expect(prisma.cycleMembership.update).toHaveBeenCalledWith({
      where: { id: 'mem-1' },
      data: { track: 'BIG_TECH' },
    });
    expect(result.membership?.track).toBe('BIG_TECH');
  });

  it('updates both phone and track at once', async () => {
    const prisma = makeFullPrisma();
    const svc = new AvailabilityService(prisma as any);
    const result = await svc.updateProfile('user-1', {
      whatsappPhone: '+5521988887777',
      targetTrack: 'STARTUP',
    });
    expect(result.user?.whatsappPhone).toBe('+5521988887777');
    expect(result.membership?.track).toBe('STARTUP');
  });

  it('clears whatsappPhone when null is passed', async () => {
    const prisma = makeFullPrisma();
    prisma.users.set('user-1', { id: 'user-1', whatsappPhone: '+5511999999999' });
    const svc = new AvailabilityService(prisma as any);
    const result = await svc.updateProfile('user-1', { whatsappPhone: null });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { whatsappPhone: null },
    });
    expect(result.user?.whatsappPhone).toBeNull();
  });

  it('clears track when null is passed', async () => {
    const prisma = makeFullPrisma();
    prisma.memberships.set('mem-1', {
      id: 'mem-1',
      userId: 'user-1',
      cycleId: 'cycle-1',
      track: 'BIG_TECH',
    });
    const svc = new AvailabilityService(prisma as any);
    const result = await svc.updateProfile('user-1', { targetTrack: null });
    expect(prisma.cycleMembership.update).toHaveBeenCalledWith({
      where: { id: 'mem-1' },
      data: { track: null },
    });
    expect(result.membership?.track).toBeNull();
  });

  it('skips membership update when no active cycle exists', async () => {
    const prisma = makeFullPrisma();
    prisma.cycles.set('cycle-1', { id: 'cycle-1', status: 'CLOSED' });
    const svc = new AvailabilityService(prisma as any);
    const result = await svc.updateProfile('user-1', { targetTrack: 'OTHER' });
    expect(prisma.cycleMembership.update).not.toHaveBeenCalled();
    expect(result.membership).toBeNull();
  });
});

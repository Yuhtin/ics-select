import { AvailabilityService } from './availability.service';
import type { AvailabilityPatchInput } from './availability.types';

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
  const slotRows = new Map<string, {
    id: string; userId: string; dayOfWeek: number;
    startMinute: number; endMinute: number;
  }>();

  const api: any = {
    rows,
    users,
    memberships,
    cycles,
    slotRows,
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
    cycle: {
      findFirst: jest.fn(async ({ where, orderBy }: any) => {
        const list: CycleRow[] = [];
        for (const c of cycles.values()) {
          if (where?.status && c.status !== where.status) continue;
          if (where?.startsAt?.lte && c.startsAt && c.startsAt > where.startsAt.lte) continue;
          if (where?.startsAt?.gt && c.startsAt && c.startsAt <= where.startsAt.gt) continue;
          if (where?.endsAt?.gte && c.endsAt && c.endsAt < where.endsAt.gte) continue;
          list.push(c);
        }
        if (orderBy?.startsAt === 'asc') {
          list.sort((a, b) => (a.startsAt?.getTime() ?? 0) - (b.startsAt?.getTime() ?? 0));
        }
        return list[0] ?? null;
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
      create: jest.fn(async ({ data }: any) => {
        const id = `mem-${memberships.size + 1}`;
        const next: MembershipRow = { id, ...data };
        memberships.set(id, next);
        return next;
      }),
    },
    availabilitySlot: {
      findMany: jest.fn(async ({ where, orderBy }: any) => {
        const out: any[] = [];
        for (const s of slotRows.values()) {
          if (where?.userId && s.userId !== where.userId) continue;
          out.push(s);
        }
        // Support orderBy [{ dayOfWeek: 'asc' }, { startMinute: 'asc' }] if passed
        out.sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.startMinute - b.startMinute);
        return out;
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        let n = 0;
        for (const [id, s] of slotRows) {
          if (where?.userId && s.userId !== where.userId) continue;
          if (where?.dayOfWeek !== undefined) {
            const target = where.dayOfWeek.in ?? [where.dayOfWeek];
            if (!target.includes(s.dayOfWeek)) continue;
          }
          slotRows.delete(id);
          n += 1;
        }
        return { count: n };
      }),
      createMany: jest.fn(async ({ data }: any) => {
        for (const d of data) {
          const id = `slot-${slotRows.size + 1}`;
          slotRows.set(id, { id, ...d });
        }
        return { count: data.length };
      }),
    },
    $transaction: jest.fn(async (cb: any) => cb(api)),
  };
  return api;
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
    prisma.memberships.delete('mem-1');
    const svc = new AvailabilityService(prisma as any);
    const result = await svc.updateProfile('user-1', { targetTrack: 'OTHER' });
    expect(prisma.cycleMembership.update).not.toHaveBeenCalled();
    expect(prisma.cycleMembership.create).not.toHaveBeenCalled();
    expect(result.membership).toBeNull();
  });

  it('auto-creates membership in active cycle when user has none (onboarding path)', async () => {
    const prisma = makeFullPrisma();
    // User has no membership yet — simulates fresh post-login member.
    prisma.memberships.delete('mem-1');
    const svc = new AvailabilityService(prisma as any);
    const result = await svc.updateProfile('user-1', { targetTrack: 'BIG_TECH' });
    expect(prisma.cycleMembership.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', cycleId: 'cycle-1', track: 'BIG_TECH' },
    });
    expect(result.membership?.track).toBe('BIG_TECH');
  });
});

describe('AvailabilityService.upsert with slots', () => {
  it('replaces slots for the days present in payload, leaves others untouched', async () => {
    const prisma = fakePrisma();
    prisma.slotRows.set('pre-1', {
      id: 'pre-1', userId: 'user-1', dayOfWeek: 1, startMinute: 0, endMinute: 60,
    });
    prisma.slotRows.set('pre-2', {
      id: 'pre-2', userId: 'user-1', dayOfWeek: 2, startMinute: 600, endMinute: 720,
    });
    const svc = new AvailabilityService(prisma as any);
    const patch: AvailabilityPatchInput = {
      preferredSessionMinutes: 60,
      timezone: 'America/Sao_Paulo',
      slots: [
        { dayOfWeek: 0, startMinute: 480, endMinute: 600 },
        { dayOfWeek: 0, startMinute: 1140, endMinute: 1320 },
        { dayOfWeek: 1, startMinute: 0, endMinute: 30 },
      ],
    };
    const out = await svc.upsert('user-1', patch);
    const monday = out.slots.filter((s) => s.dayOfWeek === 0);
    expect(monday).toHaveLength(2);
    const tuesday = out.slots.filter((s) => s.dayOfWeek === 1);
    expect(tuesday).toHaveLength(1);
    expect(tuesday[0]!.startMinute).toBe(0);
    expect(tuesday[0]!.endMinute).toBe(30);
    const wednesday = out.slots.filter((s) => s.dayOfWeek === 2);
    expect(wednesday).toHaveLength(1);
    expect(wednesday[0]!.startMinute).toBe(600);
  });

  it('clearDays wipes slots for those days without introducing new ones', async () => {
    const prisma = fakePrisma();
    prisma.slotRows.set('pre-1', {
      id: 'pre-1', userId: 'user-1', dayOfWeek: 0, startMinute: 480, endMinute: 600,
    });
    prisma.slotRows.set('pre-2', {
      id: 'pre-2', userId: 'user-1', dayOfWeek: 1, startMinute: 480, endMinute: 600,
    });
    const svc = new AvailabilityService(prisma as any);
    const out = await svc.upsert('user-1', {
      preferredSessionMinutes: 60,
      timezone: 'America/Sao_Paulo',
      clearDays: [0],
    });
    expect(out.slots.filter((s) => s.dayOfWeek === 0)).toHaveLength(0);
    expect(out.slots.filter((s) => s.dayOfWeek === 1)).toHaveLength(1);
  });

  it('rejects overlapping slots with BadRequestException', async () => {
    const prisma = fakePrisma();
    const svc = new AvailabilityService(prisma as any);
    await expect(
      svc.upsert('user-1', {
        preferredSessionMinutes: 60,
        timezone: 'America/Sao_Paulo',
        slots: [
          { dayOfWeek: 0, startMinute: 480, endMinute: 720 },
          { dayOfWeek: 0, startMinute: 600, endMinute: 900 },
        ],
      }),
    ).rejects.toThrow(/overlap/);
  });

  it('allows null day caps (no cap)', async () => {
    const prisma = fakePrisma();
    const svc = new AvailabilityService(prisma as any);
    const out = await svc.upsert('user-1', {
      mondayMinutes: null,
      tuesdayMinutes: 120,
      preferredSessionMinutes: 60,
      timezone: 'America/Sao_Paulo',
      slots: [{ dayOfWeek: 0, startMinute: 480, endMinute: 1320 }],
    });
    expect(out.mondayMinutes).toBeNull();
    expect(out.tuesdayMinutes).toBe(120);
  });
});

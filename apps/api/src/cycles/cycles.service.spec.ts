import { CyclesService } from './cycles.service';

type C = {
  id: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  status: 'ACTIVE' | 'ARCHIVED';
};
type M = { id: string; userId: string; cycleId: string };

function fakePrisma(seed?: { cycles?: C[]; memberships?: M[]; users?: Array<{ id: string; email: string }> }) {
  const cycles = new Map<string, C>(seed?.cycles?.map((c) => [c.id, c]) ?? []);
  const memberships = new Map<string, M>(
    seed?.memberships?.map((m) => [m.id, m]) ?? [],
  );
  const users = new Map<string, { id: string; email: string }>(
    seed?.users?.map((u) => [u.id, u]) ?? [],
  );
  return {
    cycle: {
      create: jest.fn(async ({ data }: { data: Omit<C, 'id'> }) => {
        const id = `c-${cycles.size + 1}`;
        const rec = { id, ...data } as C;
        cycles.set(id, rec);
        return rec;
      }),
      findMany: jest.fn(async () => Array.from(cycles.values())),
      findUnique: jest.fn(async ({ where: { id } }: { where: { id: string } }) =>
        cycles.get(id) ?? null,
      ),
      update: jest.fn(async ({ where: { id }, data }: { where: { id: string }; data: Partial<C> }) => {
        const cur = cycles.get(id)!;
        const next = { ...cur, ...data };
        cycles.set(id, next);
        return next;
      }),
    },
    cycleMembership: {
      findMany: jest.fn(async () => Array.from(memberships.values())),
      findFirst: jest.fn(
        async ({ where, include: _i }: { where: any; include?: any }) => {
          // Crude implementation of the overlap query used by
          // findOverlappingActiveMembership. Filters by userId, optional
          // cycleId (not), and the cycle's status / date range.
          for (const m of memberships.values()) {
            if (m.userId !== where.userId) continue;
            if (where.cycleId?.not && m.cycleId === where.cycleId.not) continue;
            const cyc = cycles.get(m.cycleId);
            if (!cyc) continue;
            const wc = where.cycle;
            if (wc) {
              if (wc.status?.not && cyc.status === wc.status.not) continue;
              if (wc.startsAt?.lte && cyc.startsAt > wc.startsAt.lte) continue;
              if (wc.endsAt?.gte && cyc.endsAt < wc.endsAt.gte) continue;
            }
            return { ...m, cycle: cyc };
          }
          return null;
        },
      ),
      create: jest.fn(async ({ data }: { data: { userId: string; cycleId: string } }) => {
        const id = `m-${memberships.size + 1}`;
        const rec = { id, ...data } as M;
        memberships.set(id, rec);
        return rec;
      }),
      delete: jest.fn(async () => ({})),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
    user: {
      findUnique: jest.fn(async ({ where: { id } }: { where: { id: string } }) => {
        const u = users.get(id);
        return u ? { email: u.email } : null;
      }),
    },
    invitedEmail: {
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
  };
}

describe('CyclesService', () => {
  it('creates a cycle as ACTIVE by default', async () => {
    const prisma = fakePrisma();
    const svc = new CyclesService(prisma as any);
    const cycle = await svc.create({
      name: '2026.1',
      startsAt: new Date('2026-04-01'),
      endsAt: new Date('2026-07-01'),
    });
    expect(cycle.status).toBe('ACTIVE');
  });

  it('archives a cycle', async () => {
    const prisma = fakePrisma();
    const svc = new CyclesService(prisma as any);
    const cycle = await svc.create({
      name: '2026.1',
      startsAt: new Date('2026-04-01'),
      endsAt: new Date('2026-07-01'),
    });
    const archived = await svc.archive(cycle.id);
    expect(archived.status).toBe('ARCHIVED');
  });

  it('update persists rankingVisibleToMembers toggle', async () => {
    const prisma = fakePrisma();
    const svc = new CyclesService(prisma as any);
    const cycle = await svc.create({
      name: '2026.1',
      startsAt: new Date('2026-04-01'),
      endsAt: new Date('2026-07-01'),
    });
    const updated = await svc.update(cycle.id, { rankingVisibleToMembers: true });
    expect(prisma.cycle.update).toHaveBeenCalledWith({
      where: { id: cycle.id },
      data: { rankingVisibleToMembers: true },
    });
    expect((updated as any).rankingVisibleToMembers).toBe(true);
  });

  describe('addMember', () => {
    const main: C = {
      id: 'c-main',
      name: '2026.2',
      startsAt: new Date('2026-04-01'),
      endsAt: new Date('2026-07-01'),
      status: 'ACTIVE',
    };
    const bench: C = {
      id: 'c-bench',
      name: '2026.2 - Bench',
      startsAt: new Date('2026-04-01'),
      endsAt: new Date('2026-07-01'),
      status: 'ACTIVE',
    };
    const future: C = {
      id: 'c-future',
      name: '2026.3',
      startsAt: new Date('2026-08-01'),
      endsAt: new Date('2026-11-01'),
      status: 'ACTIVE',
    };
    const archived: C = {
      id: 'c-old',
      name: '2025.2',
      startsAt: new Date('2025-08-01'),
      endsAt: new Date('2025-12-01'),
      status: 'ARCHIVED',
    };

    it('enrolls a new user with no prior membership', async () => {
      const prisma = fakePrisma({
        cycles: [main],
        users: [{ id: 'u-1', email: 'a@x' }],
      });
      const svc = new CyclesService(prisma as any);
      const m = await svc.addMember('c-main', 'u-1');
      expect(m.cycleId).toBe('c-main');
      expect(prisma.invitedEmail.deleteMany).toHaveBeenCalledWith({
        where: { email: 'a@x' },
      });
    });

    it('rejects when user already has an overlapping ACTIVE membership', async () => {
      const prisma = fakePrisma({
        cycles: [main, bench],
        memberships: [{ id: 'm-1', userId: 'u-1', cycleId: 'c-main' }],
        users: [{ id: 'u-1', email: 'a@x' }],
      });
      const svc = new CyclesService(prisma as any);
      await expect(svc.addMember('c-bench', 'u-1')).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'member-already-in-overlapping-cycle',
          conflictCycleId: 'c-main',
        }),
      });
    });

    it('allows enrollment in a future cycle that does not overlap', async () => {
      const prisma = fakePrisma({
        cycles: [main, future],
        memberships: [{ id: 'm-1', userId: 'u-1', cycleId: 'c-main' }],
        users: [{ id: 'u-1', email: 'a@x' }],
      });
      const svc = new CyclesService(prisma as any);
      const m = await svc.addMember('c-future', 'u-1');
      expect(m.cycleId).toBe('c-future');
    });

    it('ignores ARCHIVED memberships when checking overlap', async () => {
      const prisma = fakePrisma({
        cycles: [main, archived],
        memberships: [{ id: 'm-1', userId: 'u-1', cycleId: 'c-old' }],
        users: [{ id: 'u-1', email: 'a@x' }],
      });
      const svc = new CyclesService(prisma as any);
      // Even though c-old has a membership, it's ARCHIVED and predates main —
      // does not block enrollment.
      const m = await svc.addMember('c-main', 'u-1');
      expect(m.cycleId).toBe('c-main');
    });

    it('throws NotFoundException when target cycle does not exist', async () => {
      const prisma = fakePrisma({ users: [{ id: 'u-1', email: 'a@x' }] });
      const svc = new CyclesService(prisma as any);
      await expect(svc.addMember('c-missing', 'u-1')).rejects.toThrow(
        /not found/i,
      );
    });
  });
});

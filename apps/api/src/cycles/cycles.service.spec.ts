import { CyclesService } from './cycles.service';

type C = { id: string; name: string; startsAt: Date; endsAt: Date; status: 'ACTIVE' | 'ARCHIVED' };

function fakePrisma() {
  const cycles = new Map<string, C>();
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
      findMany: jest.fn(async () => []),
      create: jest.fn(async () => ({})),
      delete: jest.fn(async () => ({})),
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
});

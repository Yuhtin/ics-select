import { WaitlistService } from './waitlist.service.js';

function makePrisma() {
  type Row = {
    id: string;
    name: string;
    email: string;
    course: string;
    skillLevel: number;
    year: number;
    github: string | null;
    linkedin: string | null;
    cycleTarget: string;
    ipHash: string | null;
    userAgent: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  const byEmail = new Map<string, Row>();
  let nextId = 1;

  const upsert = jest.fn(async ({ where, create, update }: any) => {
    const existing = byEmail.get(where.email);
    if (existing) {
      const next: Row = { ...existing, ...update, updatedAt: new Date() };
      byEmail.set(where.email, next);
      return next;
    }
    const row: Row = {
      id: `w-${nextId++}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      github: null,
      linkedin: null,
      ipHash: null,
      userAgent: null,
      ...create,
    };
    byEmail.set(where.email, row);
    return row;
  });

  const findMany = jest.fn(async ({ where, skip = 0, take = 50, cursor }: any = {}) => {
    let rows = Array.from(byEmail.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    if (where?.course)            rows = rows.filter((r) => r.course === where.course);
    if (where?.skillLevel?.gte)   rows = rows.filter((r) => r.skillLevel >= where.skillLevel.gte);
    if (where?.skillLevel?.lte)   rows = rows.filter((r) => r.skillLevel <= where.skillLevel.lte);
    if (where?.OR) {
      const needles = where.OR.map((c: any) =>
        (c.name?.contains ?? c.email?.contains ?? '').toLowerCase(),
      );
      rows = rows.filter((r) =>
        needles.some((n: string) => r.name.toLowerCase().includes(n) || r.email.includes(n)),
      );
    }
    if (cursor?.id) {
      const idx = rows.findIndex((r) => r.id === cursor.id);
      if (idx >= 0) rows = rows.slice(idx + 1);
    }
    return rows.slice(skip, skip + take);
  });

  const count = jest.fn(async ({ where }: any = {}) => {
    const rows = await findMany({ where });
    return rows.length;
  });

  const groupBy = jest.fn(async ({ by }: any) => {
    const rows = Array.from(byEmail.values());
    const field = by[0] as keyof Row;
    const keyOf = (r: Row): string => String(r[field]);
    const valOf = (r: Row): unknown => r[field];
    const countMap = new Map<string, number>();
    const valMap = new Map<string, unknown>();
    for (const r of rows) {
      const k = keyOf(r);
      countMap.set(k, (countMap.get(k) ?? 0) + 1);
      valMap.set(k, valOf(r));
    }
    return Array.from(countMap, ([k, n]) => ({ [field]: valMap.get(k), _count: { _all: n } }));
  });

  const cycles: Array<{ id: string; name: string; startsAt: Date; endsAt: Date; status: string }> = [];
  const filterCycles = (where: any) => {
    let rows = cycles.filter((c) => c.status === (where?.status ?? c.status));
    if (where?.startsAt?.lte && where?.endsAt?.gte) {
      rows = rows.filter((c) => c.startsAt <= where.startsAt.lte && c.endsAt >= where.endsAt.gte);
    } else if (where?.startsAt?.gt) {
      rows = rows.filter((c) => c.startsAt > where.startsAt.gt);
    }
    return rows;
  };
  const sortCycles = (rows: typeof cycles, orderBy: any) => {
    if (orderBy?.startsAt === 'desc') rows.sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
    else if (orderBy?.startsAt === 'asc') rows.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
    return rows;
  };
  const cycleFindFirst = jest.fn(async ({ where, orderBy }: any = {}) => {
    const rows = sortCycles(filterCycles(where), orderBy);
    return rows[0] ?? null;
  });
  const cycleFindMany = jest.fn(async ({ where, orderBy, take }: any = {}) => {
    const rows = sortCycles(filterCycles(where), orderBy);
    return take ? rows.slice(0, take) : rows;
  });

  return {
    waitlistEntry: { upsert, findMany, count, groupBy },
    cycle: { findFirst: cycleFindFirst, findMany: cycleFindMany },
    _byEmail: byEmail,
    _cycles: cycles,
  };
}

// Seeds two upcoming cycles: imminent (selection already in progress) + target
// (the one waitlist signups go to). Matches the production rule: always skip
// the nearest cycle and queue for the one after it.
function seedWaitlistTarget(prisma: ReturnType<typeof makePrisma>) {
  const day = 24 * 60 * 60 * 1000;
  const weekFromNow = Date.now() + 7 * day;
  prisma._cycles.push(
    {
      id: 'imminent',
      name: '2026.2',
      startsAt: new Date(weekFromNow),
      endsAt: new Date(weekFromNow + 60 * day),
      status: 'ACTIVE',
    },
    {
      id: 'target',
      name: '2026.3',
      startsAt: new Date(weekFromNow + 90 * day),
      endsAt: new Date(weekFromNow + 270 * day),
      status: 'ACTIVE',
    },
  );
}

const VALID = {
  name: 'Ada Lovelace',
  email: 'ada@sou.inteli.edu.br',
  course: 'CIENCIA_COMPUTACAO' as const,
  skillLevel: 4,
  year: 2,
  github: 'https://github.com/ada',
  linkedin: undefined,
};

describe('WaitlistService', () => {
  it('upserts a new submission by email', async () => {
    const prisma = makePrisma();
    seedWaitlistTarget(prisma);
    const svc = new WaitlistService(prisma as any);
    await svc.submit({ ...VALID }, 'ip-hash-a', 'ua-a');
    expect(prisma.waitlistEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'ada@sou.inteli.edu.br' },
        create: expect.objectContaining({
          name: 'Ada Lovelace',
          course: 'CIENCIA_COMPUTACAO',
          skillLevel: 4,
          year: 2,
          cycleTarget: '2026.3',
          ipHash: 'ip-hash-a',
          userAgent: 'ua-a',
        }),
      }),
    );
  });

  it('silent-drops when honeypot website field is filled', async () => {
    const prisma = makePrisma();
    const svc = new WaitlistService(prisma as any);
    await svc.submit({ ...VALID, website: 'http://spam.example' } as any, 'ip', 'ua');
    expect(prisma.waitlistEntry.upsert).not.toHaveBeenCalled();
  });

  it('on re-submit by the same email, update overwrites fields but cycleTarget comes from server', async () => {
    const prisma = makePrisma();
    seedWaitlistTarget(prisma);
    const svc = new WaitlistService(prisma as any);
    await svc.submit({ ...VALID }, 'ip-a', 'ua-a');
    await svc.submit({ ...VALID, skillLevel: 5 }, 'ip-b', 'ua-b');
    const stored = prisma._byEmail.get('ada@sou.inteli.edu.br')!;
    expect(stored.skillLevel).toBe(5);
    expect(stored.cycleTarget).toBe('2026.3');
    expect(stored.ipHash).toBe('ip-b');
  });

  it('list returns rows matching filters, newest first, paginated', async () => {
    const prisma = makePrisma();
    seedWaitlistTarget(prisma);
    const svc = new WaitlistService(prisma as any);
    await svc.submit({ ...VALID, email: 'a@x.com', course: 'CIENCIA_COMPUTACAO', skillLevel: 3 }, null, null);
    await svc.submit({ ...VALID, email: 'b@x.com', course: 'ADMINISTRACAO',       skillLevel: 5 }, null, null);
    await svc.submit({ ...VALID, email: 'c@x.com', course: 'CIENCIA_COMPUTACAO', skillLevel: 1 }, null, null);
    const result = await svc.list({ page: 1, pageSize: 50, course: 'CIENCIA_COMPUTACAO', skillMin: 2 });
    expect(result.total).toBe(1);
    expect(result.items.map((r) => r.email)).toEqual(['a@x.com']);
  });

  it('stats aggregates total, last7d, byCourse, bySkill', async () => {
    const prisma = makePrisma();
    seedWaitlistTarget(prisma);
    const svc = new WaitlistService(prisma as any);
    await svc.submit({ ...VALID, email: 'a@sou.inteli.edu.br' }, null, null);
    await svc.submit({ ...VALID, email: 'b@sou.inteli.edu.br' }, null, null);
    const s = await svc.stats();
    expect(s.total).toBe(2);
    expect(s.last7d).toBe(2);
    expect(s.byCourse).toEqual(expect.arrayContaining([{ course: 'CIENCIA_COMPUTACAO', count: 2 }]));
    expect(s.bySkill).toEqual(expect.arrayContaining([{ skillLevel: 4, count: 2 }]));
  });

  it('iterateAll yields every row, newest first', async () => {
    const prisma = makePrisma();
    seedWaitlistTarget(prisma);
    const svc = new WaitlistService(prisma as any);
    for (const i of [1, 2, 3]) {
      await svc.submit({ ...VALID, email: `u${i}@x.com` }, null, null);
    }
    const emails: string[] = [];
    for await (const row of svc.iterateAll()) emails.push(row.email);
    expect(emails).toHaveLength(3);
    expect(new Set(emails)).toEqual(new Set(['u1@x.com', 'u2@x.com', 'u3@x.com']));
  });

  it('throws ServiceUnavailableException when no future cycle is programmed', async () => {
    const prisma = makePrisma();
    // intentionally do NOT seed any cycle
    const svc = new WaitlistService(prisma as any);
    await expect(svc.submit({ ...VALID }, null, null)).rejects.toThrow(/próximo ciclo/i);
    expect(prisma.waitlistEntry.upsert).not.toHaveBeenCalled();
  });

  it('getConfig returns the target cycle', async () => {
    const prisma = makePrisma();
    seedWaitlistTarget(prisma);
    const svc = new WaitlistService(prisma as any);
    const cfg = await svc.getConfig();
    expect(cfg?.cycleTarget).toBe('2026.3');
    expect(cfg?.startsAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('getConfig returns null when no cycle is programmed', async () => {
    const prisma = makePrisma();
    const svc = new WaitlistService(prisma as any);
    expect(await svc.getConfig()).toBeNull();
  });
});

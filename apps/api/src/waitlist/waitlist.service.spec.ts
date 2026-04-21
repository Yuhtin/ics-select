import { WaitlistService } from './waitlist.service.js';

function makePrisma() {
  type Row = {
    id: string;
    name: string;
    email: string;
    course: string;
    skillLevel: number;
    github: string | null;
    linkedin: string | null;
    wantsUpdates: boolean;
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
    if (where?.wantsUpdates !== undefined) rows = rows.filter((r) => r.wantsUpdates === where.wantsUpdates);
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

  return {
    waitlistEntry: { upsert, findMany, count, groupBy },
    _byEmail: byEmail,
  };
}

const VALID = {
  name: 'Ada Lovelace',
  email: 'ada@inteli.edu.br',
  course: 'CIENCIA_COMPUTACAO' as const,
  skillLevel: 4,
  github: 'https://github.com/ada',
  linkedin: undefined,
  wantsUpdates: true,
  cycleTarget: '2026.3',
};

describe('WaitlistService', () => {
  it('upserts a new submission by email', async () => {
    const prisma = makePrisma();
    const svc = new WaitlistService(prisma as any);
    await svc.submit({ ...VALID }, 'ip-hash-a', 'ua-a');
    expect(prisma.waitlistEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { email: 'ada@inteli.edu.br' },
        create: expect.objectContaining({
          name: 'Ada Lovelace',
          course: 'CIENCIA_COMPUTACAO',
          skillLevel: 4,
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

  it('on re-submit by the same email, update overwrites all fields (latest wins)', async () => {
    const prisma = makePrisma();
    const svc = new WaitlistService(prisma as any);
    await svc.submit({ ...VALID }, 'ip-a', 'ua-a');
    await svc.submit({ ...VALID, skillLevel: 5, cycleTarget: '2026.4' }, 'ip-b', 'ua-b');
    const stored = prisma._byEmail.get('ada@inteli.edu.br')!;
    expect(stored.skillLevel).toBe(5);
    expect(stored.cycleTarget).toBe('2026.4');
    expect(stored.ipHash).toBe('ip-b');
  });

  it('list returns rows matching filters, newest first, paginated', async () => {
    const prisma = makePrisma();
    const svc = new WaitlistService(prisma as any);
    await svc.submit({ ...VALID, email: 'a@x.com', course: 'CIENCIA_COMPUTACAO', skillLevel: 3 }, null, null);
    await svc.submit({ ...VALID, email: 'b@x.com', course: 'ADMINISTRACAO',       skillLevel: 5 }, null, null);
    await svc.submit({ ...VALID, email: 'c@x.com', course: 'CIENCIA_COMPUTACAO', skillLevel: 1 }, null, null);
    const result = await svc.list({ page: 1, pageSize: 50, course: 'CIENCIA_COMPUTACAO', skillMin: 2 });
    expect(result.total).toBe(1);
    expect(result.items.map((r) => r.email)).toEqual(['a@x.com']);
  });

  it('stats aggregates total, last7d, wantsUpdatesPct, byCourse, bySkill', async () => {
    const prisma = makePrisma();
    const svc = new WaitlistService(prisma as any);
    await svc.submit({ ...VALID, email: 'a@x.com', wantsUpdates: true  }, null, null);
    await svc.submit({ ...VALID, email: 'b@x.com', wantsUpdates: false }, null, null);
    const s = await svc.stats();
    expect(s.total).toBe(2);
    expect(s.last7d).toBe(2);
    expect(s.wantsUpdatesPct).toBe(50);
    expect(s.byCourse).toEqual(expect.arrayContaining([{ course: 'CIENCIA_COMPUTACAO', count: 2 }]));
    expect(s.bySkill).toEqual(expect.arrayContaining([{ skillLevel: 4, count: 2 }]));
  });

  it('iterateAll yields every row, newest first', async () => {
    const prisma = makePrisma();
    const svc = new WaitlistService(prisma as any);
    for (const i of [1, 2, 3]) {
      await svc.submit({ ...VALID, email: `u${i}@x.com` }, null, null);
    }
    const emails: string[] = [];
    for await (const row of svc.iterateAll()) emails.push(row.email);
    expect(emails).toHaveLength(3);
    expect(new Set(emails)).toEqual(new Set(['u1@x.com', 'u2@x.com', 'u3@x.com']));
  });
});

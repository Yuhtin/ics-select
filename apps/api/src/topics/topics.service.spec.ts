import { TopicsService } from './topics.service';

function makePrisma() {
  const topics = new Map<
    string,
    { id: string; slug: string; label: string; order: number; createdAt: Date }
  >();
  let nextId = 1;
  return {
    topics,
    topic: {
      findMany: jest.fn(async () =>
        Array.from(topics.values()).sort((a, b) => a.order - b.order),
      ),
      findFirst: jest.fn(async ({ orderBy }: any) => {
        const all = Array.from(topics.values());
        if (orderBy?.order === 'desc') {
          return all.sort((a, b) => b.order - a.order)[0] ?? null;
        }
        return all[0] ?? null;
      }),
      findUnique: jest.fn(async ({ where }: any) => topics.get(where.id) ?? null),
      create: jest.fn(async ({ data }: any) => {
        const id = `t-${nextId++}`;
        const rec = { id, createdAt: new Date(), ...data };
        topics.set(id, rec);
        return rec;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const cur = topics.get(where.id)!;
        const next = { ...cur, ...data };
        topics.set(where.id, next);
        return next;
      }),
      delete: jest.fn(async ({ where }: any) => {
        const row = topics.get(where.id)!;
        topics.delete(where.id);
        return row;
      }),
    },
  };
}

describe('TopicsService', () => {
  it('lists topics ordered by order asc', async () => {
    const prisma = makePrisma();
    await prisma.topic.create({ data: { slug: 'dp', label: 'DP', order: 1 } });
    await prisma.topic.create({ data: { slug: 'arrays', label: 'Arrays', order: 0 } });
    const svc = new TopicsService(prisma as any);
    const list = await svc.list();
    expect(list.map((t: any) => t.slug)).toEqual(['arrays', 'dp']);
  });

  it('creates a topic with the next order value when order is omitted', async () => {
    const prisma = makePrisma();
    await prisma.topic.create({ data: { slug: 'arrays', label: 'Arrays', order: 0 } });
    const svc = new TopicsService(prisma as any);
    const created = await svc.create({ slug: 'dp', label: 'DP' });
    expect(created.order).toBe(1);
  });

  it('creates a topic with order 0 when none exist', async () => {
    const prisma = makePrisma();
    const svc = new TopicsService(prisma as any);
    const created = await svc.create({ slug: 'arrays', label: 'Arrays' });
    expect(created.order).toBe(0);
  });

  it('updates a topic label', async () => {
    const prisma = makePrisma();
    const row = await prisma.topic.create({ data: { slug: 'dp', label: 'DP', order: 0 } });
    const svc = new TopicsService(prisma as any);
    const updated = await svc.update(row.id, { label: 'Dynamic Programming' });
    expect(updated.label).toBe('Dynamic Programming');
  });

  it('throws NotFoundException when updating a missing topic', async () => {
    const prisma = makePrisma();
    const svc = new TopicsService(prisma as any);
    await expect(svc.update('missing', { label: 'x' })).rejects.toThrow();
  });

  it('deletes a topic', async () => {
    const prisma = makePrisma();
    const row = await prisma.topic.create({ data: { slug: 'dp', label: 'DP', order: 0 } });
    const svc = new TopicsService(prisma as any);
    await svc.delete(row.id);
    expect(prisma.topics.size).toBe(0);
  });
});

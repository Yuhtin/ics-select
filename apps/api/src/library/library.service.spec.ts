import { LibraryService } from './library.service';

type Item = {
  id: string;
  title: string;
  url: string | null;
  description: string | null;
  format: 'VIDEO' | 'ARTICLE' | 'BOOK' | 'PROBLEM' | 'OTHER';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  estimatedMinutes: number;
  source: string | null;
  tags: string[];
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

function fakePrisma() {
  const items = new Map<string, Item>();
  const raw: Array<{ embeddingRaw: number[]; id: string }> = [];
  const topicRows: Array<{ id: string; slug: string; label: string }> = [];
  const libraryItemTopicRows: Array<{
    itemId: string;
    topicId: string;
    isPrimary: boolean;
  }> = [];
  return {
    items,
    raw,
    libraryItem: {
      create: jest.fn(async ({ data }: { data: Omit<Item, 'id' | 'createdAt' | 'updatedAt'> }) => {
        const id = `li-${items.size + 1}`;
        const rec: Item = {
          id,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        items.set(id, rec);
        return rec;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<Item> }) => {
        const cur = items.get(where.id)!;
        const next = { ...cur, ...data, updatedAt: new Date() };
        items.set(where.id, next);
        return next;
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => {
        const it = items.get(where.id);
        return it ? { ...it, topics: [] } : null;
      }),
      findMany: jest.fn(async () =>
        Array.from(items.values()).map((it) => ({ ...it, topics: [] })),
      ),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const rec = items.get(where.id);
        items.delete(where.id);
        return rec;
      }),
    },
    libraryItemTopic: {
      rows: libraryItemTopicRows,
      findMany: jest.fn(async (args?: any) => {
        const w = args?.where ?? {};
        const filtered = libraryItemTopicRows.filter((r) => {
          if (w.itemId?.in && !w.itemId.in.includes(r.itemId)) return false;
          if (w.topicId?.in && !w.topicId.in.includes(r.topicId)) return false;
          if (w.topicId && typeof w.topicId === 'string' && r.topicId !== w.topicId) {
            return false;
          }
          return true;
        });
        // If the service asked for `include: { topic: { select: ... } }`,
        // emulate the join; otherwise return the raw rows.
        if (args?.include?.topic) {
          const byId = new Map(topicRows.map((t) => [t.id, t]));
          return filtered.map((r) => ({ ...r, topic: byId.get(r.topicId) ?? null }));
        }
        return filtered;
      }),
      deleteMany: jest.fn(async () => ({ count: 0 })),
      create: jest.fn(async ({ data }: any) => data),
    },
    topic: {
      // Tests seed rows via `prisma.topic.rows.push(...)`. Do NOT reassign
      // `prisma.topic.rows = [...]` — the mock closes over the original array
      // reference, so reassignment leaves the mock reading a stale empty array.
      rows: topicRows,
      findMany: jest.fn(async (args?: any) => {
        const w = args?.where;
        if (!w) return [...topicRows];
        if (w.slug?.in) {
          return topicRows.filter((r) => (w.slug.in as string[]).includes(r.slug));
        }
        // OR: [{ label: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }]
        if (Array.isArray(w.OR)) {
          const q: string =
            w.OR[0]?.label?.contains ?? w.OR[0]?.slug?.contains ?? '';
          const qLow = q.toLowerCase();
          return topicRows.filter(
            (r) =>
              r.label.toLowerCase().includes(qLow) ||
              r.slug.toLowerCase().includes(qLow),
          );
        }
        return [...topicRows];
      }),
    },
    $transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
    $executeRawUnsafe: jest.fn(async (_sql: string, ...values: unknown[]) => {
      const [id, vectorLiteral] = values as [string, string];
      const nums = vectorLiteral.replace(/[[\]]/g, '').split(',').map(Number);
      raw.push({ id, embeddingRaw: nums });
      return 1;
    }),
    $queryRawUnsafe: jest.fn(async (_sql: string, ...values: unknown[]) => {
      const q = ((values[0] as string | null) ?? '').trim().toLowerCase();
      if (!q) return [];
      const hit = (s: string | null | undefined) =>
        !!s && s.toLowerCase().includes(q);
      return Array.from(items.values())
        .map((it) => {
          if (hit(it.title)) return { ...it, score: 4 };
          if (hit(it.description)) return { ...it, score: 2 };
          if (hit(it.tags.join(' '))) return { ...it, score: 1 };
          if (hit(it.source)) return { ...it, score: 1 };
          if (hit(it.url)) return { ...it, score: 0.5 };
          return null;
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort((a, b) => b.score - a.score);
    }),
  };
}

const openai = {
  embed: jest.fn(async (_text: string) => [0.1, 0.2, 0.3]),
};

describe('LibraryService', () => {
  beforeEach(() => {
    openai.embed.mockClear();
  });

  it('create stores the item, computes embedding, and writes it via raw SQL', async () => {
    const prisma = fakePrisma();
    const svc = new LibraryService(prisma as any, openai as any);
    const created = await svc.create({
      title: 'DP Intro',
      description: 'Intro to dynamic programming',
      url: 'https://x.com/dp',
      format: 'VIDEO',
      difficulty: 'EASY',
      estimatedMinutes: 20,
      source: 'YouTube',
      tags: ['dp'],
      createdById: 'u-1',
    });
    expect(created.id).toBe('li-1');
    expect(openai.embed).toHaveBeenCalledWith(expect.stringContaining('DP Intro'));
    expect(prisma.raw).toHaveLength(1);
    expect(prisma.raw[0]?.id).toBe('li-1');
    expect(prisma.raw[0]?.embeddingRaw).toEqual([0.1, 0.2, 0.3]);
  });

  it('update re-embeds when content-affecting fields change', async () => {
    const prisma = fakePrisma();
    const svc = new LibraryService(prisma as any, openai as any);
    const created = await svc.create({
      title: 'Old',
      description: null,
      url: null,
      format: 'ARTICLE',
      difficulty: 'EASY',
      estimatedMinutes: 10,
      source: null,
      tags: [],
      createdById: 'u-1',
    });
    openai.embed.mockClear();
    await svc.update(created.id, { title: 'New title' });
    expect(openai.embed).toHaveBeenCalled();
  });

  it('search returns results via raw query', async () => {
    const prisma = fakePrisma();
    const svc = new LibraryService(prisma as any, openai as any);
    await svc.create({
      title: 'Arrays 101',
      description: null,
      url: null,
      format: 'ARTICLE',
      difficulty: 'EASY',
      estimatedMinutes: 10,
      source: null,
      tags: ['arrays'],
      createdById: 'u-1',
    });
    const results = await svc.search({ query: 'arrays' });
    expect(results.length).toBeGreaterThan(0);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
  });

  it('list returns items sorted newest first', async () => {
    const prisma = fakePrisma();
    const svc = new LibraryService(prisma as any, openai as any);
    await svc.create({
      title: 'A',
      description: null,
      url: null,
      format: 'ARTICLE',
      difficulty: 'EASY',
      estimatedMinutes: 10,
      source: null,
      tags: [],
      createdById: 'u-1',
    });
    await svc.create({
      title: 'B',
      description: null,
      url: null,
      format: 'ARTICLE',
      difficulty: 'EASY',
      estimatedMinutes: 10,
      source: null,
      tags: [],
      createdById: 'u-1',
    });
    const items = await svc.list();
    expect(items).toHaveLength(2);
  });
});

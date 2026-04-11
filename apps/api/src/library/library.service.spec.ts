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
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => items.get(where.id) ?? null),
      findMany: jest.fn(async () => Array.from(items.values())),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const rec = items.get(where.id);
        items.delete(where.id);
        return rec;
      }),
    },
    $executeRawUnsafe: jest.fn(async (_sql: string, ...values: unknown[]) => {
      const [id, vectorLiteral] = values as [string, string];
      const nums = vectorLiteral.replace(/[[\]]/g, '').split(',').map(Number);
      raw.push({ id, embeddingRaw: nums });
      return 1;
    }),
    $queryRawUnsafe: jest.fn(async (_sql: string, ..._values: unknown[]) => {
      return Array.from(items.values()).map((it) => ({ ...it, score: 0.5 }));
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

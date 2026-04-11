import { RefreshTokenService } from './refresh-token.service';

type Stored = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

function fakePrisma() {
  const store = new Map<string, Stored>();
  return {
    store,
    refreshToken: {
      create: jest.fn(async ({ data }: { data: Omit<Stored, 'id'> }) => {
        const id = `rt-${store.size + 1}`;
        const rec: Stored = { id, revokedAt: null, ...data };
        store.set(id, rec);
        return rec;
      }),
      findUnique: jest.fn(async ({ where }: { where: { tokenHash: string } }) => {
        for (const r of store.values()) {
          if (r.tokenHash === where.tokenHash) return r;
        }
        return null;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<Stored> }) => {
        const cur = store.get(where.id);
        if (!cur) throw new Error('not found');
        const next = { ...cur, ...data };
        store.set(where.id, next);
        return next;
      }),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
  };
}

describe('RefreshTokenService', () => {
  it('issues a unique token each call and stores its hash', async () => {
    const prisma = fakePrisma();
    const svc = new RefreshTokenService(prisma as any);
    const a = await svc.issue('user-1');
    const b = await svc.issue('user-1');
    expect(a.plaintext).not.toBe(b.plaintext);
    expect(prisma.store.size).toBe(2);
  });

  it('validates a previously issued token by looking up its hash', async () => {
    const prisma = fakePrisma();
    const svc = new RefreshTokenService(prisma as any);
    const issued = await svc.issue('user-1');
    const rec = await svc.validate(issued.plaintext);
    expect(rec?.userId).toBe('user-1');
  });

  it('rejects a revoked token', async () => {
    const prisma = fakePrisma();
    const svc = new RefreshTokenService(prisma as any);
    const issued = await svc.issue('user-1');
    await svc.revoke(issued.plaintext);
    const rec = await svc.validate(issued.plaintext);
    expect(rec).toBeNull();
  });

  it('rejects an expired token', async () => {
    const prisma = fakePrisma();
    const svc = new RefreshTokenService(prisma as any);
    const issued = await svc.issue('user-1');
    // Manually expire it in the store
    for (const r of prisma.store.values()) {
      r.expiresAt = new Date(Date.now() - 1000);
    }
    const rec = await svc.validate(issued.plaintext);
    expect(rec).toBeNull();
  });
});

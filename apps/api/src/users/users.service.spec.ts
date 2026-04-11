import { UsersService } from './users.service';

type U = { id: string; email: string; name: string; role: 'ADMIN' | 'MEMBER'; pictureUrl: string | null };

function fakePrisma(initial: U[] = []) {
  const users = new Map<string, U>(initial.map((u) => [u.id, u]));
  return {
    user: {
      findUnique: jest.fn(async ({ where: { id } }: { where: { id: string } }) =>
        users.get(id) ?? null,
      ),
      findMany: jest.fn(async () => Array.from(users.values())),
      create: jest.fn(async ({ data }: { data: Omit<U, 'id'> }) => {
        const id = `u-${users.size + 1}`;
        const rec = { id, ...data } as U;
        users.set(id, rec);
        return rec;
      }),
      delete: jest.fn(async ({ where: { id } }: { where: { id: string } }) => {
        const rec = users.get(id);
        if (!rec) throw new Error('not found');
        users.delete(id);
        return rec;
      }),
    },
  };
}

describe('UsersService', () => {
  it('getById returns the user', async () => {
    const prisma = fakePrisma([
      { id: 'u-1', email: 'a@x.com', name: 'A', role: 'ADMIN', pictureUrl: null },
    ]);
    const svc = new UsersService(prisma as any);
    const user = await svc.getById('u-1');
    expect(user?.email).toBe('a@x.com');
  });

  it('list returns all users', async () => {
    const prisma = fakePrisma([
      { id: 'u-1', email: 'a@x.com', name: 'A', role: 'ADMIN', pictureUrl: null },
      { id: 'u-2', email: 'b@x.com', name: 'B', role: 'MEMBER', pictureUrl: null },
    ]);
    const svc = new UsersService(prisma as any);
    expect((await svc.list()).length).toBe(2);
  });

  it('invite creates a MEMBER user', async () => {
    const prisma = fakePrisma();
    const svc = new UsersService(prisma as any);
    const u = await svc.invite({ email: 'new@x.com', name: 'New' });
    expect(u.role).toBe('MEMBER');
    expect(u.email).toBe('new@x.com');
  });
});

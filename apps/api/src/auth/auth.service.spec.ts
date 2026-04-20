import { AuthService } from './auth.service';

type FakeUser = {
  id: string;
  email: string;
  name: string;
  pictureUrl: string | null;
  role: 'ADMIN' | 'MEMBER';
  privacyAcceptedAt: Date | null;
};

function fakeDeps(bootstrap: string[] = []) {
  const users = new Map<string, FakeUser>();
  const googleAccounts = new Map<string, { accessTokenEnc: string; refreshTokenEnc: string | null; expiresAt: Date; scope: string; userId: string }>();
  const invites = new Map<string, { id: string; email: string; role: 'ADMIN' | 'MEMBER' }>();
  const prisma = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { email: string } }) =>
        users.get(where.email) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: Omit<FakeUser, 'id'> }) => {
        const id = `u-${users.size + 1}`;
        const rec = { id, ...data } as FakeUser;
        users.set(data.email, rec);
        return rec;
      }),
      update: jest.fn(async ({ where, data }: { where: { email: string }; data: Partial<FakeUser> }) => {
        const cur = users.get(where.email)!;
        const next = { ...cur, ...data };
        users.set(where.email, next);
        return next;
      }),
    },
    googleAccount: {
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = googleAccounts.get(where.userId);
        const next = existing ? { ...existing, ...update } : { userId: where.userId, ...create };
        googleAccounts.set(where.userId, next);
        return next;
      }),
    },
    invitedEmail: {
      findUnique: jest.fn(async ({ where }: { where: { email: string } }) =>
        invites.get(where.email) ?? null,
      ),
    },
  };
  const jwt = { sign: jest.fn(() => 'jwt.token.value') };
  const refresh = {
    issue: jest.fn(async (userId: string) => ({
      plaintext: `rt-${userId}-${Math.random()}`,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })),
    revoke: jest.fn(async () => undefined),
    validate: jest.fn(async (_t: string) => ({ id: 'rt-1', userId: 'u-1' })),
    rotate: jest.fn(async (_t: string, userId: string) => ({
      plaintext: `rt-${userId}-new`,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })),
  };
  const aes = { encrypt: jest.fn((s: string) => `enc(${s})`), decrypt: jest.fn((s: string) => s.replace(/^enc\(|\)$/g, '')) };
  const gcal = { invalidateAuth: jest.fn() };
  const svc = new AuthService(prisma as any, jwt as any, refresh as any, bootstrap, aes as any, gcal as any);
  return { svc, prisma, jwt, refresh, users, googleAccounts, invites, aes, gcal };
}

describe('AuthService.loginWithGoogle', () => {
  it('creates a new user on first login when an invite exists', async () => {
    const { svc, users, invites } = fakeDeps();
    invites.set('pedro@sou.inteli.edu.br', {
      id: 'inv-1',
      email: 'pedro@sou.inteli.edu.br',
      role: 'MEMBER',
    });
    const result = await svc.loginWithGoogle({
      email: 'pedro@sou.inteli.edu.br',
      name: 'Pedro',
      pictureUrl: 'http://pic',
      accessToken: 'ga',
      refreshToken: 'gr',
    });
    expect(users.size).toBe(1);
    expect(result.user.email).toBe('pedro@sou.inteli.edu.br');
    expect(result.user.role).toBe('MEMBER');
    expect(result.accessToken).toBe('jwt.token.value');
    expect(result.refreshToken.plaintext).toMatch(/^rt-/);
  });

  it('rejects first-login when email is neither invited nor bootstrap admin', async () => {
    const { svc, users } = fakeDeps();
    await expect(
      svc.loginWithGoogle({
        email: 'stranger@sou.inteli.edu.br',
        name: 'Stranger',
        pictureUrl: null,
        accessToken: 'ga',
        refreshToken: null,
      }),
    ).rejects.toThrow(/EMAIL_NOT_INVITED/);
    expect(users.size).toBe(0);
  });

  it('first-login inherits role from invite (ADMIN invite → ADMIN user)', async () => {
    const { svc, users, invites } = fakeDeps();
    invites.set('pedro@sou.inteli.edu.br', {
      id: 'inv-1',
      email: 'pedro@sou.inteli.edu.br',
      role: 'ADMIN',
    });
    await svc.loginWithGoogle({
      email: 'pedro@sou.inteli.edu.br',
      name: 'Pedro',
      pictureUrl: null,
      accessToken: 'ga',
      refreshToken: null,
    });
    expect(users.get('pedro@sou.inteli.edu.br')!.role).toBe('ADMIN');
  });

  it('updates name and picture on subsequent login (no invite needed once User exists)', async () => {
    const { svc, users, prisma, invites } = fakeDeps();
    invites.set('pedro@sou.inteli.edu.br', {
      id: 'inv-1',
      email: 'pedro@sou.inteli.edu.br',
      role: 'MEMBER',
    });
    await svc.loginWithGoogle({
      email: 'pedro@sou.inteli.edu.br',
      name: 'Pedro',
      pictureUrl: 'http://old',
      accessToken: 'ga',
      refreshToken: null,
    });
    await svc.loginWithGoogle({
      email: 'pedro@sou.inteli.edu.br',
      name: 'Pedro Silva',
      pictureUrl: 'http://new',
      accessToken: 'ga2',
      refreshToken: null,
    });
    expect(users.size).toBe(1);
    expect(prisma.user.update).toHaveBeenCalled();
    const stored = users.get('pedro@sou.inteli.edu.br')!;
    expect(stored.name).toBe('Pedro Silva');
    expect(stored.pictureUrl).toBe('http://new');
  });

  it('promotes an email in BOOTSTRAP_ADMIN_EMAILS to ADMIN on first login (no invite needed)', async () => {
    const { svc, users } = fakeDeps(['admin@sou.inteli.edu.br']);
    await svc.loginWithGoogle({
      email: 'admin@sou.inteli.edu.br',
      name: 'Admin',
      pictureUrl: null,
      accessToken: 'ga',
      refreshToken: null,
    });
    expect(users.get('admin@sou.inteli.edu.br')!.role).toBe('ADMIN');
  });

  it('persists encrypted Google access and refresh tokens on login', async () => {
    const { svc, googleAccounts, aes, invites } = fakeDeps();
    invites.set('pedro@sou.inteli.edu.br', {
      id: 'inv-1',
      email: 'pedro@sou.inteli.edu.br',
      role: 'MEMBER',
    });
    await svc.loginWithGoogle({
      email: 'pedro@sou.inteli.edu.br',
      name: 'Pedro',
      pictureUrl: null,
      accessToken: 'ga-plain',
      refreshToken: 'gr-plain',
    });
    expect(aes.encrypt).toHaveBeenCalledWith('ga-plain');
    expect(aes.encrypt).toHaveBeenCalledWith('gr-plain');
    const row = Array.from(googleAccounts.values())[0];
    expect(row?.accessTokenEnc).toBe('enc(ga-plain)');
    expect(row?.refreshTokenEnc).toBe('enc(gr-plain)');
  });

  it('invalidates the GoogleCalendarService auth cache after upserting GoogleAccount', async () => {
    const { svc, gcal, invites } = fakeDeps();
    invites.set('pedro@sou.inteli.edu.br', {
      id: 'inv-1',
      email: 'pedro@sou.inteli.edu.br',
      role: 'MEMBER',
    });
    const result = await svc.loginWithGoogle({
      email: 'pedro@sou.inteli.edu.br',
      name: 'Pedro',
      pictureUrl: null,
      accessToken: 'ga',
      refreshToken: null,
    });
    expect(gcal.invalidateAuth).toHaveBeenCalledWith(result.user.id);
  });
});

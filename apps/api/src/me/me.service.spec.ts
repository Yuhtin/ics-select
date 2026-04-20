import { MeService } from './me.service';

function fakePrisma() {
  const user = {
    id: 'u-1',
    email: 'a@x.com',
    name: 'A',
    pictureUrl: null,
    role: 'MEMBER',
    privacyAcceptedAt: null,
    createdAt: new Date(),
  };
  return {
    user: {
      findUnique: jest.fn(async () => user),
      delete: jest.fn(async () => user),
      update: jest.fn(async ({ data }: { data: any }) => ({ ...user, ...data })),
    },
    memberAvailability: { findUnique: jest.fn(async () => null) },
    cycleMembership: { findMany: jest.fn(async () => []) },
    weeklyPlan: { findMany: jest.fn(async () => []) },
    classAttendance: { findMany: jest.fn(async () => []) },
  };
}

describe('MeService', () => {
  it('exportForUser returns user + empty relations', async () => {
    const prisma = fakePrisma();
    const svc = new MeService(prisma as any);
    const result = await svc.exportForUser('u-1');
    expect(result.user.email).toBe('a@x.com');
    expect(result.plans).toEqual([]);
  });

  it('deleteUser calls prisma.user.delete', async () => {
    const prisma = fakePrisma();
    const svc = new MeService(prisma as any);
    const result = await svc.deleteUser('u-1');
    expect(result.deleted).toBe(true);
    expect(prisma.user.delete).toHaveBeenCalledWith({ where: { id: 'u-1' } });
  });

  it('updateThemePreference writes both columns keyed on userId', async () => {
    const prisma = fakePrisma();
    const svc = new MeService(prisma as any);
    const before = Date.now();
    await svc.updateThemePreference('u-1', 'DARK');
    const after = Date.now();

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    const call = prisma.user.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'u-1' });
    expect(call.data.themePreference).toBe('DARK');
    const writtenAt = call.data.themePreferenceAt as Date;
    expect(writtenAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(writtenAt.getTime()).toBeLessThanOrEqual(after);
  });

  it('updateThemePreference is idempotent — second call overwrites', async () => {
    const prisma = fakePrisma();
    const svc = new MeService(prisma as any);
    await svc.updateThemePreference('u-1', 'LIGHT');
    await svc.updateThemePreference('u-1', 'DARK');
    expect(prisma.user.update).toHaveBeenCalledTimes(2);
    expect(prisma.user.update.mock.calls[1][0].data.themePreference).toBe('DARK');
  });
});

import { MeController } from './me.controller';

describe('MeController', () => {
  it('updateTheme parses body and delegates to service', async () => {
    const prisma = fakePrisma();
    const svc = new MeService(prisma as any);
    const controller = new MeController(svc);
    const user = { sub: 'u-1', email: 'a@x.com', role: 'MEMBER' } as any;

    await controller.updateTheme(user, { themePreference: 'DARK' });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u-1' },
        data: expect.objectContaining({ themePreference: 'DARK' }),
      }),
    );
  });

  it('updateTheme rejects invalid enum via Zod', async () => {
    const prisma = fakePrisma();
    const svc = new MeService(prisma as any);
    const controller = new MeController(svc);
    const user = { sub: 'u-1', email: 'a@x.com', role: 'MEMBER' } as any;

    await expect(
      controller.updateTheme(user, { themePreference: 'SYSTEM' } as any),
    ).rejects.toThrow();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

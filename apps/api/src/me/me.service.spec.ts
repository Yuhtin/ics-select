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
});

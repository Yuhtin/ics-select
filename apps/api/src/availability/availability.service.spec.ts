import { AvailabilityService } from './availability.service';

type A = {
  id: string;
  userId: string;
  mondayMinutes: number;
  tuesdayMinutes: number;
  wednesdayMinutes: number;
  thursdayMinutes: number;
  fridayMinutes: number;
  saturdayMinutes: number;
  sundayMinutes: number;
  preferredSessionMinutes: number;
  timezone: string;
};

function fakePrisma() {
  const rows = new Map<string, A>();
  return {
    rows,
    memberAvailability: {
      findUnique: jest.fn(async ({ where }: { where: { userId: string } }) =>
        rows.get(where.userId) ?? null,
      ),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = rows.get(where.userId);
        const next: A = existing
          ? { ...existing, ...update }
          : { id: `a-${rows.size + 1}`, ...create };
        rows.set(where.userId, next);
        return next;
      }),
    },
  };
}

describe('AvailabilityService', () => {
  it('upsert creates a new availability row with defaults', async () => {
    const prisma = fakePrisma();
    const svc = new AvailabilityService(prisma as any);
    const row = await svc.upsert('user-1', {
      mondayMinutes: 60,
      tuesdayMinutes: 60,
      wednesdayMinutes: 0,
      thursdayMinutes: 30,
      fridayMinutes: 0,
      saturdayMinutes: 90,
      sundayMinutes: 0,
      preferredSessionMinutes: 45,
      timezone: 'America/Sao_Paulo',
    });
    expect(row.mondayMinutes).toBe(60);
    expect(row.preferredSessionMinutes).toBe(45);
    expect(prisma.rows.get('user-1')?.saturdayMinutes).toBe(90);
  });

  it('get returns null when no row exists', async () => {
    const prisma = fakePrisma();
    const svc = new AvailabilityService(prisma as any);
    expect(await svc.get('u')).toBeNull();
  });
});

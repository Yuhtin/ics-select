import { ClassesService } from './classes.service';

function fakePrisma() {
  const sessions = new Map<string, any>();
  const attendance = new Map<string, any>();
  let sid = 0;
  let aid = 0;
  return {
    sessions,
    attendance,
    classSession: {
      create: jest.fn(async ({ data }: any) => {
        const id = `s-${++sid}`;
        const rec = { id, ...data };
        sessions.set(id, rec);
        return rec;
      }),
      findMany: jest.fn(async ({ where }: any) =>
        Array.from(sessions.values()).filter((s) => s.cycleId === where.cycleId),
      ),
      findUnique: jest.fn(async ({ where }: any) => sessions.get(where.id) ?? null),
      update: jest.fn(async ({ where, data }: any) => {
        const cur = sessions.get(where.id);
        const next = { ...cur, ...data };
        sessions.set(where.id, next);
        return next;
      }),
    },
    classAttendance: {
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = Array.from(attendance.values()).find(
          (a: any) =>
            a.classSessionId === where.classSessionId_userId.classSessionId &&
            a.userId === where.classSessionId_userId.userId,
        );
        if (existing) {
          const next = { ...existing, ...update };
          attendance.set(existing.id, next);
          return next;
        }
        const id = `a-${++aid}`;
        const rec = { id, ...create };
        attendance.set(id, rec);
        return rec;
      }),
      findMany: jest.fn(async ({ where }: any) =>
        Array.from(attendance.values()).filter((a: any) => a.classSessionId === where.classSessionId),
      ),
    },
  };
}

describe('ClassesService', () => {
  it('createForCycle creates a class', async () => {
    const prisma = fakePrisma();
    const svc = new ClassesService(prisma as any);
    const cls = await svc.createForCycle('c-1', {
      title: 'Aula 1 - Arrays',
      topic: 'arrays',
      scheduledAt: new Date('2026-04-15T19:00:00Z'),
      durationMin: 90,
    });
    expect(cls.cycleId).toBe('c-1');
    expect(cls.title).toBe('Aula 1 - Arrays');
  });

  it('markBatchAttendance upserts attendance for multiple users', async () => {
    const prisma = fakePrisma();
    const svc = new ClassesService(prisma as any);
    const cls = await svc.createForCycle('c-1', {
      title: 'A1',
      topic: null,
      scheduledAt: new Date(),
      durationMin: 90,
    });
    await svc.markBatchAttendance(cls.id, [
      { userId: 'u-1', status: 'PRESENT' },
      { userId: 'u-2', status: 'ABSENT' },
    ]);
    const rows = await svc.listAttendance(cls.id);
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.userId === 'u-1')?.status).toBe('PRESENT');
  });
});

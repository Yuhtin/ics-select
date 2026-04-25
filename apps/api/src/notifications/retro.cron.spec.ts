import { RetroCron } from './retro.cron';

// All time-window tests below use Fri/Thu of the same ISO week. The cron
// computes weekStart as the Monday of that week in UTC → 2026-04-13.
const WEEK_START_FIXTURE = new Date(Date.UTC(2026, 3, 13));
const PUBLISHED_PLAN = [
  { status: 'PUBLISHED', weekStart: WEEK_START_FIXTURE },
];

describe('RetroCron', () => {
  function makeCron({
    users = [] as any[],
    sentRows = new Map<string, any>(),
  } = {}) {
    const prisma = {
      user: {
        findMany: jest.fn(async ({ where }: any) => {
          const planFilter = where?.weeklyPlans?.some;
          if (!planFilter) return users;
          return users.filter((u: any) =>
            (u.weeklyPlans ?? []).some(
              (p: any) =>
                p.status === planFilter.status &&
                p.weekStart.getTime() === planFilter.weekStart.getTime(),
            ),
          );
        }),
      },
      retroReminderSent: {
        findUnique: jest.fn(
          async ({ where }: any) =>
            sentRows.get(
              `${where.userId_weekStart.userId}:${where.userId_weekStart.weekStart.toISOString()}`,
            ) ?? null,
        ),
        create: jest.fn(async ({ data }: any) => {
          const key = `${data.userId}:${data.weekStart.toISOString()}`;
          const row = { id: `rrs-${sentRows.size + 1}`, sentAt: new Date(), ...data };
          sentRows.set(key, row);
          return row;
        }),
      },
    };
    const whatsapp: { send: jest.Mock } = { send: jest.fn(async () => ({ ok: true })) };
    const templates = {
      render: jest.fn(async (_kind: string, vars: Record<string, string>) => ({
        text: `Oi ${vars.firstName ?? ''}, retro aberto.`,
        enabled: true,
      })),
    };
    return {
      cron: new RetroCron(prisma as any, whatsapp as any, templates as any),
      prisma,
      whatsapp,
      sentRows,
    };
  }

  it('sends a WhatsApp + records RetroReminderSent when member is at Fri 18:05 local', async () => {
    const now = new Date('2026-04-17T21:05:00Z'); // Fri 18:05 São Paulo
    const { cron, whatsapp, prisma } = makeCron({
      users: [
        {
          id: 'u1',
          name: 'Davi Duarte',
          whatsappPhone: '5511999',
          availability: { timezone: 'America/Sao_Paulo' },
          weeklyPlans: PUBLISHED_PLAN,
        },
      ],
    });
    await cron.tick(now);
    expect(whatsapp.send).toHaveBeenCalledTimes(1);
    expect(whatsapp.send.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        userId: 'u1',
        to: '5511999',
        kind: 'retro_reminder',
        text: expect.stringContaining('Davi'),
      }),
    );
    expect(prisma.retroReminderSent.create).toHaveBeenCalledTimes(1);
  });

  it('skips at Fri 18:30 local (window passed)', async () => {
    const now = new Date('2026-04-17T21:30:00Z');
    const { cron, whatsapp } = makeCron({
      users: [
        {
          id: 'u1',
          name: 'A',
          whatsappPhone: '1',
          availability: { timezone: 'America/Sao_Paulo' },
          weeklyPlans: PUBLISHED_PLAN,
        },
      ],
    });
    await cron.tick(now);
    expect(whatsapp.send).not.toHaveBeenCalled();
  });

  it('skips at Thu 18:05 local (wrong day)', async () => {
    const now = new Date('2026-04-16T21:05:00Z');
    const { cron, whatsapp } = makeCron({
      users: [
        {
          id: 'u1',
          name: 'A',
          whatsappPhone: '1',
          availability: { timezone: 'America/Sao_Paulo' },
          weeklyPlans: PUBLISHED_PLAN,
        },
      ],
    });
    await cron.tick(now);
    expect(whatsapp.send).not.toHaveBeenCalled();
  });

  it('skips members with an existing RetroReminderSent row for this week', async () => {
    const now = new Date('2026-04-17T21:05:00Z');
    const weekStart = new Date(Date.UTC(2026, 3, 13)); // 2026-04-13 UTC, the Mon
    const sent = new Map();
    sent.set(`u1:${weekStart.toISOString()}`, { id: 'rrs-seed' });
    const { cron, whatsapp, prisma } = makeCron({
      users: [
        {
          id: 'u1',
          name: 'A',
          whatsappPhone: '1',
          availability: { timezone: 'America/Sao_Paulo' },
          weeklyPlans: PUBLISHED_PLAN,
        },
      ],
      sentRows: sent,
    });
    await cron.tick(now);
    expect(whatsapp.send).not.toHaveBeenCalled();
    expect(prisma.retroReminderSent.create).not.toHaveBeenCalled();
  });

  it('continues iterating after one member throws during timezone parse', async () => {
    const now = new Date('2026-04-17T21:05:00Z');
    const { cron, whatsapp } = makeCron({
      users: [
        // Bad timezone → Intl.DateTimeFormat throws
        { id: 'bad', name: 'X', whatsappPhone: '1', availability: { timezone: 'Not/A_Real_TZ' }, weeklyPlans: PUBLISHED_PLAN },
        {
          id: 'u1',
          name: 'Davi',
          whatsappPhone: '5511999',
          availability: { timezone: 'America/Sao_Paulo' },
          weeklyPlans: PUBLISHED_PLAN,
        },
      ],
    });
    await cron.tick(now);
    expect(whatsapp.send).toHaveBeenCalledTimes(1);
    expect(whatsapp.send.mock.calls[0][0].userId).toBe('u1');
  });

  it('skips members without a PUBLISHED plan for this week (program not started)', async () => {
    const now = new Date('2026-04-17T21:05:00Z');
    const { cron, whatsapp, prisma } = makeCron({
      users: [
        // No weeklyPlans at all — pre-program member
        {
          id: 'pre1',
          name: 'A',
          whatsappPhone: '1',
          availability: { timezone: 'America/Sao_Paulo' },
          weeklyPlans: [],
        },
        // Has a plan but DRAFT, not PUBLISHED
        {
          id: 'draft1',
          name: 'B',
          whatsappPhone: '2',
          availability: { timezone: 'America/Sao_Paulo' },
          weeklyPlans: [{ status: 'DRAFT', weekStart: WEEK_START_FIXTURE }],
        },
        // Has a PUBLISHED plan but for a different week
        {
          id: 'oldweek1',
          name: 'C',
          whatsappPhone: '3',
          availability: { timezone: 'America/Sao_Paulo' },
          weeklyPlans: [
            { status: 'PUBLISHED', weekStart: new Date(Date.UTC(2026, 3, 6)) },
          ],
        },
      ],
    });
    await cron.tick(now);
    expect(whatsapp.send).not.toHaveBeenCalled();
    expect(prisma.retroReminderSent.create).not.toHaveBeenCalled();
  });

  it('uses America/Sao_Paulo as fallback when availability is null', async () => {
    const now = new Date('2026-04-17T21:05:00Z');
    const { cron, whatsapp } = makeCron({
      users: [{ id: 'u1', name: 'A', whatsappPhone: '1', availability: null, weeklyPlans: PUBLISHED_PLAN }],
    });
    await cron.tick(now);
    expect(whatsapp.send).toHaveBeenCalledTimes(1);
  });
});

import { RemindersCron } from './reminders.cron';

describe('RemindersCron', () => {
  const now = new Date('2026-04-17T12:00:00Z');

  function makeCron(
    {
      users = [],
      calendarFactory,
      whatsappSendSpy = jest.fn(async () => ({ ok: true })),
    }: {
      users?: Array<{ id: string; name: string | null; whatsappPhone: string | null }>;
      calendarFactory?: { listEventsInRange: jest.Mock };
      whatsappSendSpy?: jest.Mock;
    } = {},
  ) {
    const prisma = { user: { findMany: jest.fn(async () => users) } } as any;
    const whatsapp = { send: whatsappSendSpy } as any;
    const calendar = (calendarFactory ?? { listEventsInRange: jest.fn(async () => []) }) as any;
    return { cron: new RemindersCron(prisma, whatsapp, calendar), prisma, whatsapp, calendar };
  }

  it('sends a WhatsApp reminder when an event has a valid ICS ID', async () => {
    const events = [
      {
        id: 'ev1',
        summary: 'Leetcode · binary search',
        description: 'Link: https://leetcode.com\n\nICS ID: plan-1/item-1',
        start: new Date('2026-04-17T12:10:00Z'),
        end: new Date('2026-04-17T13:10:00Z'),
      },
    ];
    const { cron, whatsapp } = makeCron({
      users: [{ id: 'u1', name: 'Davi Duarte', whatsappPhone: '5511999' }],
      calendarFactory: { listEventsInRange: jest.fn(async () => events) },
    });
    await cron.sendReminders(now);
    expect(whatsapp.send).toHaveBeenCalledTimes(1);
    expect(whatsapp.send.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        userId: 'u1',
        kind: 'session_reminder',
        to: '5511999',
        text: expect.stringContaining('Leetcode · binary search'),
      }),
    );
  });

  it('skips events without an ICS ID marker', async () => {
    const events = [
      {
        id: 'ev1',
        summary: 'Lunch',
        description: 'Not a study event',
        start: new Date('2026-04-17T12:10:00Z'),
        end: new Date('2026-04-17T13:10:00Z'),
      },
    ];
    const { cron, whatsapp } = makeCron({
      users: [{ id: 'u1', name: 'Davi', whatsappPhone: '5511999' }],
      calendarFactory: { listEventsInRange: jest.fn(async () => events) },
    });
    await cron.sendReminders(now);
    expect(whatsapp.send).not.toHaveBeenCalled();
  });

  it("continues after one member's Calendar call throws", async () => {
    const listEventsInRange = jest
      .fn()
      .mockRejectedValueOnce(new Error('oauth revoked'))
      .mockResolvedValueOnce([
        {
          id: 'ev1',
          summary: 'X',
          description: 'ICS ID: p/i',
          start: new Date('2026-04-17T12:10:00Z'),
          end: new Date('2026-04-17T13:10:00Z'),
        },
      ]);
    const { cron, whatsapp } = makeCron({
      users: [
        { id: 'u1', name: 'Bob', whatsappPhone: '5511111' },
        { id: 'u2', name: 'Ana', whatsappPhone: '5522222' },
      ],
      calendarFactory: { listEventsInRange },
    });
    await cron.sendReminders(now);
    expect(listEventsInRange).toHaveBeenCalledTimes(2);
    expect(whatsapp.send).toHaveBeenCalledTimes(1);
    expect(whatsapp.send.mock.calls[0][0].userId).toBe('u2');
  });

  it('queries only members with whatsappPhone set', async () => {
    const { cron, prisma } = makeCron();
    await cron.sendReminders(now);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: 'MEMBER',
          whatsappPhone: { not: null },
        }),
      }),
    );
  });
});

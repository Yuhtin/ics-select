import { GoogleCalendarService } from './google-calendar.service';

type GoogleAccountRow = {
  accessTokenEnc: string;
  refreshTokenEnc: string | null;
  expiresAt: Date;
  scope: string;
};

function fakePrisma(row: GoogleAccountRow | null) {
  return {
    googleAccount: {
      findUnique: jest.fn(async () => row),
      update: jest.fn(async ({ data }: { data: Partial<GoogleAccountRow> }) => {
        if (row) Object.assign(row, data);
        return row;
      }),
    },
  };
}

const aes = {
  encrypt: jest.fn((s: string) => `enc(${s})`),
  decrypt: jest.fn((s: string) => s.replace(/^enc\(|\)$/g, '')),
};

type MockCalendar = {
  freebusy: { query: jest.Mock };
  events: { insert: jest.Mock; patch: jest.Mock; delete: jest.Mock; list: jest.Mock };
};

function mockClient(): MockCalendar {
  return {
    freebusy: { query: jest.fn().mockResolvedValue({ data: { calendars: { primary: { busy: [] } } } }) },
    events: {
      insert: jest.fn().mockResolvedValue({ data: { id: 'evt-1' } }),
      patch: jest.fn().mockResolvedValue({ data: { id: 'evt-1' } }),
      delete: jest.fn().mockResolvedValue({}),
      list: jest.fn().mockResolvedValue({ data: { items: [] } }),
    },
  };
}

describe('GoogleCalendarService', () => {
  beforeEach(() => {
    aes.encrypt.mockClear();
    aes.decrypt.mockClear();
  });

  it('getFreeBusy decrypts the token and calls freebusy.query', async () => {
    const row = {
      accessTokenEnc: 'enc(plain-access)',
      refreshTokenEnc: 'enc(plain-refresh)',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      scope: 'calendar.events',
    };
    const prisma = fakePrisma(row);
    const client = mockClient();
    const svc = new GoogleCalendarService(prisma as any, aes as any, () => client as any);
    const result = await svc.getFreeBusy('user-1', new Date('2026-04-14'), new Date('2026-04-21'));
    expect(result).toEqual([]);
    expect(client.freebusy.query).toHaveBeenCalled();
  });

  it('createEvent returns the created event id', async () => {
    const row = {
      accessTokenEnc: 'enc(plain-access)',
      refreshTokenEnc: 'enc(plain-refresh)',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      scope: 'calendar.events',
    };
    const prisma = fakePrisma(row);
    const client = mockClient();
    const svc = new GoogleCalendarService(prisma as any, aes as any, () => client as any);
    const id = await svc.createEvent('user-1', {
      summary: 'Test',
      description: 'desc',
      start: new Date('2026-04-14T10:00:00Z'),
      end: new Date('2026-04-14T11:00:00Z'),
    });
    expect(id).toBe('evt-1');
    expect(client.events.insert).toHaveBeenCalled();
  });

  it('createEvent embeds the ICS ID marker in the description when icsId is present', async () => {
    const row = {
      accessTokenEnc: 'enc(plain-access)',
      refreshTokenEnc: 'enc(plain-refresh)',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      scope: 'calendar.events',
    };
    const prisma = fakePrisma(row);
    const client = mockClient();
    const svc = new GoogleCalendarService(prisma as any, aes as any, () => client as any);
    await svc.createEvent('user-1', {
      summary: 'Test',
      description: 'Link: https://example.com',
      start: new Date('2026-04-14T10:00:00Z'),
      end: new Date('2026-04-14T11:00:00Z'),
      icsId: { planId: 'plan-x', itemId: 'item-y' },
    });
    expect(client.events.insert).toHaveBeenCalledTimes(1);
    const call = client.events.insert.mock.calls[0]![0] as {
      requestBody: { description: string };
    };
    expect(call.requestBody.description).toContain('ICS ID: plan-x/item-y');
  });

  it('throws if the user has no GoogleAccount row', async () => {
    const prisma = fakePrisma(null);
    const client = mockClient();
    const svc = new GoogleCalendarService(prisma as any, aes as any, () => client as any);
    await expect(svc.getFreeBusy('u', new Date(), new Date())).rejects.toThrow(/GoogleAccount/);
  });

  it('listEventsInRange maps Calendar event shape into the normalized shape', async () => {
    const row = {
      accessTokenEnc: 'enc(plain-access)',
      refreshTokenEnc: 'enc(plain-refresh)',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      scope: 'calendar.events',
    };
    const prisma = fakePrisma(row);
    const client = mockClient();
    client.events.list.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 'evt-a',
            summary: 'Leetcode · binary search',
            description: 'Link: https://leetcode.com\n\nICS ID: plan-1/item-1',
            start: { dateTime: '2026-04-17T12:10:00Z' },
            end: { dateTime: '2026-04-17T13:10:00Z' },
          },
          {
            id: 'evt-b',
            summary: 'All-day',
            description: '',
            start: { date: '2026-04-17' },
            end: { date: '2026-04-18' },
          },
          {
            // dropped because no id
            summary: 'No id',
            start: { dateTime: '2026-04-17T14:00:00Z' },
            end: { dateTime: '2026-04-17T15:00:00Z' },
          },
        ],
      },
    });
    const svc = new GoogleCalendarService(prisma as any, aes as any, () => client as any);
    const result = await svc.listEventsInRange(
      'user-1',
      new Date('2026-04-17T12:00:00Z'),
      new Date('2026-04-17T13:00:00Z'),
    );
    expect(client.events.list).toHaveBeenCalledWith(
      expect.objectContaining({
        calendarId: 'primary',
        singleEvents: true,
        orderBy: 'startTime',
        timeMin: '2026-04-17T12:00:00.000Z',
        timeMax: '2026-04-17T13:00:00.000Z',
      }),
    );
    expect(result).toEqual([
      {
        id: 'evt-a',
        summary: 'Leetcode · binary search',
        description: 'Link: https://leetcode.com\n\nICS ID: plan-1/item-1',
        start: new Date('2026-04-17T12:10:00Z'),
        end: new Date('2026-04-17T13:10:00Z'),
        allDay: false,
        location: undefined,
        htmlLink: undefined,
        meetLink: undefined,
      },
    ]);
  });

  describe('listEventsInRange — extended fields', () => {
    it('returns allDay=false, location, htmlLink, meetLink for timed events', async () => {
      const row = {
        accessTokenEnc: 'enc(plain-access)',
        refreshTokenEnc: 'enc(plain-refresh)',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        scope: 'calendar.events',
      };
      const prisma = fakePrisma(row);
      const client = mockClient();
      client.events.list.mockResolvedValueOnce({
        data: {
          items: [
            {
              id: 'e1',
              summary: 'Study',
              description: 'ICS ID: p1/i1',
              start: { dateTime: '2026-04-20T14:00:00Z' },
              end: { dateTime: '2026-04-20T15:00:00Z' },
              location: 'Room A',
              htmlLink: 'https://calendar.google.com/event?eid=abc',
              conferenceData: {
                entryPoints: [{ entryPointType: 'video', uri: 'https://meet.google.com/xyz' }],
              },
            },
          ],
        },
      });
      const svc = new GoogleCalendarService(prisma as any, aes as any, () => client as any);
      const out = await svc.listEventsInRange(
        'user-1',
        new Date('2026-04-20T00:00:00Z'),
        new Date('2026-04-21T00:00:00Z'),
      );
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({
        id: 'e1',
        allDay: false,
        location: 'Room A',
        htmlLink: 'https://calendar.google.com/event?eid=abc',
        meetLink: 'https://meet.google.com/xyz',
      });
    });

    it('includes all-day events when includeAllDay=true', async () => {
      const row = {
        accessTokenEnc: 'enc(plain-access)',
        refreshTokenEnc: 'enc(plain-refresh)',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        scope: 'calendar.events',
      };
      const prisma = fakePrisma(row);
      const client = mockClient();
      client.events.list.mockResolvedValueOnce({
        data: {
          items: [
            {
              id: 'allday-1',
              summary: 'Trip LA',
              description: '',
              start: { date: '2026-04-22' },
              end: { date: '2026-04-23' },
            },
          ],
        },
      });
      const svc = new GoogleCalendarService(prisma as any, aes as any, () => client as any);
      const out = await svc.listEventsInRange(
        'user-1',
        new Date('2026-04-20T00:00:00Z'),
        new Date('2026-04-27T00:00:00Z'),
        { includeAllDay: true },
      );
      expect(out).toHaveLength(1);
      expect(out[0]).toMatchObject({ id: 'allday-1', allDay: true });
    });

    it('excludes all-day events by default (backward compat)', async () => {
      const row = {
        accessTokenEnc: 'enc(plain-access)',
        refreshTokenEnc: 'enc(plain-refresh)',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        scope: 'calendar.events',
      };
      const prisma = fakePrisma(row);
      const client = mockClient();
      client.events.list.mockResolvedValueOnce({
        data: {
          items: [
            {
              id: 'allday-1',
              summary: 'Trip LA',
              start: { date: '2026-04-22' },
              end: { date: '2026-04-23' },
            },
          ],
        },
      });
      const svc = new GoogleCalendarService(prisma as any, aes as any, () => client as any);
      const out = await svc.listEventsInRange(
        'user-1',
        new Date('2026-04-20T00:00:00Z'),
        new Date('2026-04-27T00:00:00Z'),
      );
      expect(out).toHaveLength(0);
    });
  });

  describe('rescheduleEvent', () => {
    it('patches only start and end on the primary calendar', async () => {
      const row = {
        accessTokenEnc: 'enc(plain-access)',
        refreshTokenEnc: 'enc(plain-refresh)',
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
        scope: 'calendar.events',
      };
      const prisma = fakePrisma(row);
      const client = mockClient();
      const svc = new GoogleCalendarService(prisma as any, aes as any, () => client as any);
      await svc.rescheduleEvent(
        'user-1',
        'event-1',
        new Date('2026-04-20T14:00:00Z'),
        new Date('2026-04-20T15:00:00Z'),
      );
      expect(client.events.patch).toHaveBeenCalledWith({
        calendarId: 'primary',
        eventId: 'event-1',
        requestBody: {
          start: { dateTime: '2026-04-20T14:00:00.000Z' },
          end: { dateTime: '2026-04-20T15:00:00.000Z' },
        },
      });
    });
  });
});

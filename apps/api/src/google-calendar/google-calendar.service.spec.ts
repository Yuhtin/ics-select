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
  events: { insert: jest.Mock; patch: jest.Mock; delete: jest.Mock };
};

function mockClient(): MockCalendar {
  return {
    freebusy: { query: jest.fn().mockResolvedValue({ data: { calendars: { primary: { busy: [] } } } }) },
    events: {
      insert: jest.fn().mockResolvedValue({ data: { id: 'evt-1' } }),
      patch: jest.fn().mockResolvedValue({ data: { id: 'evt-1' } }),
      delete: jest.fn().mockResolvedValue({}),
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

  it('throws if the user has no GoogleAccount row', async () => {
    const prisma = fakePrisma(null);
    const client = mockClient();
    const svc = new GoogleCalendarService(prisma as any, aes as any, () => client as any);
    await expect(svc.getFreeBusy('u', new Date(), new Date())).rejects.toThrow(/GoogleAccount/);
  });
});

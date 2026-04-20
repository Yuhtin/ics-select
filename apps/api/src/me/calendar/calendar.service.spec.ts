import { Test } from '@nestjs/testing';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { GoogleCalendarService } from '../../google-calendar/google-calendar.service.js';
import { MeCalendarService } from './calendar.service.js';

const makeGcalMock = () => ({
  listEventsInRange: jest.fn(),
  rescheduleEvent: jest.fn(),
});

const makePrismaMock = () => ({
  googleAccount: { findUnique: jest.fn() },
  weeklyPlanItem: { findMany: jest.fn() },
  memberAvailability: { findUnique: jest.fn() },
});

describe('MeCalendarService', () => {
  let service: MeCalendarService;
  let prisma: ReturnType<typeof makePrismaMock>;
  let gcal: ReturnType<typeof makeGcalMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    gcal = makeGcalMock();
    const mod = await Test.createTestingModule({
      providers: [
        MeCalendarService,
        { provide: PrismaService, useValue: prisma },
        { provide: GoogleCalendarService, useValue: gcal },
      ],
    }).compile();
    service = mod.get(MeCalendarService);
  });

  describe('getWeek', () => {
    const weekStart = new Date('2026-04-19T00:00:00-03:00'); // Sunday in São Paulo

    it('returns hasGoogleConnection=false when no GoogleAccount', async () => {
      prisma.googleAccount.findUnique.mockResolvedValue(null);
      prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
      const result = await service.getWeek('user-1', weekStart);
      expect(result.hasGoogleConnection).toBe(false);
      expect(result.events).toEqual([]);
      expect(gcal.listEventsInRange).not.toHaveBeenCalled();
    });

    it('returns hasGoogleConnection=false when listEventsInRange throws invalid_grant', async () => {
      prisma.googleAccount.findUnique.mockResolvedValue({ userId: 'user-1' });
      prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
      gcal.listEventsInRange.mockRejectedValue(new Error('invalid_grant: token revoked'));
      const result = await service.getWeek('user-1', weekStart);
      expect(result.hasGoogleConnection).toBe(false);
      expect(result.events).toEqual([]);
    });

    it('returns hasGoogleConnection=false when listEventsInRange throws "No refresh token is set"', async () => {
      prisma.googleAccount.findUnique.mockResolvedValue({ userId: 'user-1' });
      prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
      gcal.listEventsInRange.mockRejectedValue(new Error('No refresh token is set.'));
      const result = await service.getWeek('user-1', weekStart);
      expect(result.hasGoogleConnection).toBe(false);
      expect(result.events).toEqual([]);
    });

    it('classifies events with ICS ID marker as kind=ICS, others as EXTERNAL', async () => {
      prisma.googleAccount.findUnique.mockResolvedValue({ userId: 'user-1' });
      prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
      gcal.listEventsInRange.mockResolvedValue([
        {
          id: 'e-ics',
          summary: 'Two pointers',
          description: 'study · leetcode\nICS ID: plan-1/item-1',
          start: new Date('2026-04-20T14:00:00Z'),
          end: new Date('2026-04-20T14:30:00Z'),
          allDay: false,
        },
        {
          id: 'e-ext',
          summary: 'Team standup',
          description: 'Daily sync',
          start: new Date('2026-04-20T13:00:00Z'),
          end: new Date('2026-04-20T13:15:00Z'),
          allDay: false,
        },
      ]);
      prisma.weeklyPlanItem.findMany.mockResolvedValue([
        {
          id: 'item-1',
          weeklyPlanId: 'plan-1',
          outcome: 'PENDING',
          libraryItem: {
            url: 'https://leetcode.com/problems/two-sum',
            format: 'PROBLEM',
            topics: [
              { isPrimary: true, topic: { slug: 'array', label: 'Arrays' } },
            ],
          },
        },
      ]);

      const result = await service.getWeek('user-1', weekStart);

      expect(result.hasGoogleConnection).toBe(true);
      expect(result.events).toHaveLength(2);
      const ics = result.events.find((e) => e.kind === 'ICS')!;
      const ext = result.events.find((e) => e.kind === 'EXTERNAL')!;
      expect(ics.id).toBe('e-ics');
      expect(ics.ics).toMatchObject({
        planId: 'plan-1',
        itemId: 'item-1',
        url: 'https://leetcode.com/problems/two-sum',
        format: 'PROBLEM',
        outcome: 'PENDING',
        topic: { slug: 'array', label: 'Arrays' },
      });
      expect(ext.id).toBe('e-ext');
      expect(ext.ics).toBeUndefined();
    });

    it('downgrades orphan ICS events (itemId missing in DB) to EXTERNAL', async () => {
      prisma.googleAccount.findUnique.mockResolvedValue({ userId: 'user-1' });
      prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
      gcal.listEventsInRange.mockResolvedValue([
        {
          id: 'e-orphan',
          summary: 'Deleted study block',
          description: 'ICS ID: plan-1/item-GONE',
          start: new Date('2026-04-20T14:00:00Z'),
          end: new Date('2026-04-20T14:30:00Z'),
          allDay: false,
        },
      ]);
      prisma.weeklyPlanItem.findMany.mockResolvedValue([]); // not found

      const result = await service.getWeek('user-1', weekStart);
      expect(result.events).toHaveLength(1);
      expect(result.events[0]!.kind).toBe('EXTERNAL');
      expect(result.events[0]!.ics).toBeUndefined();
    });

    it('uses MemberAvailability.timezone, falling back to America/Sao_Paulo', async () => {
      prisma.googleAccount.findUnique.mockResolvedValue({ userId: 'user-1' });
      prisma.memberAvailability.findUnique.mockResolvedValue(null);
      gcal.listEventsInRange.mockResolvedValue([]);
      const result = await service.getWeek('user-1', weekStart);
      expect(result.timezone).toBe('America/Sao_Paulo');
    });

    it('includes all-day events (passes includeAllDay=true)', async () => {
      prisma.googleAccount.findUnique.mockResolvedValue({ userId: 'user-1' });
      prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
      gcal.listEventsInRange.mockResolvedValue([]);
      await service.getWeek('user-1', weekStart);
      expect(gcal.listEventsInRange).toHaveBeenCalledWith(
        'user-1',
        expect.any(Date),
        expect.any(Date),
        { includeAllDay: true },
      );
    });

    it('fetches availability and googleAccount in parallel', async () => {
      const resolveAvailability = { value: null as any };
      const resolveGoogle = { value: null as any };
      prisma.memberAvailability.findUnique.mockImplementationOnce(
        () => new Promise((r) => { resolveAvailability.value = r; }),
      );
      prisma.googleAccount.findUnique.mockImplementationOnce(
        () => new Promise((r) => { resolveGoogle.value = r; }),
      );

      const pending = service.getWeek('user-1', weekStart);

      // Both Prisma calls must be in-flight before either resolves,
      // which only happens if they were initiated in parallel.
      await Promise.resolve();
      expect(resolveAvailability.value).toBeDefined();
      expect(resolveGoogle.value).toBeDefined();

      resolveAvailability.value({ timezone: 'America/Sao_Paulo' });
      resolveGoogle.value(null);
      await pending;
    });
  });

  describe('reschedule', () => {
    it('throws ForbiddenException when target event has no ICS ID', async () => {
      gcal.listEventsInRange.mockResolvedValue([
        {
          id: 'e-ext',
          summary: 'Standup',
          description: 'no marker here',
          start: new Date('2026-04-20T13:00:00Z'),
          end: new Date('2026-04-20T13:15:00Z'),
          allDay: false,
        },
      ]);
      await expect(
        service.reschedule(
          'user-1',
          'e-ext',
          new Date('2026-04-20T14:00:00Z'),
          new Date('2026-04-20T15:00:00Z'),
        ),
      ).rejects.toThrow(/Cannot reschedule non-ICS/);
    });

    it('calls rescheduleEvent when target event has an ICS ID', async () => {
      gcal.listEventsInRange.mockResolvedValue([
        {
          id: 'e-ics',
          summary: 'Two pointers',
          description: 'ICS ID: plan-1/item-1',
          start: new Date('2026-04-20T14:00:00Z'),
          end: new Date('2026-04-20T14:30:00Z'),
          allDay: false,
        },
      ]);
      gcal.rescheduleEvent.mockResolvedValue(undefined);
      await service.reschedule(
        'user-1',
        'e-ics',
        new Date('2026-04-20T16:00:00Z'),
        new Date('2026-04-20T16:30:00Z'),
      );
      expect(gcal.rescheduleEvent).toHaveBeenCalledWith(
        'user-1',
        'e-ics',
        new Date('2026-04-20T16:00:00Z'),
        new Date('2026-04-20T16:30:00Z'),
      );
    });
  });
});

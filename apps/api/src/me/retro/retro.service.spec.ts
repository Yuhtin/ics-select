import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { InvalidItemReferenceError, RetroService } from './retro.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const makePrismaMock = () => ({
  memberAvailability: { findUnique: jest.fn() },
  cycleMembership: { findFirst: jest.fn() },
  weeklyRetro: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  weeklyPlan: {
    findFirst: jest.fn(),
  },
  weeklyPlanItem: {
    findMany: jest.fn(),
  },
});

describe('RetroService', () => {
  let service: RetroService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    const mod = await Test.createTestingModule({
      providers: [RetroService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = mod.get(RetroService);
  });

  it('open=true when Fri 19:00 local (BRT, UTC-3)', async () => {
    prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
    prisma.weeklyRetro.findUnique.mockResolvedValue(null);
    // Fri Apr 17 at 22:00 UTC = 19:00 BRT
    const result = await service.getCurrent('u-1', new Date('2026-04-17T22:00:00Z'));
    expect(result.open).toBe(true);
    expect(result.retro).toBeNull();
  });

  it('open=false on Fri 17:00 local (before window)', async () => {
    prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
    prisma.weeklyRetro.findUnique.mockResolvedValue(null);
    // Fri Apr 17 at 20:00 UTC = 17:00 BRT
    const result = await service.getCurrent('u-1', new Date('2026-04-17T20:00:00Z'));
    expect(result.open).toBe(false);
  });

  it('returns existing retro when submitted', async () => {
    prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
    prisma.weeklyRetro.findUnique.mockResolvedValue({
      id: 'r-1',
      userId: 'u-1',
      cycleId: 'c-1',
      weekStart: new Date(),
      whatClicked: 'x',
      whatStuck: null,
      nextWeekWish: null,
      submittedAt: new Date(),
    });
    const result = await service.getCurrent('u-1', new Date('2026-04-17T22:00:00Z'));
    expect(result.retro?.whatClicked).toBe('x');
  });

  it('weekRecap is null when there is no current-week PUBLISHED plan', async () => {
    prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
    prisma.weeklyRetro.findUnique.mockResolvedValue(null);
    prisma.weeklyPlan.findFirst.mockResolvedValue(null);
    const result = await service.getCurrent('u-1', new Date('2026-04-17T22:00:00Z'));
    expect(result.weekRecap).toBeNull();
  });

  it('weekRecap aggregates outcomes and minutesStudied from current-week plan items', async () => {
    prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
    prisma.weeklyRetro.findUnique.mockResolvedValue(null);
    prisma.weeklyPlan.findFirst.mockResolvedValue({
      id: 'p-1',
      items: [
        // Two DONE_EASY (45 + 30 = 75 min), one DONE_HARD (60 min) → 135 minutesStudied
        { id: 'i1', order: 0, outcome: 'DONE_EASY', scheduledMinutes: 45, libraryItem: { title: 'A', format: 'VIDEO', estimatedMinutes: 30, url: 'https://x/a' } },
        { id: 'i2', order: 1, outcome: 'DONE_HARD', scheduledMinutes: 60, libraryItem: { title: 'B', format: 'PROBLEM', estimatedMinutes: 45, url: 'https://x/b' } },
        { id: 'i3', order: 2, outcome: 'DONE_EASY', scheduledMinutes: 30, libraryItem: { title: 'C', format: 'ARTICLE', estimatedMinutes: 25, url: null } },
        { id: 'i4', order: 3, outcome: 'DOUBTS', scheduledMinutes: 30, libraryItem: { title: 'D', format: 'VIDEO', estimatedMinutes: 20, url: null } },
        { id: 'i5', order: 4, outcome: 'STUCK', scheduledMinutes: 30, libraryItem: { title: 'E', format: 'VIDEO', estimatedMinutes: 20, url: null } },
        { id: 'i6', order: 5, outcome: 'SKIPPED', scheduledMinutes: null, libraryItem: { title: 'F', format: 'VIDEO', estimatedMinutes: 5, url: null } },
        { id: 'i7', order: 6, outcome: 'PENDING', scheduledMinutes: 30, libraryItem: { title: 'G', format: 'VIDEO', estimatedMinutes: 30, url: null } },
      ],
    });
    const result = await service.getCurrent('u-1', new Date('2026-04-17T22:00:00Z'));
    expect(result.weekRecap).not.toBeNull();
    expect(result.weekRecap!.stats).toEqual({
      nailed: 2,
      hard: 1,
      doubts: 1,
      stuck: 1,
      skipped: 1,
      minutesStudied: 135,
    });
    expect(result.weekRecap!.items).toHaveLength(7);
    expect(result.weekRecap!.items[0]).toEqual({
      id: 'i1',
      title: 'A',
      format: 'VIDEO',
      estimatedMinutes: 30,
      url: 'https://x/a',
      outcome: 'DONE_EASY',
      order: 0,
    });
  });

  it('submit throws ConflictException outside window (Thu is the only fully-closed day)', async () => {
    prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
    await expect(
      service.submit(
        'u-1',
        { whatClicked: 'x' },
        new Date('2026-04-16T22:00:00Z'),   // Thu 19:00 BRT — gap day between windows
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('open=true on Wed (carry-over) and weekStart points to the previous Monday', async () => {
    prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
    prisma.weeklyRetro.findUnique.mockResolvedValue(null);
    prisma.weeklyPlan.findFirst.mockResolvedValue(null);
    // Wed Apr 22 at 22:00 UTC = 19:00 BRT — inside the carry-over window for the
    // previous week (Apr 13 Monday). Last week's weekStart is 2026-04-13.
    const result = await service.getCurrent('u-1', new Date('2026-04-22T22:00:00Z'));
    expect(result.open).toBe(true);
    expect(prisma.weeklyPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ weekStart: new Date('2026-04-13T00:00:00.000Z') }),
      }),
    );
    // windowClosesAt is Wed 23:59 of the week after weekStart Monday (Apr 13 + 9 = Apr 22).
    expect(result.windowClosesAt).toBe('2026-04-22T23:59:59.999Z');
  });

  it('open=false on Thu (gap day between carry-over close and Fri reopen)', async () => {
    prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
    prisma.weeklyRetro.findUnique.mockResolvedValue(null);
    prisma.weeklyPlan.findFirst.mockResolvedValue(null);
    const result = await service.getCurrent('u-1', new Date('2026-04-23T22:00:00Z')); // Thu 19:00 BRT
    expect(result.open).toBe(false);
  });

  it('submit on Tue upserts the previous-week retro (carry-over)', async () => {
    prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
    prisma.cycleMembership.findFirst.mockResolvedValue({ cycleId: 'c-1' });
    prisma.weeklyRetro.upsert.mockResolvedValue({
      id: 'r-late',
      userId: 'u-1',
      cycleId: 'c-1',
      weekStart: new Date('2026-04-13T00:00:00Z'),
      whatClicked: 'late note',
      whatStuck: null,
      nextWeekWish: null,
      submittedAt: new Date(),
    });
    // Tue Apr 21 at 22:00 UTC = 19:00 BRT → carry-over for week of Apr 13.
    const result = await service.submit(
      'u-1',
      { whatClicked: 'late note' },
      new Date('2026-04-21T22:00:00Z'),
    );
    expect(prisma.weeklyRetro.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_weekStart: { userId: 'u-1', weekStart: new Date('2026-04-13T00:00:00.000Z') } },
      }),
    );
    expect(result.whatClicked).toBe('late note');
  });

  it('submit upserts when inside window', async () => {
    prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
    prisma.cycleMembership.findFirst.mockResolvedValue({ cycleId: 'c-1' });
    prisma.weeklyRetro.upsert.mockResolvedValue({
      id: 'r-new',
      userId: 'u-1',
      cycleId: 'c-1',
      weekStart: new Date('2026-04-13T00:00:00Z'),
      whatClicked: 'clicked',
      whatStuck: null,
      nextWeekWish: null,
      submittedAt: new Date(),
    });
    const result = await service.submit(
      'u-1',
      { whatClicked: 'clicked' },
      new Date('2026-04-17T22:00:00Z'),
    );
    expect(prisma.weeklyRetro.upsert).toHaveBeenCalled();
    expect(result.whatClicked).toBe('clicked');
  });

  it('submit accepts valuedItemId/stuckItemId when both belong to the caller and the current week', async () => {
    prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
    prisma.cycleMembership.findFirst.mockResolvedValue({ cycleId: 'c-1' });
    // Both ids resolve to items in the caller's current-week plan.
    prisma.weeklyPlanItem.findMany.mockResolvedValue([
      { id: 'item-valued', weeklyPlan: { userId: 'u-1', weekStart: new Date('2026-04-13T00:00:00Z') } },
      { id: 'item-stuck',  weeklyPlan: { userId: 'u-1', weekStart: new Date('2026-04-13T00:00:00Z') } },
    ]);
    prisma.weeklyRetro.upsert.mockResolvedValue({
      id: 'r-1', userId: 'u-1', cycleId: 'c-1',
      weekStart: new Date('2026-04-13T00:00:00Z'),
      whatClicked: 'because',
      whatStuck: 'lost on subqueries',
      nextWeekWish: null,
      valuedItemId: 'item-valued',
      stuckItemId: 'item-stuck',
      submittedAt: new Date(),
    });
    const result = await service.submit(
      'u-1',
      {
        whatClicked: 'because',
        whatStuck: 'lost on subqueries',
        valuedItemId: 'item-valued',
        stuckItemId: 'item-stuck',
      },
      new Date('2026-04-17T22:00:00Z'),
    );
    expect(prisma.weeklyRetro.upsert).toHaveBeenCalled();
    expect(result.valuedItemId).toBe('item-valued');
    expect(result.stuckItemId).toBe('item-stuck');
  });

  it('submit rejects valuedItemId belonging to another user', async () => {
    prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
    prisma.cycleMembership.findFirst.mockResolvedValue({ cycleId: 'c-1' });
    prisma.weeklyPlanItem.findMany.mockResolvedValue([
      // findMany returned 0 rows that match the caller + week — the id either
      // doesn't exist or belongs to a different user/week.
    ]);
    await expect(
      service.submit(
        'u-1',
        { whatClicked: 'x', valuedItemId: 'foreign-item' },
        new Date('2026-04-17T22:00:00Z'),
      ),
    ).rejects.toBeInstanceOf(InvalidItemReferenceError);
  });

  it('submit treats null/undefined ids as "no link" (no validation needed)', async () => {
    prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
    prisma.cycleMembership.findFirst.mockResolvedValue({ cycleId: 'c-1' });
    prisma.weeklyRetro.upsert.mockResolvedValue({
      id: 'r-1', userId: 'u-1', cycleId: 'c-1',
      weekStart: new Date('2026-04-13T00:00:00Z'),
      whatClicked: null, whatStuck: null,
      nextWeekWish: 'mais SD',
      valuedItemId: null, stuckItemId: null,
      submittedAt: new Date(),
    });
    await service.submit(
      'u-1',
      { nextWeekWish: 'mais SD' },
      new Date('2026-04-17T22:00:00Z'),
    );
    // No findMany call needed when both ids are absent.
    expect(prisma.weeklyPlanItem.findMany).not.toHaveBeenCalled();
  });
});

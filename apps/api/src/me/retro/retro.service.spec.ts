import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { RetroService } from './retro.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const makePrismaMock = () => ({
  memberAvailability: { findUnique: jest.fn() },
  cycleMembership: { findFirst: jest.fn() },
  weeklyRetro: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
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

  it('submit throws ConflictException outside window', async () => {
    prisma.memberAvailability.findUnique.mockResolvedValue({ timezone: 'America/Sao_Paulo' });
    await expect(
      service.submit(
        'u-1',
        { whatClicked: 'x' },
        new Date('2026-04-15T22:00:00Z'),   // Wed, not a retro day
      ),
    ).rejects.toThrow(ConflictException);
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
});

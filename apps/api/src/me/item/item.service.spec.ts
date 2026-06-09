import { Test } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { ItemService } from './item.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const makePrismaMock = () => ({
  weeklyPlanItem: { findUnique: jest.fn() },
});

describe('ItemService', () => {
  let service: ItemService;
  let prisma: ReturnType<typeof makePrismaMock>;

  beforeEach(async () => {
    prisma = makePrismaMock();
    const mod = await Test.createTestingModule({
      providers: [ItemService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = mod.get(ItemService);
  });

  it('throws NotFoundException when item does not exist', async () => {
    prisma.weeklyPlanItem.findUnique.mockResolvedValue(null);
    await expect(service.getItem('missing', 'user-1')).rejects.toThrow(NotFoundException);
  });

  it('throws ForbiddenException when caller does not own the plan', async () => {
    prisma.weeklyPlanItem.findUnique.mockResolvedValue({
      id: 'i1',
      weeklyPlan: { userId: 'someone-else' },
      libraryItem: { topics: [] },
      carriedFrom: null,
    });
    await expect(service.getItem('i1', 'user-1')).rejects.toThrow(ForbiddenException);
  });

  it('returns item + carriedFrom when present', async () => {
    prisma.weeklyPlanItem.findUnique.mockResolvedValue({
      id: 'i1',
      weeklyPlanId: 'plan-new',
      order: 1,
      outcome: 'PENDING',
      reflection: null,
      completedAt: null,
      scheduledAt: null,
      scheduledMinutes: null,
      weeklyPlan: {
        userId: 'user-1',
        weekStart: new Date('2026-04-13T00:00:00Z'),
        weekEnd: new Date('2026-04-19T23:59:59Z'),
      },
      libraryItem: {
        id: 'lib-1',
        title: 'DP intro',
        description: 'Dynamic programming fundamentals',
        url: 'https://x',
        format: 'PROBLEM',
        estimatedMinutes: 45,
        topics: [
          {
            isPrimary: true,
            topic: { id: 't-dp', slug: 'dp', label: 'Dynamic Programming' },
          },
        ],
      },
      carriedFrom: {
        outcome: 'STUCK',
        reflection: 'travei no passo base',
        completedAt: new Date('2026-04-11T12:00:00Z'),
        weeklyPlan: { weekStart: new Date('2026-04-06T00:00:00Z') },
      },
    });

    const result = await service.getItem('i1', 'user-1', new Date('2026-04-15T12:00:00Z'));
    expect(result.id).toBe('i1');
    expect(result.libraryItem.topic?.slug).toBe('dp');
    expect(result.carriedFrom?.outcome).toBe('STUCK');
    expect(result.carriedFrom?.weekStart).toBe('2026-04-06');
  });

  it('returns null carriedFrom when not present', async () => {
    prisma.weeklyPlanItem.findUnique.mockResolvedValue({
      id: 'i1',
      weeklyPlanId: 'plan-new',
      order: 1,
      outcome: 'PENDING',
      reflection: null,
      completedAt: null,
      scheduledAt: null,
      scheduledMinutes: null,
      weeklyPlan: {
        userId: 'user-1',
        weekStart: new Date('2026-04-13T00:00:00Z'),
        weekEnd: new Date('2026-04-19T23:59:59Z'),
      },
      libraryItem: {
        id: 'lib-1',
        title: 'Fresh item',
        description: null,
        url: null,
        format: 'ARTICLE',
        estimatedMinutes: 20,
        topics: [],
      },
      carriedFrom: null,
    });

    const result = await service.getItem('i1', 'user-1', new Date('2026-04-15T12:00:00Z'));
    expect(result.carriedFrom).toBeNull();
  });

  it('throws ForbiddenException when the item belongs to a past (closed) week', async () => {
    prisma.weeklyPlanItem.findUnique.mockResolvedValue({
      id: 'i1',
      weeklyPlanId: 'plan-old',
      order: 1,
      outcome: 'PENDING',
      reflection: null,
      completedAt: null,
      scheduledAt: null,
      scheduledMinutes: null,
      weeklyPlan: {
        userId: 'user-1',
        weekStart: new Date('2026-04-13T00:00:00Z'),
        weekEnd: new Date('2026-04-19T23:59:59Z'),
      },
      libraryItem: { id: 'lib-1', title: 'Old item', description: null, url: null, format: 'ARTICLE', estimatedMinutes: 20, topics: [] },
      carriedFrom: null,
    });
    // now is well after that week ended → blocked.
    await expect(
      service.getItem('i1', 'user-1', new Date('2026-05-30T12:00:00Z')),
    ).rejects.toThrow(ForbiddenException);
  });
});

import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { CycleReceiptService } from './cycle-receipt.service';
import type { PrismaService } from '../../common/prisma/prisma.service';

const mockPrisma = () => ({
  cycle: { findUnique: jest.fn() },
  weeklyPlanItem: { findMany: jest.fn().mockResolvedValue([]) },
  weeklyRetro: { groupBy: jest.fn().mockResolvedValue([]) },
  classSession: { findMany: jest.fn().mockResolvedValue([]) },
  classAttendance: { findMany: jest.fn().mockResolvedValue([]) },
});

const makeService = (prisma: ReturnType<typeof mockPrisma>) =>
  new CycleReceiptService(prisma as unknown as PrismaService);

describe('CycleReceiptService — cycle metadata', () => {
  it('throws NotFoundException when cycle does not exist', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue(null);
    const svc = makeService(prisma);
    await expect(svc.build('nonexistent', new Date())).rejects.toThrow(NotFoundException);
  });

  it('throws ConflictException for UPCOMING cycle that has not started', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'Ciclo 5',
      status: 'UPCOMING',
      startsAt: new Date('2030-06-01T00:00:00Z'),
      endsAt: new Date('2030-08-01T00:00:00Z'),
      memberships: [],
    });
    const svc = makeService(prisma);
    await expect(svc.build('c1', new Date('2026-05-13'))).rejects.toThrow(ConflictException);
  });

  it('throws BadRequestException when asOf is out of range', async () => {
    const prisma = mockPrisma();
    prisma.cycle.findUnique.mockResolvedValue({
      id: 'c1',
      name: 'Ciclo 4',
      status: 'ACTIVE',
      startsAt: new Date('2026-04-01T00:00:00Z'),
      endsAt: new Date('2026-06-01T00:00:00Z'),
      memberships: [],
    });
    const svc = makeService(prisma);
    await expect(svc.build('c1', new Date('2026-03-15'))).rejects.toThrow(BadRequestException);
    await expect(svc.build('c1', new Date('2026-06-15'))).rejects.toThrow(BadRequestException);
  });
});

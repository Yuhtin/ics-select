import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';

@Injectable()
export class PlanDraftsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateDraft(input: { memberId: string; weekStart: Date }) {
    const membership = await this.prisma.cycleMembership.findFirst({
      where: { userId: input.memberId, cycle: { status: 'ACTIVE' } },
      include: { cycle: true },
    });
    if (!membership) throw new NotFoundException('member has no active cycle');
    const cycle = (membership as any).cycle;
    const weekEnd = new Date(input.weekStart.getTime() + 7 * 24 * 60 * 60 * 1000 - 1);
    if (input.weekStart < cycle.startsAt || weekEnd > cycle.endsAt) {
      throw new ConflictException({
        error: { code: 'PLAN_OUTSIDE_CYCLE', message: 'Semana fora do intervalo do ciclo' },
      });
    }

    const existing = await this.prisma.weeklyPlan.findFirst({
      where: { userId: input.memberId, weekStart: input.weekStart },
      include: { items: { include: { libraryItem: true }, orderBy: { order: 'asc' } } },
    });
    if (existing) {
      if (existing.status === 'PUBLISHED') {
        throw new ConflictException({
          error: { code: 'PLAN_ALREADY_PUBLISHED', message: 'Essa semana já tem plano publicado' },
        });
      }
      return existing;
    }

    return this.prisma.weeklyPlan.create({
      data: {
        userId: input.memberId,
        cycleId: cycle.id,
        weekStart: input.weekStart,
        weekEnd,
        status: 'DRAFT',
      },
      include: { items: { include: { libraryItem: true }, orderBy: { order: 'asc' } } },
    });
  }
}

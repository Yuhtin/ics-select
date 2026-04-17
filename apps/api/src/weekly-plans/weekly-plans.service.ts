import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type { ItemOutcome } from '@ics-select/shared';

type CreateInput = {
  userId: string;
  cycleId: string;
  weekStart: Date;
  weekEnd: Date;
  adminNotes?: string;
  items: Array<{ libraryItemId: string; order: number }>;
};

type UpdateInput = {
  adminNotes?: string;
  items?: Array<{ libraryItemId: string; order: number }>;
};

@Injectable()
export class WeeklyPlansService {
  constructor(private readonly prisma: PrismaService) {}

  async remove(id: string) {
    const plan = await this.prisma.weeklyPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('plan not found');
    await this.prisma.weeklyPlan.delete({ where: { id } });
  }

  async createDraft(input: CreateInput) {
    const cycle = await this.prisma.cycle.findUnique({ where: { id: input.cycleId } });
    if (!cycle) throw new NotFoundException('cycle not found');
    if (input.weekStart < cycle.startsAt || input.weekEnd > cycle.endsAt) {
      throw new ConflictException({
        error: {
          code: 'PLAN_OUTSIDE_CYCLE',
          message: 'A semana do plano precisa estar dentro do período do ciclo',
          details: {
            cycleStart: cycle.startsAt,
            cycleEnd: cycle.endsAt,
            weekStart: input.weekStart,
            weekEnd: input.weekEnd,
          },
        },
      });
    }
    return this.prisma.weeklyPlan.create({
      data: {
        userId: input.userId,
        cycleId: input.cycleId,
        weekStart: input.weekStart,
        weekEnd: input.weekEnd,
        adminNotes: input.adminNotes,
        status: 'DRAFT',
        items: {
          create: input.items.map((i) => ({
            libraryItemId: i.libraryItemId,
            order: i.order,
          })),
        },
      },
      include: { items: { include: { libraryItem: true } } },
    });
  }

  async update(id: string, input: UpdateInput) {
    const existing = await this.getByIdOrThrow(id);
    if (existing.status !== 'DRAFT') {
      throw new ConflictException('only DRAFT plans can be edited');
    }
    if (input.items) {
      // Delete and recreate items for simplicity
      await this.prisma.weeklyPlanItem.deleteMany({ where: { weeklyPlanId: id } });
    }
    return this.prisma.weeklyPlan.update({
      where: { id },
      data: {
        adminNotes: input.adminNotes,
        ...(input.items
          ? {
              items: {
                create: input.items.map((i) => ({
                  libraryItemId: i.libraryItemId,
                  order: i.order,
                })),
              },
            }
          : {}),
      },
      include: { items: { include: { libraryItem: true } } },
    });
  }

  getById(id: string) {
    return this.prisma.weeklyPlan.findUnique({
      where: { id },
      include: {
        items: {
          include: { libraryItem: true },
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async getByIdOrThrow(id: string) {
    const plan = await this.getById(id);
    if (!plan) throw new NotFoundException('plan not found');
    return plan;
  }

  async cohortProgress(userId: string) {
    const now = new Date();
    // Prefer the cycle whose dates contain today; if none, the next upcoming cycle the member is in.
    let membership = await this.prisma.cycleMembership.findFirst({
      where: {
        userId,
        cycle: {
          status: 'ACTIVE',
          startsAt: { lte: now },
          endsAt: { gte: now },
        },
      },
      select: { cycleId: true },
    });
    if (!membership) {
      membership = await this.prisma.cycleMembership.findFirst({
        where: {
          userId,
          cycle: { status: 'ACTIVE', startsAt: { gt: now } },
        },
        orderBy: { cycle: { startsAt: 'asc' } },
        select: { cycleId: true },
      });
    }
    if (!membership) return [];

    const memberships = await this.prisma.cycleMembership.findMany({
      where: { cycleId: membership.cycleId },
      include: {
        user: { select: { id: true, name: true, pictureUrl: true } },
      },
    });

    const plans = await this.prisma.weeklyPlan.findMany({
      where: { cycleId: membership.cycleId, status: 'PUBLISHED' },
      orderBy: { weekStart: 'desc' },
      include: { items: { select: { id: true, outcome: true } } },
    });

    return memberships
      .map((m) => {
        const userPlans = plans.filter((p) => p.userId === m.userId);
        const currentPlan = userPlans[0];
        const done = currentPlan?.items.filter((i) => i.outcome === 'DONE_EASY' || i.outcome === 'DONE_HARD').length ?? 0;
        const total = currentPlan?.items.length ?? 0;
        return {
          userId: m.user.id,
          name: m.user.name,
          pictureUrl: m.user.pictureUrl,
          done,
          total,
          percent: total === 0 ? 0 : Math.round((done / total) * 100),
        };
      })
      .sort((a, b) => b.percent - a.percent);
  }

  listAllForMember(userId: string) {
    return this.prisma.weeklyPlan.findMany({
      where: { userId },
      orderBy: { weekStart: 'asc' },
      select: {
        id: true,
        weekStart: true,
        weekEnd: true,
        status: true,
        cycleId: true,
        cycle: { select: { name: true } },
        items: {
          select: { id: true, outcome: true },
        },
      },
    });
  }

  listForMember(userId: string) {
    return this.prisma.weeklyPlan.findMany({
      where: { userId },
      orderBy: { weekStart: 'desc' },
      include: {
        items: { include: { libraryItem: true }, orderBy: { order: 'asc' } },
      },
    });
  }

  async setItemOutcome(
    itemId: string,
    userId: string,
    input: { outcome: ItemOutcome; reflection?: string | null },
  ) {
    const item = await this.prisma.weeklyPlanItem.findUnique({
      where: { id: itemId },
      include: { weeklyPlan: { select: { userId: true } } },
    });
    if (!item) throw new NotFoundException('Item not found');
    if (item.weeklyPlan.userId !== userId) {
      throw new ForbiddenException('Forbidden: cannot change someone else\'s item');
    }

    const completed = input.outcome !== 'PENDING';

    return this.prisma.weeklyPlanItem.update({
      where: { id: itemId },
      data: {
        outcome: input.outcome,
        reflection: input.reflection ?? undefined,
        completedAt: completed ? new Date() : null,
      },
    });
  }
}

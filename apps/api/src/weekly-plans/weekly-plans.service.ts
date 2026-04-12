import { ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { WhatsappService } from '../whatsapp/whatsapp.service.js';

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
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly whatsapp?: WhatsappService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async createDraft(input: CreateInput) {
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
      include: { items: { include: { libraryItem: true, sessions: true } } },
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
      include: { items: { include: { libraryItem: true, sessions: true } } },
    });
  }

  getById(id: string) {
    return this.prisma.weeklyPlan.findUnique({
      where: { id },
      include: {
        items: {
          include: { libraryItem: true, sessions: true },
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
    const membership = await this.prisma.cycleMembership.findFirst({
      where: {
        userId,
        cycle: {
          status: 'ACTIVE',
          startsAt: { lte: new Date() },
          endsAt: { gte: new Date() },
        },
      },
      select: { cycleId: true },
    });
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
      include: { items: { select: { id: true, status: true } } },
    });

    return memberships
      .map((m) => {
        const userPlans = plans.filter((p) => p.userId === m.userId);
        const currentPlan = userPlans[0];
        const done = currentPlan?.items.filter((i) => i.status === 'DONE').length ?? 0;
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
          select: { id: true, status: true },
        },
      },
    });
  }

  listForMember(userId: string) {
    return this.prisma.weeklyPlan.findMany({
      where: { userId },
      orderBy: { weekStart: 'desc' },
      include: {
        items: { include: { libraryItem: true, sessions: true }, orderBy: { order: 'asc' } },
      },
    });
  }

  async markItemDone(
    planId: string,
    itemId: string,
    userId: string,
    input: {
      rating?: 'EASY' | 'HARD';
      reflection?: string;
      completionStatus?: 'DONE' | 'STUCK' | 'DOUBTS';
      feedback?: string;
    },
  ) {
    const plan = await this.prisma.weeklyPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('plan not found');
    if (plan.userId !== userId) throw new NotFoundException('plan not found');
    const cs = input.completionStatus ?? 'DONE';
    return this.prisma.weeklyPlanItem.update({
      where: { id: itemId },
      data: {
        status: 'DONE',
        completedAt: new Date(),
        difficultyRating: input.rating ?? null,
        reflection: input.reflection ?? null,
        completionStatus: cs,
        feedback: input.feedback ?? null,
        stuck: cs === 'STUCK',
        stuckAt: cs === 'STUCK' ? new Date() : null,
      },
    });
  }

  async markItemStuck(planId: string, itemId: string, userId: string) {
    const plan = await this.prisma.weeklyPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('plan not found');
    if (plan.userId !== userId) throw new NotFoundException('plan not found');
    const updated = await this.prisma.weeklyPlanItem.update({
      where: { id: itemId },
      data: { stuck: true, stuckAt: new Date() },
    });

    if (this.whatsapp && this.config) {
      const adminNumber = this.config.get<string>('ADMIN_WHATSAPP_NUMBER');
      if (adminNumber) {
        const planWithUser = await this.prisma.weeklyPlan.findUnique({
          where: { id: planId },
          include: { user: true },
        });
        const item = await this.prisma.weeklyPlanItem.findUnique({
          where: { id: itemId },
          include: { libraryItem: true },
        });
        if (planWithUser && item) {
          await this.whatsapp.send({
            userId: planWithUser.user.id,
            kind: 'stuck_alert',
            to: adminNumber,
            text: `🚨 ${planWithUser.user.name} travou em "${item.libraryItem.title}"`,
          });
        }
      }
    }

    return updated;
  }
}

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
    input: { rating?: 'EASY' | 'HARD'; reflection?: string },
  ) {
    const plan = await this.prisma.weeklyPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('plan not found');
    if (plan.userId !== userId) throw new NotFoundException('plan not found');
    return this.prisma.weeklyPlanItem.update({
      where: { id: itemId },
      data: {
        status: 'DONE',
        completedAt: new Date(),
        difficultyRating: input.rating ?? null,
        reflection: input.reflection ?? null,
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

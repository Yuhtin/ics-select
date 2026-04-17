import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';

@Injectable()
export class ItemService {
  constructor(private readonly prisma: PrismaService) {}

  async getItem(itemId: string, userId: string) {
    const row = await this.prisma.weeklyPlanItem.findUnique({
      where: { id: itemId },
      include: {
        weeklyPlan: { select: { userId: true } },
        libraryItem: { include: { topic: true } },
        carriedFrom: {
          include: {
            weeklyPlan: { select: { weekStart: true } },
          },
        },
      },
    });

    if (!row) throw new NotFoundException('Item not found');
    if (row.weeklyPlan.userId !== userId) {
      throw new ForbiddenException('Cannot view this item');
    }

    return {
      id: row.id,
      planId: row.weeklyPlanId,
      order: row.order,
      outcome: row.outcome,
      reflection: row.reflection ?? null,
      completedAt: row.completedAt ? row.completedAt.toISOString() : null,
      scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
      scheduledMinutes: row.scheduledMinutes ?? null,
      libraryItem: {
        id: row.libraryItem.id,
        title: row.libraryItem.title,
        description: row.libraryItem.description ?? null,
        url: row.libraryItem.url ?? null,
        format: row.libraryItem.format,
        estimatedMinutes: row.libraryItem.estimatedMinutes,
        topic: row.libraryItem.topic
          ? { slug: row.libraryItem.topic.slug, label: row.libraryItem.topic.label }
          : null,
      },
      carriedFrom: row.carriedFrom
        ? {
            outcome: row.carriedFrom.outcome,
            reflection: row.carriedFrom.reflection ?? null,
            completedAt: row.carriedFrom.completedAt
              ? row.carriedFrom.completedAt.toISOString()
              : null,
            weekStart: row.carriedFrom.weeklyPlan.weekStart.toISOString().slice(0, 10),
          }
        : null,
    };
  }
}

import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { isPlanWeekCurrent } from '../../common/cycle/current-week.js';

@Injectable()
export class ItemService {
  constructor(private readonly prisma: PrismaService) {}

  async getItem(itemId: string, userId: string, now: Date = new Date()) {
    const row = await this.prisma.weeklyPlanItem.findUnique({
      where: { id: itemId },
      include: {
        weeklyPlan: { select: { userId: true, weekStart: true, weekEnd: true } },
        libraryItem: {
          include: {
            topics: {
              include: {
                topic: { select: { id: true, slug: true, label: true } },
              },
            },
          },
        },
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
    // Only the current week's items are accessible — a stale carried copy from a
    // closed week must not be reachable (e.g. via calendar history) and marked.
    if (!isPlanWeekCurrent(row.weeklyPlan.weekStart, row.weeklyPlan.weekEnd, now)) {
      throw new ForbiddenException('Este item não está na sua semana atual.');
    }

    return {
      id: row.id,
      planId: row.weeklyPlanId,
      order: row.order,
      outcome: row.outcome,
      skippable: row.libraryItem.topics.some((t) => t.topic.slug === 'foundations'),
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
        topic: (() => {
          const primary = row.libraryItem.topics.find((t) => t.isPrimary);
          return primary
            ? { slug: primary.topic.slug, label: primary.topic.label }
            : null;
        })(),
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

import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { resolveActiveMembership } from '../common/cycle/active-cycle.js';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service.js';
import { type ItemOutcome, isPositiveOutcome } from '@ics-select/shared';

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
    private readonly calendar: GoogleCalendarService,
  ) {}

  async remove(id: string) {
    const plan = await this.prisma.weeklyPlan.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!plan) throw new NotFoundException('plan not found');

    if (plan.status === 'PUBLISHED') {
      for (const item of plan.items) {
        try {
          const eventId = await this.calendar.findEventIdByIcsId(
            plan.userId,
            plan.id,
            item.id,
            { start: plan.weekStart, end: plan.weekEnd },
          );
          if (eventId) await this.calendar.deleteEvent(plan.userId, eventId);
        } catch {
          // swallow — per-item Calendar failures shouldn't block delete
        }
      }
    }

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
    await this.prisma.weeklyPlan.update({
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
    });
    // Re-read via getByIdOrThrow so the response carries the hydrated
    // topicId/topic/topics/skippable shape — a bare Prisma update returns raw
    // libraryItem rows, which drops the topic label + skippable pill in the
    // admin plan editor after "Save draft".
    return this.getByIdOrThrow(id);
  }

  async getById(id: string) {
    const plan = await this.prisma.weeklyPlan.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            libraryItem: {
              include: {
                topics: {
                  include: {
                    topic: { select: { id: true, slug: true, label: true } },
                  },
                },
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });
    if (!plan) return null;
    return {
      ...plan,
      items: plan.items.map((i) => {
        const primary = i.libraryItem.topics.find((t) => t.isPrimary)?.topic ?? null;
        return {
          ...i,
          skippable: i.libraryItem.topics.some((t) => t.topic.slug === 'foundations'),
          libraryItem: {
            ...i.libraryItem,
            topicId: primary?.id ?? null,
            topic: primary ? { id: primary.id, slug: primary.slug, label: primary.label } : null,
            topics: i.libraryItem.topics.map((tr) => ({
              id: tr.topic.id,
              slug: tr.topic.slug,
              label: tr.topic.label,
              isPrimary: tr.isPrimary,
            })),
          },
        };
      }),
    };
  }

  async getByIdOrThrow(id: string) {
    const plan = await this.getById(id);
    if (!plan) throw new NotFoundException('plan not found');
    return plan;
  }

  async cohortProgress(userId: string) {
    const membership = await resolveActiveMembership(this.prisma, userId);
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
        const done = currentPlan?.items.filter((i) => isPositiveOutcome(i.outcome)).length ?? 0;
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

  async listForMember(userId: string) {
    const plans = await this.prisma.weeklyPlan.findMany({
      where: { userId },
      orderBy: { weekStart: 'desc' },
      include: {
        items: {
          include: {
            libraryItem: {
              include: {
                topics: {
                  include: {
                    topic: { select: { id: true, slug: true, label: true } },
                  },
                },
              },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    });
    return plans.map((plan) => ({
      ...plan,
      items: plan.items.map((i) => {
        const primary = i.libraryItem.topics.find((t) => t.isPrimary)?.topic ?? null;
        return {
          ...i,
          skippable: i.libraryItem.topics.some((t) => t.topic.slug === 'foundations'),
          libraryItem: {
            ...i.libraryItem,
            topicId: primary?.id ?? null,
            topic: primary ? { id: primary.id, slug: primary.slug, label: primary.label } : null,
            topics: i.libraryItem.topics.map((tr) => ({
              id: tr.topic.id,
              slug: tr.topic.slug,
              label: tr.topic.label,
              isPrimary: tr.isPrimary,
            })),
          },
        };
      }),
    }));
  }

  async setItemOutcome(
    itemId: string,
    userId: string,
    input: { outcome: ItemOutcome; reflection?: string | null },
  ) {
    const item = await this.prisma.weeklyPlanItem.findUnique({
      where: { id: itemId },
      include: {
        weeklyPlan: { select: { id: true, userId: true, status: true, weekStart: true, weekEnd: true } },
        libraryItem: { include: { topics: { include: { topic: { select: { slug: true } } } } } },
      },
    });
    if (!item) throw new NotFoundException('Item not found');
    if (item.weeklyPlan.userId !== userId) {
      throw new ForbiddenException("Forbidden: cannot change someone else's item");
    }

    if (input.outcome === 'SKIPPED') {
      const slugs = item.libraryItem.topics.map((t) => t.topic.slug);
      if (!slugs.includes('foundations')) {
        throw new ForbiddenException('Only foundations items can be skipped');
      }
      if (item.weeklyPlan.status === 'PUBLISHED') {
        const eventId = await this.calendar.findEventIdByIcsId(
          userId,
          item.weeklyPlan.id,
          item.id,
          { start: item.weeklyPlan.weekStart, end: item.weeklyPlan.weekEnd },
        );
        if (eventId) {
          try {
            await this.calendar.deleteEvent(userId, eventId);
          } catch {
            // swallow — matches PublicationService style
          }
        }
      }
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

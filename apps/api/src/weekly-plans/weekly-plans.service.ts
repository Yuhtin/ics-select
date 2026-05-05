import { ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { resolveActiveMembership } from '../common/cycle/active-cycle.js';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service.js';
import { BusyCacheService } from '../google-calendar/busy-cache.service.js';
import { type ItemOutcome, allocatedMinutes, isPositiveOutcome } from '@ics-select/shared';

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

// Foundations items are skippable because the cohort enters the cycle with
// uneven priors — strong members shouldn't have to mark "done" on what they
// already know. Videos are skippable too: members regularly already watched
// the channel/playlist and forcing a re-watch is friction with no learning
// gain. Both surfaces (admin pill + member action) and the server-side
// guard share this rule.
function isItemSkippable(libraryItem: {
  format: string;
  topics: ReadonlyArray<{ topic: { slug: string } }>;
}): boolean {
  if (libraryItem.format === 'VIDEO') return true;
  return libraryItem.topics.some((t) => t.topic.slug === 'foundations');
}

@Injectable()
export class WeeklyPlansService {
  private readonly logger = new Logger(WeeklyPlansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calendar: GoogleCalendarService,
    private readonly busyCache: BusyCacheService,
  ) {}

  async remove(id: string) {
    // Read the event ids we own before the cascade wipes them, then delete the
    // plan synchronously and return. The Google Calendar delete fan-out runs
    // in the background — the admin sees a sub-200ms response and a flaky
    // Calendar (or 10 events × 500ms each) doesn't pin the request thread.
    const plan = await this.prisma.weeklyPlan.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        weekStart: true,
        items: { select: { calendarEvents: { select: { googleEventId: true } } } },
      },
    });
    if (!plan) throw new NotFoundException('plan not found');

    const eventIds = plan.items.flatMap((i) => i.calendarEvents.map((e) => e.googleEventId));

    await this.prisma.weeklyPlan.delete({ where: { id } });

    if (eventIds.length > 0) {
      this.busyCache.invalidate(plan.userId, plan.weekStart);
      void this.deleteCalendarEventsInBackground(plan.userId, plan.id, eventIds);
    }
  }

  private async deleteCalendarEventsInBackground(
    userId: string,
    planId: string,
    eventIds: string[],
  ): Promise<void> {
    const startedAt = Date.now();
    const results = await Promise.allSettled(
      eventIds.map((eventId) => this.calendar.deleteEvent(userId, eventId)),
    );
    const failed = results.filter((r) => r.status === 'rejected').length;
    this.logger.log(
      `plan-delete calendar cleanup · user=${userId} plan=${planId} · ${eventIds.length - failed}/${eventIds.length} deleted · ${Date.now() - startedAt}ms`,
    );
    for (const r of results) {
      if (r.status === 'rejected') {
        this.logger.warn(
          `calendar.deleteEvent failed during plan delete · user=${userId} plan=${planId} · ${String(r.reason)}`,
        );
      }
    }
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
    // SCHEDULED plans are still editable — admin can tweak before the cron
    // flips them to PUBLISHED. PUBLISHED/COMPLETED/ARCHIVED are frozen.
    if (existing.status !== 'DRAFT' && existing.status !== 'SCHEDULED') {
      throw new ConflictException('only DRAFT/SCHEDULED plans can be edited');
    }
    // Wrap delete-and-recreate in a transaction so a mid-flight failure
    // doesn't leave the plan with zero items. WeeklyPlanItemCalendarEvent
    // rows cascade-delete with the items (only relevant if a SCHEDULED plan
    // had been pre-scheduled, which currently never happens — autoSchedule
    // runs on PUBLISHED plans — but the cascade keeps us correct if that
    // ever changes).
    await this.prisma.$transaction(async (tx) => {
      if (input.items) {
        await tx.weeklyPlanItem.deleteMany({ where: { weeklyPlanId: id } });
      }
      await tx.weeklyPlan.update({
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
          skippable: isItemSkippable(i.libraryItem),
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

    // Two-step query so we don't load every PUBLISHED plan in the cycle when
    // we only need each member's most recent one.
    //   1. cohort roster + max(weekStart) per user (groupBy is a single
    //      indexed query; previously this pulled 12 members × 12 weeks of
    //      plans + items just to use plans[0]).
    //   2. fetch only the (userId, weekStart) pairs that actually win.
    const [memberships, latestByUser] = await Promise.all([
      this.prisma.cycleMembership.findMany({
        where: { cycleId: membership.cycleId },
        include: {
          user: { select: { id: true, name: true, pictureUrl: true } },
        },
      }),
      this.prisma.weeklyPlan.groupBy({
        by: ['userId'],
        where: { cycleId: membership.cycleId, status: 'PUBLISHED' },
        _max: { weekStart: true },
      }),
    ]);

    const latestPairs = latestByUser
      .filter((row): row is { userId: string; _max: { weekStart: Date } } => row._max.weekStart != null)
      .map((row) => ({ userId: row.userId, weekStart: row._max.weekStart }));

    const plans = latestPairs.length === 0
      ? []
      : await this.prisma.weeklyPlan.findMany({
          where: {
            cycleId: membership.cycleId,
            status: 'PUBLISHED',
            OR: latestPairs.map((p) => ({ userId: p.userId, weekStart: p.weekStart })),
          },
          select: {
            userId: true,
            items: { select: { outcome: true } },
          },
        });

    const planByUser = new Map(plans.map((p) => [p.userId, p]));

    return memberships
      .map((m) => {
        const currentPlan = planByUser.get(m.userId);
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
          skippable: isItemSkippable(i.libraryItem),
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
    input: { outcome: ItemOutcome; reflection?: string | null; actualMinutes: number | null },
  ) {
    const item = await this.prisma.weeklyPlanItem.findUnique({
      where: { id: itemId },
      include: {
        weeklyPlan: { select: { id: true, userId: true, status: true, weekStart: true } },
        libraryItem: { include: { topics: { include: { topic: { select: { slug: true } } } } } },
        calendarEvents: { select: { id: true, googleEventId: true } },
      },
    });
    if (!item) throw new NotFoundException('Item not found');
    if (item.weeklyPlan.userId !== userId) {
      throw new ForbiddenException("Forbidden: cannot change someone else's item");
    }
    if (input.outcome === 'SKIPPED' && !isItemSkippable(item.libraryItem)) {
      throw new ForbiddenException('Only foundations or video items can be skipped');
    }

    // Apply the outcome immediately — this is what the user actually clicked.
    // Calendar reconciliation (delete events on SKIPPED, reschedule-to-now on
    // early completion) is fire-and-forget so the member doesn't wait on
    // Google round-trips. Errors there were already swallowed (warn-only),
    // so backgrounding doesn't change the contract. See
    // docs/calendar-durable-queue.md for the planned move to a Redis queue.
    const completed = input.outcome !== 'PENDING';
    const updated = await this.prisma.weeklyPlanItem.update({
      where: { id: itemId },
      data: {
        outcome: input.outcome,
        reflection: input.reflection ?? undefined,
        actualMinutes: input.actualMinutes,
        completedAt: completed ? new Date() : null,
      },
    });

    // Any non-PENDING outcome moves or deletes the calendar event; the
    // member's busy state for this week changed, so the cached freebusy
    // is stale. Invalidate optimistically — the next plan-context read
    // will refetch. (PENDING means "undo" with no calendar side-effect.)
    if (input.outcome !== 'PENDING') {
      this.busyCache.invalidate(userId, item.weeklyPlan.weekStart);
    }

    void this.reconcileCalendarAfterOutcome(item, input.outcome, userId).catch((err) => {
      this.logger.warn(
        `calendar reconcile failed · user=${userId} item=${item.id} outcome=${input.outcome} · ${String(err)}`,
      );
    });

    return updated;
  }

  /**
   * Background calendar reconciliation triggered by an outcome change.
   * - SKIPPED → delete every calendar event tied to the item (and its DB rows).
   * - completed-early (non-PENDING outcome with `scheduledAt` still in the
   *   future) → collapse multi-chunk events into one and reschedule to "now",
   *   freeing the future slot.
   * Returns void; callers MUST `void` this and never await — outcome write
   * already returned to the user. Each Google call has its own catch so a
   * partial failure doesn't abort the rest.
   */
  private async reconcileCalendarAfterOutcome(
    item: {
      id: string;
      scheduledAt: Date | null;
      scheduledMinutes: number | null;
      libraryItem: { estimatedMinutes: number; format: string };
      calendarEvents: ReadonlyArray<{ id: string; googleEventId: string }>;
    },
    outcome: ItemOutcome,
    userId: string,
  ): Promise<void> {
    const now = new Date();

    if (outcome === 'SKIPPED') {
      if (item.calendarEvents.length === 0) return;
      await Promise.all(
        item.calendarEvents.map((ev) =>
          this.calendar.deleteEvent(userId, ev.googleEventId).catch((err) => {
            this.logger.warn(
              `calendar.deleteEvent failed on SKIPPED · user=${userId} item=${item.id} event=${ev.googleEventId} · ${String(err)}`,
            );
          }),
        ),
      );
      await this.prisma.weeklyPlanItemCalendarEvent.deleteMany({
        where: { weeklyPlanItemId: item.id },
      });
      return;
    }

    if (
      outcome === 'PENDING' ||
      !item.scheduledAt ||
      item.scheduledAt.getTime() <= now.getTime() ||
      item.calendarEvents.length === 0
    ) {
      return;
    }

    const totalMinutes =
      item.scheduledMinutes ?? allocatedMinutes(item.libraryItem.estimatedMinutes, item.libraryItem.format);
    const SLOT_MS = 15 * 60 * 1000;
    const endMs = Math.ceil(now.getTime() / SLOT_MS) * SLOT_MS;
    const startMs = endMs - totalMinutes * 60 * 1000;
    const newStart = new Date(startMs);
    const newEnd = new Date(endMs);

    const [first, ...rest] = item.calendarEvents;
    if (first) {
      await this.calendar
        .rescheduleEvent(userId, first.googleEventId, newStart, newEnd)
        .catch((err) => {
          this.logger.warn(
            `calendar.rescheduleEvent failed on outcome=${outcome} · user=${userId} item=${item.id} event=${first.googleEventId} · ${String(err)}`,
          );
        });
    }
    if (rest.length > 0) {
      await Promise.all(
        rest.map((ev) =>
          this.calendar.deleteEvent(userId, ev.googleEventId).catch((err) => {
            this.logger.warn(
              `calendar.deleteEvent failed on outcome collapse · user=${userId} item=${item.id} event=${ev.googleEventId} · ${String(err)}`,
            );
          }),
        ),
      );
      await this.prisma.weeklyPlanItemCalendarEvent.deleteMany({
        where: { id: { in: rest.map((r) => r.id) } },
      });
    }
    await this.prisma.weeklyPlanItem.update({
      where: { id: item.id },
      data: { scheduledAt: newStart, scheduledMinutes: totalMinutes },
    });
  }
}

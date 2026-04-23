import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { SchedulerService, type SchedulerInput } from '../scheduler/scheduler.service.js';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service.js';
import { WhatsappService } from '../whatsapp/whatsapp.service.js';

export class PlanOverflowError extends ConflictException {
  constructor(public readonly overflow: Array<{ itemId: string; minutesRequired: number }>) {
    super({
      error: {
        code: 'PLAN_OVERFLOW',
        message: 'Não há janelas suficientes no Calendar pra este plano',
        details: { overflow },
      },
    });
  }
}

const DEFAULT_AVAILABILITY = {
  mondayMinutes: 60,
  tuesdayMinutes: 60,
  wednesdayMinutes: 60,
  thursdayMinutes: 60,
  fridayMinutes: 60,
  saturdayMinutes: 0,
  sundayMinutes: 0,
  preferredSessionMinutes: 60,
  timezone: 'America/Sao_Paulo',
};

/**
 * Convert a library item's raw `estimatedMinutes` (the intrinsic length of
 * the material) into the calendar block we actually reserve for it. Two
 * adjustments stack:
 *
 *   1. 2× padding — people pause videos, take notes, re-watch confusing parts.
 *   2. Round UP to the nearest 15 minutes, minimum 30. Study slots feel
 *      cleaner in quarter-hour increments; sub-30-min blocks are too granular.
 *
 * Examples:
 *   13 min  → 2× = 26 → round ↑ 15 = 30
 *   25 min  → 2× = 50 → round ↑ 15 = 60
 *   17 min  → 2× = 34 → round ↑ 15 = 45
 *   5 min   → 2× = 10 → min 30    = 30
 */
export function allocatedMinutes(estimated: number): number {
  const padded = Math.max(0, estimated) * 2;
  const rounded = Math.ceil(padded / 15) * 15;
  return Math.max(30, rounded);
}

@Injectable()
export class PublicationService {
  private readonly logger = new Logger(PublicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SchedulerService,
    private readonly calendar: GoogleCalendarService,
    private readonly whatsapp: WhatsappService,
  ) {}

  /**
   * Publish a plan — either immediately (publishAt absent or past) or on a
   * schedule (publishAt in the future). The SCHEDULED case only persists
   * flags; the side-effects (calendar events, WhatsApp) fire later via
   * executeScheduledPublish() when the cron catches up to publishAt.
   *
   * When publishing immediately, this method only flips status → PUBLISHED.
   * The admin flow also calls autoSchedule() right after to create Calendar
   * events; that split exists because the admin may want to publish without
   * touching the member's Calendar (e.g. when only whatsapp is desired).
   */
  async publish(
    planId: string,
    options: {
      publishAt?: Date | null;
      sendWhatsapp?: boolean;
      autoSchedule?: boolean;
      now?: Date;
    } = {},
  ) {
    const now = options.now ?? new Date();
    const plan = await this.prisma.weeklyPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('plan not found');
    if (plan.status !== 'DRAFT' && plan.status !== 'SCHEDULED') {
      throw new ConflictException('only DRAFT/SCHEDULED plans can be published');
    }

    const sendWhatsapp = options.sendWhatsapp ?? true;
    const autoSchedule = options.autoSchedule ?? true;
    const publishAt = options.publishAt ?? null;

    if (publishAt && publishAt.getTime() > now.getTime()) {
      const updated = await this.prisma.weeklyPlan.update({
        where: { id: planId },
        data: {
          status: 'SCHEDULED',
          publishAt,
          sendWhatsapp,
          autoSchedule,
        },
      });
      return { plan: updated, deferred: true as const };
    }

    const updated = await this.prisma.weeklyPlan.update({
      where: { id: planId },
      data: {
        status: 'PUBLISHED',
        publishedAt: now,
        publishAt: null,
        sendWhatsapp,
        autoSchedule,
      },
    });
    return { plan: updated, deferred: false as const };
  }

  /**
   * Cron-invoked flip from SCHEDULED → PUBLISHED + the side-effects the admin
   * picked at publish time. Runs autoSchedule (if flag) and sends the
   * plan_published WhatsApp (if flag). Calendar/WhatsApp failures are
   * swallowed — the status flip sticks even if side-effects miss, so the
   * cron doesn't keep retrying the same plan.
   */
  async executeScheduledPublish(planId: string, now: Date = new Date()): Promise<void> {
    const plan = await this.prisma.weeklyPlan.findUnique({
      where: { id: planId },
      include: { user: { select: { name: true, whatsappPhone: true } } },
    });
    if (!plan) return;
    if (plan.status !== 'SCHEDULED') return;

    await this.prisma.weeklyPlan.update({
      where: { id: planId },
      data: { status: 'PUBLISHED', publishedAt: now },
    });

    if (plan.autoSchedule) {
      try {
        await this.autoSchedule(planId, false);
      } catch (err) {
        this.logger.warn(`scheduled publish: autoSchedule failed for ${planId}: ${String(err)}`);
      }
    }

    if (plan.sendWhatsapp && plan.user.whatsappPhone) {
      const firstName = plan.user.name?.split(' ')[0] ?? '';
      const text = `teu plano da semana tá no ar${firstName ? `, ${firstName}` : ''}. bons estudos.`;
      await this.whatsapp
        .send({
          userId: plan.userId,
          kind: 'plan_published',
          to: plan.user.whatsappPhone,
          text,
        })
        .catch((err) => {
          this.logger.warn(`scheduled publish: whatsapp failed for ${planId}: ${String(err)}`);
        });
    }
  }

  // Admin-initiated: delete existing Calendar events for PENDING items and
  // re-schedule them into the remaining days of the week.
  async reschedulePending(planId: string, options: { now?: Date } = {}): Promise<void> {
    const now = options.now ?? new Date();

    const plan = await this.prisma.weeklyPlan.findUnique({
      where: { id: planId },
      include: { items: { include: { libraryItem: true }, orderBy: { order: 'asc' } } },
    });
    if (!plan) throw new NotFoundException('plan not found');
    if (plan.status !== 'PUBLISHED') {
      throw new ConflictException('Only PUBLISHED plans can be rescheduled');
    }

    const pending = plan.items.filter((i) => i.outcome === 'PENDING');
    if (pending.length === 0) return;

    // 1. Delete existing Calendar events for the PENDING items
    for (const item of pending) {
      try {
        const eventId = await this.calendar.findEventIdByIcsId(
          plan.userId,
          plan.id,
          item.id,
          { start: plan.weekStart, end: plan.weekEnd },
        );
        if (eventId) await this.calendar.deleteEvent(plan.userId, eventId);
      } catch {
        // swallow — one flaky event should not block the reschedule
      }
    }

    // 2. Re-schedule PENDING items into remaining window.
    // The scheduler already skips past days when `now` is provided; passing
    // `now` here is sufficient to clamp to the remaining window.
    const existing = await this.prisma.memberAvailability.findUnique({
      where: { userId: plan.userId },
    });
    const availability = existing ?? DEFAULT_AVAILABILITY;

    const busyBlocks = await this.calendar
      .getFreeBusy(plan.userId, now, plan.weekEnd)
      .catch(() => [] as Array<{ start: Date; end: Date }>);

    const result = this.scheduler.plan({
      weekStart: plan.weekStart,
      availability,
      busyBlocks,
      items: pending.map((i) => ({
        id: i.id,
        estimatedMinutes: allocatedMinutes(i.libraryItem.estimatedMinutes),
      })),
      now,
    });

    if (result.overflow.length > 0) {
      throw new PlanOverflowError(result.overflow);
    }

    // 3. Create new Calendar events and update DB-side scheduling fields
    for (const session of result.sessions) {
      const item = pending.find((p) => p.id === session.itemId)!;
      const eventEnd = new Date(session.scheduledAt.getTime() + session.durationMinutes * 60 * 1000);
      try {
        await this.calendar.createEvent(plan.userId, {
          summary: `ICS Select — ${item.libraryItem.title}`,
          description: item.libraryItem.url
            ? `Link: ${item.libraryItem.url}`
            : 'ICS Select study session',
          start: session.scheduledAt,
          end: eventEnd,
          icsId: { planId: plan.id, itemId: item.id },
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `calendar.createEvent failed · user=${plan.userId} plan=${plan.id} item=${item.id} · ${msg}`,
        );
      }
    }

    // Persist updated scheduling fields on each rescheduled item
    const byItem = new Map<string, { startAt: Date; minutes: number }[]>();
    for (const session of result.sessions) {
      const list = byItem.get(session.itemId) ?? [];
      list.push({ startAt: session.scheduledAt, minutes: session.durationMinutes });
      byItem.set(session.itemId, list);
    }

    for (const [itemId, chunks] of byItem) {
      chunks.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
      const earliest = chunks[0]!;
      await this.prisma.weeklyPlanItem.update({
        where: { id: itemId },
        data: {
          scheduledAt: earliest.startAt,
          scheduledMinutes: chunks.reduce((s, c) => s + c.minutes, 0),
        },
      });
    }
  }

  // Member-initiated: allocate study sessions into their Google Calendar.
  async autoSchedule(planId: string, force: boolean) {
    const plan = await this.prisma.weeklyPlan.findUnique({
      where: { id: planId },
      include: {
        items: { include: { libraryItem: true }, orderBy: { order: 'asc' } },
      },
    });
    if (!plan) throw new NotFoundException('plan not found');

    const existing = await this.prisma.memberAvailability.findUnique({
      where: { userId: plan.userId },
    });
    const availability = existing ?? DEFAULT_AVAILABILITY;

    const busyBlocks = await this.calendar
      .getFreeBusy(plan.userId, plan.weekStart, plan.weekEnd)
      .catch(() => [] as Array<{ start: Date; end: Date }>);

    const schedulableItems = plan.items.filter((i) => i.outcome !== 'SKIPPED');

    const input: SchedulerInput = {
      weekStart: plan.weekStart,
      availability,
      busyBlocks,
      items: schedulableItems.map((i) => ({
        id: i.id,
        estimatedMinutes: allocatedMinutes(i.libraryItem.estimatedMinutes),
      })),
      now: new Date(),
    };

    const result = this.scheduler.plan(input);
    if (result.overflow.length > 0 && !force) {
      throw new PlanOverflowError(result.overflow);
    }

    let sessionsFailed = 0;
    for (const session of result.sessions) {
      const item = plan.items.find((i) => i.id === session.itemId)!;
      const eventEnd = new Date(session.scheduledAt.getTime() + session.durationMinutes * 60 * 1000);
      try {
        await this.calendar.createEvent(plan.userId, {
          summary: `ICS Select — ${item.libraryItem.title}`,
          description: item.libraryItem.url
            ? `Link: ${item.libraryItem.url}`
            : 'ICS Select study session',
          start: session.scheduledAt,
          end: eventEnd,
          icsId: { planId: plan.id, itemId: item.id },
        });
      } catch (err) {
        sessionsFailed += 1;
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `calendar.createEvent failed · user=${plan.userId} plan=${plan.id} item=${item.id} · ${msg}`,
        );
      }
    }

    // Persist the scheduler's plan on each item so the /me/home endpoint
    // can render "19:00 · 45 min" without round-tripping to Google Calendar.
    // Items in `overflow` get null for both fields (they weren't placed).
    const byItem = new Map<string, { startAt: Date; minutes: number }[]>();
    for (const session of result.sessions) {
      const list = byItem.get(session.itemId) ?? [];
      list.push({ startAt: session.scheduledAt, minutes: session.durationMinutes });
      byItem.set(session.itemId, list);
    }

    // Gather all item IDs known to this plan so we can null out overflow items
    const allItemIds = new Set<string>(plan.items.map((i) => i.id));

    for (const [itemId, chunks] of byItem) {
      chunks.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
      const earliest = chunks[0]!;
      await this.prisma.weeklyPlanItem.update({
        where: { id: itemId },
        data: {
          scheduledAt: earliest.startAt,
          scheduledMinutes: chunks.reduce((s, c) => s + c.minutes, 0),
        },
      });
      allItemIds.delete(itemId);
    }

    // Items that didn't get sessions (overflow or otherwise unplaced): null out.
    for (const itemId of allItemIds) {
      await this.prisma.weeklyPlanItem.update({
        where: { id: itemId },
        data: { scheduledAt: null, scheduledMinutes: null },
      });
    }

    return {
      sessionsCreated: result.sessions.length - sessionsFailed,
      sessionsFailed,
      overflow: result.overflow,
    };
  }
}

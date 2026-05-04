import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { allocatedMinutes } from '@ics-select/shared';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { SchedulerService, type SchedulerInput } from '../scheduler/scheduler.service.js';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service.js';
import { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { WhatsappTemplateService } from '../whatsapp/whatsapp-template.service.js';

export { allocatedMinutes };

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

const DEFAULT_PREFERRED_SESSION_MINUTES = 60;
const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

// If a member has no availability row at all, treat the week as unavailable.
// Legacy members have been backfilled (08:00-22:00 slots per day with minutes >
// 0) in the p_availability_slots migration, so reaching here means a fresh
// user who has not yet declared slots.
const EMPTY_CAPS: (number | null)[] = [null, null, null, null, null, null, null];

// When the admin force-publishes (or force-reschedules) over an overflow,
// the scheduler runs against this wide-open availability instead of the
// member's declared slots. busyBlocks from Google Calendar still apply, so
// real commitments are respected — we just stop honoring the self-declared
// study window. Items that don't fit even in this window stay overflow and
// surface in the member's "Unscheduled" section.
const FORCE_FALLBACK_SLOTS = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  startMinute: 8 * 60,
  endMinute: 22 * 60,
}));
const FORCE_FALLBACK_CAPS: (number | null)[] = [null, null, null, null, null, null, null];

type SchedulerAvailability = {
  slots: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>;
  caps: (number | null)[];
  preferredSessionMinutes: number;
  timezone: string;
};

// allocatedMinutes lives in @ics-select/shared so the web budget badge and
// the api scheduler agree on the per-item calendar block size. Re-exported
// above for downstream importers that already pull from this file.

async function loadSchedulerAvailability(
  prisma: { memberAvailability: any; availabilitySlot: any },
  userId: string,
  options: { force?: boolean } = {},
): Promise<SchedulerAvailability> {
  const row = await prisma.memberAvailability.findUnique({ where: { userId } });
  if (options.force) {
    return {
      slots: FORCE_FALLBACK_SLOTS,
      caps: FORCE_FALLBACK_CAPS,
      preferredSessionMinutes: row?.preferredSessionMinutes ?? DEFAULT_PREFERRED_SESSION_MINUTES,
      timezone: row?.timezone ?? DEFAULT_TIMEZONE,
    };
  }
  const slotRows = await prisma.availabilitySlot.findMany({ where: { userId } });
  const caps: (number | null)[] = row
    ? [
        row.mondayMinutes ?? null,
        row.tuesdayMinutes ?? null,
        row.wednesdayMinutes ?? null,
        row.thursdayMinutes ?? null,
        row.fridayMinutes ?? null,
        row.saturdayMinutes ?? null,
        row.sundayMinutes ?? null,
      ]
    : EMPTY_CAPS;
  return {
    slots: slotRows.map((s: any) => ({
      dayOfWeek: s.dayOfWeek,
      startMinute: s.startMinute,
      endMinute: s.endMinute,
    })),
    caps,
    preferredSessionMinutes: row?.preferredSessionMinutes ?? DEFAULT_PREFERRED_SESSION_MINUTES,
    timezone: row?.timezone ?? DEFAULT_TIMEZONE,
  };
}

@Injectable()
export class PublicationService {
  private readonly logger = new Logger(PublicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SchedulerService,
    private readonly calendar: GoogleCalendarService,
    private readonly whatsapp: WhatsappService,
    private readonly templates: WhatsappTemplateService,
  ) {}

  /**
   * Send the plan_published WhatsApp to the member if their phone is wired
   * and the template is enabled. Used by both immediate and scheduled
   * publish flows. Errors are logged but never thrown — a flaky WhatsApp
   * shouldn't block the publish.
   */
  private async sendPlanPublishedNotification(plan: {
    id: string;
    userId: string;
    user: { name: string | null; whatsappPhone: string | null } | null;
  }): Promise<void> {
    if (!plan.user?.whatsappPhone) {
      this.logger.log(
        `plan_published whatsapp skipped · plan=${plan.id} user=${plan.userId} · no whatsappPhone`,
      );
      return;
    }
    const firstName = plan.user.name?.split(' ')[0] ?? '';
    const rendered = await this.templates.render('plan_published', { firstName });
    if (!rendered.enabled) {
      this.logger.log(
        `plan_published whatsapp skipped · plan=${plan.id} user=${plan.userId} · template disabled`,
      );
      return;
    }
    const startedAt = Date.now();
    this.logger.log(
      `plan_published whatsapp sending · plan=${plan.id} user=${plan.userId} to=${plan.user.whatsappPhone}`,
    );
    await this.whatsapp
      .send({
        userId: plan.userId,
        kind: 'plan_published',
        to: plan.user.whatsappPhone,
        text: rendered.text,
      })
      .then(() => {
        this.logger.log(
          `plan_published whatsapp sent · plan=${plan.id} user=${plan.userId} · ${Date.now() - startedAt}ms`,
        );
      })
      .catch((err) => {
        this.logger.warn(
          `plan_published whatsapp failed · plan=${plan.id} user=${plan.userId} · ${Date.now() - startedAt}ms · ${String(err)}`,
        );
      });
  }

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
    const tTotal = Date.now();
    const now = options.now ?? new Date();
    const tFind = Date.now();
    const plan = await this.prisma.weeklyPlan.findUnique({
      where: { id: planId },
      include: { user: { select: { name: true, whatsappPhone: true } } },
    });
    const findMs = Date.now() - tFind;
    if (!plan) throw new NotFoundException('plan not found');
    if (plan.status !== 'DRAFT' && plan.status !== 'SCHEDULED') {
      throw new ConflictException('only DRAFT/SCHEDULED plans can be published');
    }

    const sendWhatsapp = options.sendWhatsapp ?? true;
    const autoSchedule = options.autoSchedule ?? true;
    const publishAt = options.publishAt ?? null;

    if (publishAt && publishAt.getTime() > now.getTime()) {
      const tUpdate = Date.now();
      const updated = await this.prisma.weeklyPlan.update({
        where: { id: planId },
        data: {
          status: 'SCHEDULED',
          publishAt,
          sendWhatsapp,
          autoSchedule,
        },
      });
      this.logger.log(
        `[bench] publish (deferred) total=${Date.now() - tTotal}ms · find=${findMs}ms update=${Date.now() - tUpdate}ms`,
      );
      return { plan: updated, deferred: true as const };
    }

    const tUpdate = Date.now();
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
    const updateMs = Date.now() - tUpdate;

    // Fire-and-forget: "Publish now" shouldn't block on Evolution API
    // (seconds of latency). sendPlanPublishedNotification logs start/sent/fail
    // so the timing and errors still show up in container logs.
    if (sendWhatsapp) {
      void this.sendPlanPublishedNotification({
        id: plan.id,
        userId: plan.userId,
        user: plan.user,
      });
    }

    this.logger.log(
      `[bench] publish total=${Date.now() - tTotal}ms · find=${findMs}ms update=${updateMs}ms whatsapp=fire-and-forget`,
    );
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

    if (plan.sendWhatsapp) {
      await this.sendPlanPublishedNotification(plan);
    }
  }

  // Admin-initiated: delete existing Calendar events for PENDING items and
  // re-schedule them into the remaining days of the week.
  async reschedulePending(
    planId: string,
    options: { now?: Date; force?: boolean } = {},
  ): Promise<void> {
    const tTotal = Date.now();
    const now = options.now ?? new Date();
    const force = options.force ?? false;

    const tFind = Date.now();
    const plan = await this.prisma.weeklyPlan.findUnique({
      where: { id: planId },
      include: {
        items: {
          include: { libraryItem: true, calendarEvents: true },
          orderBy: { order: 'asc' },
        },
      },
    });
    const findMs = Date.now() - tFind;
    if (!plan) throw new NotFoundException('plan not found');
    if (plan.status !== 'PUBLISHED') {
      throw new ConflictException('Only PUBLISHED plans can be rescheduled');
    }

    const pending = plan.items.filter((i) => i.outcome === 'PENDING');
    if (pending.length === 0) return;

    // 1. Delete existing Calendar events for PENDING items, looked up by id
    // from our own DB instead of scanning the member's whole calendar.
    const pendingItemIds = pending.map((i) => i.id);
    const staleEvents = pending.flatMap((i) => i.calendarEvents);
    let deleteEventsMs = 0;
    let deleteRowsMs = 0;
    if (staleEvents.length > 0) {
      const tDel = Date.now();
      await Promise.all(
        staleEvents.map((ev) =>
          this.calendar.deleteEvent(plan.userId, ev.googleEventId).catch((err) => {
            this.logger.warn(
              `calendar.deleteEvent failed during reschedule · user=${plan.userId} plan=${plan.id} event=${ev.googleEventId} · ${String(err)}`,
            );
          }),
        ),
      );
      deleteEventsMs = Date.now() - tDel;
      const tDelRows = Date.now();
      await this.prisma.weeklyPlanItemCalendarEvent.deleteMany({
        where: { weeklyPlanItemId: { in: pendingItemIds } },
      });
      deleteRowsMs = Date.now() - tDelRows;
    }

    // 2. Re-schedule PENDING items into remaining window.
    // The scheduler already skips past days when `now` is provided; passing
    // `now` here is sufficient to clamp to the remaining window.
    const tFreeBusy = Date.now();
    const busyBlocks = await this.calendar
      .getFreeBusy(plan.userId, now, plan.weekEnd)
      .catch(() => [] as Array<{ start: Date; end: Date }>);
    const freeBusyMs = Date.now() - tFreeBusy;

    const tAvail = Date.now();
    const availability = await loadSchedulerAvailability(this.prisma, plan.userId, { force });
    const availMs = Date.now() - tAvail;

    const tScheduler = Date.now();
    const result = this.scheduler.plan({
      weekStart: plan.weekStart,
      availability,
      busyBlocks,
      items: pending.map((i) => ({
        id: i.id,
        estimatedMinutes: allocatedMinutes(i.libraryItem.estimatedMinutes, i.libraryItem.format),
        order: i.order,
      })),
      now,
    });
    const schedulerMs = Date.now() - tScheduler;

    if (result.overflow.length > 0 && !force) {
      throw new PlanOverflowError(result.overflow);
    }

    // 3. Create new Calendar events in parallel — HTTP/2 multiplexes them on a
    // single TLS socket so wall time ≈ 1× latency, not N×. Persist the ids in
    // a single createMany to avoid N round-trips to Postgres too.
    const tCreate = Date.now();
    const createResults = await Promise.all(
      result.sessions.map(async (session) => {
        const item = pending.find((p) => p.id === session.itemId)!;
        const eventEnd = new Date(session.scheduledAt.getTime() + session.durationMinutes * 60 * 1000);
        try {
          const googleEventId = await this.calendar.createEvent(plan.userId, {
            summary: `ICS Select — ${item.libraryItem.title}`,
            description: item.libraryItem.url
              ? `Link: ${item.libraryItem.url}`
              : 'ICS Select study session',
            start: session.scheduledAt,
            end: eventEnd,
            icsId: { planId: plan.id, itemId: item.id },
          });
          return { ok: true as const, itemId: item.id, googleEventId };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `calendar.createEvent failed · user=${plan.userId} plan=${plan.id} item=${item.id} · ${msg}`,
          );
          return { ok: false as const };
        }
      }),
    );
    const createMs = Date.now() - tCreate;
    const sessionsFailed = createResults.filter((r) => !r.ok).length;
    const persistEvents = createResults
      .filter((r): r is { ok: true; itemId: string; googleEventId: string } => r.ok)
      .map((r) => ({ weeklyPlanItemId: r.itemId, googleEventId: r.googleEventId }));
    let persistMs = 0;
    if (persistEvents.length > 0) {
      const tPersist = Date.now();
      await this.prisma.weeklyPlanItemCalendarEvent.createMany({ data: persistEvents });
      persistMs = Date.now() - tPersist;
    }

    // Persist updated scheduling fields on each rescheduled item, batched into
    // one transaction.
    const byItem = new Map<string, { startAt: Date; minutes: number }[]>();
    for (const session of result.sessions) {
      const list = byItem.get(session.itemId) ?? [];
      list.push({ startAt: session.scheduledAt, minutes: session.durationMinutes });
      byItem.set(session.itemId, list);
    }

    const placedUpdates = Array.from(byItem).map(([itemId, chunks]) => {
      chunks.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
      const earliest = chunks[0]!;
      return this.prisma.weeklyPlanItem.update({
        where: { id: itemId },
        data: {
          scheduledAt: earliest.startAt,
          scheduledMinutes: chunks.reduce((s, c) => s + c.minutes, 0),
        },
      });
    });

    // Force-reschedule may leave items in overflow even after the fallback
    // window. Null out their scheduledAt/Minutes so stale values from a
    // previous run don't masquerade as a real placement.
    const placedIds = new Set(byItem.keys());
    const unplacedIds = pending.map((p) => p.id).filter((id) => !placedIds.has(id));
    const overflowUpdate = unplacedIds.length > 0
      ? [
          this.prisma.weeklyPlanItem.updateMany({
            where: { id: { in: unplacedIds } },
            data: { scheduledAt: null, scheduledMinutes: null },
          }),
        ]
      : [];

    let txMs = 0;
    if (placedUpdates.length > 0 || overflowUpdate.length > 0) {
      const tTx = Date.now();
      await this.prisma.$transaction([...placedUpdates, ...overflowUpdate]);
      txMs = Date.now() - tTx;
    }

    this.logger.log(
      `[bench] reschedulePending total=${Date.now() - tTotal}ms · ` +
      `find=${findMs}ms ` +
      `delEvents=${deleteEventsMs}ms(n=${staleEvents.length}) ` +
      `delRows=${deleteRowsMs}ms ` +
      `freeBusy=${freeBusyMs}ms ` +
      `avail=${availMs}ms ` +
      `scheduler=${schedulerMs}ms ` +
      `createEvents=${createMs}ms(n=${result.sessions.length},failed=${sessionsFailed}) ` +
      `persistRows=${persistMs}ms ` +
      `tx=${txMs}ms(updates=${placedUpdates.length + overflowUpdate.length})`,
    );
  }

  // Member-initiated: allocate study sessions into their Google Calendar.
  async autoSchedule(planId: string, force: boolean) {
    const tTotal = Date.now();

    const tFind = Date.now();
    const plan = await this.prisma.weeklyPlan.findUnique({
      where: { id: planId },
      include: {
        items: {
          include: { libraryItem: true, calendarEvents: true },
          orderBy: { order: 'asc' },
        },
      },
    });
    const findMs = Date.now() - tFind;
    if (!plan) throw new NotFoundException('plan not found');

    // Wipe any events that a previous autoSchedule run created. Without this,
    // re-running autoSchedule on a PUBLISHED plan duplicates events on the
    // member's calendar.
    const existingEvents = plan.items.flatMap((i) => i.calendarEvents);
    let deleteEventsMs = 0;
    let deleteRowsMs = 0;
    if (existingEvents.length > 0) {
      const tDel = Date.now();
      await Promise.all(
        existingEvents.map((ev) =>
          this.calendar.deleteEvent(plan.userId, ev.googleEventId).catch((err) => {
            this.logger.warn(
              `calendar.deleteEvent failed during autoSchedule · user=${plan.userId} plan=${plan.id} event=${ev.googleEventId} · ${String(err)}`,
            );
          }),
        ),
      );
      deleteEventsMs = Date.now() - tDel;
      const tDelRows = Date.now();
      await this.prisma.weeklyPlanItemCalendarEvent.deleteMany({
        where: { weeklyPlanItemId: { in: plan.items.map((i) => i.id) } },
      });
      deleteRowsMs = Date.now() - tDelRows;
    }

    const tFreeBusy = Date.now();
    const busyBlocks = await this.calendar
      .getFreeBusy(plan.userId, plan.weekStart, plan.weekEnd)
      .catch(() => [] as Array<{ start: Date; end: Date }>);
    const freeBusyMs = Date.now() - tFreeBusy;

    const schedulableItems = plan.items.filter((i) => i.outcome !== 'SKIPPED');

    const tAvail = Date.now();
    const availability = await loadSchedulerAvailability(this.prisma, plan.userId, { force });
    const availMs = Date.now() - tAvail;

    const input: SchedulerInput = {
      weekStart: plan.weekStart,
      availability,
      busyBlocks,
      items: schedulableItems.map((i) => ({
        id: i.id,
        estimatedMinutes: allocatedMinutes(i.libraryItem.estimatedMinutes, i.libraryItem.format),
        order: i.order,
      })),
      now: new Date(),
    };

    const tScheduler = Date.now();
    const result = this.scheduler.plan(input);
    const schedulerMs = Date.now() - tScheduler;
    if (result.overflow.length > 0 && !force) {
      this.logger.log(
        `[bench] autoSchedule overflow-abort total=${Date.now() - tTotal}ms · ` +
        `find=${findMs}ms delEvents=${deleteEventsMs}ms(n=${existingEvents.length}) ` +
        `delRows=${deleteRowsMs}ms freeBusy=${freeBusyMs}ms avail=${availMs}ms ` +
        `scheduler=${schedulerMs}ms`,
      );
      throw new PlanOverflowError(result.overflow);
    }

    const itemById = new Map(plan.items.map((i) => [i.id, i]));
    const tCreate = Date.now();
    const createResults = await Promise.all(
      result.sessions.map(async (session) => {
        const item = itemById.get(session.itemId)!;
        const eventEnd = new Date(session.scheduledAt.getTime() + session.durationMinutes * 60 * 1000);
        try {
          const googleEventId = await this.calendar.createEvent(plan.userId, {
            summary: `ICS Select — ${item.libraryItem.title}`,
            description: item.libraryItem.url
              ? `Link: ${item.libraryItem.url}`
              : 'ICS Select study session',
            start: session.scheduledAt,
            end: eventEnd,
            icsId: { planId: plan.id, itemId: item.id },
          });
          return { ok: true as const, itemId: item.id, googleEventId };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `calendar.createEvent failed · user=${plan.userId} plan=${plan.id} item=${item.id} · ${msg}`,
          );
          return { ok: false as const };
        }
      }),
    );
    const createMs = Date.now() - tCreate;
    const sessionsFailed = createResults.filter((r) => !r.ok).length;
    const persistEvents = createResults
      .filter((r): r is { ok: true; itemId: string; googleEventId: string } => r.ok)
      .map((r) => ({ weeklyPlanItemId: r.itemId, googleEventId: r.googleEventId }));
    let persistMs = 0;
    if (persistEvents.length > 0) {
      const tPersist = Date.now();
      await this.prisma.weeklyPlanItemCalendarEvent.createMany({ data: persistEvents });
      persistMs = Date.now() - tPersist;
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
    const overflowIds = plan.items.map((i) => i.id).filter((id) => !byItem.has(id));

    const placedUpdates = Array.from(byItem).map(([itemId, chunks]) => {
      chunks.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
      const earliest = chunks[0]!;
      return this.prisma.weeklyPlanItem.update({
        where: { id: itemId },
        data: {
          scheduledAt: earliest.startAt,
          scheduledMinutes: chunks.reduce((s, c) => s + c.minutes, 0),
        },
      });
    });

    const overflowUpdate = overflowIds.length > 0
      ? [
          this.prisma.weeklyPlanItem.updateMany({
            where: { id: { in: overflowIds } },
            data: { scheduledAt: null, scheduledMinutes: null },
          }),
        ]
      : [];

    const tTx = Date.now();
    await this.prisma.$transaction([...placedUpdates, ...overflowUpdate]);
    const txMs = Date.now() - tTx;

    this.logger.log(
      `[bench] autoSchedule total=${Date.now() - tTotal}ms · ` +
      `find=${findMs}ms ` +
      `delEvents=${deleteEventsMs}ms(n=${existingEvents.length}) ` +
      `delRows=${deleteRowsMs}ms ` +
      `freeBusy=${freeBusyMs}ms ` +
      `avail=${availMs}ms ` +
      `scheduler=${schedulerMs}ms ` +
      `createEvents=${createMs}ms(n=${result.sessions.length},failed=${sessionsFailed}) ` +
      `persistRows=${persistMs}ms ` +
      `tx=${txMs}ms(updates=${placedUpdates.length + overflowUpdate.length})`,
    );

    return {
      sessionsCreated: result.sessions.length - sessionsFailed,
      sessionsFailed,
      overflow: result.overflow,
    };
  }

  /**
   * Edit a PUBLISHED plan: diff the incoming items against the existing
   * roster, drop removed items + their Calendar events, add new items and
   * schedule Calendar events only for those (existing items keep their
   * outcome/reflection/calendarEvents). Items with outcome ≠ PENDING cannot
   * be removed — admin must keep historical work intact.
   *
   * Status stays PUBLISHED, no WhatsApp fires. The newly added items are
   * scheduled into the remaining window via getFreeBusy + scheduler.plan
   * (existing in-plan events show up as busy because they live on the user's
   * Calendar, so we never double-book).
   */
  async editPublished(
    planId: string,
    input: {
      adminNotes?: string;
      items: Array<{ libraryItemId: string; order: number }>;
    },
    options: { force?: boolean; now?: Date } = {},
  ): Promise<{
    sessionsCreated: number;
    sessionsFailed: number;
    overflow: Array<{ itemId: string; minutesRequired: number }>;
    removedCount: number;
    addedCount: number;
  }> {
    const now = options.now ?? new Date();
    const plan = await this.prisma.weeklyPlan.findUnique({
      where: { id: planId },
      include: {
        items: { include: { calendarEvents: true } },
      },
    });
    if (!plan) throw new NotFoundException('plan not found');
    if (plan.status !== 'PUBLISHED') {
      throw new ConflictException('only PUBLISHED plans can be edited via this endpoint');
    }

    // Diff by libraryItemId. The frontend sends a fresh roster; we figure out
    // what's removed/added/kept by comparing libraryItemIds.
    const existingByLibId = new Map(plan.items.map((i) => [i.libraryItemId, i]));
    const incomingLibIds = new Set(input.items.map((i) => i.libraryItemId));

    const removedItems = plan.items.filter((i) => !incomingLibIds.has(i.libraryItemId));
    const addedRows = input.items.filter((i) => !existingByLibId.has(i.libraryItemId));
    const keptUpdates = input.items
      .filter((i) => existingByLibId.has(i.libraryItemId))
      .map((i) => ({
        id: existingByLibId.get(i.libraryItemId)!.id,
        order: i.order,
      }));

    // Block remove of items the member already engaged with — outcome ≠ PENDING
    // means there's history we'd lose (completion, reflection, doubts).
    const blockedRemoves = removedItems.filter((i) => i.outcome !== 'PENDING');
    if (blockedRemoves.length > 0) {
      throw new ConflictException({
        error: {
          code: 'CANT_REMOVE_COMPLETED_ITEM',
          message: `Cannot remove ${blockedRemoves.length} item(s) the member already engaged with`,
          details: { itemIds: blockedRemoves.map((i) => i.id) },
        },
      });
    }

    const removedEventIds = removedItems.flatMap((i) =>
      i.calendarEvents.map((e) => e.googleEventId),
    );

    // Pre-flight scheduler check BEFORE mutating the DB. If the added items
    // can't fit and force=false, throw PlanOverflowError now — the plan stays
    // unchanged so the admin can adjust without orphaning items in the DB.
    // We use the libraryItemId as the scheduler's item key here (the
    // WeeklyPlanItem rows don't exist yet) and re-key by libraryItemId after
    // the DB diff to find the real item ids for createEvent.
    const force = options.force ?? false;
    let plannedSessions: Array<{
      libraryItemId: string;
      scheduledAt: Date;
      durationMinutes: number;
    }> = [];
    let plannedOverflow: Array<{ itemId: string; minutesRequired: number }> = [];

    if (addedRows.length > 0) {
      const addedLibraryItems = await this.prisma.libraryItem.findMany({
        where: { id: { in: addedRows.map((a) => a.libraryItemId) } },
        select: { id: true, estimatedMinutes: true, format: true, title: true, url: true },
      });
      const libById = new Map(addedLibraryItems.map((l) => [l.id, l]));

      const busyBlocks = await this.calendar
        .getFreeBusy(plan.userId, now, plan.weekEnd)
        .catch(() => [] as Array<{ start: Date; end: Date }>);

      const result = this.scheduler.plan({
        weekStart: plan.weekStart,
        availability: await loadSchedulerAvailability(this.prisma, plan.userId, { force }),
        busyBlocks,
        items: addedRows.map((a) => {
          const lib = libById.get(a.libraryItemId);
          return {
            id: a.libraryItemId,
            estimatedMinutes: allocatedMinutes(lib?.estimatedMinutes ?? 0, lib?.format),
            order: a.order,
          };
        }),
        now,
      });

      if (result.overflow.length > 0 && !force) {
        throw new PlanOverflowError(result.overflow);
      }

      plannedSessions = result.sessions.map((s) => ({
        libraryItemId: s.itemId, // we used libraryItemId as the scheduler key
        scheduledAt: s.scheduledAt,
        durationMinutes: s.durationMinutes,
      }));
      plannedOverflow = result.overflow;
    }

    // Pre-flight passed. Now commit the DB diff in a single transaction. The
    // negative-bump trick avoids collisions with @@unique([weeklyPlanId, order])
    // when reordering.
    await this.prisma.$transaction(async (tx) => {
      // 1. Move every existing order into negative space so subsequent updates
      //    don't transiently collide with the unique constraint.
      const existingIds = plan.items.map((i) => i.id);
      if (existingIds.length > 0) {
        for (const item of plan.items) {
          await tx.weeklyPlanItem.update({
            where: { id: item.id },
            data: { order: -(item.order + 1) },
          });
        }
      }

      // 2. Delete removed items (cascades to WeeklyPlanItemCalendarEvent rows
      //    in the DB; Google Calendar deletes happen post-tx).
      if (removedItems.length > 0) {
        await tx.weeklyPlanItem.deleteMany({
          where: { id: { in: removedItems.map((i) => i.id) } },
        });
      }

      // 3. Update kept items to their final orders.
      for (const k of keptUpdates) {
        await tx.weeklyPlanItem.update({
          where: { id: k.id },
          data: { order: k.order },
        });
      }

      // 4. Create new items with their final orders.
      for (const a of addedRows) {
        await tx.weeklyPlanItem.create({
          data: {
            weeklyPlanId: planId,
            libraryItemId: a.libraryItemId,
            order: a.order,
          },
        });
      }

      // 5. Update adminNotes (if provided).
      if (input.adminNotes !== undefined) {
        await tx.weeklyPlan.update({
          where: { id: planId },
          data: { adminNotes: input.adminNotes },
        });
      }
    });

    // Post-tx: delete Google Calendar events for removed items. Fire-and-forget
    // — a flaky Google API call shouldn't undo the DB diff.
    await Promise.all(
      removedEventIds.map((eventId) =>
        this.calendar.deleteEvent(plan.userId, eventId).catch((err) => {
          this.logger.warn(
            `calendar.deleteEvent failed during editPublished · user=${plan.userId} plan=${plan.id} event=${eventId} · ${String(err)}`,
          );
        }),
      ),
    );

    // Apply the pre-computed scheduler placements to Calendar + persist
    // scheduledAt/scheduledMinutes on the freshly-created items.
    const scheduling = await this.applyAddedItemPlacements(plan, {
      plannedSessions,
      plannedOverflow,
      addedLibraryItemIds: addedRows.map((a) => a.libraryItemId),
    });

    return {
      ...scheduling,
      removedCount: removedItems.length,
      addedCount: addedRows.length,
    };
  }

  /**
   * Apply pre-computed scheduler placements to Calendar + persist
   * scheduledAt/scheduledMinutes on the freshly-created items. Called after
   * editPublished's DB diff commits — the scheduler ran on libraryItemId keys
   * before the items had real ids, so we re-key by libraryItemId here.
   */
  private async applyAddedItemPlacements(
    plan: { id: string; userId: string },
    input: {
      plannedSessions: Array<{ libraryItemId: string; scheduledAt: Date; durationMinutes: number }>;
      plannedOverflow: Array<{ itemId: string; minutesRequired: number }>;
      addedLibraryItemIds: string[];
    },
  ): Promise<{
    sessionsCreated: number;
    sessionsFailed: number;
    overflow: Array<{ itemId: string; minutesRequired: number }>;
  }> {
    if (input.addedLibraryItemIds.length === 0) {
      return { sessionsCreated: 0, sessionsFailed: 0, overflow: [] };
    }

    // Re-fetch the freshly-created items to get their DB ids.
    const newItems = await this.prisma.weeklyPlanItem.findMany({
      where: {
        weeklyPlanId: plan.id,
        libraryItemId: { in: input.addedLibraryItemIds },
      },
      include: { libraryItem: true },
    });
    const itemByLibId = new Map(newItems.map((i) => [i.libraryItemId, i]));

    if (input.plannedSessions.length === 0) {
      // All overflow — set scheduledAt/Minutes null and surface overflow.
      const ids = newItems.map((i) => i.id);
      if (ids.length > 0) {
        await this.prisma.weeklyPlanItem.updateMany({
          where: { id: { in: ids } },
          data: { scheduledAt: null, scheduledMinutes: null },
        });
      }
      // Re-key overflow itemIds (which were libraryItemIds) onto real item ids
      // so the response matches the OverflowModal's expectations.
      return {
        sessionsCreated: 0,
        sessionsFailed: 0,
        overflow: input.plannedOverflow.map((o) => ({
          itemId: itemByLibId.get(o.itemId)?.id ?? o.itemId,
          minutesRequired: o.minutesRequired,
        })),
      };
    }


    // Create Calendar events for placed sessions. The pre-flight gave us
    // libraryItemId-keyed sessions; resolve them to the freshly-created item
    // ids via itemByLibId.
    const createResults = await Promise.all(
      input.plannedSessions.map(async (session) => {
        const item = itemByLibId.get(session.libraryItemId);
        if (!item) return { ok: false as const };
        const eventEnd = new Date(
          session.scheduledAt.getTime() + session.durationMinutes * 60 * 1000,
        );
        try {
          const googleEventId = await this.calendar.createEvent(plan.userId, {
            summary: `ICS Select — ${item.libraryItem.title}`,
            description: item.libraryItem.url
              ? `Link: ${item.libraryItem.url}`
              : 'ICS Select study session',
            start: session.scheduledAt,
            end: eventEnd,
            icsId: { planId: plan.id, itemId: item.id },
          });
          return { ok: true as const, itemId: item.id, googleEventId };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(
            `calendar.createEvent failed during editPublished · user=${plan.userId} plan=${plan.id} item=${item.id} · ${msg}`,
          );
          return { ok: false as const };
        }
      }),
    );
    const sessionsFailed = createResults.filter((r) => !r.ok).length;
    const persistEvents = createResults
      .filter((r): r is { ok: true; itemId: string; googleEventId: string } => r.ok)
      .map((r) => ({ weeklyPlanItemId: r.itemId, googleEventId: r.googleEventId }));
    if (persistEvents.length > 0) {
      await this.prisma.weeklyPlanItemCalendarEvent.createMany({ data: persistEvents });
    }

    // Persist scheduledAt/scheduledMinutes per item. Items in overflow get
    // null (no slot found).
    const byItem = new Map<string, { startAt: Date; minutes: number }[]>();
    for (const session of input.plannedSessions) {
      const item = itemByLibId.get(session.libraryItemId);
      if (!item) continue;
      const list = byItem.get(item.id) ?? [];
      list.push({ startAt: session.scheduledAt, minutes: session.durationMinutes });
      byItem.set(item.id, list);
    }
    const overflowItemIds = newItems.map((i) => i.id).filter((id) => !byItem.has(id));

    const placedUpdates = Array.from(byItem).map(([itemId, chunks]) => {
      chunks.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
      const earliest = chunks[0]!;
      return this.prisma.weeklyPlanItem.update({
        where: { id: itemId },
        data: {
          scheduledAt: earliest.startAt,
          scheduledMinutes: chunks.reduce((s, c) => s + c.minutes, 0),
        },
      });
    });
    const overflowUpdate =
      overflowItemIds.length > 0
        ? [
            this.prisma.weeklyPlanItem.updateMany({
              where: { id: { in: overflowItemIds } },
              data: { scheduledAt: null, scheduledMinutes: null },
            }),
          ]
        : [];

    if (placedUpdates.length > 0 || overflowUpdate.length > 0) {
      await this.prisma.$transaction([...placedUpdates, ...overflowUpdate]);
    }

    return {
      sessionsCreated: input.plannedSessions.length - sessionsFailed,
      sessionsFailed,
      overflow: input.plannedOverflow.map((o) => ({
        itemId: itemByLibId.get(o.itemId)?.id ?? o.itemId,
        minutesRequired: o.minutesRequired,
      })),
    };
  }
}

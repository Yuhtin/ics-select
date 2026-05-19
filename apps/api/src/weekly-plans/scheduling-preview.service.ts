import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { allocatedMinutes } from '@ics-select/shared';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { SchedulerService } from '../scheduler/scheduler.service.js';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service.js';
import { loadSchedulerAvailability } from '../scheduler/availability-loader.js';

export class NoAvailabilityError extends BadRequestException {
  readonly code = 'MEMBER_NO_AVAILABILITY';
  constructor() {
    super({
      error: {
        code: 'MEMBER_NO_AVAILABILITY',
        message: 'Member has no availability configured.',
      },
    });
  }
}

export type PreviewItemInput = {
  libraryItemId: string;
  order: number;
  estimatedMinutes?: number;
};

export type PreviewBody = {
  items?: PreviewItemInput[];
  /** When true, scheduler packs by descending duration instead of order. */
  relaxOrder?: boolean;
};

export type PreviewPlacement = {
  itemId: string;
  scheduledAt: string;
  durationMinutes: number;
};

export type PreviewBusyBlock = { start: string; end: string };

export type PreviewResult = {
  placements: PreviewPlacement[];
  overflow: Array<{ itemId: string; minutesRequired: number }>;
  /**
   * Google Calendar busy blocks overlapping the plan's week, as the scheduler
   * saw them. Surfaced so the editor can render them on day cards — otherwise
   * admin sees "FREE 60m" on a slot that was actually fully consumed by a
   * meeting and wonders why the scheduler skipped the day.
   */
  busyBlocks: PreviewBusyBlock[];
  weekStart: string;
  weekEnd: string;
};

@Injectable()
export class SchedulingPreviewService {
  private readonly logger = new Logger(SchedulingPreviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SchedulerService,
    private readonly calendar: GoogleCalendarService,
  ) {}

  async preview(planId: string, body: PreviewBody): Promise<PreviewResult> {
    const plan = await this.prisma.weeklyPlan.findUnique({
      where: { id: planId },
      select: { id: true, userId: true, weekStart: true, weekEnd: true, status: true },
    });
    if (!plan) throw new NotFoundException('plan not found');

    const items = body.items ?? (await this.loadPersistedItems(planId));

    if (items.length === 0) {
      return {
        placements: [],
        overflow: [],
        busyBlocks: [],
        weekStart: plan.weekStart.toISOString(),
        weekEnd: plan.weekEnd.toISOString(),
      };
    }

    const availabilityRow = await this.prisma.memberAvailability.findUnique({
      where: { userId: plan.userId },
    });
    if (!availabilityRow) throw new NoAvailabilityError();

    const availability = await loadSchedulerAvailability(this.prisma, plan.userId);
    // Use `getFreeBusy` directly instead of BusyCacheService so the preview
    // sees the same real-time calendar data that `publish` / `editPublished`
    // will see. The cache uses stale-while-revalidate (60 s), which means a
    // stale or empty entry causes the preview to show "fits" when the live
    // calendar would overflow — exactly the gap admins hit when the numbers
    // disagree between preview and Apply Changes. Since preview is debounced
    // 500 ms on the frontend this direct call only fires ≤2× per second.
    const now = new Date();
    const busyBlocks = await this.calendar
      .getFreeBusy(plan.userId, now, plan.weekEnd)
      .catch(() => [] as Array<{ start: Date; end: Date }>);

    // Pass `now` so the preview mirrors what `publish` / `autoSchedule` will
    // actually do — the scheduler skips intervals that ended before `now`.
    // Without this, the editor optimistically claims days that have already
    // passed are still schedulable, then publish later returns overflow.
    const result = this.scheduler.plan({
      weekStart: plan.weekStart,
      availability,
      busyBlocks,
      items: items.map((i) => ({
        id: i.libraryItemId,
        order: i.order,
        estimatedMinutes: i.estimatedMinutes ?? 60,
      })),
      now: new Date(),
      relaxOrder: body.relaxOrder ?? false,
    });

    return {
      placements: result.sessions.map((s) => ({
        itemId: s.itemId,
        scheduledAt: s.scheduledAt.toISOString(),
        durationMinutes: s.durationMinutes,
      })),
      overflow: result.overflow,
      busyBlocks: busyBlocks.map((b) => ({
        start: b.start.toISOString(),
        end: b.end.toISOString(),
      })),
      weekStart: plan.weekStart.toISOString(),
      weekEnd: plan.weekEnd.toISOString(),
    };
  }

  private async loadPersistedItems(planId: string): Promise<PreviewItemInput[]> {
    const rows = await this.prisma.weeklyPlanItem.findMany({
      where: { weeklyPlanId: planId },
      include: { libraryItem: { select: { estimatedMinutes: true, format: true } } },
      orderBy: { order: 'asc' },
    });
    return rows.map((r: any) => ({
      libraryItemId: r.libraryItemId,
      order: r.order,
      estimatedMinutes: allocatedMinutes(r.libraryItem.estimatedMinutes, r.libraryItem.format),
    }));
  }
}

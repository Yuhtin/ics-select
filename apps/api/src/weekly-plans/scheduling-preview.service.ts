import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { allocatedMinutes } from '@ics-select/shared';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { SchedulerService } from '../scheduler/scheduler.service.js';
import { BusyCacheService } from '../google-calendar/busy-cache.service.js';
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

export type PreviewBody = { items?: PreviewItemInput[] };

export type PreviewPlacement = {
  itemId: string;
  scheduledAt: string;
  durationMinutes: number;
};

export type PreviewResult = {
  placements: PreviewPlacement[];
  overflow: Array<{ itemId: string; minutesRequired: number }>;
  weekStart: string;
  weekEnd: string;
};

@Injectable()
export class SchedulingPreviewService {
  private readonly logger = new Logger(SchedulingPreviewService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SchedulerService,
    private readonly busyCache: BusyCacheService,
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
        weekStart: plan.weekStart.toISOString(),
        weekEnd: plan.weekEnd.toISOString(),
      };
    }

    const availabilityRow = await this.prisma.memberAvailability.findUnique({
      where: { userId: plan.userId },
    });
    if (!availabilityRow) throw new NoAvailabilityError();

    const availability = await loadSchedulerAvailability(this.prisma, plan.userId);
    const busyBlocks = await this.busyCache
      .getWeekBusy(plan.userId, plan.weekStart, plan.weekEnd)
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
    });

    return {
      placements: result.sessions.map((s) => ({
        itemId: s.itemId,
        scheduledAt: s.scheduledAt.toISOString(),
        durationMinutes: s.durationMinutes,
      })),
      overflow: result.overflow,
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

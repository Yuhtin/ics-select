import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { SchedulerService, type SchedulerInput } from '../scheduler/scheduler.service.js';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service.js';

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

@Injectable()
export class PublicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SchedulerService,
    private readonly calendar: GoogleCalendarService,
  ) {}

  // Publishing a plan only flips status → PUBLISHED so the member sees it on the map.
  // It does NOT touch Google Calendar. The member later opts-in via autoSchedule().
  async publish(planId: string) {
    const plan = await this.prisma.weeklyPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('plan not found');
    const updated = await this.prisma.weeklyPlan.update({
      where: { id: planId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });
    return { plan: updated };
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

    const input: SchedulerInput = {
      weekStart: plan.weekStart,
      availability,
      busyByDay: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] },
      items: plan.items.map((i) => ({
        id: i.id,
        estimatedMinutes: i.libraryItem.estimatedMinutes,
      })),
    };

    const result = this.scheduler.plan(input);
    if (result.overflow.length > 0 && !force) {
      throw new PlanOverflowError(result.overflow);
    }

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
        });
      } catch {
        // Calendar failure is non-fatal; PR 3 will embed ICS ID in description
      }
    }

    return {
      sessionsCreated: result.sessions.length,
      overflow: result.overflow,
    };
  }
}

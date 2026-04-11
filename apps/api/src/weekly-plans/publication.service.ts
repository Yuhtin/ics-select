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

@Injectable()
export class PublicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SchedulerService,
    private readonly calendar: GoogleCalendarService,
  ) {}

  async publish(planId: string, force: boolean) {
    const plan = await this.prisma.weeklyPlan.findUnique({
      where: { id: planId },
      include: {
        items: { include: { libraryItem: true }, orderBy: { order: 'asc' } },
      },
    });
    if (!plan) throw new NotFoundException('plan not found');

    const availability = await this.prisma.memberAvailability.findUnique({
      where: { userId: plan.userId },
    });
    if (!availability) {
      throw new ConflictException({
        error: {
          code: 'NO_AVAILABILITY',
          message: 'Membro ainda não definiu disponibilidade',
        },
      });
    }

    const input: SchedulerInput = {
      weekStart: plan.weekStart,
      availability,
      busyByDay: { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] }, // simplification: Phase 4 ignores real Calendar free/busy
      items: plan.items.map((i) => ({
        id: i.id,
        estimatedMinutes: i.libraryItem.estimatedMinutes,
      })),
    };

    const result = this.scheduler.plan(input);
    if (result.overflow.length > 0 && !force) {
      throw new PlanOverflowError(result.overflow);
    }

    // Remove any pre-existing sessions (re-publish) — Phase 4 uses "delete-all and recreate".
    // Phase 5+ will diff.
    await this.prisma.studySession.deleteMany({
      where: { weeklyPlanItem: { weeklyPlanId: planId } },
    });

    // Create sessions + Calendar events
    for (const session of result.sessions) {
      const item = plan.items.find((i) => i.id === session.itemId)!;
      const eventEnd = new Date(session.scheduledAt.getTime() + session.durationMinutes * 60 * 1000);
      let googleEventId: string | null = null;
      try {
        googleEventId = await this.calendar.createEvent(plan.userId, {
          summary: `ICS Select — ${item.libraryItem.title}`,
          description: item.libraryItem.url
            ? `Link: ${item.libraryItem.url}`
            : 'ICS Select study session',
          start: session.scheduledAt,
          end: eventEnd,
        });
      } catch {
        // If Calendar fails, still create the session record; admin can retry
        googleEventId = null;
      }
      await this.prisma.studySession.create({
        data: {
          weeklyPlanItemId: session.itemId,
          scheduledAt: session.scheduledAt,
          durationMinutes: session.durationMinutes,
          googleEventId,
          status: 'SCHEDULED',
        },
      });
    }

    const updated = await this.prisma.weeklyPlan.update({
      where: { id: planId },
      data: { status: 'PUBLISHED', publishedAt: new Date() },
    });

    return {
      plan: updated,
      sessionsCreated: result.sessions.length,
      overflow: result.overflow,
    };
  }
}

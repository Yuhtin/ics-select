import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { ItemOutcome } from '@ics-select/prisma';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { resolveActiveMembership } from '../../common/cycle/active-cycle.js';
import type { SubmitRetroInput } from './dto.js';

export type WeekRecapItem = {
  id: string;
  title: string;
  format: string;
  estimatedMinutes: number;
  url: string | null;
  outcome: ItemOutcome;
  order: number;
};

export type WeekRecap = {
  stats: {
    nailed: number;
    hard: number;
    doubts: number;
    stuck: number;
    skipped: number;
    minutesStudied: number;
  };
  items: WeekRecapItem[];
};

// Mirrors the PlanOverflowError pattern in publication.service.ts: a
// custom ConflictException subclass that carries the structured
// { error: { code, message, details } } payload the global
// HttpExceptionFilter forwards to the client. Tests assert via
// toBeInstanceOf(InvalidItemReferenceError) instead of regex matching
// on the message.
export class InvalidItemReferenceError extends ConflictException {
  constructor(public readonly missing: string[]) {
    super({
      error: {
        code: 'INVALID_ITEM_REFERENCE',
        message: 'One or more linked items do not belong to your current-week plan',
        details: { missing },
      },
    });
  }
}

@Injectable()
export class RetroService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(userId: string, now: Date = new Date()) {
    const availability = await this.prisma.memberAvailability.findUnique({ where: { userId } });
    const tz = availability?.timezone ?? 'America/Sao_Paulo';
    const { open, windowOpensAt, windowClosesAt, weekStart } = this.computeWindow(now, tz);

    const [retro, weekRecap] = await Promise.all([
      this.prisma.weeklyRetro.findUnique({
        where: { userId_weekStart: { userId, weekStart } },
      }),
      this.loadWeekRecap(userId, weekStart),
    ]);

    return {
      open,
      retro,
      windowOpensAt: windowOpensAt.toISOString(),
      windowClosesAt: windowClosesAt.toISOString(),
      weekRecap,
    };
  }

  // Loads the current-week PUBLISHED plan and shapes its items into the
  // recap block the frontend renders above the form. Returns null if the
  // member has no published plan for the week — the form falls back to
  // showing only Q3 (the wish field).
  private async loadWeekRecap(userId: string, weekStart: Date): Promise<WeekRecap | null> {
    const plan = await this.prisma.weeklyPlan.findFirst({
      where: { userId, weekStart, status: 'PUBLISHED' },
      include: {
        items: {
          orderBy: { order: 'asc' },
          include: {
            libraryItem: {
              select: { title: true, format: true, estimatedMinutes: true, url: true },
            },
          },
        },
      },
    });
    if (!plan) return null;

    const stats = { nailed: 0, hard: 0, doubts: 0, stuck: 0, skipped: 0, minutesStudied: 0 };
    const items: WeekRecapItem[] = [];
    for (const i of plan.items) {
      switch (i.outcome) {
        case 'DONE_EASY':
          stats.nailed += 1;
          stats.minutesStudied += i.scheduledMinutes ?? 0;
          break;
        case 'DONE_HARD':
          stats.hard += 1;
          stats.minutesStudied += i.scheduledMinutes ?? 0;
          break;
        case 'DOUBTS':
          stats.doubts += 1;
          break;
        case 'STUCK':
          stats.stuck += 1;
          break;
        case 'SKIPPED':
          stats.skipped += 1;
          break;
        // PENDING is intentionally not surfaced in stats — the recap is
        // about what happened, not what's still pending.
      }
      items.push({
        id: i.id,
        title: i.libraryItem.title,
        format: i.libraryItem.format,
        estimatedMinutes: i.libraryItem.estimatedMinutes,
        url: i.libraryItem.url,
        outcome: i.outcome,
        order: i.order,
      });
    }

    return { stats, items };
  }

  async submit(userId: string, input: SubmitRetroInput, now: Date = new Date()) {
    const availability = await this.prisma.memberAvailability.findUnique({ where: { userId } });
    const tz = availability?.timezone ?? 'America/Sao_Paulo';
    const { open, weekStart } = this.computeWindow(now, tz);
    if (!open) {
      throw new ConflictException('Retro window is closed — try again Fri 18:00 to Sun 23:59 local time.');
    }

    const membership = await resolveActiveMembership(this.prisma, userId, now);
    if (!membership) throw new NotFoundException('No active cycle membership');

    // Validate any provided item ids against the caller's current-week plan.
    // Both ids are independently optional; null means "explicit clear" and
    // is also valid (no DB lookup needed).
    const idsToCheck = [input.valuedItemId, input.stuckItemId].filter(
      (id): id is string => typeof id === 'string',
    );
    if (idsToCheck.length > 0) {
      const found = await this.prisma.weeklyPlanItem.findMany({
        where: {
          id: { in: idsToCheck },
          weeklyPlan: { userId, weekStart },
        },
        select: { id: true },
      });
      const foundIds = new Set(found.map((r) => r.id));
      const missing = idsToCheck.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        throw new InvalidItemReferenceError(missing);
      }
    }

    return this.prisma.weeklyRetro.upsert({
      where: { userId_weekStart: { userId, weekStart } },
      create: {
        userId,
        cycleId: membership.cycleId,
        weekStart,
        whatClicked: input.whatClicked ?? null,
        whatStuck: input.whatStuck ?? null,
        nextWeekWish: input.nextWeekWish ?? null,
        valuedItemId: input.valuedItemId ?? null,
        stuckItemId: input.stuckItemId ?? null,
      },
      update: {
        whatClicked: input.whatClicked ?? null,
        whatStuck: input.whatStuck ?? null,
        nextWeekWish: input.nextWeekWish ?? null,
        valuedItemId: input.valuedItemId ?? null,
        stuckItemId: input.stuckItemId ?? null,
        submittedAt: new Date(),
      },
    });
  }

  computeWindow(now: Date, timezone: string) {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: 'numeric',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = Object.fromEntries(
      fmt.formatToParts(now).map((p) => [p.type, p.value]),
    );
    const dayCode: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const weekdayPart = parts['weekday'] ?? 'Mon';
    const hourPart = parts['hour'] ?? '0';
    const localDay = dayCode[weekdayPart] ?? 1;
    const localHour = parseInt(hourPart === '24' ? '0' : hourPart, 10);

    const inWindow =
      (localDay === 5 && localHour >= 18) ||   // Fri 18:00+
      localDay === 6 ||                         // All of Sat
      localDay === 0;                           // Sun (until 23:59 — end-of-day handled naturally)

    // weekStart: UTC Monday of the current user-local week.
    const localDate = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
    const mondayOffset = (localDay + 6) % 7;   // days since Monday
    const weekStart = new Date(localDate);
    weekStart.setUTCDate(weekStart.getUTCDate() - mondayOffset);

    const windowOpensAt = new Date(weekStart);
    windowOpensAt.setUTCDate(windowOpensAt.getUTCDate() + 4);   // Friday
    windowOpensAt.setUTCHours(18, 0, 0, 0);
    const windowClosesAt = new Date(weekStart);
    windowClosesAt.setUTCDate(windowClosesAt.getUTCDate() + 6);   // Sunday
    windowClosesAt.setUTCHours(23, 59, 59, 999);

    return { open: inWindow, weekStart, windowOpensAt, windowClosesAt };
  }
}

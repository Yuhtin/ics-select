import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { SubmitRetroInput } from './dto.js';

@Injectable()
export class RetroService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(userId: string, now: Date = new Date()) {
    const availability = await this.prisma.memberAvailability.findUnique({ where: { userId } });
    const tz = availability?.timezone ?? 'America/Sao_Paulo';
    const { open, windowOpensAt, windowClosesAt, weekStart } = this.computeWindow(now, tz);

    const retro = await this.prisma.weeklyRetro.findUnique({
      where: { userId_weekStart: { userId, weekStart } },
    });

    return {
      open,
      retro,
      windowOpensAt: windowOpensAt.toISOString(),
      windowClosesAt: windowClosesAt.toISOString(),
    };
  }

  async submit(userId: string, input: SubmitRetroInput, now: Date = new Date()) {
    const availability = await this.prisma.memberAvailability.findUnique({ where: { userId } });
    const tz = availability?.timezone ?? 'America/Sao_Paulo';
    const { open, weekStart } = this.computeWindow(now, tz);
    if (!open) {
      throw new ConflictException('Retro window is closed — try again Fri 18:00 to Sun 23:59 local time.');
    }

    const membership = await this.prisma.cycleMembership.findFirst({
      where: { userId, cycle: { status: 'ACTIVE' } },
    });
    if (!membership) throw new NotFoundException('No active cycle membership');

    return this.prisma.weeklyRetro.upsert({
      where: { userId_weekStart: { userId, weekStart } },
      create: {
        userId,
        cycleId: membership.cycleId,
        weekStart,
        whatClicked: input.whatClicked ?? null,
        whatStuck: input.whatStuck ?? null,
        nextWeekWish: input.nextWeekWish ?? null,
      },
      update: {
        whatClicked: input.whatClicked ?? null,
        whatStuck: input.whatStuck ?? null,
        nextWeekWish: input.nextWeekWish ?? null,
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

/**
 * Shared helpers for resolving THE active cycle.
 *
 * Business rule (as of 2026-04-17):
 *   1. If a cycle with status=ACTIVE contains `now` (startsAt <= now <= endsAt),
 *      that cycle is "the active one".
 *   2. Otherwise, the active cycle is the ACTIVE cycle with the earliest
 *      `startsAt > now` (the nearest upcoming cycle).
 *   3. Never return more than one cycle as "active".
 *
 * ARCHIVED cycles are always excluded — archiving is how the admin retires
 * a cycle. If every cycle is archived, callers get null.
 */

import type { PrismaService } from '../prisma/prisma.service.js';

type PrismaCycleClient = Pick<PrismaService, 'cycle' | 'cycleMembership'>;

type AnyCycle = {
  id: string;
  startsAt: Date;
  endsAt: Date;
};

export async function resolveActiveCycle(
  prisma: PrismaCycleClient,
  now: Date = new Date(),
) {
  // 1. Cycle whose date range contains `now`.
  const current = await prisma.cycle.findFirst({
    where: {
      status: 'ACTIVE',
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    orderBy: { startsAt: 'desc' },
  });
  if (current) return current;

  // 2. Nearest upcoming cycle.
  return prisma.cycle.findFirst({
    where: { status: 'ACTIVE', startsAt: { gt: now } },
    orderBy: { startsAt: 'asc' },
  });
}

type ResolveMembershipInclude = {
  cycle?: boolean;
  user?: boolean;
};

/**
 * Pick the single active membership for this user. Prefers a membership whose
 * cycle contains `now`; falls back to the nearest upcoming membership.
 */
export async function resolveActiveMembership<T extends ResolveMembershipInclude>(
  prisma: PrismaCycleClient,
  userId: string,
  now: Date = new Date(),
  include?: T,
) {
  const mergedInclude = { cycle: true, ...(include ?? {}) };
  const current = await prisma.cycleMembership.findFirst({
    where: {
      userId,
      cycle: {
        status: 'ACTIVE',
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
    },
    include: mergedInclude,
    orderBy: { cycle: { startsAt: 'desc' } },
  });
  if (current) return current;

  return prisma.cycleMembership.findFirst({
    where: {
      userId,
      cycle: { status: 'ACTIVE', startsAt: { gt: now } },
    },
    include: mergedInclude,
    orderBy: { cycle: { startsAt: 'asc' } },
  });
}

export type WeekPosition = {
  weekNumber: number; // 0 when the cycle hasn't started yet, otherwise 1..weeksTotal
  weeksTotal: number;
  hasStarted: boolean;
  daysUntilStart: number; // 0 once the cycle is running
  daysUntilWeekEnds: number; // 0..6 while running; 0 before start
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/**
 * Compute the member-facing week position for a cycle. Callers use this for
 * any "week X of N · Y days until week ends" label.
 */
export function computeWeekPosition(
  cycle: AnyCycle,
  now: Date = new Date(),
): WeekPosition {
  const startMs = cycle.startsAt.getTime();
  const endMs = cycle.endsAt.getTime();
  const totalMs = Math.max(WEEK_MS, endMs - startMs);
  const weeksTotal = Math.max(1, Math.ceil(totalMs / WEEK_MS));

  if (now.getTime() < startMs) {
    return {
      weekNumber: 0,
      weeksTotal,
      hasStarted: false,
      daysUntilStart: Math.max(0, Math.ceil((startMs - now.getTime()) / DAY_MS)),
      daysUntilWeekEnds: 0,
    };
  }

  const elapsedMs = now.getTime() - startMs;
  const weekNumber = Math.min(weeksTotal, Math.max(1, Math.ceil(elapsedMs / WEEK_MS) || 1));
  // Day-of-cycle mod 7; "days until this week ends" is how many days remain
  // in the member's current 7-day window within the cycle.
  const dayOfCycle = Math.floor(elapsedMs / DAY_MS);
  const dayInWeek = dayOfCycle % 7;
  const daysUntilWeekEnds = Math.max(0, 6 - dayInWeek);
  return {
    weekNumber,
    weeksTotal,
    hasStarted: true,
    daysUntilStart: 0,
    daysUntilWeekEnds,
  };
}

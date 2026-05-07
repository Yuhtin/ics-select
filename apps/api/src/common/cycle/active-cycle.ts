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

/**
 * The cycle a waitlist signup targets.
 *
 * Rule: always skip the "current-or-imminent" cycle. A cycle that's already
 * running has its 12 spots taken; a cycle that's imminent (next upcoming)
 * already has selection in progress. Waitlist signups go to the cycle AFTER
 * whichever of those is relevant.
 *
 *   1. If a cycle is running (now ∈ [startsAt, endsAt]), return the nearest
 *      upcoming cycle with startsAt > running.endsAt.
 *   2. Otherwise, skip the nearest upcoming cycle and return the one after it.
 *   3. Returns null if no qualifying cycle exists. Caller decides how to handle.
 */
export async function resolveWaitlistTargetCycle(
  prisma: PrismaCycleClient,
  now: Date = new Date(),
) {
  const running = await prisma.cycle.findFirst({
    where: {
      status: 'ACTIVE',
      startsAt: { lte: now },
      endsAt: { gte: now },
    },
    orderBy: { startsAt: 'desc' },
  });
  if (running) {
    return prisma.cycle.findFirst({
      where: { status: 'ACTIVE', startsAt: { gt: running.endsAt } },
      orderBy: { startsAt: 'asc' },
    });
  }
  const upcoming = await prisma.cycle.findMany({
    where: { status: 'ACTIVE', startsAt: { gt: now } },
    orderBy: { startsAt: 'asc' },
    take: 2,
  });
  return upcoming[1] ?? null;
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

/**
 * Returns a CycleMembership row when `userId` already has a non-ARCHIVED
 * membership in a cycle whose date range overlaps `target`'s date range.
 * Returns null when adding a membership in `target` is safe.
 *
 * "Overlap" uses the inclusive interval test:
 *   existing.startsAt <= target.endsAt && existing.endsAt >= target.startsAt
 *
 * The membership in `target` itself is excluded so this helper is safe to
 * call when re-adding (idempotent enroll). Pass target.id = null when
 * checking before the cycle has been chosen yet.
 */
export async function findOverlappingActiveMembership(
  prisma: PrismaCycleClient,
  userId: string,
  target: { id: string | null; startsAt: Date; endsAt: Date },
) {
  return prisma.cycleMembership.findFirst({
    where: {
      userId,
      ...(target.id ? { cycleId: { not: target.id } } : {}),
      cycle: {
        status: { not: 'ARCHIVED' },
        startsAt: { lte: target.endsAt },
        endsAt: { gte: target.startsAt },
      },
    },
    include: { cycle: true },
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
  // floor+1 is correct at week boundaries: elapsed=0 → week 1, elapsed=WEEK_MS
  // (start of second 7-day window) → week 2. ceil used to round WEEK_MS down
  // to 1, which is wrong when the plan editor queries by plan.weekStart.
  const weekNumber = Math.min(
    weeksTotal,
    Math.max(1, Math.floor(elapsedMs / WEEK_MS) + 1),
  );
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

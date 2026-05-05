import type { PrismaService } from '../../common/prisma/prisma.service.js';
import type { EngagementInput } from './engagement-score.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Builds an EngagementInput per cohort member using a single batched query.
 * Used by the cycle-overview ranking.
 *
 * cycleStart must be Monday-normalized (use mondayUTC(cycle.startsAt) at the
 * call site). Passing a raw cycle.startsAt that doesn't fall on a Monday
 * skews daysActive/daysElapsed by up to 6 days.
 */
export async function computeEngagementInputsForCohort(
  prisma: PrismaService,
  userIds: string[],
  cycleId: string,
  cycleStart: Date,
  now: Date,
): Promise<Map<string, EngagementInput>> {
  if (userIds.length === 0) return new Map();

  const rows = await prisma.$queryRawUnsafe<Array<{
    userId: string;
    daysActive: number;
    itemsDone: number;
    itemsPlanned: number;
    retrosSubmitted: number;
    daysSinceLastSession: number | null;
  }>>(
    `SELECT
       u."userId",
       COALESCE(ev_days.cnt, 0)   AS "daysActive",
       COALESCE(wp_done.cnt, 0)   AS "itemsDone",
       COALESCE(wp_plan.cnt, 0)   AS "itemsPlanned",
       COALESCE(retro.cnt, 0)     AS "retrosSubmitted",
       last_ev."daysSinceLastSession" AS "daysSinceLastSession"
     FROM unnest($1::text[]) AS u("userId")
     LEFT JOIN (
       SELECT "userId", COUNT(DISTINCT date_trunc('day', "occurredAt"))::int AS cnt FROM "UserEvent"
       WHERE "userId" = ANY($1::text[]) AND "occurredAt" BETWEEN $2 AND $3
       GROUP BY "userId"
     ) ev_days ON ev_days."userId" = u."userId"
     LEFT JOIN (
       SELECT wp."userId", COUNT(*)::int AS cnt
       FROM "WeeklyPlanItem" wpi JOIN "WeeklyPlan" wp ON wp.id = wpi."weeklyPlanId"
       WHERE wp."cycleId" = $4 AND wp."userId" = ANY($1::text[]) AND wpi."outcome" <> 'PENDING'
       GROUP BY wp."userId"
     ) wp_done ON wp_done."userId" = u."userId"
     LEFT JOIN (
       SELECT wp."userId", COUNT(*)::int AS cnt
       FROM "WeeklyPlanItem" wpi JOIN "WeeklyPlan" wp ON wp.id = wpi."weeklyPlanId"
       WHERE wp."cycleId" = $4 AND wp."userId" = ANY($1::text[])
       GROUP BY wp."userId"
     ) wp_plan ON wp_plan."userId" = u."userId"
     LEFT JOIN (
       SELECT "userId", COUNT(*)::int AS cnt FROM "WeeklyRetro"
       WHERE "cycleId" = $4 AND "userId" = ANY($1::text[])
       GROUP BY "userId"
     ) retro ON retro."userId" = u."userId"
     LEFT JOIN (
       SELECT "userId",
              FLOOR(EXTRACT(EPOCH FROM ($3 - MAX("occurredAt"))) / 86400)::int AS "daysSinceLastSession"
       FROM "UserEvent"
       WHERE "userId" = ANY($1::text[])
       GROUP BY "userId"
     ) last_ev ON last_ev."userId" = u."userId"`,
    userIds,
    cycleStart,
    now,
    cycleId,
  );

  const daysElapsed = Math.max(1, Math.floor((now.getTime() - cycleStart.getTime()) / DAY_MS));
  const weeksElapsed = Math.max(1, Math.ceil(daysElapsed / 7));

  const sortedByDone = [...rows]
    .map((r) => ({ userId: r.userId, itemsDone: Number(r.itemsDone) }))
    .sort((a, b) => a.itemsDone - b.itemsDone);
  const rankIndex = new Map<string, number>();
  sortedByDone.forEach((r, idx) => rankIndex.set(r.userId, idx));

  const plannedSorted = rows.map((r) => Number(r.itemsPlanned)).sort((a, b) => a - b);
  let cohortMedianItemsPlanned = 0;
  if (plannedSorted.length > 0) {
    const mid = Math.floor(plannedSorted.length / 2);
    cohortMedianItemsPlanned = Math.round(
      plannedSorted.length % 2 === 0
        ? (plannedSorted[mid - 1]! + plannedSorted[mid]!) / 2
        : plannedSorted[mid]!,
    );
  }

  const cohortSize = Math.max(0, userIds.length - 1);
  const out = new Map<string, EngagementInput>();
  for (const row of rows) {
    out.set(row.userId, {
      cohortRankFromBottom: rankIndex.get(row.userId) ?? 0,
      cohortSize,
      daysActive: Number(row.daysActive),
      daysElapsed,
      itemsDone: Number(row.itemsDone),
      itemsPlanned: Number(row.itemsPlanned),
      retrosSubmitted: Number(row.retrosSubmitted),
      weeksElapsed,
      daysSinceLastSession:
        row.daysSinceLastSession === null ? null : Number(row.daysSinceLastSession),
      cohortMedianItemsPlanned,
    });
  }
  return out;
}

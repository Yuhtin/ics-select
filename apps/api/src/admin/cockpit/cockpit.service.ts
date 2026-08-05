import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  computeWeekPosition,
  resolveActiveMembership,
} from '../../common/cycle/active-cycle.js';
import type { ItemOutcome, UserEventType } from '@ics-select/prisma';
import { computeEngagementScore } from './engagement-score.js';
import { classifyRisk } from './risk-thresholds.js';
import { canonicalCompletions } from '../../common/completions/canonical-completions.js';
import type { CockpitRange, CockpitResponse } from './cockpit.types.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const ZERO_OUTCOMES: Record<ItemOutcome, number> = {
  PENDING: 0,
  DONE_EASY: 0,
  DONE_HARD: 0,
  DOUBTS: 0,
  STUCK: 0,
  SKIPPED: 0,
};

function mondayUTC(d: Date): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = out.getUTCDay();
  out.setUTCDate(out.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return out;
}

@Injectable()
export class CockpitService {
  constructor(private readonly prisma: PrismaService) {}

  async getCockpit(
    memberId: string,
    cycleIdParam: string | null,
    range: CockpitRange,
    now: Date = new Date(),
  ): Promise<CockpitResponse> {
    const member = await this.prisma.user.findUnique({
      where: { id: memberId },
      select: { id: true, name: true, email: true, pictureUrl: true, whatsappPhone: true },
    });
    if (!member) throw new NotFoundException('member not found');

    const membership = cycleIdParam
      ? await this.prisma.cycleMembership.findFirst({
          where: { userId: memberId, cycleId: cycleIdParam },
          include: { cycle: true },
        })
      : await resolveActiveMembership(this.prisma, memberId, now);

    if (!membership) {
      // Member without cycle — return shell with empty data
      return this.emptyResponse(member, range);
    }

    const cycle = membership.cycle;

    // Data scope by range. 'all' spans every cycle the member was ever in;
    // 'cycle' and '7d' stay on the resolved cycle.
    //
    // 'all' deliberately drops cohort comparison and the engagement score.
    // Both are defined *inside* one cycle — the score is built from cohort
    // rank, days active vs. days elapsed in the cycle, and retros vs. weeks
    // in the cycle. Summing those across cycles produces a number with no
    // meaning, so `engagement` comes back null and the card unmounts.
    const isAllCycles = range === 'all';
    const scopedCycleIds = isAllCycles
      ? (
          await this.prisma.cycleMembership.findMany({
            where: { userId: memberId },
            select: { cycleId: true },
          })
        ).map((m) => m.cycleId)
      : [cycle.id];

    // '7d' narrows what counts as *completed* to the last 7 days while keeping
    // the cycle's plan as the denominator — "3 done in the last week, of 47
    // planned for the cycle" is the reading the admin wants.
    const windowStart =
      range === '7d' ? new Date(now.getTime() - 7 * DAY_MS) : null;

    const cohortIds = isAllCycles
      ? []
      : (
          await this.prisma.cycleMembership.findMany({
            where: { cycleId: cycle.id, NOT: { userId: memberId } },
            select: { userId: true },
          })
        ).map((m) => m.userId);

    const [plans, retros, classes, lastEvent, recent, topics] = await Promise.all([
      this.prisma.weeklyPlan.findMany({
        where: { userId: memberId, cycleId: { in: scopedCycleIds } },
        select: {
          id: true,
          weekStart: true,
          publishedAt: true,
          items: {
            include: {
              libraryItem: {
                select: {
                  estimatedMinutes: true,
                  topics: { select: { topicId: true, isPrimary: true } },
                },
              },
            },
          },
        },
        orderBy: { weekStart: 'asc' },
      }),
      this.prisma.weeklyRetro.findMany({
        where: { userId: memberId, cycleId: { in: scopedCycleIds } },
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.classSession.findMany({
        where: { cycleId: { in: scopedCycleIds } },
        orderBy: { scheduledAt: 'asc' },
        include: { attendance: { where: { userId: memberId }, take: 1 } },
      }),
      this.prisma.userEvent.findFirst({
        where: { userId: memberId },
        orderBy: { occurredAt: 'desc' },
      }),
      this.prisma.userEvent.findMany({
        where: { userId: memberId },
        orderBy: { occurredAt: 'desc' },
        take: 5,
      }),
      this.prisma.topic.findMany({ orderBy: { order: 'asc' } }),
    ]);

    const weekPos = computeWeekPosition(cycle, now);
    const weeksTotal = weekPos.weeksTotal;
    const weeksElapsed = Math.max(1, weekPos.weekNumber);
    const cycleStart = mondayUTC(cycle.startsAt);
    const daysElapsed = Math.max(1, Math.floor((now.getTime() - cycleStart.getTime()) / DAY_MS));

    // Per-week buckets. In 'all' mode the timeline runs from the member's very
    // first planned week to now — using the resolved cycle's start would drop
    // every week that happened before it. `plans` is ordered weekStart asc.
    const firstPlanStart = plans[0]?.weekStart;
    const bucketStart =
      isAllCycles && firstPlanStart ? mondayUTC(firstPlanStart) : cycleStart;
    const bucketWeeks =
      isAllCycles && firstPlanStart
        ? Math.max(
            1,
            Math.floor((now.getTime() - bucketStart.getTime()) / WEEK_MS) + 1,
          )
        : weeksElapsed;

    // Compute firstSession: earliest UserEvent within the cycle
    const firstEvent = await this.prisma.userEvent.findFirst({
      where: { userId: memberId, occurredAt: { gte: cycleStart, lte: now } },
      orderBy: { occurredAt: 'asc' },
      select: { occurredAt: true },
    });

    const firstSessionPayload = firstEvent
      ? {
          occurredAt: firstEvent.occurredAt.toISOString(),
          dayOfCycle: Math.floor((firstEvent.occurredAt.getTime() - cycleStart.getTime()) / DAY_MS) + 1,
        }
      : null;

    // Items aggregates. A material carried across N weeks and marked done in
    // each is N rows in `allItems`; dedup to one canonical completion per
    // material (earliest positive) so counts/minutes don't multiply.
    const allItems = plans.flatMap((p) => p.items);
    // canonicalCompletions is already the cross-cycle-safe dedup, so 'all' mode
    // counts a material carried across cycles once, not once per cycle.
    const completedInScope = canonicalCompletions(allItems);
    const completed = windowStart
      ? completedInScope.filter(
          (i) => i.completedAt != null && i.completedAt >= windowStart,
        )
      : completedInScope;
    const byOutcome = countByOutcome(completed.map((i) => i.outcome));
    const perWeekItems = bucketPerWeek(plans, bucketWeeks, bucketStart);
    const needsAttention = {
      total: byOutcome.STUCK + byOutcome.DOUBTS,
      stuck: byOutcome.STUCK,
      doubts: byOutcome.DOUBTS,
    };

    // Time invested
    const actualMinutes = completed.reduce(
      (sum, i) => sum + (i.actualMinutes ?? i.scheduledMinutes ?? i.libraryItem.estimatedMinutes ?? 0),
      0,
    );
    // Planned minutes: one row per distinct material (a re-planned material
    // isn't budgeted N times), keeping its first appearance.
    const plannedByMaterial = new Map<string, (typeof allItems)[number]>();
    for (const i of allItems) {
      if (!plannedByMaterial.has(i.libraryItemId)) plannedByMaterial.set(i.libraryItemId, i);
    }
    const scheduledMinutes = [...plannedByMaterial.values()].reduce(
      (sum, i) => sum + (i.scheduledMinutes ?? i.libraryItem.estimatedMinutes ?? 0),
      0,
    );
    const naoSeiCount = completed.filter(
      (i) => i.actualMinutes === null && (i.scheduledMinutes ?? 0) > 0,
    ).length;
    const perWeekMinutes = bucketMinutesPerWeek(plans, bucketWeeks, bucketStart);

    // Cohort medians (per-metric SQL — percentile_cont across cohort users)
    const cohortMedians = await this.computeCohortMedians(
      cohortIds,
      cycle.id,
      cycleStart,
      now,
    );

    // Behavior. These use bucketStart/bucketWeeks, not cycleStart/weeksElapsed,
    // so that in 'all' mode the counters span the same timeline as the per-week
    // charts instead of silently reporting only the resolved cycle. In 'cycle'
    // and '7d' the two are the same value, so nothing changes there.
    const scopeDays = isAllCycles
      ? Math.max(1, Math.floor((now.getTime() - bucketStart.getTime()) / DAY_MS))
      : daysElapsed;
    const daysActive = await this.distinctDaysOfEvents(memberId, bucketStart, now);
    const daysStudying = await this.distinctDaysOfOutcomeMarks(
      memberId,
      cycle.id,
      bucketStart,
      now,
    );
    // Same definition as engagement-inputs.ts: BRT days with at least one
    // completed item in the cycle. The chip-level daysActive above keeps the
    // broader "any platform event" semantics for the dashboard display.
    const daysCompletedForScore = await this.distinctDaysOfCompletedItems(
      memberId,
      cycle.id,
      cycleStart,
      now,
    );
    const sessions = await this.countSessions(memberId, bucketStart, now);
    const carryOver = allItems.filter((i) => i.carriedFromItemId !== null).length;

    const sessionsPerWeek = await this.sessionsPerWeek(memberId, bucketWeeks, bucketStart);
    const daysActivePerWeek = await this.daysActivePerWeek(memberId, bucketWeeks, bucketStart);
    const daysStudyingPerWeek = await this.daysStudyingPerWeek(
      memberId,
      cycle.id,
      bucketWeeks,
      bucketStart,
    );
    const carryOverPerWeek = bucketCarryPerWeek(plans, bucketWeeks, bucketStart);

    // Null when the member has no events recorded yet (either never used the
    // platform or activity capture only just deployed). classifyRisk and
    // computeEngagementScore both skip the session criterion when this is null —
    // we want "no data yet" to look neutral, not catastrophic.
    const daysSinceLastSession: number | null = lastEvent
      ? Math.floor((now.getTime() - lastEvent.occurredAt.getTime()) / DAY_MS)
      : null;

    // Cohort rank and the engagement score are cycle-scoped by construction, so
    // 'all' skips them rather than emitting a meaningless number. cohortIds is
    // already [] in that mode, which also short-circuits computeCohortMedians.
    const cohortRankPct = isAllCycles
      ? 0
      : await this.cohortRankPct(memberId, cohortIds, cycle.id, daysElapsed);
    const cohortRankFromBottom = Math.round(cohortRankPct * cohortIds.length);

    // Engagement score
    const engagement = isAllCycles
      ? null
      : computeEngagementScore({
          cohortRankFromBottom,
          cohortSize: cohortIds.length,
          daysActive: daysCompletedForScore,
          daysElapsed,
          itemsDone: completed.length,
          itemsPlanned: plannedByMaterial.size,
          retrosSubmitted: retros.length,
          weeksElapsed,
          daysSinceLastSession,
          classesAttended: classes.filter((c) => c.scheduledAt < now && c.attendance[0]?.status === 'PRESENT').length,
          classesHeld: classes.filter((c) => c.scheduledAt < now).length,
          cohortMedianItemsPlanned: cohortMedians.itemsPlanned,
        });

    const scoreByWeek = isAllCycles
      ? []
      : await this.scoreByWeek(memberId, cycle, weeksElapsed, cohortIds, now);

    // Risk
    const completionRate =
      plannedByMaterial.size === 0 ? 0 : completed.length / plannedByMaterial.size;
    const risk = classifyRisk({
      daysSinceLastSession,
      completionRate,
      cohortRankPct,
    });

    // Topic engagement
    const topicEngagement = computeTopicEngagement(topics, allItems, cohortMedians.byTopic);

    // Class attendance
    const present = classes.filter((c) => c.attendance[0]?.status === 'PRESENT').length;
    const sessionsList = classes.map((c) => ({
      scheduledAt: c.scheduledAt.toISOString(),
      status: c.attendance[0]?.status ?? null,
    }));

    return {
      member: { ...member, track: membership.track ?? null },
      cycle: {
        id: cycle.id,
        name: cycle.name,
        weekNumber: weekPos.weekNumber,
        weeksTotal,
        startsAt: cycle.startsAt.toISOString(),
        endsAt: cycle.endsAt.toISOString(),
      },
      range,
      risk,
      engagement: engagement
        ? {
            score: engagement.score,
            cohortMedian: cohortMedians.engagement,
            breakdown: engagement.breakdown,
            scoreByWeek,
          }
        : null,
      itemsCompleted: {
        total: completed.length,
        planned: plannedByMaterial.size,
        completionPct: Math.round(completionRate * 100),
        cohortMedian: cohortMedians.itemsDone,
        cohortMedianPlanned: cohortMedians.itemsPlanned,
        byOutcome,
        perWeek: perWeekItems,
        needsAttention,
      },
      timeInvested: {
        actualMinutes,
        scheduledMinutes,
        cohortMedianMinutes: cohortMedians.minutes,
        naoSeiCount,
        perWeekMinutes,
      },
      behavior: {
        sessions: { value: sessions, cohortMedian: cohortMedians.sessions, perWeek: sessionsPerWeek },
        daysActive: { value: daysActive, cycleDays: scopeDays, cohortMedian: cohortMedians.daysActive, perWeek: daysActivePerWeek },
        daysStudying: { value: daysStudying, cycleDays: scopeDays, cohortMedian: cohortMedians.daysStudying, perWeek: daysStudyingPerWeek },
        // expected = number of weeks whose retro window has already closed
        // (= weeksElapsed - 1). The current week's retro doesn't count: window
        // opens Friday and stays submittable until the next Monday, so until
        // the week fully ends there's no opportunity to be "behind". Same
        // divisor used by the engagement score's retro criterion.
        // `submitted` follows the data scope, so `expected` must too — otherwise
        // 'all' compares retros from every cycle against one cycle's week count
        // and reports a nonsense surplus. Same -1 as engagement-score: the
        // current week's retro window is still open, so it isn't yet a miss.
        retros: { submitted: retros.length, expected: Math.max(0, bucketWeeks - 1) },
        carryOver: { value: carryOver, cohortMedian: cohortMedians.carryOver, perWeek: carryOverPerWeek },
        lastSeen: {
          occurredAt: lastEvent?.occurredAt.toISOString() ?? null,
          surface: extractSurface(lastEvent?.meta),
        },
      },
      topicEngagement,
      classAttendance: {
        present,
        total: classes.length,
        cohortPresent: cohortMedians.classAttendance,
        sessions: sessionsList,
      },
      firstSession: firstSessionPayload,
      recentActivity: recent.map((e) => ({
        occurredAt: e.occurredAt.toISOString(),
        type: e.type,
        meta: e.meta,
        label: labelEvent(e.type, e.meta),
      })),
    };
  }

  private emptyResponse(
    member: {
      id: string;
      name: string;
      email: string;
      pictureUrl: string | null;
      whatsappPhone: string | null;
    },
    range: CockpitRange,
  ): CockpitResponse {
    return {
      member: { ...member, track: null },
      cycle: null,
      range,
      risk: { status: 'ON_TRACK', reasons: [] },
      engagement: { score: 0, cohortMedian: 0, breakdown: [], scoreByWeek: [] },
      itemsCompleted: {
        total: 0,
        planned: 0,
        completionPct: 0,
        cohortMedian: 0,
        cohortMedianPlanned: 0,
        byOutcome: { ...ZERO_OUTCOMES },
        perWeek: [],
        needsAttention: { total: 0, stuck: 0, doubts: 0 },
      },
      timeInvested: {
        actualMinutes: 0,
        scheduledMinutes: 0,
        cohortMedianMinutes: 0,
        naoSeiCount: 0,
        perWeekMinutes: [],
      },
      behavior: {
        sessions: { value: 0, cohortMedian: 0, perWeek: [] },
        daysActive: { value: 0, cycleDays: 0, cohortMedian: 0, perWeek: [] },
        daysStudying: { value: 0, cycleDays: 0, cohortMedian: 0, perWeek: [] },
        retros: { submitted: 0, expected: 0 },
        carryOver: { value: 0, cohortMedian: 0, perWeek: [] },
        lastSeen: { occurredAt: null, surface: null },
      },
      topicEngagement: [],
      classAttendance: { present: 0, total: 0, cohortPresent: 0, sessions: [] },
      firstSession: null,
      recentActivity: [],
    };
  }

  // --- helpers (queries) ---

  private async distinctDaysOfEvents(userId: string, from: Date, to: Date): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ d: Date }>>(
      `SELECT DISTINCT date_trunc('day', "occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS d
       FROM "UserEvent" WHERE "userId" = $1 AND "occurredAt" BETWEEN $2 AND $3`,
      userId,
      from,
      to,
    );
    return rows.length;
  }

  private async distinctDaysOfOutcomeMarks(
    userId: string,
    _cycleId: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ d: Date }>>(
      `SELECT DISTINCT date_trunc('day', e."occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS d
       FROM "UserEvent" e
       WHERE e."userId" = $1
         AND e."type" = 'OUTCOME_MARKED'
         AND e."occurredAt" BETWEEN $2 AND $3`,
      userId,
      from,
      to,
    );
    return rows.length;
  }

  // Distinct BRT days where the member completed at least one plan item in
  // this cycle. Source: WeeklyPlanItem.completedAt — same field that drives
  // the home streak and the engagement-inputs ranking. Used as the daysActive
  // input for computeEngagementScore so cockpit and cycle-overview agree.
  private async distinctDaysOfCompletedItems(
    userId: string,
    cycleId: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ d: Date }>>(
      `SELECT DISTINCT date_trunc('day', wpi."completedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS d
       FROM "WeeklyPlanItem" wpi
       JOIN "WeeklyPlan" wp ON wp.id = wpi."weeklyPlanId"
       WHERE wp."userId" = $1
         AND wp."cycleId" = $2
         AND wpi."completedAt" IS NOT NULL
         AND wpi."completedAt" BETWEEN $3 AND $4`,
      userId,
      cycleId,
      from,
      to,
    );
    return rows.length;
  }

  private async countSessions(userId: string, from: Date, to: Date): Promise<number> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
      `SELECT COUNT(*) AS c FROM "UserEvent"
       WHERE "userId" = $1 AND "type" = 'SESSION_START' AND "occurredAt" BETWEEN $2 AND $3`,
      userId,
      from,
      to,
    );
    return Number(rows[0]?.c ?? 0);
  }

  private async sessionsPerWeek(
    userId: string,
    weeksElapsed: number,
    cycleStart: Date,
  ): Promise<number[]> {
    return arrayPerWeek(
      weeksElapsed,
      async (start, end) => {
        const r = await this.prisma.$queryRawUnsafe<Array<{ c: bigint }>>(
          `SELECT COUNT(*) AS c FROM "UserEvent" WHERE "userId" = $1 AND "type" = 'SESSION_START' AND "occurredAt" >= $2 AND "occurredAt" < $3`,
          userId,
          start,
          end,
        );
        return Number(r[0]?.c ?? 0);
      },
      cycleStart,
    );
  }

  private async daysActivePerWeek(
    userId: string,
    weeksElapsed: number,
    cycleStart: Date,
  ): Promise<number[]> {
    return arrayPerWeek(
      weeksElapsed,
      async (start, end) => {
        const r = await this.prisma.$queryRawUnsafe<Array<{ d: Date }>>(
          `SELECT DISTINCT date_trunc('day', "occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS d FROM "UserEvent" WHERE "userId" = $1 AND "occurredAt" >= $2 AND "occurredAt" < $3`,
          userId,
          start,
          end,
        );
        return r.length;
      },
      cycleStart,
    );
  }

  private async daysStudyingPerWeek(
    userId: string,
    _cycleId: string,
    weeksElapsed: number,
    cycleStart: Date,
  ): Promise<number[]> {
    return arrayPerWeek(
      weeksElapsed,
      async (start, end) => {
        const r = await this.prisma.$queryRawUnsafe<Array<{ d: Date }>>(
          `SELECT DISTINCT date_trunc('day', "occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo') AS d FROM "UserEvent" WHERE "userId" = $1 AND "type" = 'OUTCOME_MARKED' AND "occurredAt" >= $2 AND "occurredAt" < $3`,
          userId,
          start,
          end,
        );
        return r.length;
      },
      cycleStart,
    );
  }

  private async cohortRankPct(
    memberId: string,
    cohortIds: string[],
    cycleId: string,
    _daysElapsed: number,
  ): Promise<number> {
    if (cohortIds.length === 0) return 1;
    const allIds = [memberId, ...cohortIds];
    const rows = await this.prisma.$queryRawUnsafe<Array<{ userId: string; done: bigint }>>(
      // Dedup carried completions: distinct materials with any non-PENDING row.
      // Scoped to this cycle so cockpit rank matches the cycle-overview ranking
      // (engagement-inputs wp_done is also cycle-scoped — "share one number").
      `SELECT wp."userId", COUNT(DISTINCT CASE WHEN wpi."outcome" <> 'PENDING' THEN wpi."libraryItemId" END) AS done
       FROM "WeeklyPlanItem" wpi
       JOIN "WeeklyPlan" wp ON wp.id = wpi."weeklyPlanId"
       WHERE wp."userId" = ANY($1::text[]) AND wp."cycleId" = $2
       GROUP BY wp."userId"`,
      allIds, cycleId,
    );
    const sumByUser = new Map<string, number>();
    for (const r of rows) {
      sumByUser.set(r.userId, (sumByUser.get(r.userId) ?? 0) + Number(r.done));
    }
    const sorted = allIds
      .map((id) => ({ id, done: sumByUser.get(id) ?? 0 }))
      .sort((a, b) => a.done - b.done); // ascending: bottom first
    const idx = sorted.findIndex((s) => s.id === memberId);
    return idx / Math.max(1, sorted.length - 1);
  }

  private async computeCohortMedians(
    cohortIds: string[],
    cycleId: string,
    cycleStart: Date,
    now: Date,
  ) {
    const empty = {
      engagement: 0,
      sessions: 0,
      daysActive: 0,
      daysStudying: 0,
      itemsDone: 0,
      itemsPlanned: 0,
      minutes: 0,
      carryOver: 0,
      classAttendance: 0,
      byTopic: new Map<string, number>(),
    };
    if (cohortIds.length === 0) return empty;

    // --- sessions median ---
    const sessionsRows = await this.prisma.$queryRawUnsafe<Array<{ median: number | null }>>(
      `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(per_user.cnt, 0)) AS median
       FROM unnest($1::text[]) AS u("userId")
       LEFT JOIN (
         SELECT "userId", COUNT(*)::int AS cnt
         FROM "UserEvent"
         WHERE "userId" = ANY($1::text[])
           AND "type" = 'SESSION_START'
           AND "occurredAt" BETWEEN $2 AND $3
         GROUP BY "userId"
       ) AS per_user USING ("userId")`,
      cohortIds, cycleStart, now,
    );
    const sessionsMedian = Math.round(sessionsRows[0]?.median ?? 0);

    // --- daysActive median ---
    const daysActiveRows = await this.prisma.$queryRawUnsafe<Array<{ median: number | null }>>(
      `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(per_user.cnt, 0)) AS median
       FROM unnest($1::text[]) AS u("userId")
       LEFT JOIN (
         SELECT "userId", COUNT(DISTINCT date_trunc('day', "occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'))::int AS cnt
         FROM "UserEvent"
         WHERE "userId" = ANY($1::text[])
           AND "occurredAt" BETWEEN $2 AND $3
         GROUP BY "userId"
       ) AS per_user USING ("userId")`,
      cohortIds, cycleStart, now,
    );
    const daysActiveMedian = Math.round(daysActiveRows[0]?.median ?? 0);

    // --- daysStudying median (OUTCOME_MARKED events) ---
    const daysStudyingRows = await this.prisma.$queryRawUnsafe<Array<{ median: number | null }>>(
      `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(per_user.cnt, 0)) AS median
       FROM unnest($1::text[]) AS u("userId")
       LEFT JOIN (
         SELECT "userId", COUNT(DISTINCT date_trunc('day', "occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'))::int AS cnt
         FROM "UserEvent"
         WHERE "userId" = ANY($1::text[])
           AND "type" = 'OUTCOME_MARKED'
           AND "occurredAt" BETWEEN $2 AND $3
         GROUP BY "userId"
       ) AS per_user USING ("userId")`,
      cohortIds, cycleStart, now,
    );
    const daysStudyingMedian = Math.round(daysStudyingRows[0]?.median ?? 0);

    // --- itemsDone median ---
    const itemsDoneRows = await this.prisma.$queryRawUnsafe<Array<{ median: number | null }>>(
      `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(per_user.cnt, 0)) AS median
       FROM unnest($1::text[]) AS u("userId")
       LEFT JOIN (
         -- distinct completed materials (dedup carried re-marks)
         SELECT wp."userId", COUNT(DISTINCT wpi."libraryItemId")::int AS cnt
         FROM "WeeklyPlanItem" wpi
         JOIN "WeeklyPlan" wp ON wp.id = wpi."weeklyPlanId"
         WHERE wp."cycleId" = $2
           AND wp."userId" = ANY($1::text[])
           AND wpi."outcome" <> 'PENDING'
         GROUP BY wp."userId"
       ) AS per_user USING ("userId")`,
      cohortIds, cycleId,
    );
    const itemsDoneMedian = Math.round(itemsDoneRows[0]?.median ?? 0);

    // --- minutes median ---
    const minutesRows = await this.prisma.$queryRawUnsafe<Array<{ median: number | null }>>(
      `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(per_user.mins, 0)) AS median
       FROM unnest($1::text[]) AS u("userId")
       LEFT JOIN (
         -- One canonical row per (user, material) so a material completed across
         -- N weeks contributes its minutes once.
         SELECT canon."userId", SUM(canon.mins)::int AS mins
         FROM (
           SELECT DISTINCT ON (wp."userId", wpi."libraryItemId")
                  wp."userId",
                  COALESCE(wpi."actualMinutes", wpi."scheduledMinutes", li."estimatedMinutes", 0) AS mins
           FROM "WeeklyPlanItem" wpi
           JOIN "WeeklyPlan" wp ON wp.id = wpi."weeklyPlanId"
           JOIN "LibraryItem" li ON li.id = wpi."libraryItemId"
           WHERE wp."cycleId" = $2
             AND wp."userId" = ANY($1::text[])
             AND wpi."outcome" <> 'PENDING'
           -- Prefer the earliest POSITIVE row (match canonicalCompletions);
           -- fall back to earliest non-PENDING only when never positive.
           ORDER BY wp."userId", wpi."libraryItemId",
                    (CASE WHEN wpi."outcome" IN ('DONE_EASY','DONE_HARD','DOUBTS','SKIPPED') THEN 0 ELSE 1 END) ASC,
                    wpi."completedAt" ASC NULLS LAST
         ) canon
         GROUP BY canon."userId"
       ) AS per_user USING ("userId")`,
      cohortIds, cycleId,
    );
    const minutesMedian = Math.round(minutesRows[0]?.median ?? 0);

    // --- carryOver median ---
    const carryOverRows = await this.prisma.$queryRawUnsafe<Array<{ median: number | null }>>(
      `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(per_user.cnt, 0)) AS median
       FROM unnest($1::text[]) AS u("userId")
       LEFT JOIN (
         SELECT wp."userId", COUNT(*)::int AS cnt
         FROM "WeeklyPlanItem" wpi
         JOIN "WeeklyPlan" wp ON wp.id = wpi."weeklyPlanId"
         WHERE wp."cycleId" = $2
           AND wp."userId" = ANY($1::text[])
           AND wpi."carriedFromItemId" IS NOT NULL
         GROUP BY wp."userId"
       ) AS per_user USING ("userId")`,
      cohortIds, cycleId,
    );
    const carryOverMedian = Math.round(carryOverRows[0]?.median ?? 0);

    // --- classAttendance median ---
    const classAttRows = await this.prisma.$queryRawUnsafe<Array<{ median: number | null }>>(
      `SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(per_user.cnt, 0)) AS median
       FROM unnest($1::text[]) AS u("userId")
       LEFT JOIN (
         SELECT ca."userId", COUNT(*)::int AS cnt
         FROM "ClassAttendance" ca
         JOIN "ClassSession" cs ON cs.id = ca."classSessionId"
         WHERE cs."cycleId" = $2
           AND ca."userId" = ANY($1::text[])
           AND ca."status" = 'PRESENT'
         GROUP BY ca."userId"
       ) AS per_user USING ("userId")`,
      cohortIds, cycleId,
    );
    const classAttMedian = Math.round(classAttRows[0]?.median ?? 0);

    // --- byTopic median minutes per topic ---
    const topicRows = await this.prisma.$queryRawUnsafe<Array<{ topicId: string; median: number | null }>>(
      `SELECT lit."topicId",
              percentile_cont(0.5) WITHIN GROUP (ORDER BY COALESCE(per_user.mins, 0)) AS median
       FROM (SELECT DISTINCT "topicId" FROM "LibraryItemTopic") AS lit
       CROSS JOIN unnest($1::text[]) AS u("userId")
       LEFT JOIN (
         -- Dedup to one canonical row per (user, material) BEFORE joining topics,
         -- so a material covering K topics and completed across N weeks adds its
         -- minutes once per topic, not N times.
         SELECT canon."userId", lit2."topicId", SUM(canon.mins)::int AS mins
         FROM (
           SELECT DISTINCT ON (wp."userId", wpi."libraryItemId")
                  wp."userId", wpi."libraryItemId",
                  COALESCE(wpi."actualMinutes", wpi."scheduledMinutes", li."estimatedMinutes", 0) AS mins
           FROM "WeeklyPlanItem" wpi
           JOIN "WeeklyPlan" wp ON wp.id = wpi."weeklyPlanId"
           JOIN "LibraryItem" li ON li.id = wpi."libraryItemId"
           WHERE wp."cycleId" = $2
             AND wp."userId" = ANY($1::text[])
             AND wpi."outcome" <> 'PENDING'
           -- Prefer the earliest POSITIVE row (match canonicalCompletions);
           -- fall back to earliest non-PENDING only when never positive.
           ORDER BY wp."userId", wpi."libraryItemId",
                    (CASE WHEN wpi."outcome" IN ('DONE_EASY','DONE_HARD','DOUBTS','SKIPPED') THEN 0 ELSE 1 END) ASC,
                    wpi."completedAt" ASC NULLS LAST
         ) canon
         JOIN "LibraryItemTopic" lit2 ON lit2."itemId" = canon."libraryItemId"
         GROUP BY canon."userId", lit2."topicId"
       ) AS per_user ON per_user."userId" = u."userId" AND per_user."topicId" = lit."topicId"
       GROUP BY lit."topicId"`,
      cohortIds, cycleId,
    );
    const byTopic = new Map<string, number>(
      topicRows.map((r) => [r.topicId, Math.round(r.median ?? 0)]),
    );

    // --- engagement median: compute score per cohort user with their metrics, then median in JS ---
    // We gather per-user metrics from the queries above for a simplified per-user score.
    // Using a single query to get all metrics per cohort user.
    const userMetricsRows = await this.prisma.$queryRawUnsafe<Array<{
      userId: string;
      sessions: number;
      daysActive: number;
      daysStudying: number;
      daysCompleted: number;
      itemsDone: number;
      itemsPlanned: number;
      retrosSubmitted: number;
    }>>(
      `SELECT
         u."userId",
         COALESCE(ev_sess.cnt, 0)        AS sessions,
         COALESCE(ev_days.cnt, 0)        AS "daysActive",
         COALESCE(ev_study.cnt, 0)       AS "daysStudying",
         COALESCE(wp_done_days.cnt, 0)   AS "daysCompleted",
         COALESCE(wp_done.cnt, 0)        AS "itemsDone",
         COALESCE(wp_plan.cnt, 0)        AS "itemsPlanned",
         COALESCE(retro.cnt, 0)          AS "retrosSubmitted"
       FROM unnest($1::text[]) AS u("userId")
       LEFT JOIN (
         SELECT "userId", COUNT(*)::int AS cnt FROM "UserEvent"
         WHERE "userId" = ANY($1::text[]) AND "type" = 'SESSION_START' AND "occurredAt" BETWEEN $2 AND $3
         GROUP BY "userId"
       ) ev_sess ON ev_sess."userId" = u."userId"
       LEFT JOIN (
         SELECT "userId", COUNT(DISTINCT date_trunc('day', "occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'))::int AS cnt FROM "UserEvent"
         WHERE "userId" = ANY($1::text[]) AND "occurredAt" BETWEEN $2 AND $3
         GROUP BY "userId"
       ) ev_days ON ev_days."userId" = u."userId"
       LEFT JOIN (
         SELECT "userId", COUNT(DISTINCT date_trunc('day', "occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'))::int AS cnt FROM "UserEvent"
         WHERE "userId" = ANY($1::text[]) AND "type" = 'OUTCOME_MARKED' AND "occurredAt" BETWEEN $2 AND $3
         GROUP BY "userId"
       ) ev_study ON ev_study."userId" = u."userId"
       LEFT JOIN (
         SELECT wp."userId",
                COUNT(DISTINCT date_trunc('day', wpi."completedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'America/Sao_Paulo'))::int AS cnt
         FROM "WeeklyPlanItem" wpi JOIN "WeeklyPlan" wp ON wp.id = wpi."weeklyPlanId"
         WHERE wp."cycleId" = $4 AND wp."userId" = ANY($1::text[])
           AND wpi."completedAt" IS NOT NULL
           AND wpi."completedAt" BETWEEN $2 AND $3
         GROUP BY wp."userId"
       ) wp_done_days ON wp_done_days."userId" = u."userId"
       LEFT JOIN (
         SELECT wp."userId", COUNT(DISTINCT wpi."libraryItemId")::int AS cnt
         FROM "WeeklyPlanItem" wpi JOIN "WeeklyPlan" wp ON wp.id = wpi."weeklyPlanId"
         WHERE wp."cycleId" = $4 AND wp."userId" = ANY($1::text[]) AND wpi."outcome" <> 'PENDING'
         GROUP BY wp."userId"
       ) wp_done ON wp_done."userId" = u."userId"
       LEFT JOIN (
         SELECT wp."userId", COUNT(DISTINCT wpi."libraryItemId")::int AS cnt
         FROM "WeeklyPlanItem" wpi JOIN "WeeklyPlan" wp ON wp.id = wpi."weeklyPlanId"
         WHERE wp."cycleId" = $4 AND wp."userId" = ANY($1::text[])
         GROUP BY wp."userId"
       ) wp_plan ON wp_plan."userId" = u."userId"
       LEFT JOIN (
         SELECT "userId", COUNT(*)::int AS cnt FROM "WeeklyRetro"
         WHERE "cycleId" = $4 AND "userId" = ANY($1::text[])
         GROUP BY "userId"
       ) retro ON retro."userId" = u."userId"`,
      cohortIds, cycleStart, now, cycleId,
    );
    const daysElapsed = Math.max(1, Math.floor((now.getTime() - cycleStart.getTime()) / DAY_MS));
    const weeksElapsed = Math.max(1, Math.ceil(daysElapsed / 7));
    // Median of per-user itemsPlanned across the cohort. Used both to score
    // the target member fairly (max(personalRate, normalizedToCohortRate))
    // and to feed the per-cohort-user score replays below.
    const plannedSorted = [...userMetricsRows]
      .map((r) => Number(r.itemsPlanned))
      .sort((a, b) => a - b);
    let itemsPlannedMedian = 0;
    if (plannedSorted.length > 0) {
      const midP = Math.floor(plannedSorted.length / 2);
      itemsPlannedMedian = Math.round(
        plannedSorted.length % 2 === 0
          ? (plannedSorted[midP - 1]! + plannedSorted[midP]!) / 2
          : plannedSorted[midP]!,
      );
    }
    const cohortScores = userMetricsRows.map((row) =>
      computeEngagementScore({
        cohortRankFromBottom: Math.floor(cohortIds.length / 2), // simplified: mid-rank for each user
        cohortSize: cohortIds.length,
        daysActive: Number(row.daysCompleted),
        daysElapsed,
        itemsDone: Number(row.itemsDone),
        itemsPlanned: Number(row.itemsPlanned),
        retrosSubmitted: Number(row.retrosSubmitted),
        weeksElapsed,
        daysSinceLastSession: null, // no per-user last-session in this batch query; neutral
        classesAttended: 0, // simplified: class data not fetched per-user in this batch; neutral
        classesHeld: 0,
      }).score,
    );
    let engagementMedian = 0;
    if (cohortScores.length > 0) {
      const sorted = [...cohortScores].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      engagementMedian = Math.round(
        sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!,
      );
    }

    return {
      engagement: engagementMedian,
      sessions: sessionsMedian,
      daysActive: daysActiveMedian,
      daysStudying: daysStudyingMedian,
      itemsDone: itemsDoneMedian,
      itemsPlanned: itemsPlannedMedian,
      minutes: minutesMedian,
      carryOver: carryOverMedian,
      classAttendance: classAttMedian,
      byTopic,
    };
  }

  private async scoreByWeek(
    memberId: string,
    cycle: { id: string; startsAt: Date; endsAt: Date },
    weeksElapsed: number,
    cohortIds: string[],
    now: Date,
  ): Promise<number[]> {
    const cycleStart = mondayUTC(cycle.startsAt);

    // Load all plans and retros once; slice per week below.
    const [memberPlans, memberRetros] = await Promise.all([
      this.prisma.weeklyPlan.findMany({
        where: { userId: memberId, cycleId: cycle.id },
        select: {
          weekStart: true,
          items: { select: { outcome: true, libraryItemId: true, completedAt: true } },
        },
      }),
      this.prisma.weeklyRetro.findMany({
        where: { userId: memberId, cycleId: cycle.id },
        select: { weekStart: true },
      }),
    ]);

    // Cohort rank is held constant at current rank for all historical weeks.
    // Recomputing per-week ranks would require N×W additional queries and is
    // not worth the cost for the sparkline use-case. Documented simplification.
    const cohortRankFromBottom = cohortIds.length === 0 ? 0 : Math.floor(cohortIds.length / 2);

    // One canonical completion per material (earliest positive). Cumulative
    // itemsDone below counts by WHEN it was actually completed (completedAt),
    // so a carried item re-marked in later weeks doesn't recount.
    const canonAll = canonicalCompletions(memberPlans.flatMap((p) => p.items));

    const out: number[] = [];
    for (let w = 1; w <= weeksElapsed; w++) {
      const weekEnd = new Date(cycleStart.getTime() + w * WEEK_MS);
      const effectiveEnd = weekEnd < now ? weekEnd : now;
      const daysElapsed = Math.max(
        1,
        Math.floor((effectiveEnd.getTime() - cycleStart.getTime()) / DAY_MS),
      );

      const plansUpToWeek = memberPlans.filter((p) => p.weekStart < weekEnd);
      // itemsDone = distinct materials actually completed (completedAt) by the
      // end of this week; itemsPlanned = distinct materials assigned by then.
      const itemsDone = canonAll.filter(
        (r) => r.completedAt && r.completedAt.getTime() < weekEnd.getTime(),
      ).length;
      const itemsPlanned = new Set(plansUpToWeek.flatMap((p) => p.items).map((i) => i.libraryItemId)).size;
      const retrosSubmitted = memberRetros.filter((r) => r.weekStart < weekEnd).length;

      const daysActive = await this.distinctDaysOfEvents(memberId, cycleStart, effectiveEnd);

      const lastEvent = await this.prisma.userEvent.findFirst({
        where: { userId: memberId, occurredAt: { lte: effectiveEnd } },
        orderBy: { occurredAt: 'desc' },
        select: { occurredAt: true },
      });
      const daysSinceLastSession: number | null = lastEvent
        ? Math.floor((effectiveEnd.getTime() - lastEvent.occurredAt.getTime()) / DAY_MS)
        : null;

      const score = computeEngagementScore({
        cohortRankFromBottom,
        cohortSize: cohortIds.length,
        daysActive,
        daysElapsed,
        itemsDone,
        itemsPlanned,
        retrosSubmitted,
        weeksElapsed: w,
        daysSinceLastSession,
        classesAttended: 0, // simplified: per-week attendance replay not fetched; neutral
        classesHeld: 0,
      });
      out.push(score.score);
    }

    return out;
  }
}

// --- pure helpers ---

function countByOutcome(outcomes: ItemOutcome[]): Record<ItemOutcome, number> {
  const out = { ...ZERO_OUTCOMES };
  for (const o of outcomes) out[o] += 1;
  return out;
}

type PlanLike = {
  id: string;
  weekStart: Date;
  publishedAt: Date | null;
  items: Array<{
    libraryItemId: string;
    outcome: ItemOutcome;
    completedAt?: Date | null;
    scheduledMinutes: number | null;
    actualMinutes: number | null;
    carriedFromItemId?: string | null;
    libraryItem?: {
      estimatedMinutes?: number;
      topics: Array<{ topicId: string; isPrimary: boolean }>;
    };
  }>;
};

/**
 * Flatten every plan-item, then keep one canonical completion per material
 * (earliest positive). A material carried + completed across weeks counts once,
 * carrying its `completedAt` so callers can bucket it by WHEN it was actually
 * done (not the plan's assigned week) — re-marking a carried duplicate later
 * doesn't recount it.
 */
function canonicalItemsByWeek(plans: PlanLike[]) {
  const flat = plans.flatMap((p) =>
    p.items.map((it) => ({
      libraryItemId: it.libraryItemId,
      outcome: it.outcome,
      completedAt: it.completedAt ?? null,
      minutes: it.actualMinutes ?? it.scheduledMinutes ?? it.libraryItem?.estimatedMinutes ?? 0,
    })),
  );
  return canonicalCompletions(flat);
}

/**
 * Cycle-week index (0-based) a completion falls into, by `completedAt` relative
 * to the cycle's first Monday — so the per-week chart reflects WHEN the member
 * actually did the work, matching daysActive/streak. Clamped into range; null
 * when there is no completion date.
 */
function weekIndexOfCompletion(
  completedAt: Date | null | undefined,
  cycleStart: Date,
  weeksElapsed: number,
): number | null {
  if (!completedAt) return null;
  const idx = Math.floor((completedAt.getTime() - cycleStart.getTime()) / WEEK_MS);
  if (idx < 0) return 0;
  if (idx >= weeksElapsed) return weeksElapsed - 1;
  return idx;
}

function bucketPerWeek(plans: PlanLike[], weeksElapsed: number, cycleStart: Date) {
  const canon = canonicalItemsByWeek(plans);
  const buckets = Array.from({ length: weeksElapsed }, (_, i) => ({
    weekStart: new Date(cycleStart.getTime() + i * WEEK_MS).toISOString(),
    byOutcome: { ...ZERO_OUTCOMES },
  }));
  for (const r of canon) {
    const idx = weekIndexOfCompletion(r.completedAt, cycleStart, weeksElapsed);
    if (idx === null) continue;
    buckets[idx]!.byOutcome[r.outcome] += 1;
  }
  return buckets;
}

function bucketMinutesPerWeek(
  plans: PlanLike[],
  weeksElapsed: number,
  cycleStart: Date,
): number[] {
  const canon = canonicalItemsByWeek(plans);
  const out = Array.from({ length: weeksElapsed }, () => 0);
  for (const r of canon) {
    const idx = weekIndexOfCompletion(r.completedAt, cycleStart, weeksElapsed);
    if (idx === null) continue;
    out[idx]! += r.minutes;
  }
  return out;
}

// Test seam for the per-week bucketing dedup.
export const bucketPerWeekForTest = bucketPerWeek;

function bucketCarryPerWeek(
  plans: PlanLike[],
  weeksElapsed: number,
  cycleStart: Date,
): number[] {
  return Array.from({ length: weeksElapsed }, (_, i) => {
    const weekStart = new Date(cycleStart.getTime() + i * WEEK_MS);
    const planThisWeek = plans.find((p) => p.weekStart.getTime() === weekStart.getTime());
    if (!planThisWeek) return 0;
    return planThisWeek.items.filter((it) => it.carriedFromItemId).length;
  });
}

async function arrayPerWeek<T>(
  weeksElapsed: number,
  fn: (start: Date, end: Date) => Promise<T>,
  cycleStart: Date,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < weeksElapsed; i++) {
    const start = new Date(cycleStart.getTime() + i * WEEK_MS);
    const end = new Date(start.getTime() + WEEK_MS);
    out.push(await fn(start, end));
  }
  return out;
}

function computeTopicEngagement(
  topics: Array<{ id: string; label: string; order: number }>,
  items: Array<{
    libraryItemId: string;
    outcome: ItemOutcome;
    completedAt?: Date | null;
    scheduledMinutes: number | null;
    actualMinutes: number | null;
    libraryItem?: { estimatedMinutes?: number; topics: Array<{ topicId: string; isPrimary: boolean }> };
  }>,
  cohortByTopic: Map<string, number>,
) {
  const minutesOf = (i: (typeof items)[number]) =>
    i.actualMinutes ?? i.scheduledMinutes ?? i.libraryItem?.estimatedMinutes ?? 0;

  // Dedup carried completions before tallying: a material studied across N weeks
  // counts (and contributes its minutes) once.
  const totalMinutes = canonicalCompletions(items).reduce((s, i) => s + minutesOf(i), 0);

  return topics.map((topic) => {
    const itemsForTopic = items.filter((i) =>
      i.libraryItem?.topics.some((t) => t.topicId === topic.id),
    );
    const completed = canonicalCompletions(itemsForTopic);
    const minutes = completed.reduce((s, i) => s + minutesOf(i), 0);
    const pctOfTotal = totalMinutes === 0 ? 0 : Math.round((minutes / totalMinutes) * 100);
    return {
      topicId: topic.id,
      label: topic.label,
      minutes,
      pctOfTotal,
      itemsDone: completed.length,
      itemsPlanned: new Set(itemsForTopic.map((i) => i.libraryItemId)).size,
      cohortMedianMinutes: cohortByTopic.get(topic.id) ?? 0,
    };
  });
}

function extractSurface(meta: unknown): string | null {
  if (typeof meta !== 'object' || meta === null) return null;
  const m = meta as { surface?: unknown };
  return typeof m.surface === 'string' ? m.surface : null;
}

function labelEvent(type: UserEventType, meta: unknown): string {
  switch (type) {
    case 'SESSION_START':
      return 'Opened the platform';
    case 'PLAN_VIEW':
      return 'Viewed plan';
    case 'ITEM_VIEW':
      return 'Viewed item';
    case 'OUTCOME_MARKED': {
      const m = meta as { outcome?: string };
      return `Marked outcome (${m.outcome ?? '?'})`;
    }
    case 'RETRO_SUBMITTED':
      return 'Submitted retro';
    case 'AVAILABILITY_SAVED':
      return 'Updated availability';
  }
}

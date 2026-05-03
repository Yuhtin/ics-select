import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  computeWeekPosition,
  resolveActiveMembership,
} from '../../common/cycle/active-cycle.js';
import type { ItemOutcome, UserEventType } from '@ics-select/prisma';
import { computeEngagementScore } from './engagement-score.js';
import { classifyRisk } from './risk-thresholds.js';
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
    const cohortIds = (
      await this.prisma.cycleMembership.findMany({
        where: { cycleId: cycle.id, NOT: { userId: memberId } },
        select: { userId: true },
      })
    ).map((m) => m.userId);

    const [plans, retros, classes, lastEvent, recent, topics] = await Promise.all([
      this.prisma.weeklyPlan.findMany({
        where: { userId: memberId, cycleId: cycle.id },
        select: {
          id: true,
          weekStart: true,
          publishedAt: true,
          items: {
            include: {
              libraryItem: {
                select: { topics: { select: { topicId: true, isPrimary: true } } },
              },
            },
          },
        },
        orderBy: { weekStart: 'asc' },
      }),
      this.prisma.weeklyRetro.findMany({
        where: { userId: memberId, cycleId: cycle.id },
        orderBy: { submittedAt: 'desc' },
      }),
      this.prisma.classSession.findMany({
        where: { cycleId: cycle.id },
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

    // Items aggregates
    const allItems = plans.flatMap((p) => p.items);
    const completed = allItems.filter((i) => i.outcome !== 'PENDING');
    const byOutcome = countByOutcome(completed.map((i) => i.outcome));
    const perWeekItems = bucketPerWeek(plans, weeksElapsed, cycleStart);
    const needsAttention = {
      total: byOutcome.STUCK + byOutcome.DOUBTS,
      stuck: byOutcome.STUCK,
      doubts: byOutcome.DOUBTS,
    };

    // Time invested
    const actualMinutes = completed.reduce(
      (sum, i) => sum + (i.actualMinutes ?? i.scheduledMinutes ?? 0),
      0,
    );
    const scheduledMinutes = allItems.reduce((sum, i) => sum + (i.scheduledMinutes ?? 0), 0);
    const naoSeiCount = completed.filter(
      (i) => i.actualMinutes === null && (i.scheduledMinutes ?? 0) > 0,
    ).length;
    const perWeekMinutes = bucketMinutesPerWeek(plans, weeksElapsed, cycleStart);

    // Cohort medians (per-metric SQL — percentile_cont across cohort users)
    const cohortMedians = await this.computeCohortMedians(
      cohortIds,
      cycle.id,
      cycleStart,
      now,
    );

    // Behavior
    const daysActive = await this.distinctDaysOfEvents(memberId, cycleStart, now);
    const daysStudying = await this.distinctDaysOfOutcomeMarks(
      memberId,
      cycle.id,
      cycleStart,
      now,
    );
    const sessions = await this.countSessions(memberId, cycleStart, now);
    const ttfvMedianHours = computeTtfvMedian(plans, await this.firstViewByPlan(memberId));
    const carryOver = allItems.filter((i) => i.carriedFromItemId !== null).length;

    const sessionsPerWeek = await this.sessionsPerWeek(memberId, weeksElapsed, cycleStart);
    const daysActivePerWeek = await this.daysActivePerWeek(memberId, weeksElapsed, cycleStart);
    const daysStudyingPerWeek = await this.daysStudyingPerWeek(
      memberId,
      cycle.id,
      weeksElapsed,
      cycleStart,
    );
    const carryOverPerWeek = bucketCarryPerWeek(plans, weeksElapsed, cycleStart);

    // Null when the member has no events recorded yet (either never used the
    // platform or activity capture only just deployed). classifyRisk and
    // computeEngagementScore both skip the session criterion when this is null —
    // we want "no data yet" to look neutral, not catastrophic.
    const daysSinceLastSession: number | null = lastEvent
      ? Math.floor((now.getTime() - lastEvent.occurredAt.getTime()) / DAY_MS)
      : null;

    const cohortRankPct = await this.cohortRankPct(
      memberId,
      cohortIds,
      cycle.id,
      daysElapsed,
    );
    const cohortRankFromBottom = Math.round(cohortRankPct * cohortIds.length);

    // Engagement score
    const engagement = computeEngagementScore({
      cohortRankFromBottom,
      cohortSize: cohortIds.length,
      daysActive,
      daysElapsed,
      itemsDone: completed.length,
      itemsPlanned: allItems.length,
      retrosSubmitted: retros.length,
      weeksElapsed,
      ttfvMedianHours,
      daysSinceLastSession,
    });

    const scoreByWeek = await this.scoreByWeek(memberId, cycle, weeksElapsed, cohortIds, now);

    // Risk
    const completionRate = allItems.length === 0 ? 0 : completed.length / allItems.length;
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
      engagement: {
        score: engagement.score,
        cohortMedian: cohortMedians.engagement,
        breakdown: engagement.breakdown,
        scoreByWeek,
      },
      itemsCompleted: {
        total: completed.length,
        planned: allItems.length,
        completionPct: Math.round(completionRate * 100),
        cohortMedian: cohortMedians.itemsDone,
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
        daysActive: { value: daysActive, cycleDays: daysElapsed, cohortMedian: cohortMedians.daysActive, perWeek: daysActivePerWeek },
        daysStudying: { value: daysStudying, cycleDays: daysElapsed, cohortMedian: cohortMedians.daysStudying, perWeek: daysStudyingPerWeek },
        timeToFirstView: { medianHours: ttfvMedianHours, cohortMedianHours: cohortMedians.ttfv, perWeek: [] },
        retros: { submitted: retros.length, expected: weeksElapsed },
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
        timeToFirstView: { medianHours: 0, cohortMedianHours: 0, perWeek: [] },
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
      `SELECT DISTINCT date_trunc('day', "occurredAt") AS d
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
      `SELECT DISTINCT date_trunc('day', e."occurredAt") AS d
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

  private async firstViewByPlan(userId: string): Promise<Map<string, Date>> {
    const rows = await this.prisma.$queryRawUnsafe<Array<{ planId: string; first: Date }>>(
      `SELECT meta->>'planId' AS "planId", MIN("occurredAt") AS first
       FROM "UserEvent" WHERE "userId" = $1 AND "type" = 'PLAN_VIEW' AND meta->>'planId' IS NOT NULL
       GROUP BY meta->>'planId'`,
      userId,
    );
    return new Map(rows.map((r) => [r.planId, r.first]));
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
          `SELECT DISTINCT date_trunc('day', "occurredAt") AS d FROM "UserEvent" WHERE "userId" = $1 AND "occurredAt" >= $2 AND "occurredAt" < $3`,
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
          `SELECT DISTINCT date_trunc('day', "occurredAt") AS d FROM "UserEvent" WHERE "userId" = $1 AND "type" = 'OUTCOME_MARKED' AND "occurredAt" >= $2 AND "occurredAt" < $3`,
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
    _cycleId: string,
    _daysElapsed: number,
  ): Promise<number> {
    if (cohortIds.length === 0) return 1;
    const allIds = [memberId, ...cohortIds];
    const rows = await this.prisma.$queryRawUnsafe<Array<{ userId: string; done: bigint }>>(
      `SELECT wp."userId", SUM(CASE WHEN wpi."outcome" <> 'PENDING' THEN 1 ELSE 0 END) AS done
       FROM "WeeklyPlanItem" wpi
       JOIN "WeeklyPlan" wp ON wp.id = wpi."weeklyPlanId"
       WHERE wp."userId" = ANY($1::text[])
       GROUP BY wp."userId"`,
      allIds,
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
      ttfv: 0,
      itemsDone: 0,
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
         SELECT "userId", COUNT(DISTINCT date_trunc('day', "occurredAt"))::int AS cnt
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
         SELECT "userId", COUNT(DISTINCT date_trunc('day', "occurredAt"))::int AS cnt
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
         SELECT wp."userId", COUNT(*)::int AS cnt
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
         SELECT wp."userId", SUM(COALESCE(wpi."actualMinutes", wpi."scheduledMinutes", 0))::int AS mins
         FROM "WeeklyPlanItem" wpi
         JOIN "WeeklyPlan" wp ON wp.id = wpi."weeklyPlanId"
         WHERE wp."cycleId" = $2
           AND wp."userId" = ANY($1::text[])
           AND wpi."outcome" <> 'PENDING'
         GROUP BY wp."userId"
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
         SELECT wp."userId", lit2."topicId",
                SUM(COALESCE(wpi."actualMinutes", wpi."scheduledMinutes", 0))::int AS mins
         FROM "WeeklyPlanItem" wpi
         JOIN "WeeklyPlan" wp ON wp.id = wpi."weeklyPlanId"
         JOIN "LibraryItemTopic" lit2 ON lit2."itemId" = wpi."libraryItemId"
         WHERE wp."cycleId" = $2
           AND wp."userId" = ANY($1::text[])
           AND wpi."outcome" <> 'PENDING'
         GROUP BY wp."userId", lit2."topicId"
       ) AS per_user ON per_user."userId" = u."userId" AND per_user."topicId" = lit."topicId"
       GROUP BY lit."topicId"`,
      cohortIds, cycleId,
    );
    const byTopic = new Map<string, number>(
      topicRows.map((r) => [r.topicId, Math.round(r.median ?? 0)]),
    );

    // --- TTFv median: median of (firstView - publishedAt) hours per cohort user ---
    // For each cohort user: gather their plans' first PLAN_VIEW events, compute hours,
    // then take median across users (median of per-user medians).
    const ttfvRows = await this.prisma.$queryRawUnsafe<Array<{ hours: number | null }>>(
      `SELECT EXTRACT(EPOCH FROM (MIN(e."occurredAt") - wp."publishedAt")) / 3600.0 AS hours
       FROM "UserEvent" e
       JOIN "WeeklyPlan" wp ON wp.id = (e.meta->>'planId')
       WHERE e."userId" = ANY($1::text[])
         AND e."type" = 'PLAN_VIEW'
         AND e.meta->>'planId' IS NOT NULL
         AND wp."publishedAt" IS NOT NULL
         AND wp."userId" = ANY($1::text[])
         AND wp."cycleId" = $2
       GROUP BY e."userId", wp.id
       HAVING MIN(e."occurredAt") >= wp."publishedAt"`,
      cohortIds, cycleId,
    );
    let ttfvMedian = 0;
    if (ttfvRows.length > 0) {
      const hours = ttfvRows.map((r) => r.hours ?? 0).sort((a, b) => a - b);
      const mid = Math.floor(hours.length / 2);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      ttfvMedian = Math.round(
        hours.length % 2 === 0 ? (hours[mid - 1]! + hours[mid]!) / 2 : hours[mid]!,
      );
    }

    // --- engagement median: compute score per cohort user with their metrics, then median in JS ---
    // We gather per-user metrics from the queries above for a simplified per-user score.
    // Using a single query to get all metrics per cohort user.
    const userMetricsRows = await this.prisma.$queryRawUnsafe<Array<{
      userId: string;
      sessions: number;
      daysActive: number;
      daysStudying: number;
      itemsDone: number;
      itemsPlanned: number;
      retrosSubmitted: number;
    }>>(
      `SELECT
         u."userId",
         COALESCE(ev_sess.cnt, 0)   AS sessions,
         COALESCE(ev_days.cnt, 0)   AS "daysActive",
         COALESCE(ev_study.cnt, 0)  AS "daysStudying",
         COALESCE(wp_done.cnt, 0)   AS "itemsDone",
         COALESCE(wp_plan.cnt, 0)   AS "itemsPlanned",
         COALESCE(retro.cnt, 0)     AS "retrosSubmitted"
       FROM unnest($1::text[]) AS u("userId")
       LEFT JOIN (
         SELECT "userId", COUNT(*)::int AS cnt FROM "UserEvent"
         WHERE "userId" = ANY($1::text[]) AND "type" = 'SESSION_START' AND "occurredAt" BETWEEN $2 AND $3
         GROUP BY "userId"
       ) ev_sess ON ev_sess."userId" = u."userId"
       LEFT JOIN (
         SELECT "userId", COUNT(DISTINCT date_trunc('day', "occurredAt"))::int AS cnt FROM "UserEvent"
         WHERE "userId" = ANY($1::text[]) AND "occurredAt" BETWEEN $2 AND $3
         GROUP BY "userId"
       ) ev_days ON ev_days."userId" = u."userId"
       LEFT JOIN (
         SELECT "userId", COUNT(DISTINCT date_trunc('day', "occurredAt"))::int AS cnt FROM "UserEvent"
         WHERE "userId" = ANY($1::text[]) AND "type" = 'OUTCOME_MARKED' AND "occurredAt" BETWEEN $2 AND $3
         GROUP BY "userId"
       ) ev_study ON ev_study."userId" = u."userId"
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
       ) retro ON retro."userId" = u."userId"`,
      cohortIds, cycleStart, now, cycleId,
    );
    const daysElapsed = Math.max(1, Math.floor((now.getTime() - cycleStart.getTime()) / DAY_MS));
    const weeksElapsed = Math.max(1, Math.ceil(daysElapsed / 7));
    const cohortScores = userMetricsRows.map((row) =>
      computeEngagementScore({
        cohortRankFromBottom: Math.floor(cohortIds.length / 2), // simplified: mid-rank for each user
        cohortSize: cohortIds.length,
        daysActive: Number(row.daysActive),
        daysElapsed,
        itemsDone: Number(row.itemsDone),
        itemsPlanned: Number(row.itemsPlanned),
        retrosSubmitted: Number(row.retrosSubmitted),
        weeksElapsed,
        ttfvMedianHours: ttfvMedian,
        daysSinceLastSession: null, // no per-user last-session in this batch query; neutral
      }).score,
    );
    let engagementMedian = 0;
    if (cohortScores.length > 0) {
      const sorted = [...cohortScores].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      engagementMedian = Math.round(
        sorted.length % 2 === 0 ? (sorted[mid - 1]! + sorted[mid]!) / 2 : sorted[mid]!,
      );
    }

    return {
      engagement: engagementMedian,
      sessions: sessionsMedian,
      daysActive: daysActiveMedian,
      daysStudying: daysStudyingMedian,
      ttfv: ttfvMedian,
      itemsDone: itemsDoneMedian,
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
        select: { weekStart: true, items: { select: { outcome: true } } },
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

    const out: number[] = [];
    for (let w = 1; w <= weeksElapsed; w++) {
      const weekEnd = new Date(cycleStart.getTime() + w * WEEK_MS);
      const effectiveEnd = weekEnd < now ? weekEnd : now;
      const daysElapsed = Math.max(
        1,
        Math.floor((effectiveEnd.getTime() - cycleStart.getTime()) / DAY_MS),
      );

      const plansUpToWeek = memberPlans.filter((p) => p.weekStart < weekEnd);
      const itemsDone = plansUpToWeek
        .flatMap((p) => p.items)
        .filter((i) => i.outcome !== 'PENDING').length;
      const itemsPlanned = plansUpToWeek.reduce((s, p) => s + p.items.length, 0);
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
        ttfvMedianHours: 0, // omitted for per-week sparkline (cheap simplification)
        daysSinceLastSession,
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
    outcome: ItemOutcome;
    scheduledMinutes: number | null;
    actualMinutes: number | null;
    carriedFromItemId?: string | null;
    libraryItem?: { topics: Array<{ topicId: string; isPrimary: boolean }> };
  }>;
};

function bucketPerWeek(plans: PlanLike[], weeksElapsed: number, cycleStart: Date) {
  const buckets: Array<{ weekStart: string; byOutcome: Record<ItemOutcome, number> }> = [];
  for (let i = 0; i < weeksElapsed; i++) {
    const weekStart = new Date(cycleStart.getTime() + i * WEEK_MS);
    const byOutcome = { ...ZERO_OUTCOMES };
    const planThisWeek = plans.find((p) => p.weekStart.getTime() === weekStart.getTime());
    if (planThisWeek) {
      for (const item of planThisWeek.items) {
        if (item.outcome !== 'PENDING') byOutcome[item.outcome] += 1;
      }
    }
    buckets.push({ weekStart: weekStart.toISOString(), byOutcome });
  }
  return buckets;
}

function bucketMinutesPerWeek(
  plans: PlanLike[],
  weeksElapsed: number,
  cycleStart: Date,
): number[] {
  return Array.from({ length: weeksElapsed }, (_, i) => {
    const weekStart = new Date(cycleStart.getTime() + i * WEEK_MS);
    const planThisWeek = plans.find((p) => p.weekStart.getTime() === weekStart.getTime());
    if (!planThisWeek) return 0;
    return planThisWeek.items
      .filter((it) => it.outcome !== 'PENDING')
      .reduce((s, it) => s + (it.actualMinutes ?? it.scheduledMinutes ?? 0), 0);
  });
}

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

function computeTtfvMedian(plans: PlanLike[], firstViewByPlan: Map<string, Date>): number {
  const hoursPerPlan: number[] = [];
  for (const plan of plans) {
    if (!plan.publishedAt || !plan.id) continue;
    const firstView = firstViewByPlan.get(plan.id);
    if (!firstView) continue;
    const hours = (firstView.getTime() - plan.publishedAt.getTime()) / 3_600_000;
    if (hours >= 0) hoursPerPlan.push(hours);
  }
  if (hoursPerPlan.length === 0) return 0;
  hoursPerPlan.sort((a, b) => a - b);
  const mid = Math.floor(hoursPerPlan.length / 2);
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  const median =
    hoursPerPlan.length % 2 === 0
      ? (hoursPerPlan[mid - 1]! + hoursPerPlan[mid]!) / 2
      : hoursPerPlan[mid]!;
  return Math.round(median);
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
    outcome: ItemOutcome;
    scheduledMinutes: number | null;
    actualMinutes: number | null;
    libraryItem?: { topics: Array<{ topicId: string; isPrimary: boolean }> };
  }>,
  cohortByTopic: Map<string, number>,
) {
  const totalMinutes = items
    .filter((i) => i.outcome !== 'PENDING')
    .reduce((s, i) => s + (i.actualMinutes ?? i.scheduledMinutes ?? 0), 0);

  return topics.map((topic) => {
    const itemsForTopic = items.filter((i) =>
      i.libraryItem?.topics.some((t) => t.topicId === topic.id),
    );
    const completed = itemsForTopic.filter((i) => i.outcome !== 'PENDING');
    const minutes = completed.reduce(
      (s, i) => s + (i.actualMinutes ?? i.scheduledMinutes ?? 0),
      0,
    );
    const pctOfTotal = totalMinutes === 0 ? 0 : Math.round((minutes / totalMinutes) * 100);
    return {
      topicId: topic.id,
      label: topic.label,
      minutes,
      pctOfTotal,
      itemsDone: completed.length,
      itemsPlanned: itemsForTopic.length,
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

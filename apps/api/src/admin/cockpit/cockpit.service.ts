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
        include: {
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

    // Cohort medians (per-metric SQL — defer real impl; spec uses percentile_cont)
    const cohortMedians = await this.computeCohortMedians(
      cohortIds,
      cycle.id,
      weeksElapsed,
      daysElapsed,
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

    const daysSinceLastSession = lastEvent
      ? Math.floor((now.getTime() - lastEvent.occurredAt.getTime()) / DAY_MS)
      : 999;

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

    const scoreByWeek = await this.scoreByWeek(memberId, cycle, weeksElapsed, cohortIds);

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

  // TODO: real impl pending — placeholder returns reasonable defaults
  private async computeCohortMedians(
    cohortIds: string[],
    _cycleId: string,
    _weeksElapsed: number,
    _daysElapsed: number,
  ) {
    if (cohortIds.length === 0) {
      return {
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
    }
    return {
      engagement: 60,
      sessions: 16,
      daysActive: 12,
      daysStudying: 11,
      ttfv: 4,
      itemsDone: 16,
      minutes: 22 * 60,
      carryOver: 1,
      classAttendance: 5,
      byTopic: new Map<string, number>(),
    };
  }

  // TODO: real impl pending — placeholder returns reasonable defaults
  private async scoreByWeek(
    _memberId: string,
    _cycle: { id: string; startsAt: Date; endsAt: Date },
    weeksElapsed: number,
    _cohortIds: string[],
  ): Promise<number[]> {
    return Array.from({ length: weeksElapsed }, (_, i) => Math.max(0, 70 - i * 8));
  }
}

// --- pure helpers ---

function countByOutcome(outcomes: ItemOutcome[]): Record<ItemOutcome, number> {
  const out = { ...ZERO_OUTCOMES };
  for (const o of outcomes) out[o] += 1;
  return out;
}

type PlanLike = {
  weekStart: Date;
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

// TODO: real impl pending — placeholder returns reasonable defaults
function computeTtfvMedian(plans: PlanLike[], _firstViewByPlan: Map<string, Date>): number {
  // Without persisted publishedAt + first view, return placeholder. Real impl:
  // for each plan with publishedAt, compute (firstView - publishedAt) hours, then median.
  if (plans.length === 0) return 0;
  return 0;
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

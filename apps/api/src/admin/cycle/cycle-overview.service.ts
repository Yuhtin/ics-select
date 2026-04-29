import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { computeWeekPosition } from '../../common/cycle/active-cycle.js';

import {
  type ItemOutcome,
  isPositiveOutcome,
  sumAllocatedMinutes,
} from '@ics-select/shared';

const DEFAULT_AVAILABILITY = {
  mondayMinutes: 60,
  tuesdayMinutes: 60,
  wednesdayMinutes: 60,
  thursdayMinutes: 60,
  fridayMinutes: 60,
  saturdayMinutes: 0,
  sundayMinutes: 0,
};

const POSITIVE = new Set<ItemOutcome>(['DONE_EASY', 'DONE_HARD', 'SKIPPED']);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const STUCK_PROXY_WINDOW_MS = 72 * 60 * 60 * 1000;
const FEED_WINDOW_DAYS = 7;

export type CycleOverviewResponse = {
  cycle: {
    id: string;
    name: string;
    startsAt: string;
    endsAt: string;
    status: 'ACTIVE' | 'ARCHIVED';
    rankingVisibleToMembers: boolean;
    weekNumber: number;
    weeksTotal: number;
  };
  members: Array<{
    userId: string;
    name: string;
    pictureUrl: string | null;
    track: string | null;
    percentThisWeek: number;
    done: number;
    total: number;
    hasAlert: boolean;
    availability: {
      itemsCount: number;
      plannedMinutes: number;
      budgetMinutes: number;
    };
  }>;
  heatmap: {
    weeks: Array<{
      index: number;
      label: string;
      startsAt: string;
    }>;
    rows: Array<{
      userId: string;
      name: string;
      cells: number[];
    }>;
  };
  feed: Array<{
    id: string;
    kind: 'finished' | 'got_stuck' | 'had_doubts' | 'posted_retro';
    at: string;
    member: { id: string; name: string; pictureUrl: string | null };
    itemTitle: string | null;
    itemId: string | null;
  }>;
};

type MembershipRow = {
  userId: string;
  track: string | null;
  user: { id: string; name: string; pictureUrl: string | null };
};

type PlanRow = {
  id: string;
  userId: string;
  weekStart: Date;
  items: Array<{
    outcome: 'PENDING' | 'DONE_EASY' | 'DONE_HARD' | 'DOUBTS' | 'STUCK';
    completedAt: Date | null;
    weeklyPlanId: string;
    libraryItem: { estimatedMinutes: number; format: string };
  }>;
};

type StuckRow = { weeklyPlan: { userId: string } };

@Injectable()
export class CycleOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(cycleId: string, now: Date = new Date()): Promise<CycleOverviewResponse> {
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
      include: {
        memberships: {
          include: {
            user: { select: { id: true, name: true, pictureUrl: true } },
          },
        },
      },
    });
    if (!cycle) throw new NotFoundException('cycle not found');

    const memberships = (cycle.memberships ?? []) as MembershipRow[];
    const userIds = memberships.map((m) => m.userId);

    // Build every week of the cycle. Week 0 starts on the Monday on or
    // before cycle.startsAt (matches the Plan Week modal's notion of a week).
    const cycleFirstMonday = this.mondayUTC(cycle.startsAt);
    const cycleLastMonday = this.mondayUTC(cycle.endsAt);
    const weekCount = Math.floor(
      (cycleLastMonday.getTime() - cycleFirstMonday.getTime()) / WEEK_MS,
    ) + 1;
    const weeksWindow: Array<{ index: number; label: string; startsAt: Date }> = [];
    for (let i = 0; i < weekCount; i += 1) {
      const start = new Date(cycleFirstMonday.getTime() + i * WEEK_MS);
      weeksWindow.push({
        index: i,
        label: start.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        }),
        startsAt: start,
      });
    }
    const windowStart = weeksWindow[0]!.startsAt;
    const windowEnd = new Date(cycleLastMonday.getTime() + WEEK_MS - 1);

    const currentWeekStart = this.mondayUTC(now);

    // Fetch PUBLISHED plans in the 6-week window for all cycle members.
    const plans =
      userIds.length === 0
        ? []
        : ((await this.prisma.weeklyPlan.findMany({
            where: {
              cycleId,
              status: 'PUBLISHED',
              weekStart: { gte: windowStart, lte: windowEnd },
            },
            select: {
              id: true,
              userId: true,
              weekStart: true,
              items: {
                select: {
                  outcome: true,
                  completedAt: true,
                  weeklyPlanId: true,
                  libraryItem: { select: { estimatedMinutes: true, format: true } },
                },
              },
            },
          })) as PlanRow[]);

    const availabilityRows =
      userIds.length === 0
        ? []
        : await this.prisma.memberAvailability.findMany({
            where: { userId: { in: userIds } },
            select: {
              userId: true,
              mondayMinutes: true,
              tuesdayMinutes: true,
              wednesdayMinutes: true,
              thursdayMinutes: true,
              fridayMinutes: true,
              saturdayMinutes: true,
              sundayMinutes: true,
            },
          });
    const budgetByUser = new Map<string, number>();
    for (const row of availabilityRows) {
      budgetByUser.set(
        row.userId,
        (row.mondayMinutes ?? 0) +
          (row.tuesdayMinutes ?? 0) +
          (row.wednesdayMinutes ?? 0) +
          (row.thursdayMinutes ?? 0) +
          (row.fridayMinutes ?? 0) +
          (row.saturdayMinutes ?? 0) +
          (row.sundayMinutes ?? 0),
      );
    }
    const defaultBudget =
      DEFAULT_AVAILABILITY.mondayMinutes +
      DEFAULT_AVAILABILITY.tuesdayMinutes +
      DEFAULT_AVAILABILITY.wednesdayMinutes +
      DEFAULT_AVAILABILITY.thursdayMinutes +
      DEFAULT_AVAILABILITY.fridayMinutes +
      DEFAULT_AVAILABILITY.saturdayMinutes +
      DEFAULT_AVAILABILITY.sundayMinutes;

    // hasAlert proxy: any STUCK outcome in last 72h (completedAt window).
    const stuckSince = new Date(now.getTime() - STUCK_PROXY_WINDOW_MS);
    const stuckItems =
      userIds.length === 0
        ? []
        : ((await this.prisma.weeklyPlanItem.findMany({
            where: {
              outcome: 'STUCK',
              completedAt: { gte: stuckSince, lte: now },
              weeklyPlan: { userId: { in: userIds } },
            },
            select: { weeklyPlan: { select: { userId: true } } },
          })) as StuckRow[]);
    const membersWithStuck = new Set(stuckItems.map((s) => s.weeklyPlan.userId));

    // Index plans by user+weekStart for O(1) lookup.
    const planByUserWeek = new Map<string, PlanRow>();
    for (const plan of plans) {
      const key = `${plan.userId}:${plan.weekStart.getTime()}`;
      planByUserWeek.set(key, plan);
    }

    const members = memberships.map((m) => {
      const currentPlan = planByUserWeek.get(`${m.userId}:${currentWeekStart.getTime()}`);
      const total = currentPlan?.items.length ?? 0;
      const done = (currentPlan?.items ?? []).filter((i) => POSITIVE.has(i.outcome)).length;
      const percent = total === 0 ? 0 : Math.round((done / total) * 100);
      const plannedMinutes = sumAllocatedMinutes(
        (currentPlan?.items ?? []).map((i) => ({
          estimatedMinutes: i.libraryItem.estimatedMinutes,
          format: i.libraryItem.format,
          outcome: i.outcome,
        })),
      );
      const budgetMinutes = budgetByUser.get(m.userId) ?? defaultBudget;
      return {
        userId: m.userId,
        name: m.user.name,
        pictureUrl: m.user.pictureUrl,
        track: m.track ?? null,
        percentThisWeek: percent,
        done,
        total,
        hasAlert: membersWithStuck.has(m.userId),
        availability: {
          itemsCount: total,
          plannedMinutes,
          budgetMinutes,
        },
      };
    });

    const heatmapRows = memberships.map((m) => {
      const cells = weeksWindow.map((w) => {
        const plan = planByUserWeek.get(`${m.userId}:${w.startsAt.getTime()}`);
        const total = plan?.items.length ?? 0;
        const done = (plan?.items ?? []).filter((i) => POSITIVE.has(i.outcome)).length;
        return total === 0 ? 0 : Math.round((done / total) * 100);
      });
      return {
        userId: m.userId,
        name: m.user.name,
        cells,
      };
    });

    // Feed: last 7 days of cohort activity (completed items + submitted retros).
    const feedSince = new Date(now);
    feedSince.setUTCDate(feedSince.getUTCDate() - FEED_WINDOW_DAYS);

    const recentItems =
      userIds.length === 0
        ? []
        : await this.prisma.weeklyPlanItem.findMany({
            where: {
              weeklyPlan: { userId: { in: userIds }, cycleId },
              completedAt: { gte: feedSince, lte: now },
            },
            include: {
              libraryItem: { select: { title: true } },
              weeklyPlan: {
                select: {
                  userId: true,
                  user: { select: { id: true, name: true, pictureUrl: true } },
                },
              },
            },
            orderBy: { completedAt: 'desc' },
            take: 60,
          });

    const recentRetros =
      userIds.length === 0
        ? []
        : await this.prisma.weeklyRetro.findMany({
            where: {
              userId: { in: userIds },
              submittedAt: { gte: feedSince, lte: now },
            },
            include: { user: { select: { id: true, name: true, pictureUrl: true } } },
            orderBy: { submittedAt: 'desc' },
            take: 60,
          });

    const feed: CycleOverviewResponse['feed'] = [];
    for (const item of recentItems as any[]) {
      if (!item.completedAt) continue;
      let kind: CycleOverviewResponse['feed'][number]['kind'] | null = null;
      if (isPositiveOutcome(item.outcome as ItemOutcome)) kind = 'finished';
      else if (item.outcome === 'STUCK') kind = 'got_stuck';
      else if (item.outcome === 'DOUBTS') kind = 'had_doubts';
      if (!kind) continue;
      feed.push({
        id: `${item.weeklyPlan.userId}:${kind}:${item.id}`,
        kind,
        at: item.completedAt.toISOString(),
        member: item.weeklyPlan.user,
        itemTitle: item.libraryItem.title,
        itemId: item.id,
      });
    }
    for (const retro of recentRetros as any[]) {
      feed.push({
        id: `${retro.userId}:posted_retro:${retro.id}`,
        kind: 'posted_retro',
        at: retro.submittedAt.toISOString(),
        member: retro.user,
        itemTitle: null,
        itemId: null,
      });
    }
    feed.sort((a, b) => (a.at < b.at ? 1 : -1));

    const pos = computeWeekPosition(cycle, now);

    return {
      cycle: {
        id: cycle.id,
        name: cycle.name,
        startsAt: cycle.startsAt.toISOString(),
        endsAt: cycle.endsAt.toISOString(),
        status: cycle.status as 'ACTIVE' | 'ARCHIVED',
        rankingVisibleToMembers: cycle.rankingVisibleToMembers,
        weekNumber: pos.weekNumber,
        weeksTotal: pos.weeksTotal,
      },
      members,
      heatmap: {
        weeks: weeksWindow.map((w) => ({
          index: w.index,
          label: w.label,
          startsAt: w.startsAt.toISOString(),
        })),
        rows: heatmapRows,
      },
      feed,
    };
  }

  private mondayUTC(now: Date): Date {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const day = d.getUTCDay(); // Sun=0 Mon=1 ... Sat=6
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    return d;
  }
}

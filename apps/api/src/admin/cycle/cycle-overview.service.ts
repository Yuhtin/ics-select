import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { computeWeekPosition } from '../../common/cycle/active-cycle.js';

const POSITIVE = new Set(['DONE_EASY', 'DONE_HARD']);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const HEATMAP_WEEKS = 6;
const STUCK_PROXY_WINDOW_MS = 72 * 60 * 60 * 1000;

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

    // Build 6-week window ending at the current week (inclusive). Index 0 = oldest.
    const thisMonday = this.mondayUTC(now);
    const weeksWindow: Array<{ index: number; label: string; startsAt: Date }> = [];
    for (let i = HEATMAP_WEEKS - 1; i >= 0; i -= 1) {
      const start = new Date(thisMonday.getTime() - i * WEEK_MS);
      weeksWindow.push({
        index: HEATMAP_WEEKS - 1 - i,
        label: start.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          timeZone: 'UTC',
        }),
        startsAt: start,
      });
    }
    const windowStart = weeksWindow[0]!.startsAt;
    const windowEnd = new Date(thisMonday.getTime() + WEEK_MS - 1);

    const currentWeekStart = thisMonday;

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
                select: { outcome: true, completedAt: true, weeklyPlanId: true },
              },
            },
          })) as PlanRow[]);

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
      return {
        userId: m.userId,
        name: m.user.name,
        pictureUrl: m.user.pictureUrl,
        track: m.track ?? null,
        percentThisWeek: percent,
        done,
        total,
        hasAlert: membersWithStuck.has(m.userId),
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

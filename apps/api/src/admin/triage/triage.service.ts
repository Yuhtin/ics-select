import { Injectable } from '@nestjs/common';
import type { AlertType } from '@ics-select/shared';
import { PrismaService } from '../../common/prisma/prisma.service';

export type TriageAlert = {
  id: string;
  type: AlertType;
  severity: 'urgent' | 'attention' | 'scheduled';
  member: { id: string; name: string; pictureUrl: string | null };
  targetId: string | null;
  summary: string;
  occurredAt: string;
  dismissKey: string;
};

export type CohortStripEntry = {
  userId: string;
  name: string;
  pictureUrl: string | null;
  percentThisWeek: number;
  hasAlert: boolean;
};

export type CycleInfo = {
  cycleId: string;
  cycleName: string;
  weekNumber: number;
  weeksTotal: number;
  daysUntilWeekEnds: number;
};

export type TriageResponse = {
  alerts: TriageAlert[];
  cohortStrip: CohortStripEntry[];
  cycleInfo: CycleInfo | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const POSITIVE = new Set(['DONE_EASY', 'DONE_HARD']);

type Member = {
  userId: string;
  user: { id: string; name: string; pictureUrl: string | null };
};

type PlanWithItems = {
  id: string;
  userId: string;
  weekStart: Date;
  weekEnd: Date;
  status: 'DRAFT' | 'PUBLISHED';
  items: Array<{
    id: string;
    outcome: 'PENDING' | 'DONE_EASY' | 'DONE_HARD' | 'DOUBTS' | 'STUCK';
    completedAt: Date | null;
    scheduledAt: Date | null;
  }>;
};

type RecentItem = {
  id: string;
  outcome: 'PENDING' | 'DONE_EASY' | 'DONE_HARD' | 'DOUBTS' | 'STUCK';
  completedAt: Date | null;
  scheduledAt: Date | null;
  weeklyPlan: {
    id: string;
    userId: string;
    weekStart: Date;
    weekEnd: Date;
    user: { id: string; name: string; pictureUrl: string | null };
  };
};

type Retro = {
  userId: string;
  weekStart: Date;
  submittedAt: Date;
};

type Dismissal = {
  userId: string;
  alertType: AlertType;
  targetId: string;
  expiresAt: Date;
};

type RuleContext = {
  now: Date;
  weekStart: Date;
  weekEnd: Date;
  nextWeekStart: Date;
  members: Member[];
  membersById: Map<string, Member>;
  plans: PlanWithItems[];
  recentItems: RecentItem[];
  retros: Retro[];
};

@Injectable()
export class TriageService {
  constructor(private readonly prisma: PrismaService) {}

  async getTriage(now: Date = new Date(), adminUserId?: string): Promise<TriageResponse> {
    const cycle = await this.prisma.cycle.findFirst({ where: { status: 'ACTIVE' } });
    if (!cycle) {
      return { alerts: [], cohortStrip: [], cycleInfo: null };
    }

    const weekStart = this.mondayUTC(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    weekEnd.setUTCMilliseconds(-1);
    const nextWeekStart = new Date(weekStart);
    nextWeekStart.setUTCDate(nextWeekStart.getUTCDate() + 7);

    // Load memberships for the active cycle.
    const memberships = (await this.prisma.cycleMembership.findMany({
      where: { cycleId: cycle.id },
      include: { user: { select: { id: true, name: true, pictureUrl: true } } },
    })) as Member[];

    if (memberships.length === 0) {
      return {
        alerts: [],
        cohortStrip: [],
        cycleInfo: this.computeCycleInfo(cycle, now, weekEnd),
      };
    }

    const userIds = memberships.map((m) => m.userId);
    const membersById = new Map(memberships.map((m) => [m.userId, m]));

    // Window to look back for retros (last 2 completed weeks).
    const twoWeeksAgoMonday = new Date(weekStart);
    twoWeeksAgoMonday.setUTCDate(twoWeeksAgoMonday.getUTCDate() - 14);

    // Window for recent items (72h covers STUCK_RECENT 48h + DISAPPEARED 72h).
    const seventyTwoHoursAgo = new Date(now.getTime() - 3 * DAY_MS);

    const [plans, recentItems, retros, dismissals] = await Promise.all([
      this.prisma.weeklyPlan.findMany({
        where: {
          cycleId: cycle.id,
          userId: { in: userIds },
          status: 'PUBLISHED',
          weekStart: { gte: twoWeeksAgoMonday, lte: nextWeekStart },
        },
        include: {
          items: {
            select: { id: true, outcome: true, completedAt: true, scheduledAt: true },
          },
        },
      }) as Promise<PlanWithItems[]>,
      this.prisma.weeklyPlanItem.findMany({
        where: {
          weeklyPlan: { userId: { in: userIds }, status: 'PUBLISHED' },
          OR: [
            { completedAt: { gte: seventyTwoHoursAgo, lte: now } },
            // Include currently scheduled-but-pending items that may be "missed".
            { outcome: 'PENDING', scheduledAt: { gte: seventyTwoHoursAgo, lte: now } },
          ],
        },
        include: {
          weeklyPlan: {
            select: {
              id: true,
              userId: true,
              weekStart: true,
              weekEnd: true,
              user: { select: { id: true, name: true, pictureUrl: true } },
            },
          },
        },
        orderBy: { completedAt: 'desc' },
      }) as Promise<RecentItem[]>,
      this.prisma.weeklyRetro.findMany({
        where: {
          userId: { in: userIds },
          weekStart: { gte: twoWeeksAgoMonday, lt: weekStart },
        },
        select: { userId: true, weekStart: true, submittedAt: true },
      }) as Promise<Retro[]>,
      this.prisma.dismissedAlert.findMany({
        where: { expiresAt: { gt: now } },
      }) as Promise<Dismissal[]>,
    ]);

    const ctx: RuleContext = {
      now,
      weekStart,
      weekEnd,
      nextWeekStart,
      members: memberships,
      membersById,
      plans,
      recentItems,
      retros,
    };

    const alerts: TriageAlert[] = [
      ...this.ruleStuckRecent(ctx),
      ...this.ruleDisappeared(ctx),
      ...this.ruleStuckRepeatedly(ctx),
      ...this.ruleFinishedEarly(ctx),
      ...this.ruleSkippedRetros(ctx),
      ...this.rulePlanPending(ctx),
    ];

    const filteredAlerts = adminUserId
      ? alerts.filter((a) => {
          const matched = dismissals.find(
            (d) =>
              d.userId === adminUserId &&
              d.alertType === a.type &&
              d.targetId === (a.targetId ?? a.member.id),
          );
          return !matched;
        })
      : alerts;

    // Order: urgent → attention → scheduled; within, most recent first.
    const severityRank: Record<TriageAlert['severity'], number> = {
      urgent: 0,
      attention: 1,
      scheduled: 2,
    };
    filteredAlerts.sort((a, b) => {
      const delta = severityRank[a.severity] - severityRank[b.severity];
      if (delta !== 0) return delta;
      return a.occurredAt < b.occurredAt ? 1 : -1;
    });

    const cohortStrip = this.buildCohortStrip(ctx, filteredAlerts);
    const cycleInfo = this.computeCycleInfo(cycle, now, weekEnd);

    return { alerts: filteredAlerts, cohortStrip, cycleInfo };
  }

  // ---------- Rules ----------

  private ruleStuckRecent(ctx: RuleContext): TriageAlert[] {
    const cutoff = new Date(ctx.now.getTime() - 2 * DAY_MS);
    const byMember = new Map<string, RecentItem>();
    for (const item of ctx.recentItems) {
      if (item.outcome !== 'STUCK') continue;
      if (!item.completedAt || item.completedAt < cutoff) continue;
      const current = byMember.get(item.weeklyPlan.userId);
      if (!current || (current.completedAt && item.completedAt > current.completedAt)) {
        byMember.set(item.weeklyPlan.userId, item);
      }
    }
    const alerts: TriageAlert[] = [];
    for (const item of byMember.values()) {
      alerts.push(
        this.makeAlert({
          type: 'STUCK_RECENT',
          severity: 'urgent',
          member: item.weeklyPlan.user,
          targetId: item.id,
          summary: `Travou recentemente em uma tarefa — abrir conversa`,
          occurredAt: item.completedAt!,
        }),
      );
    }
    return alerts;
  }

  private ruleDisappeared(ctx: RuleContext): TriageAlert[] {
    const cutoff = new Date(ctx.now.getTime() - 3 * DAY_MS);
    // Map: userId → has any positive outcome in last 72h?
    const positiveByMember = new Set<string>();
    for (const item of ctx.recentItems) {
      if (!item.completedAt || item.completedAt < cutoff) continue;
      if (POSITIVE.has(item.outcome)) positiveByMember.add(item.weeklyPlan.userId);
    }
    // Find missed (scheduled in past, still PENDING) per member.
    const missedByMember = new Map<string, RecentItem>();
    for (const item of ctx.recentItems) {
      if (item.outcome !== 'PENDING') continue;
      if (!item.scheduledAt || item.scheduledAt >= ctx.now) continue;
      const current = missedByMember.get(item.weeklyPlan.userId);
      if (!current || (current.scheduledAt && item.scheduledAt > current.scheduledAt)) {
        missedByMember.set(item.weeklyPlan.userId, item);
      }
    }
    const alerts: TriageAlert[] = [];
    for (const [userId, missed] of missedByMember.entries()) {
      if (positiveByMember.has(userId)) continue;
      alerts.push(
        this.makeAlert({
          type: 'DISAPPEARED',
          severity: 'urgent',
          member: missed.weeklyPlan.user,
          targetId: userId,
          summary: `Sem progresso nas últimas 72h e tem item atrasado`,
          occurredAt: missed.scheduledAt!,
        }),
      );
    }
    return alerts;
  }

  private ruleStuckRepeatedly(ctx: RuleContext): TriageAlert[] {
    // Count STUCK items per member in the CURRENT week's plan.
    const currentPlans = ctx.plans.filter(
      (p) => p.weekStart.getTime() === ctx.weekStart.getTime(),
    );
    const alerts: TriageAlert[] = [];
    for (const plan of currentPlans) {
      const stuckItems = plan.items.filter(
        (i) => i.outcome === 'STUCK' && i.completedAt !== null,
      );
      if (stuckItems.length < 2) continue;
      const latest = stuckItems.reduce((a, b) =>
        (a.completedAt! > b.completedAt!) ? a : b,
      );
      const member = ctx.membersById.get(plan.userId);
      if (!member) continue;
      alerts.push(
        this.makeAlert({
          type: 'STUCK_REPEATEDLY',
          severity: 'attention',
          member: member.user,
          targetId: plan.userId,
          summary: `Travou em ${stuckItems.length} tarefas nesta semana`,
          occurredAt: latest.completedAt!,
        }),
      );
    }
    return alerts;
  }

  private ruleFinishedEarly(ctx: RuleContext): TriageAlert[] {
    const currentPlans = ctx.plans.filter(
      (p) => p.weekStart.getTime() === ctx.weekStart.getTime(),
    );
    const twoDaysMs = 2 * DAY_MS;
    const timeLeft = ctx.weekEnd.getTime() - ctx.now.getTime();
    if (timeLeft < twoDaysMs) return [];

    const alerts: TriageAlert[] = [];
    for (const plan of currentPlans) {
      if (plan.items.length === 0) continue;
      const allPositive = plan.items.every((i) => POSITIVE.has(i.outcome));
      if (!allPositive) continue;
      const latest = plan.items
        .filter((i) => i.completedAt)
        .reduce<Date | null>(
          (acc, i) => (acc === null || i.completedAt! > acc ? i.completedAt! : acc),
          null,
        );
      if (!latest) continue;
      const member = ctx.membersById.get(plan.userId);
      if (!member) continue;
      alerts.push(
        this.makeAlert({
          type: 'FINISHED_EARLY',
          severity: 'attention',
          member: member.user,
          targetId: plan.id,
          summary: `Finalizou a semana antecipadamente — considere um desafio extra`,
          occurredAt: latest,
        }),
      );
    }
    return alerts;
  }

  private ruleSkippedRetros(ctx: RuleContext): TriageAlert[] {
    // The two completed weeks before the current week.
    const oneWeekAgoStart = new Date(ctx.weekStart);
    oneWeekAgoStart.setUTCDate(oneWeekAgoStart.getUTCDate() - 7);
    const twoWeeksAgoStart = new Date(ctx.weekStart);
    twoWeeksAgoStart.setUTCDate(twoWeeksAgoStart.getUTCDate() - 14);

    const retroKey = (userId: string, weekStart: Date) =>
      `${userId}:${weekStart.getTime()}`;
    const retroSet = new Set(
      ctx.retros.map((r) => retroKey(r.userId, r.weekStart)),
    );

    const alerts: TriageAlert[] = [];
    for (const m of ctx.members) {
      const missedPrev = !retroSet.has(retroKey(m.userId, oneWeekAgoStart));
      const missedPrevPrev = !retroSet.has(retroKey(m.userId, twoWeeksAgoStart));
      if (!missedPrev || !missedPrevPrev) continue;
      alerts.push(
        this.makeAlert({
          type: 'SKIPPED_RETROS',
          severity: 'attention',
          member: m.user,
          targetId: m.userId,
          summary: `Não submeteu retros nas últimas duas semanas`,
          occurredAt: twoWeeksAgoStart,
        }),
      );
    }
    return alerts;
  }

  private rulePlanPending(ctx: RuleContext): TriageAlert[] {
    const daysLeft = this.daysUntilWeekEnds(ctx.weekEnd, ctx.now);
    if (daysLeft > 3) return [];

    const nextWeekPlans = new Set(
      ctx.plans
        .filter((p) => p.weekStart.getTime() === ctx.nextWeekStart.getTime())
        .map((p) => p.userId),
    );
    const alerts: TriageAlert[] = [];
    for (const m of ctx.members) {
      if (nextWeekPlans.has(m.userId)) continue;
      alerts.push(
        this.makeAlert({
          type: 'PLAN_PENDING',
          severity: 'scheduled',
          member: m.user,
          targetId: m.userId,
          summary: `Plano da próxima semana ainda não foi publicado`,
          occurredAt: ctx.weekEnd,
        }),
      );
    }
    return alerts;
  }

  // ---------- Helpers ----------

  private makeAlert(input: {
    type: AlertType;
    severity: TriageAlert['severity'];
    member: { id: string; name: string; pictureUrl: string | null };
    targetId: string | null;
    summary: string;
    occurredAt: Date;
  }): TriageAlert {
    const id = `${input.type}:${input.targetId ?? input.member.id}`;
    return {
      id,
      type: input.type,
      severity: input.severity,
      member: input.member,
      targetId: input.targetId,
      summary: input.summary,
      occurredAt: input.occurredAt.toISOString(),
      dismissKey: id,
    };
  }

  private buildCohortStrip(
    ctx: RuleContext,
    alerts: TriageAlert[],
  ): CohortStripEntry[] {
    const alertedMembers = new Set(alerts.map((a) => a.member.id));
    const currentPlansByUser = new Map<string, PlanWithItems>();
    for (const plan of ctx.plans) {
      if (plan.weekStart.getTime() !== ctx.weekStart.getTime()) continue;
      currentPlansByUser.set(plan.userId, plan);
    }
    return ctx.members.map((m) => {
      const plan = currentPlansByUser.get(m.userId);
      let percent = 0;
      if (plan && plan.items.length > 0) {
        const done = plan.items.filter((i) => POSITIVE.has(i.outcome)).length;
        percent = Math.round((done / plan.items.length) * 100);
      }
      return {
        userId: m.userId,
        name: m.user.name,
        pictureUrl: m.user.pictureUrl,
        percentThisWeek: percent,
        hasAlert: alertedMembers.has(m.userId),
      };
    });
  }

  private computeCycleInfo(
    cycle: { id: string; name: string; startsAt: Date; endsAt: Date },
    now: Date,
    weekEnd: Date,
  ): CycleInfo {
    const totalMs = cycle.endsAt.getTime() - cycle.startsAt.getTime();
    const weeksTotal = Math.max(1, Math.ceil(totalMs / (7 * DAY_MS)));
    const elapsedMs = Math.max(0, now.getTime() - cycle.startsAt.getTime());
    const weekNumber = Math.min(
      weeksTotal,
      Math.max(1, Math.ceil(elapsedMs / (7 * DAY_MS)) || 1),
    );
    const daysUntilWeekEnds = this.daysUntilWeekEnds(weekEnd, now);
    return {
      cycleId: cycle.id,
      cycleName: cycle.name,
      weekNumber,
      weeksTotal,
      daysUntilWeekEnds,
    };
  }

  private daysUntilWeekEnds(weekEnd: Date, now: Date): number {
    const msLeft = weekEnd.getTime() - now.getTime();
    if (msLeft <= 0) return 0;
    return Math.min(6, Math.max(0, Math.ceil(msLeft / DAY_MS)));
  }

  private mondayUTC(now: Date): Date {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const day = d.getUTCDay(); // Sun=0 Mon=1 ... Sat=6
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    return d;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { computeWeekPosition } from '../../common/cycle/active-cycle.js';

import { type ItemOutcome, POSITIVE_OUTCOMES } from '@ics-select/shared';

export type PlansOverviewStatus = 'all' | 'draft' | 'published';

export type PlansOverviewResponse = {
  cycle: {
    id: string;
    name: string;
    startsAt: string;
    endsAt: string;
    weekNumber: number;
    weeksTotal: number;
  };
  weeks: Array<{
    weekStart: string;
    weekEnd: string;
    plans: Array<{
      id: string;
      status: 'DRAFT' | 'PUBLISHED';
      lastActivityAt: string;
      items: { total: number; done: number };
      user: { id: string; name: string; pictureUrl: string | null };
    }>;
  }>;
};

type PlanRow = {
  id: string;
  status: 'DRAFT' | 'PUBLISHED';
  weekStart: Date;
  weekEnd: Date;
  publishedAt: Date | null;
  createdAt: Date;
  items: Array<{ outcome: ItemOutcome }>;
  user: { id: string; name: string; pictureUrl: string | null };
};

@Injectable()
export class PlansOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    cycleId: string,
    status: PlansOverviewStatus = 'all',
    now: Date = new Date(),
  ): Promise<PlansOverviewResponse> {
    const cycle = await this.prisma.cycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new NotFoundException('cycle not found');

    const where: { cycleId: string; status?: 'DRAFT' | 'PUBLISHED' } = { cycleId };
    if (status === 'draft') where.status = 'DRAFT';
    else if (status === 'published') where.status = 'PUBLISHED';

    const plans = (await this.prisma.weeklyPlan.findMany({
      where,
      orderBy: { weekStart: 'desc' },
      include: {
        user: { select: { id: true, name: true, pictureUrl: true } },
        items: { select: { outcome: true } },
      },
    })) as PlanRow[];

    const groups = new Map<number, { weekStart: Date; weekEnd: Date; plans: PlanRow[] }>();
    for (const plan of plans) {
      const key = plan.weekStart.getTime();
      const group = groups.get(key);
      if (group) {
        group.plans.push(plan);
      } else {
        groups.set(key, { weekStart: plan.weekStart, weekEnd: plan.weekEnd, plans: [plan] });
      }
    }

    const weeks = Array.from(groups.values())
      .sort((a, b) => b.weekStart.getTime() - a.weekStart.getTime())
      .map((g) => ({
        weekStart: g.weekStart.toISOString(),
        weekEnd: g.weekEnd.toISOString(),
        plans: g.plans
          .slice()
          .sort((a, b) => a.user.name.localeCompare(b.user.name))
          .map((p) => ({
            id: p.id,
            status: p.status,
            lastActivityAt: (p.publishedAt ?? p.createdAt).toISOString(),
            items: {
              total: p.items.length,
              done: p.items.filter((i) => POSITIVE_OUTCOMES.has(i.outcome)).length,
            },
            user: {
              id: p.user.id,
              name: p.user.name,
              pictureUrl: p.user.pictureUrl,
            },
          })),
      }));

    const pos = computeWeekPosition(cycle, now);
    return {
      cycle: {
        id: cycle.id,
        name: cycle.name,
        startsAt: cycle.startsAt.toISOString(),
        endsAt: cycle.endsAt.toISOString(),
        weekNumber: pos.weekNumber,
        weeksTotal: pos.weeksTotal,
      },
      weeks,
    };
  }
}

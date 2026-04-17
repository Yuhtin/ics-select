import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';

type MemberCard = {
  id: string;
  name: string;
  email: string;
  pictureUrl: string | null;
  role: 'ADMIN' | 'MEMBER';
  stats: {
    plansCount: number;
    doneItems: number;
    stuckItems: number;
  };
};

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getCohort(): Promise<MemberCard[]> {
    const users = await this.prisma.user.findMany();
    const cards: MemberCard[] = [];
    for (const u of users) {
      const [plansCount, doneItems, stuckItems] = await Promise.all([
        this.prisma.weeklyPlan.count({ where: { userId: u.id } }),
        this.prisma.weeklyPlanItem.count({
          where: { weeklyPlan: { userId: u.id }, outcome: { in: ['DONE_EASY', 'DONE_HARD'] } },
        }),
        this.prisma.weeklyPlanItem.count({
          where: { weeklyPlan: { userId: u.id }, outcome: 'STUCK' },
        }),
      ]);
      cards.push({
        id: u.id,
        name: u.name,
        email: u.email,
        pictureUrl: u.pictureUrl,
        role: u.role,
        stats: { plansCount, doneItems, stuckItems },
      });
    }
    return cards;
  }

  async getMemberOverview(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('user not found');
    const plans = await this.prisma.weeklyPlan.findMany({
      where: { userId },
      orderBy: { weekStart: 'desc' },
      include: {
        items: {
          include: { libraryItem: true },
          orderBy: { order: 'asc' },
        },
      },
    });
    const topicCoverage = new Map<string, { done: number; total: number }>();
    for (const plan of plans) {
      for (const item of plan.items) {
        for (const tag of item.libraryItem.tags) {
          const cur = topicCoverage.get(tag) ?? { done: 0, total: 0 };
          cur.total += 1;
          if (item.outcome === 'DONE_EASY' || item.outcome === 'DONE_HARD') cur.done += 1;
          topicCoverage.set(tag, cur);
        }
      }
    }
    return {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        pictureUrl: user.pictureUrl,
      },
      plans: plans.map((p) => ({
        id: p.id,
        weekStart: p.weekStart,
        weekEnd: p.weekEnd,
        status: p.status,
        doneCount: p.items.filter((i) => i.outcome === 'DONE_EASY' || i.outcome === 'DONE_HARD').length,
        totalCount: p.items.length,
      })),
      topicCoverage: Array.from(topicCoverage.entries()).map(([tag, stats]) => ({
        tag,
        done: stats.done,
        total: stats.total,
      })),
    };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { POSITIVE_OUTCOMES, isPositiveOutcome } from '@ics-select/shared';
import type { ItemOutcome } from '@ics-select/prisma';
import { countCanonicalPositive, canonicalCompletions } from '../common/completions/canonical-completions.js';

const POSITIVE_OUTCOMES_ARR = Array.from(POSITIVE_OUTCOMES) as ItemOutcome[];

type MemberCard = {
  id: string;
  name: string;
  email: string;
  pictureUrl: string | null;
  role: 'ADMIN' | 'MEMBER';
  stats: {
    plansCount: number;
    doneItems: number;
    skippedItems: number;
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
      const [plansCount, doneRows, skippedRows, stuckRows] = await Promise.all([
        this.prisma.weeklyPlan.count({ where: { userId: u.id, status: 'PUBLISHED' } }),
        // Dedup carried completions: count distinct materials, not one row per
        // week a material was re-planned. doneItems and its sub-breakdowns
        // (skipped/stuck) all use the same per-material dedup so they stay
        // consistent on the admin card.
        this.prisma.weeklyPlanItem.findMany({
          where: { weeklyPlan: { userId: u.id }, outcome: { in: POSITIVE_OUTCOMES_ARR } },
          select: { libraryItemId: true, outcome: true, completedAt: true },
        }),
        this.prisma.weeklyPlanItem.findMany({
          where: { weeklyPlan: { userId: u.id }, outcome: 'SKIPPED' },
          select: { libraryItemId: true, outcome: true, completedAt: true },
        }),
        this.prisma.weeklyPlanItem.findMany({
          where: { weeklyPlan: { userId: u.id }, outcome: 'STUCK' },
          select: { libraryItemId: true, outcome: true, completedAt: true },
        }),
      ]);
      const doneItems = countCanonicalPositive(doneRows);
      const skippedItems = canonicalCompletions(skippedRows).length;
      const stuckItems = canonicalCompletions(stuckRows).length;
      cards.push({
        id: u.id,
        name: u.name,
        email: u.email,
        pictureUrl: u.pictureUrl,
        role: u.role,
        stats: { plansCount, doneItems, skippedItems, stuckItems },
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
    // Dedup carried completions: per tag, total = distinct materials,
    // done = distinct materials with a positive canonical completion.
    const items = plans.flatMap((p) => p.items);
    const totalByTag = new Map<string, Set<string>>();
    for (const item of items) {
      for (const tag of item.libraryItem.tags) {
        if (!totalByTag.has(tag)) totalByTag.set(tag, new Set());
        totalByTag.get(tag)!.add(item.libraryItemId);
      }
    }
    const doneByTag = new Map<string, number>();
    for (const r of canonicalCompletions(
      items.map((i) => ({
        libraryItemId: i.libraryItemId,
        outcome: i.outcome,
        completedAt: i.completedAt,
        tags: i.libraryItem.tags,
      })),
    )) {
      if (!isPositiveOutcome(r.outcome)) continue;
      for (const tag of r.tags) doneByTag.set(tag, (doneByTag.get(tag) ?? 0) + 1);
    }
    const topicCoverage = new Map<string, { done: number; total: number }>();
    for (const [tag, materials] of totalByTag) {
      topicCoverage.set(tag, { done: doneByTag.get(tag) ?? 0, total: materials.size });
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
        doneCount: p.items.filter((i) => isPositiveOutcome(i.outcome)).length,
        skippedCount: p.items.filter((i) => i.outcome === 'SKIPPED').length,
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

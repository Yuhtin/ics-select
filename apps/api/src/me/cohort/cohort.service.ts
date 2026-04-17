import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { resolveActiveMembership } from '../../common/cycle/active-cycle';

type CohortEvent = {
  id: string;
  kind: 'finished' | 'got_stuck' | 'had_doubts' | 'posted_retro' | 'started_week';
  at: string;
  member: { id: string; name: string; pictureUrl: string | null };
  itemTitle: string | null;
  itemId: string | null;
};

type MemberRank = {
  userId: string;
  name: string;
  pictureUrl: string | null;
  percent: number;
  done: number;
  total: number;
  isMe: boolean;
};

type CohortMember = {
  userId: string;
  name: string;
  email: string;
  pictureUrl: string | null;
  isMe: boolean;
};

export type CohortResponse = {
  cycleName: string;
  memberCount: number;
  weekEndsAt: string | null;
  members: CohortMember[];
  feed: CohortEvent[];
  ranking?: MemberRank[];
};

const POSITIVE = new Set(['DONE_EASY', 'DONE_HARD']);

@Injectable()
export class CohortService {
  constructor(private readonly prisma: PrismaService) {}

  async getCohort(userId: string, now: Date = new Date()): Promise<CohortResponse> {
    const membership = (await resolveActiveMembership(this.prisma, userId, now, {
      cycle: true,
    } as any)) as
      | {
          id: string;
          cycle: {
            id: string;
            name: string;
            rankingVisibleToMembers: boolean;
            startsAt: Date;
            endsAt: Date;
          };
        }
      | null;

    if (!membership) {
      return { cycleName: '', memberCount: 0, weekEndsAt: null, members: [], feed: [] };
    }

    // Load the full cycle (with memberships) separately — the helper only
    // returns the minimal include we asked for.
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: membership.cycle.id },
      include: {
        memberships: {
          include: {
            user: {
              select: { id: true, name: true, email: true, pictureUrl: true },
            },
          },
        },
      },
    });
    if (!cycle) {
      return { cycleName: '', memberCount: 0, weekEndsAt: null, members: [], feed: [] };
    }
    const userIds = cycle.memberships.map((m: any) => m.userId);

    // Active week bounds (Mon 00:00 UTC → Sun 23:59 UTC) anchored to now.
    const weekStart = this.mondayUTC(now);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    weekEnd.setUTCMilliseconds(-1);

    // Feed window (last 24h).
    const since = new Date(now);
    since.setUTCDate(since.getUTCDate() - 1);

    const recentItems = await this.prisma.weeklyPlanItem.findMany({
      where: {
        weeklyPlan: { userId: { in: userIds } },
        completedAt: { gte: since, lte: now },
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
      take: 40,
    });

    const recentRetros = await this.prisma.weeklyRetro.findMany({
      where: {
        userId: { in: userIds },
        submittedAt: { gte: since, lte: now },
      },
      include: { user: { select: { id: true, name: true, pictureUrl: true } } },
      orderBy: { submittedAt: 'desc' },
      take: 40,
    });

    const feed: CohortEvent[] = [];
    for (const item of recentItems) {
      if (!item.completedAt) continue;
      let kind: CohortEvent['kind'] | null = null;
      if (item.outcome === 'DONE_EASY' || item.outcome === 'DONE_HARD') kind = 'finished';
      else if (item.outcome === 'STUCK') kind = 'got_stuck';
      else if (item.outcome === 'DOUBTS') kind = 'had_doubts';
      if (!kind) continue;
      feed.push({
        id: `${(item as any).weeklyPlan.userId}:${kind}:${item.id}`,
        kind,
        at: item.completedAt.toISOString(),
        member: (item as any).weeklyPlan.user,
        itemTitle: (item as any).libraryItem.title,
        itemId: item.id,
      });
    }
    for (const retro of recentRetros) {
      feed.push({
        id: `${retro.userId}:posted_retro:${retro.id}`,
        kind: 'posted_retro',
        at: retro.submittedAt.toISOString(),
        member: (retro as any).user,
        itemTitle: null,
        itemId: null,
      });
    }

    feed.sort((a, b) => (a.at < b.at ? 1 : -1));

    let ranking: MemberRank[] | undefined;
    if ((cycle as any).rankingVisibleToMembers) {
      const plans = await this.prisma.weeklyPlan.findMany({
        where: {
          userId: { in: userIds },
          status: 'PUBLISHED',
          weekStart: { gte: weekStart, lte: weekEnd },
        },
        include: { items: { select: { outcome: true } } },
      });

      const byUser = new Map<string, { done: number; total: number }>();
      for (const plan of plans) {
        const tally = byUser.get(plan.userId) ?? { done: 0, total: 0 };
        tally.total += (plan as any).items.length;
        tally.done += (plan as any).items.filter((i: any) => POSITIVE.has(i.outcome)).length;
        byUser.set(plan.userId, tally);
      }

      ranking = (cycle as any).memberships
        .map((m: any) => {
          const tally = byUser.get(m.userId) ?? { done: 0, total: 0 };
          const percent = tally.total === 0 ? 0 : Math.round((tally.done / tally.total) * 100);
          return {
            userId: m.userId,
            name: m.user.name,
            pictureUrl: m.user.pictureUrl,
            percent,
            done: tally.done,
            total: tally.total,
            isMe: m.userId === userId,
          };
        })
        .sort((a: MemberRank, b: MemberRank) => b.percent - a.percent);
    }

    const members: CohortMember[] = (cycle as any).memberships
      .map((m: any) => ({
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        pictureUrl: m.user.pictureUrl ?? null,
        isMe: m.userId === userId,
      }))
      .sort((a: CohortMember, b: CohortMember) => {
        if (a.isMe && !b.isMe) return -1;
        if (!a.isMe && b.isMe) return 1;
        return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
      });

    return {
      cycleName: (cycle as any).name,
      memberCount: cycle.memberships.length,
      weekEndsAt: weekEnd.toISOString(),
      members,
      feed,
      ranking,
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

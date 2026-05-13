import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { POSITIVE_OUTCOMES } from '@ics-select/shared';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { CycleReceiptResponse, ReceiptMode } from './cycle-receipt.types.js';
import { computeStreakDays } from './streak.js';

@Injectable()
export class CycleReceiptService {
  constructor(private readonly prisma: PrismaService) {}

  async build(cycleId: string, asOf: Date): Promise<CycleReceiptResponse> {
    const cycle = await this.prisma.cycle.findUnique({
      where: { id: cycleId },
      include: {
        memberships: {
          where: { status: 'ACTIVE' },
          include: { user: { select: { id: true, name: true, pictureUrl: true } } },
        },
      },
    });
    if (!cycle) throw new NotFoundException('Cycle not found');

    const now = new Date();
    if (cycle.status === 'UPCOMING' && cycle.startsAt > now) {
      throw new ConflictException({ error: { code: 'CYCLE_NOT_STARTED' } });
    }

    const minAsOf = cycle.startsAt;
    const maxAsOf = new Date(Math.min(now.getTime(), cycle.endsAt.getTime()));
    if (asOf < minAsOf || asOf > maxAsOf) {
      throw new BadRequestException({ error: { code: 'INVALID_AS_OF' } });
    }

    return this.assembleResponse(cycle, asOf);
  }

  private async assembleResponse(cycle: any, asOf: Date): Promise<CycleReceiptResponse> {
    const items = await this.fetchItems(cycle.id, cycle.startsAt, asOf);
    const stuckItems = await this.fetchStuckOrDoubtsItems(cycle.id, cycle.startsAt, asOf);
    const windowItems = await this.fetchWindowItems(cycle.id, asOf);
    const retros = await this.fetchRetros(cycle.id, asOf);
    const classes = await this.fetchClasses(cycle.id, asOf);

    const memberCount = cycle.memberships.length;
    const members = cycle.memberships
      .map((m: any) => ({ userId: m.userId, name: m.user.name, pictureUrl: m.user.pictureUrl }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
    const memberSet = new Set<string>(members.map((m: any) => m.userId));

    const totalsBase = this.computeTotals(items, memberCount);
    const byTopic = this.computeByTopic(items, memberCount);
    const knowledgeGrid = this.buildKnowledgeGrid(cycle, items, stuckItems);

    const allMovers = this.computeMovers(items, members);
    const windowMovers = this.computeMovers(windowItems, members);
    const topMovers = windowMovers.slice(0, 3);
    const cycleTopMover = allMovers[0] ?? null;

    const itemsByUser = new Map<string, Array<{ completedAt: Date | null }>>();
    for (const it of items) {
      const u = it.weeklyPlan.userId;
      if (!memberSet.has(u)) continue;
      if (!itemsByUser.has(u)) itemsByUser.set(u, []);
      itemsByUser.get(u)!.push({ completedAt: it.completedAt });
    }
    const streaks = members
      .map((m: any) => ({
        ...m,
        streakDays: computeStreakDays(itemsByUser.get(m.userId) ?? [], asOf),
        itemCount: itemsByUser.get(m.userId)?.length ?? 0,
      }))
      .sort((a: any, b: any) => b.streakDays - a.streakDays || b.itemCount - a.itemCount);
    const streakChampion = streaks[0] && streaks[0].streakDays > 0
      ? { userId: streaks[0].userId, name: streaks[0].name, pictureUrl: streaks[0].pictureUrl, streakDays: streaks[0].streakDays }
      : null;

    const retroCountByUser = new Map<string, number>();
    for (const r of retros) {
      const raw = (r as any)._count;
      const cnt = typeof raw === 'number' ? raw : raw?._all ?? raw?.userId ?? 0;
      retroCountByUser.set((r as any).userId, Number(cnt));
    }
    const totalRetros = Array.from(retroCountByUser.values()).reduce((s, n) => s + n, 0);
    const retroChampions = members
      .map((m: any) => ({ ...m, retros: retroCountByUser.get(m.userId) ?? 0 }))
      .filter((m: any) => m.retros > 0)
      .sort((a: any, b: any) => b.retros - a.retros || a.name.localeCompare(b.name))
      .slice(0, 3);

    const classesHeld = classes.held.length;
    const classesTotal = classes.sessions.length;
    const presents = classes.attendance.filter((a: any) => a.status === 'PRESENT');
    const attendanceRate = classesHeld > 0 && memberCount > 0
      ? presents.length / (classesHeld * memberCount)
      : 0;
    const presentsByUser = new Map<string, Set<string>>();
    for (const a of presents) {
      if (!presentsByUser.has(a.userId)) presentsByUser.set(a.userId, new Set());
      presentsByUser.get(a.userId)!.add(a.classSessionId);
    }
    const perfectAttendance = classesHeld > 0
      ? members.filter((m: any) => (presentsByUser.get(m.userId)?.size ?? 0) === classesHeld)
      : [];

    const mode = this.decideMode(cycle, asOf);

    return {
      cycle: {
        id: cycle.id,
        name: cycle.name,
        weekNumber: 0,
        weeksTotal: 0,
        startsAt: cycle.startsAt.toISOString(),
        endsAt: cycle.endsAt.toISOString(),
        status: cycle.status,
      },
      asOf: asOf.toISOString(),
      mode,
      totals: {
        members: memberCount,
        ...totalsBase,
        retros: totalRetros,
        classesHeld,
        classesTotal,
        attendanceRate,
      },
      byTopic,
      knowledgeGrid,
      topMovers,
      cycleTopMover,
      streakChampion,
      retroChampions,
      perfectAttendance,
    };
  }

  private async fetchWindowItems(cycleId: string, asOf: Date) {
    const gte = new Date(asOf.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lte = new Date(asOf);
    lte.setUTCHours(23, 59, 59, 999);
    return this.prisma.weeklyPlanItem.findMany({
      where: {
        weeklyPlan: { cycleId },
        completedAt: { gte, lte },
        outcome: { in: Array.from(POSITIVE_OUTCOMES) },
      },
      include: {
        libraryItem: { include: { topics: { include: { topic: true } } } },
        weeklyPlan: { select: { userId: true } },
      },
    });
  }

  private computeMovers(items: any[], members: Array<{ userId: string; name: string; pictureUrl: string | null }>) {
    const memberLookup = new Map(members.map(m => [m.userId, m]));
    const acc = new Map<string, { delta: number; topicCounts: Map<string, number> }>();
    for (const it of items) {
      const u = it.weeklyPlan.userId;
      if (!memberLookup.has(u)) continue;
      let bucket = acc.get(u);
      if (!bucket) { bucket = { delta: 0, topicCounts: new Map() }; acc.set(u, bucket); }
      bucket.delta += 1;
      for (const lt of it.libraryItem.topics) {
        const label = lt.topic.label;
        bucket.topicCounts.set(label, (bucket.topicCounts.get(label) ?? 0) + 1);
      }
    }
    return Array.from(acc.entries())
      .filter(([, b]) => b.delta > 0)
      .map(([userId, b]) => {
        const m = memberLookup.get(userId)!;
        const topTopics = Array.from(b.topicCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([label]) => label);
        return { userId, name: m.name, pictureUrl: m.pictureUrl, deltaItems: b.delta, topTopics };
      })
      .sort((a, b) => b.deltaItems - a.deltaItems || a.name.localeCompare(b.name));
  }

  private async fetchRetros(cycleId: string, asOf: Date) {
    const asOfEnd = new Date(asOf);
    asOfEnd.setUTCHours(23, 59, 59, 999);
    return this.prisma.weeklyRetro.groupBy({
      by: ['userId'],
      _count: { _all: true },
      where: { cycleId, submittedAt: { lte: asOfEnd } },
    } as any);
  }

  private async fetchClasses(cycleId: string, asOf: Date) {
    const asOfEnd = new Date(asOf);
    asOfEnd.setUTCHours(23, 59, 59, 999);
    const sessions = await this.prisma.classSession.findMany({
      where: { cycleId },
      select: { id: true, scheduledAt: true },
    });
    const held = sessions.filter(s => s.scheduledAt <= asOfEnd);
    const heldIds = held.map(s => s.id);
    const attendance = heldIds.length > 0
      ? await this.prisma.classAttendance.findMany({
          where: { classSessionId: { in: heldIds } },
          select: { classSessionId: true, userId: true, status: true },
        })
      : [];
    return { sessions, held, attendance };
  }

  private async fetchStuckOrDoubtsItems(cycleId: string, startsAt: Date, asOf: Date) {
    const asOfEnd = new Date(asOf);
    asOfEnd.setUTCHours(23, 59, 59, 999);
    return this.prisma.weeklyPlanItem.findMany({
      where: {
        weeklyPlan: { cycleId },
        OR: [
          { outcome: 'STUCK' },
          { outcome: 'DOUBTS', completedAt: { gte: startsAt, lte: asOfEnd } },
        ],
      },
      include: {
        libraryItem: { include: { topics: { include: { topic: true } } } },
        weeklyPlan: { select: { userId: true } },
      },
    });
  }

  private buildKnowledgeGrid(cycle: any, items: any[], stuckItems: any[]) {
    const members = cycle.memberships
      .map((m: any) => ({ userId: m.userId, name: m.user.name, pictureUrl: m.user.pictureUrl }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
    const memberSet = new Set<string>(members.map((m: any) => m.userId));

    const topicMap = new Map<string, { topicId: string; slug: string; label: string; order: number }>();
    for (const it of items) {
      for (const lt of it.libraryItem.topics) {
        const t = lt.topic;
        if (!topicMap.has(t.id)) {
          topicMap.set(t.id, { topicId: t.id, slug: t.slug, label: t.label, order: t.order });
        }
      }
    }
    const topics = Array.from(topicMap.values()).sort((a, b) => a.order - b.order);

    const counts = new Map<string, number>();
    for (const it of items) {
      const u = it.weeklyPlan.userId;
      if (!memberSet.has(u)) continue;
      for (const lt of it.libraryItem.topics) {
        const key = `${u}|${lt.topic.id}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    const stuckSet = new Set<string>();
    for (const it of stuckItems) {
      const u = it.weeklyPlan.userId;
      if (!memberSet.has(u)) continue;
      for (const lt of it.libraryItem.topics) {
        stuckSet.add(`${u}|${lt.topic.id}`);
      }
    }

    const cells: Array<{ userId: string; topicId: string; itemsDone: number; hasStuckOrDoubts: boolean }> = [];
    const allKeys = new Set<string>([...counts.keys(), ...stuckSet]);
    for (const key of allKeys) {
      const [userId, topicId] = key.split('|');
      if (!topicMap.has(topicId)) continue;
      cells.push({
        userId,
        topicId,
        itemsDone: counts.get(key) ?? 0,
        hasStuckOrDoubts: stuckSet.has(key),
      });
    }

    return { members, topics, cells };
  }

  private async fetchItems(cycleId: string, startsAt: Date, asOf: Date) {
    const asOfEnd = new Date(asOf);
    asOfEnd.setUTCHours(23, 59, 59, 999);
    return this.prisma.weeklyPlanItem.findMany({
      where: {
        weeklyPlan: { cycleId },
        completedAt: { gte: startsAt, lte: asOfEnd },
        outcome: { in: Array.from(POSITIVE_OUTCOMES) },
      },
      include: {
        libraryItem: { include: { topics: { include: { topic: true } } } },
        weeklyPlan: { select: { userId: true } },
      },
    });
  }

  private computeTotals(items: any[], memberCount: number) {
    const totalMinutes = items.reduce(
      (s, it) => s + (it.libraryItem?.estimatedMinutes ?? 0),
      0,
    );
    return {
      totalMinutes,
      itemsCompleted: items.length,
      avgMinutesPerMember: memberCount > 0 ? Math.round(totalMinutes / memberCount) : 0,
    };
  }

  private computeByTopic(items: any[], memberCount: number) {
    const acc = new Map<string, {
      topicId: string; slug: string; label: string; order: number;
      members: Set<string>; itemsCompleted: number;
    }>();
    for (const it of items) {
      const userId = it.weeklyPlan.userId;
      for (const lt of it.libraryItem.topics) {
        const t = lt.topic;
        let bucket = acc.get(t.id);
        if (!bucket) {
          bucket = {
            topicId: t.id, slug: t.slug, label: t.label, order: t.order,
            members: new Set(), itemsCompleted: 0,
          };
          acc.set(t.id, bucket);
        }
        bucket.members.add(userId);
        bucket.itemsCompleted += 1;
      }
    }
    return Array.from(acc.values())
      .filter(b => b.members.size > 0)
      .map(b => ({
        topicId: b.topicId, slug: b.slug, label: b.label, order: b.order,
        membersReached: b.members.size,
        itemsCompleted: b.itemsCompleted,
        coveragePct: memberCount > 0 ? b.members.size / memberCount : 0,
      }))
      .sort((a, b) => b.coveragePct - a.coveragePct || a.order - b.order);
  }

  private decideMode(cycle: any, asOf: Date): ReceiptMode {
    if (cycle.status === 'ARCHIVED') return 'wrapped';
    const asOfKey = asOf.toISOString().slice(0, 10);
    const endKey = (cycle.endsAt as Date).toISOString().slice(0, 10);
    if (asOfKey === endKey) return 'wrapped';
    return 'thermal';
  }
}

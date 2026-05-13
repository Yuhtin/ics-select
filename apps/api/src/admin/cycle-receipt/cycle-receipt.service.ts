import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { POSITIVE_OUTCOMES } from '@ics-select/shared';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { CycleReceiptResponse, ReceiptMode } from './cycle-receipt.types.js';

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
    const memberCount = cycle.memberships.length;
    const totalsBase = this.computeTotals(items, memberCount);
    const byTopic = this.computeByTopic(items, memberCount);
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
        retros: 0,
        classesHeld: 0,
        classesTotal: 0,
        attendanceRate: 0,
      },
      byTopic,
      knowledgeGrid: { members: [], topics: [], cells: [] },
      topMovers: [],
      cycleTopMover: null,
      streakChampion: null,
      retroChampions: [],
      perfectAttendance: [],
    };
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

import { Injectable } from '@nestjs/common';
import type { ItemOutcome } from '@ics-select/prisma';
import { POSITIVE_OUTCOMES, isPositiveOutcome } from '@ics-select/shared';
import { PrismaService } from '../../common/prisma/prisma.service.js';

const POSITIVE_OUTCOMES_ARR = Array.from(POSITIVE_OUTCOMES) as ItemOutcome[];

type HomeItem = {
  id: string;
  planId: string;
  order: number;
  title: string;
  format: string;
  estimatedMinutes: number;
  url: string | null;
  topic: { slug: string; label: string } | null;
  outcome: ItemOutcome;
  skippable: boolean;
  scheduledAt: string | null;
  scheduledMinutes: number | null;
  carriedFromItemId: string | null;
};

type HeroState =
  | { state: 'now'; item: HomeItem }
  | { state: 'up_next'; item: HomeItem; minutesUntil: number }
  | { state: 'running_late'; item: HomeItem; minutesLate: number }
  | { state: 'all_done'; nextAt: string | null }
  | { state: 'free_day'; nextAt: string | null };

export type CarryOverReflection = {
  itemId: string;
  title: string;
  reflection: string;
  submittedAt: string;
  weekLabel: string;
};

export type TopicCoverage = {
  topicId: string;
  slug: string;
  label: string;
  order: number;
  itemsPlanned: number;
  itemsDone: number;
};

export type HomeResponse = {
  hero: HeroState | null;
  today: HomeItem[];
  /** PENDING items from prior days within the current week's plan. Surfaced
   *  as a separate "earlier this week" bucket so members can see — and
   *  retroactively mark — work they didn't catch up the same day. */
  late: HomeItem[];
  days: { label: string; date: string; items: HomeItem[] }[];
  unscheduled: HomeItem[];
  streak: { current: number; last7: boolean[] };
  carryOverReflection: CarryOverReflection | null;
  topicCoverage: TopicCoverage[];
};

const NOW_WINDOW_MINUTES = 15;

function sameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

function formatDayLabel(d: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(d);
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function toHomeItem(row: any): HomeItem {
  const primaryTopic = (row.libraryItem.topics ?? []).find(
    (t: any) => t.isPrimary,
  );
  return {
    id: row.id,
    planId: row.weeklyPlanId,
    order: row.order,
    title: row.libraryItem.title,
    format: row.libraryItem.format,
    estimatedMinutes: row.libraryItem.estimatedMinutes,
    url: row.libraryItem.url ?? null,
    topic: primaryTopic
      ? { slug: primaryTopic.topic.slug, label: primaryTopic.topic.label }
      : null,
    outcome: row.outcome,
    skippable: (row.libraryItem.topics ?? []).some(
      (t: any) => t.topic.slug === 'foundations',
    ),
    scheduledAt: row.scheduledAt ? row.scheduledAt.toISOString() : null,
    scheduledMinutes: row.scheduledMinutes ?? null,
    carriedFromItemId: row.carriedFromItemId ?? null,
  };
}

@Injectable()
export class HomeService {
  constructor(private readonly prisma: PrismaService) {}

  async getHome(userId: string, now: Date = new Date()): Promise<HomeResponse> {
    const plan = await this.prisma.weeklyPlan.findFirst({
      where: {
        userId,
        status: 'PUBLISHED',
        weekStart: { lte: now },
        weekEnd: { gte: now },
      },
      orderBy: { weekStart: 'desc' },
    });

    if (!plan) {
      const streak = await this.computeStreak(userId, now);
      return {
        hero: null,
        today: [],
        late: [],
        days: [],
        unscheduled: [],
        streak,
        carryOverReflection: null,
        topicCoverage: [],
      };
    }

    const rawItems = await this.prisma.weeklyPlanItem.findMany({
      where: { weeklyPlanId: plan.id },
      include: {
        libraryItem: {
          include: {
            topics: {
              include: {
                topic: { select: { id: true, slug: true, label: true } },
              },
            },
          },
        },
      },
      orderBy: [{ scheduledAt: 'asc' }, { order: 'asc' }],
    });

    const items = rawItems.map(toHomeItem);

    const today: HomeItem[] = [];
    const late: HomeItem[] = [];
    const futureByDay = new Map<string, HomeItem[]>();
    const unscheduled: HomeItem[] = [];

    for (const item of items) {
      if (!item.scheduledAt) {
        // PENDING items the scheduler couldn't place (e.g. force-publish
        // overflow). DONE/SKIPPED items without scheduledAt are intentionally
        // dropped — their state is the historical record, not actionable.
        if (item.outcome === 'PENDING') unscheduled.push(item);
        continue;
      }
      const at = new Date(item.scheduledAt);
      if (sameUtcDay(at, now)) {
        today.push(item);
      } else if (at > now) {
        const key = toIsoDate(at);
        const arr = futureByDay.get(key) ?? [];
        arr.push(item);
        futureByDay.set(key, arr);
      } else if (item.outcome === 'PENDING') {
        // Overdue PENDING from a prior day in the current plan — surface
        // separately so members can catch up or retroactively mark.
        late.push(item);
      }
      // Else: completed/skipped items in past days are historical; drop.
    }

    unscheduled.sort((a, b) => a.order - b.order);
    late.sort((a, b) => (a.scheduledAt! < b.scheduledAt! ? -1 : 1));
    today.sort((a, b) => (a.scheduledAt! < b.scheduledAt! ? -1 : 1));

    const days = [...futureByDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, dayItems]) => ({
        date,
        label: formatDayLabel(new Date(date + 'T00:00:00Z')),
        items: dayItems.sort((a, b) => (a.scheduledAt! < b.scheduledAt! ? -1 : 1)),
      }));

    const hero = this.pickHero(today, late, days, now);
    const [streak, carryOverReflection, topicCoverage] = await Promise.all([
      this.computeStreak(userId, now),
      this.pickCarryOverReflection(userId, plan.id),
      this.computeTopicCoverage(userId, plan.cycleId),
    ]);

    return { hero, today, late, days, unscheduled, streak, carryOverReflection, topicCoverage };
  }

  private async pickCarryOverReflection(
    userId: string,
    currentPlanId: string,
  ): Promise<CarryOverReflection | null> {
    // Latest reflection on a DOUBTS or STUCK item from a prior published plan.
    // Used to surface a "carried over" memory on the home page.
    const row = await this.prisma.weeklyPlanItem.findFirst({
      where: {
        weeklyPlan: { userId, status: 'PUBLISHED' },
        weeklyPlanId: { not: currentPlanId },
        outcome: { in: ['DOUBTS', 'STUCK'] },
        reflection: { not: null },
        completedAt: { not: null },
      },
      orderBy: { completedAt: 'desc' },
      include: {
        libraryItem: { select: { title: true } },
        weeklyPlan: { select: { weekStart: true } },
      },
    });
    if (!row || !row.reflection || !row.completedAt) return null;
    return {
      itemId: row.id,
      title: row.libraryItem.title,
      reflection: row.reflection,
      submittedAt: row.completedAt.toISOString(),
      weekLabel: new Intl.DateTimeFormat('en-US', {
        weekday: 'short',
        timeZone: 'UTC',
      }).format(row.weeklyPlan.weekStart),
    };
  }

  private async computeTopicCoverage(
    userId: string,
    cycleId: string,
  ): Promise<TopicCoverage[]> {
    const [topics, items] = await Promise.all([
      this.prisma.topic.findMany({ orderBy: { order: 'asc' } }),
      this.prisma.weeklyPlanItem.findMany({
        where: { weeklyPlan: { userId, cycleId } },
        select: {
          outcome: true,
          libraryItem: {
            select: {
              topics: { select: { topicId: true } },
            },
          },
        },
      }),
    ]);

    const byTopic = new Map<string, { planned: number; done: number }>();
    for (const t of topics) byTopic.set(t.id, { planned: 0, done: 0 });
    // An item with N topics (primary + covers) contributes to all N topics'
    // coverage. Cross-topic videos "complete" every topic they touch.
    for (const it of items) {
      const topicIds = it.libraryItem?.topics?.map((t) => t.topicId) ?? [];
      const done = isPositiveOutcome(it.outcome);
      for (const topicId of topicIds) {
        const stat = byTopic.get(topicId);
        if (!stat) continue;
        stat.planned += 1;
        if (done) stat.done += 1;
      }
    }

    return topics.map((t) => {
      const stat = byTopic.get(t.id) ?? { planned: 0, done: 0 };
      return {
        topicId: t.id,
        slug: t.slug,
        label: t.label,
        order: t.order,
        itemsPlanned: stat.planned,
        itemsDone: stat.done,
      };
    });
  }

  private pickHero(
    today: HomeItem[],
    late: HomeItem[],
    days: HomeResponse['days'],
    now: Date,
  ): HeroState | null {
    const nowMs = now.getTime();

    // 1) "now" — a pending item whose scheduled window (minus a 15-min lead-in,
    //    plus its scheduledMinutes block) contains the current time.
    const nowItem = today.find((i) => {
      if (i.outcome !== 'PENDING' || !i.scheduledAt) return false;
      const startMs = new Date(i.scheduledAt).getTime();
      const durationMs = (i.scheduledMinutes ?? 0) * 60_000;
      const windowStart = startMs - NOW_WINDOW_MINUTES * 60_000;
      const windowEnd = startMs + durationMs;
      return nowMs >= windowStart && nowMs <= windowEnd;
    });
    if (nowItem) return { state: 'now', item: nowItem };

    // 2) "running_late" — oldest carry-over from prior days first, else
    //    today's past-window pending items.
    const lateItem =
      late[0] ??
      today.find((i) => {
        if (i.outcome !== 'PENDING' || !i.scheduledAt) return false;
        const startMs = new Date(i.scheduledAt).getTime();
        const durationMs = (i.scheduledMinutes ?? 0) * 60_000;
        return startMs + durationMs < nowMs;
      });
    if (lateItem) {
      const endMs =
        new Date(lateItem.scheduledAt!).getTime() +
        (lateItem.scheduledMinutes ?? 0) * 60_000;
      const minutesLate = Math.round((nowMs - endMs) / 60_000);
      return { state: 'running_late', item: lateItem, minutesLate };
    }

    // 3) "up_next" — next pending item today
    const upNext = today.find((i) => i.outcome === 'PENDING' && i.scheduledAt && new Date(i.scheduledAt).getTime() > nowMs);
    if (upNext) {
      const minutesUntil = Math.round((new Date(upNext.scheduledAt!).getTime() - nowMs) / 60_000);
      return { state: 'up_next', item: upNext, minutesUntil };
    }

    // 4) "all_done" — today has items but none PENDING (and no carry-over)
    if (today.length > 0) {
      const nextAt = days[0]?.items[0]?.scheduledAt ?? null;
      return { state: 'all_done', nextAt };
    }

    // 5) "free_day" — today has no items
    const nextAt = days[0]?.items[0]?.scheduledAt ?? null;
    return { state: 'free_day', nextAt };
  }

  private async computeStreak(userId: string, now: Date): Promise<{ current: number; last7: boolean[] }> {
    // Look back up to 30 days; pull items with positive outcomes grouped by day.
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 30);

    const rows = await this.prisma.weeklyPlanItem.findMany({
      where: {
        weeklyPlan: { userId },
        outcome: { in: POSITIVE_OUTCOMES_ARR },
        completedAt: { gte: thirtyDaysAgo },
      },
      select: { completedAt: true },
    });

    const positiveDays = new Set<string>();
    for (const row of rows) {
      if (!row.completedAt) continue;
      positiveDays.add(toIsoDate(row.completedAt));
    }

    // last 7 days, oldest first
    const last7: boolean[] = [];
    for (let offset = 6; offset >= 0; offset--) {
      const day = new Date(now);
      day.setUTCDate(day.getUTCDate() - offset);
      last7.push(positiveDays.has(toIsoDate(day)));
    }

    // current streak: walk backwards from today; break when two consecutive zero-positive days occur
    let current = 0;
    let zeroStreak = 0;
    for (let offset = 0; offset < 30; offset++) {
      const day = new Date(now);
      day.setUTCDate(day.getUTCDate() - offset);
      const hasPositive = positiveDays.has(toIsoDate(day));
      if (hasPositive) {
        current++;
        zeroStreak = 0;
      } else {
        zeroStreak++;
        if (zeroStreak >= 2) break;
      }
    }

    return { current, last7 };
  }
}

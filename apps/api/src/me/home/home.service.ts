import { Injectable } from '@nestjs/common';
import type { ItemOutcome } from '@ics-select/prisma';
import { PrismaService } from '../../common/prisma/prisma.service.js';

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

export type HomeResponse = {
  hero: HeroState | null;
  today: HomeItem[];
  days: { label: string; date: string; items: HomeItem[] }[];
  streak: { current: number; last7: boolean[] };
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
  return {
    id: row.id,
    planId: row.weeklyPlanId,
    order: row.order,
    title: row.libraryItem.title,
    format: row.libraryItem.format,
    estimatedMinutes: row.libraryItem.estimatedMinutes,
    url: row.libraryItem.url ?? null,
    topic: row.libraryItem.topic
      ? { slug: row.libraryItem.topic.slug, label: row.libraryItem.topic.label }
      : null,
    outcome: row.outcome,
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
      return { hero: null, today: [], days: [], streak };
    }

    const rawItems = await this.prisma.weeklyPlanItem.findMany({
      where: { weeklyPlanId: plan.id },
      include: {
        libraryItem: {
          include: { topic: true },
        },
      },
      orderBy: [{ scheduledAt: 'asc' }, { order: 'asc' }],
    });

    const items = rawItems.map(toHomeItem);

    const today: HomeItem[] = [];
    const futureByDay = new Map<string, HomeItem[]>();

    for (const item of items) {
      if (!item.scheduledAt) continue;
      const at = new Date(item.scheduledAt);
      if (sameUtcDay(at, now)) {
        today.push(item);
      } else if (at > now) {
        const key = toIsoDate(at);
        const arr = futureByDay.get(key) ?? [];
        arr.push(item);
        futureByDay.set(key, arr);
      }
    }

    today.sort((a, b) => (a.scheduledAt! < b.scheduledAt! ? -1 : 1));

    const days = [...futureByDay.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, dayItems]) => ({
        date,
        label: formatDayLabel(new Date(date + 'T00:00:00Z')),
        items: dayItems.sort((a, b) => (a.scheduledAt! < b.scheduledAt! ? -1 : 1)),
      }));

    const hero = this.pickHero(today, days, now);
    const streak = await this.computeStreak(userId, now);

    return { hero, today, days, streak };
  }

  private pickHero(
    today: HomeItem[],
    days: HomeResponse['days'],
    now: Date,
  ): HeroState | null {
    const nowMs = now.getTime();

    // 1) "now" — a pending item scheduled within NOW_WINDOW_MINUTES
    const nowItem = today.find((i) => {
      if (i.outcome !== 'PENDING' || !i.scheduledAt) return false;
      const diffMin = (new Date(i.scheduledAt).getTime() - nowMs) / 60_000;
      return Math.abs(diffMin) <= NOW_WINDOW_MINUTES;
    });
    if (nowItem) return { state: 'now', item: nowItem };

    // 2) "running_late" — pending item scheduled earlier today
    const lateItem = today.find((i) => {
      if (i.outcome !== 'PENDING' || !i.scheduledAt) return false;
      return new Date(i.scheduledAt).getTime() < nowMs;
    });
    if (lateItem) {
      const minutesLate = Math.round((nowMs - new Date(lateItem.scheduledAt!).getTime()) / 60_000);
      return { state: 'running_late', item: lateItem, minutesLate };
    }

    // 3) "up_next" — next pending item today
    const upNext = today.find((i) => i.outcome === 'PENDING' && i.scheduledAt && new Date(i.scheduledAt).getTime() > nowMs);
    if (upNext) {
      const minutesUntil = Math.round((new Date(upNext.scheduledAt!).getTime() - nowMs) / 60_000);
      return { state: 'up_next', item: upNext, minutesUntil };
    }

    // 4) "all_done" — today has items but none PENDING
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
        outcome: { in: ['DONE_EASY', 'DONE_HARD'] },
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

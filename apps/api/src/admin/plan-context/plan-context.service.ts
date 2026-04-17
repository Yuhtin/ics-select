import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  computeWeekPosition,
  resolveActiveMembership,
} from '../../common/cycle/active-cycle.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const POSITIVE = new Set(['DONE_EASY', 'DONE_HARD']);
const CARRY_OUTCOMES = new Set(['PENDING', 'DOUBTS', 'STUCK']);

const DEFAULT_AVAILABILITY = {
  mondayMinutes: 60,
  tuesdayMinutes: 60,
  wednesdayMinutes: 60,
  thursdayMinutes: 60,
  fridayMinutes: 60,
  saturdayMinutes: 0,
  sundayMinutes: 0,
  preferredSessionMinutes: 60,
  timezone: 'America/Sao_Paulo',
};

type Outcome = 'PENDING' | 'DONE_EASY' | 'DONE_HARD' | 'DOUBTS' | 'STUCK';
type CarryOutcome = 'PENDING' | 'DOUBTS' | 'STUCK';

export type PlanContextResponse = {
  member: {
    id: string;
    name: string;
    pictureUrl: string | null;
    track: string | null;
  };
  cycle: {
    id: string;
    name: string;
    weekNumber: number;
    weeksTotal: number;
  };
  lastWeek: {
    weekStart: string | null;
    outcomes: {
      done_easy: number;
      done_hard: number;
      doubts: number;
      stuck: number;
      pending: number;
    };
    items: Array<{
      id: string;
      libraryItemId: string;
      title: string;
      outcome: Outcome;
      reflection: string | null;
    }>;
  };
  carryOverCandidates: Array<{
    id: string;
    libraryItemId: string;
    title: string;
    outcome: CarryOutcome;
    reflection: string | null;
    topicId: string | null;
    topicLabel: string | null;
    estimatedMinutes: number;
  }>;
  retro: {
    whatClicked: string | null;
    whatStuck: string | null;
    nextWeekWish: string | null;
    submittedAt: string;
  } | null;
  topicCoverage: Array<{
    topicId: string;
    topicSlug: string;
    topicLabel: string;
    order: number;
    itemsPlanned: number;
    itemsDone: number;
    coveragePct: number;
  }>;
  availability: {
    mondayMinutes: number;
    tuesdayMinutes: number;
    wednesdayMinutes: number;
    thursdayMinutes: number;
    fridayMinutes: number;
    saturdayMinutes: number;
    sundayMinutes: number;
    preferredSessionMinutes: number;
    weeklyBudgetMinutes: number;
    timezone: string;
  };
};

type LastWeekItem = {
  id: string;
  libraryItemId: string;
  outcome: Outcome;
  reflection: string | null;
  libraryItem: {
    id: string;
    title: string;
    topicId: string | null;
    estimatedMinutes: number;
  };
};

type LastWeekPlan = {
  id: string;
  weekStart: Date;
  items: LastWeekItem[];
};

type CyclePlanItem = {
  outcome: Outcome;
  libraryItem: { topicId: string | null };
};

type CyclePlan = {
  id: string;
  items: CyclePlanItem[];
};

type AvailabilityRow = typeof DEFAULT_AVAILABILITY & { userId?: string };

type TopicRow = { id: string; slug: string; label: string; order: number };

type RetroRow = {
  whatClicked: string | null;
  whatStuck: string | null;
  nextWeekWish: string | null;
  submittedAt: Date;
};

@Injectable()
export class PlanContextService {
  constructor(private readonly prisma: PrismaService) {}

  async getContext(input: { memberId: string; weekStart: Date }, now: Date = new Date()): Promise<PlanContextResponse> {
    const member = await this.prisma.user.findUnique({
      where: { id: input.memberId },
      select: { id: true, name: true, pictureUrl: true },
    });
    if (!member) throw new NotFoundException('member not found');

    const membership = (await resolveActiveMembership(
      this.prisma,
      input.memberId,
      now,
    )) as {
      track: string | null;
      cycle: { id: string; name: string; startsAt: Date; endsAt: Date };
    } | null;
    if (!membership) throw new NotFoundException('member has no active cycle');

    const cycle = membership.cycle as {
      id: string;
      name: string;
      startsAt: Date;
      endsAt: Date;
    };

    const lastWeekStart = new Date(input.weekStart.getTime() - WEEK_MS);

    const [lastWeekPlan, thisCyclePlans, retro, availabilityRow, topics] = await Promise.all([
      this.prisma.weeklyPlan.findFirst({
        where: {
          userId: input.memberId,
          weekStart: lastWeekStart,
          status: 'PUBLISHED',
        },
        include: {
          items: {
            orderBy: { order: 'asc' },
            include: {
              libraryItem: {
                select: {
                  id: true,
                  title: true,
                  topicId: true,
                  estimatedMinutes: true,
                },
              },
            },
          },
        },
      }) as Promise<LastWeekPlan | null>,
      this.prisma.weeklyPlan.findMany({
        where: { cycleId: cycle.id, userId: input.memberId },
        select: {
          id: true,
          items: {
            select: {
              outcome: true,
              libraryItem: { select: { topicId: true } },
            },
          },
        },
      }) as Promise<CyclePlan[]>,
      this.prisma.weeklyRetro.findFirst({
        where: { userId: input.memberId, weekStart: lastWeekStart },
        select: {
          whatClicked: true,
          whatStuck: true,
          nextWeekWish: true,
          submittedAt: true,
        },
      }) as Promise<RetroRow | null>,
      this.prisma.memberAvailability.findUnique({
        where: { userId: input.memberId },
      }) as Promise<AvailabilityRow | null>,
      this.prisma.topic.findMany({ orderBy: { order: 'asc' } }) as Promise<TopicRow[]>,
    ]);

    const topicById = new Map(topics.map((t) => [t.id, t]));

    const { weekNumber, weeksTotal } = this.computeWeekNumber(cycle.startsAt, cycle.endsAt, now);

    const lastWeek = this.buildLastWeek(lastWeekPlan);
    const carryOverCandidates = this.buildCarryOver(lastWeekPlan, topicById);
    const topicCoverage = this.computeTopicCoverage(topics, thisCyclePlans);
    const availability = this.buildAvailability(availabilityRow);

    return {
      member: {
        id: member.id,
        name: member.name,
        pictureUrl: member.pictureUrl,
        track: membership.track ?? null,
      },
      cycle: {
        id: cycle.id,
        name: cycle.name,
        weekNumber,
        weeksTotal,
      },
      lastWeek,
      carryOverCandidates,
      retro: retro
        ? {
            whatClicked: retro.whatClicked,
            whatStuck: retro.whatStuck,
            nextWeekWish: retro.nextWeekWish,
            submittedAt: retro.submittedAt.toISOString(),
          }
        : null,
      topicCoverage,
      availability,
    };
  }

  private buildLastWeek(plan: LastWeekPlan | null): PlanContextResponse['lastWeek'] {
    if (!plan) {
      return {
        weekStart: null,
        outcomes: { done_easy: 0, done_hard: 0, doubts: 0, stuck: 0, pending: 0 },
        items: [],
      };
    }
    const outcomes = this.computeOutcomes(plan.items);
    const items = plan.items.map((item) => ({
      id: item.id,
      libraryItemId: item.libraryItemId,
      title: item.libraryItem.title,
      outcome: item.outcome,
      reflection: item.reflection,
    }));
    return {
      weekStart: plan.weekStart.toISOString(),
      outcomes,
      items,
    };
  }

  private computeOutcomes(items: LastWeekItem[]): PlanContextResponse['lastWeek']['outcomes'] {
    const out = { done_easy: 0, done_hard: 0, doubts: 0, stuck: 0, pending: 0 };
    for (const item of items) {
      switch (item.outcome) {
        case 'DONE_EASY':
          out.done_easy += 1;
          break;
        case 'DONE_HARD':
          out.done_hard += 1;
          break;
        case 'DOUBTS':
          out.doubts += 1;
          break;
        case 'STUCK':
          out.stuck += 1;
          break;
        case 'PENDING':
          out.pending += 1;
          break;
      }
    }
    return out;
  }

  private buildCarryOver(
    plan: LastWeekPlan | null,
    topicById: Map<string, TopicRow>,
  ): PlanContextResponse['carryOverCandidates'] {
    if (!plan) return [];
    return plan.items
      .filter((item) => CARRY_OUTCOMES.has(item.outcome))
      .map((item) => {
        const topic = item.libraryItem.topicId
          ? topicById.get(item.libraryItem.topicId) ?? null
          : null;
        return {
          id: item.id,
          libraryItemId: item.libraryItemId,
          title: item.libraryItem.title,
          outcome: item.outcome as CarryOutcome,
          reflection: item.reflection,
          topicId: item.libraryItem.topicId ?? null,
          topicLabel: topic?.label ?? null,
          estimatedMinutes: item.libraryItem.estimatedMinutes,
        };
      });
  }

  private computeTopicCoverage(
    topics: TopicRow[],
    plans: CyclePlan[],
  ): PlanContextResponse['topicCoverage'] {
    return topics.map((topic) => {
      let itemsPlanned = 0;
      let itemsDone = 0;
      for (const plan of plans) {
        for (const item of plan.items) {
          if (item.libraryItem.topicId !== topic.id) continue;
          itemsPlanned += 1;
          if (POSITIVE.has(item.outcome)) itemsDone += 1;
        }
      }
      const coveragePct = itemsPlanned === 0 ? 0 : Math.round((100 * itemsDone) / itemsPlanned);
      return {
        topicId: topic.id,
        topicSlug: topic.slug,
        topicLabel: topic.label,
        order: topic.order,
        itemsPlanned,
        itemsDone,
        coveragePct,
      };
    });
  }

  private buildAvailability(
    row: AvailabilityRow | null,
  ): PlanContextResponse['availability'] {
    const source = row ?? DEFAULT_AVAILABILITY;
    const weeklyBudgetMinutes =
      source.mondayMinutes +
      source.tuesdayMinutes +
      source.wednesdayMinutes +
      source.thursdayMinutes +
      source.fridayMinutes +
      source.saturdayMinutes +
      source.sundayMinutes;
    return {
      mondayMinutes: source.mondayMinutes,
      tuesdayMinutes: source.tuesdayMinutes,
      wednesdayMinutes: source.wednesdayMinutes,
      thursdayMinutes: source.thursdayMinutes,
      fridayMinutes: source.fridayMinutes,
      saturdayMinutes: source.saturdayMinutes,
      sundayMinutes: source.sundayMinutes,
      preferredSessionMinutes: source.preferredSessionMinutes,
      weeklyBudgetMinutes,
      timezone: source.timezone,
    };
  }

  private computeWeekNumber(
    startsAt: Date,
    endsAt: Date,
    now: Date,
  ): { weekNumber: number; weeksTotal: number } {
    const pos = computeWeekPosition({ id: '', startsAt, endsAt }, now);
    return { weekNumber: pos.weekNumber, weeksTotal: pos.weeksTotal };
  }
}

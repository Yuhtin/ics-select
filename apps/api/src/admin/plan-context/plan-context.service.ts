import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  computeWeekPosition,
  resolveActiveMembership,
} from '../../common/cycle/active-cycle.js';
import { POSITIVE_OUTCOMES } from '@ics-select/shared';
import { BusyCacheService } from '../../google-calendar/busy-cache.service.js';
import { computeRemainingWeekCapacity } from '../../scheduler/capacity.js';
import type { AvailabilitySlotInput, BusyBlock } from '../../scheduler/scheduler.types.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Returns `busy` with `subtract` intervals carved out. Each block in `busy`
 * is split / shrunk so any portion overlapping a `subtract` interval is
 * removed. Used so the remaining-capacity calc treats our own scheduled
 * items as available time (they are *the* plan; they shouldn't compete
 * with new items). Subtract intervals are merged first so overlapping
 * Calendar duplicates collapse cleanly.
 */
function subtractIntervals(
  busy: BusyBlock[],
  subtract: { start: Date; end: Date }[],
): BusyBlock[] {
  if (subtract.length === 0) return busy;
  const sorted = subtract
    .map((s) => ({ start: s.start.getTime(), end: s.end.getTime() }))
    .sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const s of sorted) {
    const last = merged[merged.length - 1];
    if (last && s.start <= last.end) {
      last.end = Math.max(last.end, s.end);
    } else {
      merged.push({ ...s });
    }
  }
  const out: BusyBlock[] = [];
  for (const block of busy) {
    let segments: { start: number; end: number }[] = [
      { start: block.start.getTime(), end: block.end.getTime() },
    ];
    for (const cut of merged) {
      const next: { start: number; end: number }[] = [];
      for (const seg of segments) {
        if (cut.end <= seg.start || cut.start >= seg.end) {
          next.push(seg);
          continue;
        }
        if (cut.start > seg.start) next.push({ start: seg.start, end: cut.start });
        if (cut.end < seg.end) next.push({ start: cut.end, end: seg.end });
      }
      segments = next;
      if (segments.length === 0) break;
    }
    for (const seg of segments) {
      if (seg.end > seg.start) {
        out.push({ start: new Date(seg.start), end: new Date(seg.end) });
      }
    }
  }
  return out;
}
// Only unfinished work carries over: PENDING (never started) and STUCK
// (couldn't finish). DOUBTS is positive — the study was done; the dúvida is
// surfaced as a member note in the timeline, not as a re-plan signal.
const CARRY_OUTCOMES = new Set(['PENDING', 'STUCK']);

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

type Outcome = 'PENDING' | 'DONE_EASY' | 'DONE_HARD' | 'DOUBTS' | 'STUCK' | 'SKIPPED';
type CarryOutcome = 'PENDING' | 'STUCK';

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
      skipped: number;
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
  /**
   * Latest non-PENDING outcome the member has logged per library item, across
   * every plan they've ever had. Lets the library picker hide items already
   * mastered (DONE_EASY/DONE_HARD/SKIPPED — SKIPPED means the member chose
   * to skip because they already knew it) and color the + button for items
   * that stalled (STUCK/DOUBTS).
   */
  memberHistory: Array<{
    libraryItemId: string;
    lastOutcome: 'DONE_EASY' | 'DONE_HARD' | 'DOUBTS' | 'STUCK' | 'SKIPPED';
  }>;
  retro: {
    whatClicked: string | null;
    whatStuck: string | null;
    nextWeekWish: string | null;
    submittedAt: string;
    valuedItem: { id: string; title: string; outcome: string } | null;
    stuckItem: { id: string; title: string; outcome: string } | null;
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
    /**
     * "How many more minutes can the admin add to this week's plan?" — sum
     * of remaining capacity per day from today through Sunday, computed via
     * the same intervals the scheduler uses (slot windows minus Google
     * Calendar busy, capped per-day). Null when the calendar lookup fails;
     * the badge falls back to weeklyBudgetMinutes - plannedMinutes in that
     * case (the old behavior).
     */
    remainingCapacityMinutes: number | null;
    /** Days from today through Sunday with remainingCapacityMinutes > 0. */
    daysRemaining: number;
    /** Declared availability slots — used by the plan editor week preview. */
    slots: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>;
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
    estimatedMinutes: number;
    topics: Array<{ topicId: string; isPrimary: boolean }>;
  };
};

type LastWeekPlan = {
  id: string;
  weekStart: Date;
  items: LastWeekItem[];
};

type CyclePlanItem = {
  outcome: Outcome;
  libraryItem: { topics: Array<{ topicId: string }> };
};

type CyclePlan = {
  id: string;
  items: CyclePlanItem[];
};

type AvailabilityRow = typeof DEFAULT_AVAILABILITY & { userId?: string };

type TopicRow = { id: string; slug: string; label: string; order: number };

type RetroLinkedItem = {
  id: string;
  outcome: string;
  libraryItem: { title: string };
} | null;

type RetroRow = {
  whatClicked: string | null;
  whatStuck: string | null;
  nextWeekWish: string | null;
  submittedAt: Date;
  valuedItem: RetroLinkedItem;
  stuckItem: RetroLinkedItem;
};

@Injectable()
export class PlanContextService {
  private readonly logger = new Logger(PlanContextService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly busyCache: BusyCacheService,
  ) {}

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
    const weekEnd = new Date(input.weekStart.getTime() + WEEK_MS);

    const [
      lastWeekPlan,
      thisCyclePlans,
      retro,
      availabilityRow,
      topics,
      memberItemsRaw,
      slotRows,
    ] = await Promise.all([
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
                  estimatedMinutes: true,
                  topics: {
                    select: { topicId: true, isPrimary: true },
                  },
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
              libraryItem: {
                select: {
                  topics: { select: { topicId: true } },
                },
              },
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
          valuedItem: {
            select: {
              id: true,
              outcome: true,
              libraryItem: { select: { title: true } },
            },
          },
          stuckItem: {
            select: {
              id: true,
              outcome: true,
              libraryItem: { select: { title: true } },
            },
          },
        },
      }) as Promise<RetroRow | null>,
      this.prisma.memberAvailability.findUnique({
        where: { userId: input.memberId },
      }) as Promise<AvailabilityRow | null>,
      this.prisma.topic.findMany({ orderBy: { order: 'asc' } }) as Promise<TopicRow[]>,
      // Pull every non-PENDING outcome the member has logged, newest first.
      // We dedupe by libraryItemId in JS keeping the first (= latest) row per
      // item to compute memberHistory below.
      this.prisma.weeklyPlanItem.findMany({
        where: {
          weeklyPlan: { userId: input.memberId },
          outcome: { not: 'PENDING' },
        },
        orderBy: { weeklyPlan: { weekStart: 'desc' } },
        select: { libraryItemId: true, outcome: true },
      }) as Promise<Array<{ libraryItemId: string; outcome: Outcome | 'SKIPPED' }>>,
      this.prisma.availabilitySlot.findMany({
        where: { userId: input.memberId },
        select: { dayOfWeek: true, startMinute: true, endMinute: true },
      }) as Promise<AvailabilitySlotInput[]>,
    ]);

    const topicById = new Map(topics.map((t) => [t.id, t]));

    // weekNumber here answers "which week of the cycle is THIS PLAN for",
    // not "which week of the cycle is happening right now". Using now would
    // return 0 whenever the admin edits a plan before the cycle starts —
    // we want week 1 to render as week 1 even if the cycle kicks off Monday.
    const { weekNumber, weeksTotal } = this.computeWeekNumber(
      cycle.startsAt,
      cycle.endsAt,
      input.weekStart,
    );

    const lastWeek = this.buildLastWeek(lastWeekPlan);
    const carryOverCandidates = this.buildCarryOver(lastWeekPlan, topicById);
    const topicCoverage = this.computeTopicCoverage(topics, thisCyclePlans);
    const remaining = await this.computeRemainingCapacity({
      userId: input.memberId,
      weekStart: input.weekStart,
      weekEnd,
      now,
      slots: slotRows,
      availability: availabilityRow,
    });
    const availability = this.buildAvailability(availabilityRow, remaining, slotRows);

    // Latest outcome per library item — first occurrence wins because the query
    // ordered weekStart desc.
    const seen = new Set<string>();
    const memberHistory: PlanContextResponse['memberHistory'] = [];
    for (const row of memberItemsRaw) {
      if (seen.has(row.libraryItemId)) continue;
      seen.add(row.libraryItemId);
      memberHistory.push({
        libraryItemId: row.libraryItemId,
        lastOutcome: row.outcome as PlanContextResponse['memberHistory'][number]['lastOutcome'],
      });
    }

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
            valuedItem: retro.valuedItem
              ? {
                  id: retro.valuedItem.id,
                  title: retro.valuedItem.libraryItem.title,
                  outcome: retro.valuedItem.outcome,
                }
              : null,
            stuckItem: retro.stuckItem
              ? {
                  id: retro.stuckItem.id,
                  title: retro.stuckItem.libraryItem.title,
                  outcome: retro.stuckItem.outcome,
                }
              : null,
          }
        : null,
      topicCoverage,
      availability,
      memberHistory,
    };
  }

  private buildLastWeek(plan: LastWeekPlan | null): PlanContextResponse['lastWeek'] {
    if (!plan) {
      return {
        weekStart: null,
        outcomes: { done_easy: 0, done_hard: 0, doubts: 0, stuck: 0, skipped: 0, pending: 0 },
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
    const out = { done_easy: 0, done_hard: 0, doubts: 0, stuck: 0, skipped: 0, pending: 0 };
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
        case 'SKIPPED':
          out.skipped += 1;
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
        const primaryTopicId =
          item.libraryItem.topics.find((t) => t.isPrimary)?.topicId ?? null;
        const topic = primaryTopicId
          ? topicById.get(primaryTopicId) ?? null
          : null;
        return {
          id: item.id,
          libraryItemId: item.libraryItemId,
          title: item.libraryItem.title,
          outcome: item.outcome as CarryOutcome,
          reflection: item.reflection,
          topicId: primaryTopicId,
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
          const touchesTopic = item.libraryItem.topics.some(
            (t) => t.topicId === topic.id,
          );
          if (!touchesTopic) continue;
          itemsPlanned += 1;
          if (POSITIVE_OUTCOMES.has(item.outcome)) itemsDone += 1;
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
    remaining: { remainingCapacityMinutes: number | null; daysRemaining: number },
    slots: Array<{ dayOfWeek: number; startMinute: number; endMinute: number }>,
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
      remainingCapacityMinutes: remaining.remainingCapacityMinutes,
      daysRemaining: remaining.daysRemaining,
      slots: slots.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startMinute: s.startMinute,
        endMinute: s.endMinute,
      })),
    };
  }

  /**
   * Compute "minutes still addable this week" by combining the member's
   * declared availability (slot windows + per-day caps) with their actual
   * Google Calendar busy state. Mirrors the scheduler's view, so the
   * badge's number and what `reschedulePending` will fit are aligned.
   *
   * The intervals belonging to this plan's PUBLISHED items are subtracted
   * from busy *before* capacity is computed — otherwise items already in
   * the plan would compete with themselves for capacity (their Calendar
   * events show up in busy AND get counted in pendingMinutes downstream),
   * making the badge read "Over capacity" even when the scheduler had
   * actually fit everything just fine. The intent is that the number
   * answers "if I add MORE work, how much more fits?", regardless of how
   * full the plan currently is.
   *
   * Returns `remainingCapacityMinutes: null` if the calendar lookup fails
   * — the badge then falls back to the dumb (budget − planned) calc.
   */
  private async computeRemainingCapacity(params: {
    userId: string;
    weekStart: Date;
    weekEnd: Date;
    now: Date;
    slots: AvailabilitySlotInput[];
    availability: AvailabilityRow | null;
  }): Promise<{ remainingCapacityMinutes: number | null; daysRemaining: number }> {
    // Past weeks have no addable capacity; skip the calendar call entirely.
    if (params.weekEnd.getTime() <= params.now.getTime()) {
      return { remainingCapacityMinutes: 0, daysRemaining: 0 };
    }
    const av = params.availability ?? DEFAULT_AVAILABILITY;
    const caps: (number | null)[] = [
      av.mondayMinutes ?? null,
      av.tuesdayMinutes ?? null,
      av.wednesdayMinutes ?? null,
      av.thursdayMinutes ?? null,
      av.fridayMinutes ?? null,
      av.saturdayMinutes ?? null,
      av.sundayMinutes ?? null,
    ];
    let busy: BusyBlock[];
    try {
      // Cache stores the full week so the same payload serves every read
      // regardless of "now". The capacity helper clips by `now` itself
      // via buildEffectiveIntervals, so this is correct.
      busy = await this.busyCache.getWeekBusy(params.userId, params.weekStart, params.weekEnd);
    } catch (err) {
      this.logger.warn(
        `plan-context: getFreeBusy failed for user=${params.userId} · ${String(err)}`,
      );
      return { remainingCapacityMinutes: null, daysRemaining: 0 };
    }

    const ownIntervals = await this.loadOwnPlanIntervals(
      params.userId,
      params.weekStart,
    );
    const adjustedBusy = subtractIntervals(busy, ownIntervals);

    const out = computeRemainingWeekCapacity({
      weekStart: params.weekStart,
      slots: params.slots,
      caps,
      busyBlocks: adjustedBusy,
      timezone: av.timezone,
      now: params.now,
    });
    return {
      remainingCapacityMinutes: out.totalMinutes,
      daysRemaining: out.daysRemaining,
    };
  }

  /**
   * Returns the [start, end] intervals of the member's currently-scheduled
   * items for the given week. Used to remove our own Calendar events from
   * the busy list when computing remaining capacity. Items with no
   * scheduledAt or scheduledMinutes contribute no interval.
   */
  private async loadOwnPlanIntervals(
    userId: string,
    weekStart: Date,
  ): Promise<{ start: Date; end: Date }[]> {
    const items = await this.prisma.weeklyPlanItem.findMany({
      where: {
        weeklyPlan: { userId, weekStart },
        scheduledAt: { not: null },
        scheduledMinutes: { not: null },
      },
      select: { scheduledAt: true, scheduledMinutes: true },
    });
    return items
      .filter(
        (i): i is { scheduledAt: Date; scheduledMinutes: number } =>
          i.scheduledAt != null && i.scheduledMinutes != null,
      )
      .map((i) => ({
        start: i.scheduledAt,
        end: new Date(i.scheduledAt.getTime() + i.scheduledMinutes * 60_000),
      }));
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

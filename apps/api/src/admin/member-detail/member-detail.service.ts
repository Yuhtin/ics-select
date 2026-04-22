import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import {
  computeWeekPosition,
  resolveActiveMembership,
} from '../../common/cycle/active-cycle.js';

import type { ItemOutcome } from '@ics-select/shared';

const POSITIVE = new Set<ItemOutcome>(['DONE_EASY', 'DONE_HARD', 'SKIPPED']);
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function mondayUTC(d: Date): Date {
  const out = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const day = out.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  out.setUTCDate(out.getUTCDate() + diff);
  return out;
}

type Outcome = 'PENDING' | 'DONE_EASY' | 'DONE_HARD' | 'DOUBTS' | 'STUCK';
type Track =
  | 'BIG_TECH'
  | 'CONSULTING_TECH'
  | 'COMPETITIVE_PROGRAMMING'
  | 'STARTUP'
  | 'OTHER';
type PlanStatus = 'DRAFT' | 'PUBLISHED';
type Role = 'ADMIN' | 'MEMBER';
type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE';

export type MemberDetailResponse = {
  member: {
    id: string;
    name: string;
    email: string;
    pictureUrl: string | null;
    whatsappPhone: string | null;
    track: Track | null;
    role: Role;
  };
  cycle: {
    id: string;
    name: string;
    weekNumber: number;
    weeksTotal: number;
    startsAt: string;
    endsAt: string;
  } | null;
  memberships: Array<{
    cycleId: string;
    cycleName: string;
    cycleStartsAt: string;
    cycleEndsAt: string;
    status: 'ACTIVE' | 'ARCHIVED';
    isCurrent: boolean;
  }>;
  topicCoverage: Array<{
    topicId: string;
    topicSlug: string;
    topicLabel: string;
    order: number;
    itemsPlanned: number;
    itemsDone: number;
    coveragePct: number;
  }>;
  timeline: Array<{
    planId: string;
    weekStart: string;
    weekEnd: string;
    status: PlanStatus;
    items: Array<{
      id: string;
      libraryItemId: string;
      title: string;
      outcome: Outcome;
      reflection: string | null;
      completedAt: string | null;
      topicLabel: string | null;
    }>;
  }>;
  retros: Array<{
    id: string;
    weekStart: string;
    whatClicked: string | null;
    whatStuck: string | null;
    nextWeekWish: string | null;
    submittedAt: string;
  }>;
  attendance: Array<{
    classId: string;
    classTitle: string;
    scheduledAt: string;
    durationMin: number;
    topic: string | null;
    status: AttendanceStatus | null;
  }>;
  planWeeks: {
    current: PlanWeekSlot;
    next: PlanWeekSlot;
  };
};

export type PlanWeekSlot = {
  weekStart: string;
  weekEnd: string;
  inCycle: boolean;
  planId: string | null;
  status: PlanStatus | null;
};

type MemberRow = {
  id: string;
  name: string;
  email: string;
  pictureUrl: string | null;
  whatsappPhone: string | null;
  role: Role;
};

type MembershipRow = {
  userId: string;
  cycleId: string;
  track: Track | null;
  cycle: {
    id: string;
    name: string;
    startsAt: Date;
    endsAt: Date;
    status: 'ACTIVE' | 'ARCHIVED';
  };
};

type AllMembershipsRow = {
  cycleId: string;
  cycle: {
    id: string;
    name: string;
    startsAt: Date;
    endsAt: Date;
    status: 'ACTIVE' | 'ARCHIVED';
  };
};

type ClassSessionRow = {
  id: string;
  title: string;
  scheduledAt: Date;
  durationMin: number;
  topic: string | null;
  attendance: Array<{
    status: AttendanceStatus;
  }>;
};

type TimelinePlanItem = {
  id: string;
  libraryItemId: string;
  outcome: Outcome;
  reflection: string | null;
  completedAt: Date | null;
  libraryItem: {
    title: string;
    topics: Array<{ isPrimary: boolean; topic: { label: string } }>;
  };
};

type TimelinePlan = {
  id: string;
  weekStart: Date;
  weekEnd: Date;
  status: PlanStatus;
  items: TimelinePlanItem[];
};

type RetroRow = {
  id: string;
  weekStart: Date;
  whatClicked: string | null;
  whatStuck: string | null;
  nextWeekWish: string | null;
  submittedAt: Date;
};

type TopicRow = { id: string; slug: string; label: string; order: number };

type CyclePlanItem = {
  outcome: Outcome;
  libraryItem: { topics: Array<{ topicId: string }> };
};

type CyclePlan = {
  id: string;
  items: CyclePlanItem[];
};

@Injectable()
export class MemberDetailService {
  constructor(private readonly prisma: PrismaService) {}

  async getDetail(
    memberId: string,
    cycleIdParam: string | null = null,
    now: Date = new Date(),
  ): Promise<MemberDetailResponse> {
    const member = (await this.prisma.user.findUnique({
      where: { id: memberId },
      select: {
        id: true,
        name: true,
        email: true,
        pictureUrl: true,
        whatsappPhone: true,
        role: true,
      },
    })) as MemberRow | null;
    if (!member) throw new NotFoundException('member not found');

    // Resolve the membership for the selected cycle (or active cycle).
    let membership: MembershipRow | null;
    if (cycleIdParam) {
      const explicit = (await this.prisma.cycleMembership.findFirst({
        where: { userId: memberId, cycleId: cycleIdParam },
        include: { cycle: true },
      })) as MembershipRow | null;
      if (!explicit) throw new NotFoundException('member is not in that cycle');
      membership = explicit;
    } else {
      membership = (await resolveActiveMembership(
        this.prisma,
        memberId,
        now,
      )) as MembershipRow | null;
    }

    const resolvedCycleId = membership?.cycleId ?? null;

    const [timelinePlans, retros, topics, cyclePlans, allMemberships, classes] =
      await Promise.all([
        this.prisma.weeklyPlan.findMany({
          where: { userId: memberId, status: 'PUBLISHED' },
          orderBy: { weekStart: 'desc' },
          take: 6,
          include: {
            items: {
              include: {
                libraryItem: {
                  select: {
                    title: true,
                    topics: {
                      select: {
                        isPrimary: true,
                        topic: { select: { label: true } },
                      },
                    },
                  },
                },
              },
              orderBy: { order: 'asc' },
            },
          },
        }) as Promise<TimelinePlan[]>,
        this.prisma.weeklyRetro.findMany({
          where: { userId: memberId },
          orderBy: { submittedAt: 'desc' },
          take: 8,
        }) as Promise<RetroRow[]>,
        this.prisma.topic.findMany({ orderBy: { order: 'asc' } }) as Promise<TopicRow[]>,
        resolvedCycleId
          ? (this.prisma.weeklyPlan.findMany({
              where: { cycleId: resolvedCycleId, userId: memberId },
              include: {
                items: {
                  include: {
                    libraryItem: {
                      select: {
                        topics: { select: { topicId: true } },
                      },
                    },
                  },
                },
              },
            }) as Promise<CyclePlan[]>)
          : Promise.resolve([] as CyclePlan[]),
        this.prisma.cycleMembership.findMany({
          where: { userId: memberId },
          include: { cycle: true },
          orderBy: { cycle: { startsAt: 'desc' } },
        }) as Promise<AllMembershipsRow[]>,
        resolvedCycleId
          ? (this.prisma.classSession.findMany({
              where: { cycleId: resolvedCycleId },
              orderBy: { scheduledAt: 'desc' },
              include: {
                attendance: { where: { userId: memberId }, take: 1 },
              },
            }) as Promise<ClassSessionRow[]>)
          : Promise.resolve([] as ClassSessionRow[]),
      ]);

    const cycle = membership
      ? this.buildCycle(membership.cycle, now)
      : null;

    const topicCoverage = membership
      ? this.computeTopicCoverage(topics, cyclePlans)
      : [];

    const planWeeks = await this.buildPlanWeeks(
      memberId,
      membership?.cycle ?? null,
      now,
    );

    return {
      member: {
        id: member.id,
        name: member.name,
        email: member.email,
        pictureUrl: member.pictureUrl,
        whatsappPhone: member.whatsappPhone,
        track: membership?.track ?? null,
        role: member.role,
      },
      cycle,
      memberships: allMemberships.map((m) => ({
        cycleId: m.cycle.id,
        cycleName: m.cycle.name,
        cycleStartsAt: m.cycle.startsAt.toISOString(),
        cycleEndsAt: m.cycle.endsAt.toISOString(),
        status: m.cycle.status,
        isCurrent: m.cycle.id === resolvedCycleId,
      })),
      topicCoverage,
      timeline: timelinePlans.map((plan) => ({
        planId: plan.id,
        weekStart: plan.weekStart.toISOString(),
        weekEnd: plan.weekEnd.toISOString(),
        status: plan.status,
        items: plan.items.map((item) => ({
          id: item.id,
          libraryItemId: item.libraryItemId,
          title: item.libraryItem.title,
          outcome: item.outcome,
          reflection: item.reflection,
          completedAt: item.completedAt ? item.completedAt.toISOString() : null,
          topicLabel:
            item.libraryItem.topics.find((t) => t.isPrimary)?.topic.label ??
            null,
        })),
      })),
      retros: retros.map((r) => ({
        id: r.id,
        weekStart: r.weekStart.toISOString(),
        whatClicked: r.whatClicked,
        whatStuck: r.whatStuck,
        nextWeekWish: r.nextWeekWish,
        submittedAt: r.submittedAt.toISOString(),
      })),
      attendance: classes.map((cls) => ({
        classId: cls.id,
        classTitle: cls.title,
        scheduledAt: cls.scheduledAt.toISOString(),
        durationMin: cls.durationMin,
        topic: cls.topic,
        status: cls.attendance[0]?.status ?? null,
      })),
      planWeeks,
    };
  }

  private async buildPlanWeeks(
    memberId: string,
    cycle: { startsAt: Date; endsAt: Date } | null,
    now: Date,
  ): Promise<MemberDetailResponse['planWeeks']> {
    const currentStart = mondayUTC(now);
    const nextStart = new Date(currentStart.getTime() + WEEK_MS);

    const existing = (await this.prisma.weeklyPlan.findMany({
      where: {
        userId: memberId,
        weekStart: { in: [currentStart, nextStart] },
      },
      select: { id: true, weekStart: true, status: true },
    })) as Array<{ id: string; weekStart: Date; status: PlanStatus }>;

    const byStart = new Map(
      existing.map((p) => [p.weekStart.getTime(), p] as const),
    );

    const slot = (start: Date): PlanWeekSlot => {
      const end = new Date(start.getTime() + WEEK_MS - 1);
      const match = byStart.get(start.getTime());
      const inCycle =
        !!cycle && start >= cycle.startsAt && end <= cycle.endsAt;
      return {
        weekStart: start.toISOString(),
        weekEnd: end.toISOString(),
        inCycle,
        planId: match?.id ?? null,
        status: match?.status ?? null,
      };
    };

    return { current: slot(currentStart), next: slot(nextStart) };
  }

  private buildCycle(
    cycle: MembershipRow['cycle'],
    now: Date,
  ): MemberDetailResponse['cycle'] {
    const pos = computeWeekPosition(cycle, now);
    return {
      id: cycle.id,
      name: cycle.name,
      weekNumber: pos.weekNumber,
      weeksTotal: pos.weeksTotal,
      startsAt: cycle.startsAt.toISOString(),
      endsAt: cycle.endsAt.toISOString(),
    };
  }

  private computeTopicCoverage(
    topics: TopicRow[],
    plans: CyclePlan[],
  ): MemberDetailResponse['topicCoverage'] {
    return topics.map((topic) => {
      let itemsPlanned = 0;
      let itemsDone = 0;
      for (const plan of plans) {
        for (const item of plan.items) {
          // Item counts for this topic if the topic is in its primary OR
          // secondary covers (cross-topic items contribute to every topic
          // they cover, matching the home-screen topic coverage logic).
          const touchesTopic = item.libraryItem.topics.some(
            (t) => t.topicId === topic.id,
          );
          if (!touchesTopic) continue;
          itemsPlanned += 1;
          if (POSITIVE.has(item.outcome)) itemsDone += 1;
        }
      }
      const coveragePct =
        itemsPlanned === 0 ? 0 : Math.round((100 * itemsDone) / itemsPlanned);
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
}

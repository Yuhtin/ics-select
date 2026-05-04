import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { resolveActiveMembership } from '../../common/cycle/active-cycle.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function mondayUTC(d: Date): Date {
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = out.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  out.setUTCDate(out.getUTCDate() + diff);
  return out;
}

@Injectable()
export class PlanDraftsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Return-or-create a plan for the given member + week.
   *
   * If `weekStart` is omitted, the auto-pick is idempotent on the upcoming week:
   *   • Monday of max(today, cycle.startsAt)
   *   • if a plan already exists for that week (DRAFT or PUBLISHED), return it
   *   • else create a new DRAFT
   *   • if that Monday overflows past `cycle.endsAt`, fall back to the latest
   *     existing plan in the cycle (or throw PLAN_OUTSIDE_CYCLE if none)
   *
   * Picking a different week is the job of the /admin/plans overview — this
   * method never walks forward.
   *
   * When `weekStart` is provided but falls outside the cycle, we throw
   * PLAN_OUTSIDE_CYCLE as before.
   */
  async getOrCreateDraft(input: { memberId: string; weekStart?: Date }, now: Date = new Date()) {
    const membership = await resolveActiveMembership(this.prisma, input.memberId, now);
    if (!membership) throw new NotFoundException('member has no active cycle');
    const cycle = (membership as any).cycle as {
      id: string;
      startsAt: Date;
      endsAt: Date;
    };

    if (input.weekStart) {
      return this.returnOrCreate(input.memberId, cycle, input.weekStart, { strict: true });
    }

    // Auto-pick: the very next Monday >= max(now, cycle.startsAt).
    // If a plan already exists for that week (DRAFT or PUBLISHED), return it.
    // Else create a new DRAFT. No walking forward — that's what /admin/plans is for.
    const cursor = mondayUTC(now < cycle.startsAt ? cycle.startsAt : now);
    const weekStart = new Date(cursor);
    const weekEnd = new Date(weekStart.getTime() + WEEK_MS - 1);

    if (weekEnd > cycle.endsAt) {
      // No more weeks in this cycle — fall back to the latest existing plan
      // so the admin lands on something editable.
      const latest = await this.prisma.weeklyPlan.findFirst({
        where: { userId: input.memberId, cycleId: cycle.id },
        orderBy: { weekStart: 'desc' },
        include: { items: { include: { libraryItem: true }, orderBy: { order: 'asc' } } },
      });
      if (latest) return latest;
      throw new ConflictException({
        error: {
          code: 'PLAN_OUTSIDE_CYCLE',
          message: 'Não há semanas restantes no ciclo pra planejar.',
        },
      });
    }

    const existing = await this.prisma.weeklyPlan.findFirst({
      where: { userId: input.memberId, weekStart },
      include: { items: { include: { libraryItem: true }, orderBy: { order: 'asc' } } },
    });
    if (existing) return existing;
    return this.createDraft(input.memberId, cycle.id, weekStart, weekEnd);
  }

  private async returnOrCreate(
    memberId: string,
    cycle: { id: string; startsAt: Date; endsAt: Date },
    weekStart: Date,
    _opts: { strict: boolean },
  ) {
    const weekEnd = new Date(weekStart.getTime() + WEEK_MS - 1);
    if (weekStart < cycle.startsAt || weekEnd > cycle.endsAt) {
      throw new ConflictException({
        error: { code: 'PLAN_OUTSIDE_CYCLE', message: 'Semana fora do intervalo do ciclo' },
      });
    }

    const existing = await this.prisma.weeklyPlan.findFirst({
      where: { userId: memberId, weekStart },
      include: { items: { include: { libraryItem: true }, orderBy: { order: 'asc' } } },
    });
    if (existing) return existing;
    return this.createDraft(memberId, cycle.id, weekStart, weekEnd);
  }

  private async createDraft(
    memberId: string,
    cycleId: string,
    weekStart: Date,
    weekEnd: Date,
  ) {
    // Seed unfinished items from the previous week's PUBLISHED plan as
    // carry-overs. Mirrors the same PENDING/DOUBTS/STUCK rule the plan-context
    // service uses to surface candidates in the editor's left panel — keeps
    // the two views consistent. Only happens at creation time; reopening an
    // existing draft never re-seeds.
    const prevWeekStart = new Date(weekStart.getTime() - WEEK_MS);
    const prevPlan = await this.prisma.weeklyPlan.findFirst({
      where: {
        userId: memberId,
        weekStart: prevWeekStart,
        status: 'PUBLISHED',
      },
      select: {
        items: {
          where: { outcome: { in: ['PENDING', 'DOUBTS', 'STUCK'] } },
          orderBy: { order: 'asc' },
          select: { id: true, libraryItemId: true },
        },
      },
    });
    const carryItems = prevPlan?.items ?? [];

    return this.prisma.weeklyPlan.create({
      data: {
        userId: memberId,
        cycleId,
        weekStart,
        weekEnd,
        status: 'DRAFT',
        ...(carryItems.length > 0 && {
          items: {
            create: carryItems.map((src, idx) => ({
              libraryItemId: src.libraryItemId,
              order: idx,
              outcome: 'PENDING' as const,
              carriedFromItemId: src.id,
            })),
          },
        }),
      },
      include: { items: { include: { libraryItem: true }, orderBy: { order: 'asc' } } },
    });
  }
}

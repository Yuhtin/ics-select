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
   * If `weekStart` is omitted, picks the next plannable week automatically:
   *   • starts from the Monday of max(today, cycle.startsAt)
   *   • walks forward one week at a time until it finds a week without any
   *     existing plan for that member
   *   • if that would overflow past `cycle.endsAt`, returns the latest
   *     existing plan instead of creating a new one
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

    // Auto-pick: next Monday >= max(today, cycle.startsAt). If that week
    // already has a plan, walk forward until we find a free week.
    const cursor = mondayUTC(now < cycle.startsAt ? cycle.startsAt : now);
    // If the cursor is already past `now`'s week, that's fine — we want the
    // next free future-ish week anyway.
    let weekStart = new Date(cursor);
    for (let i = 0; i < 52; i += 1) {
      const weekEnd = new Date(weekStart.getTime() + WEEK_MS - 1);
      if (weekEnd > cycle.endsAt) {
        // Out of cycle — fall back to the most recent existing plan so the
        // admin at least lands on something editable.
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
      if (!existing) {
        return this.createDraft(input.memberId, cycle.id, weekStart, weekEnd);
      }
      // Occupied → try the next week.
      weekStart = new Date(weekStart.getTime() + WEEK_MS);
    }
    throw new ConflictException({
      error: {
        code: 'PLAN_OUTSIDE_CYCLE',
        message: 'Não consegui encontrar uma semana livre pra planejar.',
      },
    });
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

  private createDraft(
    memberId: string,
    cycleId: string,
    weekStart: Date,
    weekEnd: Date,
  ) {
    return this.prisma.weeklyPlan.create({
      data: {
        userId: memberId,
        cycleId,
        weekStart,
        weekEnd,
        status: 'DRAFT',
      },
      include: { items: { include: { libraryItem: true }, orderBy: { order: 'asc' } } },
    });
  }
}

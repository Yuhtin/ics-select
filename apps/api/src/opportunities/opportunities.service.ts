import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { closingDate, isOpportunityOpen, type OpportunityInput } from '@ics-select/shared';
import type { JwtStrategyPayload } from '../auth/strategies/jwt.strategy.js';
import { resolveActiveMembership } from '../common/cycle/active-cycle.js';
import { PrismaService } from '../common/prisma/prisma.service.js';

const INCLUDE = {
  createdBy: { select: { id: true, name: true, role: true } },
  interests: {
    orderBy: { createdAt: 'asc' as const },
    include: { user: { select: { name: true, pictureUrl: true } } },
  },
};

const toDate = (s: string | null | undefined) => (s ? new Date(`${s}T00:00:00Z`) : s === null ? null : undefined);
const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

@Injectable()
export class OpportunitiesService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertAccess(user: JwtStrategyPayload, now: Date) {
    if (user.role === 'ADMIN') return;
    if (!(await resolveActiveMembership(this.prisma, user.sub, now))) {
      throw new ForbiddenException('active membership required');
    }
  }

  private dto(o: any, user: JwtStrategyPayload, now: Date) {
    return {
      ...o,
      deadline: ymd(o.deadline),
      eventDate: ymd(o.eventDate),
      isOpen: isOpportunityOpen(o, now),
      interests: o.interests.map((i: any) => ({
        userId: i.userId, name: i.user.name, pictureUrl: i.user.pictureUrl, createdAt: i.createdAt,
      })),
      interestedByMe: o.interests.some((i: any) => i.userId === user.sub),
    };
  }

  async list(user: JwtStrategyPayload, opts: { interestedBy?: string }, now = new Date()) {
    await this.assertAccess(user, now);
    const admin = user.role === 'ADMIN';
    const interestedBy = admin ? opts.interestedBy : undefined;
    const rows = await this.prisma.opportunity.findMany({
      where: {
        ...(admin ? {} : { status: { in: ['PUBLISHED', 'ARCHIVED'] } }),
        ...(interestedBy ? { interests: { some: { userId: interestedBy } } } : {}),
      },
      include: INCLUDE,
    });
    // ponytail: sorted in memory, fine for tens to hundreds of rows; move to SQL if it grows.
    let out = rows.map((r) => this.dto(r, user, now));
    if (interestedBy) out = out.filter((o) => o.isOpen);
    const key = (o: any) => closingDate({ deadline: o.deadline, eventDate: o.eventDate }) ?? '￿';
    const pub = (o: any) => (o.publishedAt ? new Date(o.publishedAt).getTime() : 0);
    return out.sort(
      (a, b) =>
        Number(b.isOpen) - Number(a.isOpen) ||
        (a.isOpen ? key(a).localeCompare(key(b)) : 0) ||
        pub(b) - pub(a),
    );
  }

  async get(user: JwtStrategyPayload, id: string, now = new Date()) {
    await this.assertAccess(user, now);
    const row = await this.prisma.opportunity.findUnique({ where: { id }, include: INCLUDE });
    if (!row || (row.status === 'DRAFT' && user.role !== 'ADMIN')) throw new NotFoundException('opportunity not found');
    return this.dto(row, user, now);
  }

  async create(user: JwtStrategyPayload, input: OpportunityInput, now = new Date()) {
    await this.assertAccess(user, now);
    const status = user.role === 'ADMIN' ? (input.status ?? 'DRAFT') : 'PUBLISHED';
    const row = await this.prisma.opportunity.create({
      data: {
        ...input,
        status,
        deadline: toDate(input.deadline) ?? null,
        eventDate: toDate(input.eventDate) ?? null,
        publishedAt: status === 'PUBLISHED' ? now : null,
        createdById: user.sub,
      },
      include: INCLUDE,
    });
    return this.dto(row, user, now);
  }

  async update(user: JwtStrategyPayload, id: string, input: Partial<OpportunityInput>, now = new Date()) {
    await this.assertAccess(user, now);
    const cur = await this.prisma.opportunity.findUnique({ where: { id } });
    if (!cur) throw new NotFoundException('opportunity not found');
    const admin = user.role === 'ADMIN';
    if (!admin && cur.createdById !== user.sub) throw new ForbiddenException('not your opportunity');
    if (!admin && input.status === 'DRAFT') throw new BadRequestException('members cannot set DRAFT');
    const { deadline, eventDate, ...rest } = input;
    const row = await this.prisma.opportunity.update({
      where: { id },
      data: {
        ...rest,
        deadline: toDate(deadline),
        eventDate: toDate(eventDate),
        ...(input.status === 'PUBLISHED' && !cur.publishedAt ? { publishedAt: now } : {}),
      },
      include: INCLUDE,
    });
    return this.dto(row, user, now);
  }

  async remove(id: string) {
    const { count } = await this.prisma.opportunity.deleteMany({ where: { id } });
    if (!count) throw new NotFoundException('opportunity not found');
    return { ok: true };
  }

  async setInterest(user: JwtStrategyPayload, id: string, on: boolean, now = new Date()) {
    await this.assertAccess(user, now);
    const opp = await this.prisma.opportunity.findUnique({ where: { id } });
    if (!opp || (opp.status === 'DRAFT' && user.role !== 'ADMIN')) throw new NotFoundException('opportunity not found');
    if (!isOpportunityOpen(opp, now)) throw new ConflictException('opportunity is closed');
    const key = { userId: user.sub, opportunityId: id };
    if (on) {
      await this.prisma.opportunityInterest.upsert({
        where: { userId_opportunityId: key }, create: key, update: {},
      });
    } else {
      await this.prisma.opportunityInterest.deleteMany({ where: key });
    }
    return { ok: true };
  }
}

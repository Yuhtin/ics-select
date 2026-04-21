import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { resolveWaitlistTargetCycle } from '../common/cycle/active-cycle.js';
import type { SubmitWaitlistDto } from './dto/submit-waitlist.dto.js';
import type { ListWaitlistQuery } from './dto/list-waitlist.query.js';
import type { Course } from '@ics-select/prisma';

type WaitlistRow = {
  id: string;
  name: string;
  email: string;
  course: Course;
  skillLevel: number;
  github: string | null;
  linkedin: string | null;
  wantsUpdates: boolean;
  cycleTarget: string;
  ipHash: string | null;
  userAgent: string | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class WaitlistService {
  constructor(private readonly prisma: PrismaService) {}

  async submit(dto: SubmitWaitlistDto, ipHash: string | null, userAgent: string | null) {
    // Honeypot — bot filled the hidden field.
    if (dto.website && dto.website.length > 0) {
      return { ok: true as const };
    }

    const cycle = await resolveWaitlistTargetCycle(this.prisma);
    if (!cycle) {
      throw new ServiceUnavailableException(
        'Waitlist fechada: próximo ciclo ainda não foi programado.',
      );
    }

    const data = {
      name: dto.name,
      email: dto.email,
      course: dto.course as Course,
      skillLevel: dto.skillLevel,
      github: dto.github ?? null,
      linkedin: dto.linkedin ?? null,
      wantsUpdates: dto.wantsUpdates,
      cycleTarget: cycle.name,
      ipHash,
      userAgent,
    };

    await this.prisma.waitlistEntry.upsert({
      where: { email: dto.email },
      create: data,
      update: data,
    });

    return { ok: true as const };
  }

  async getConfig(): Promise<{ cycleTarget: string; startsAt: string } | null> {
    const cycle = await resolveWaitlistTargetCycle(this.prisma);
    if (!cycle) return null;
    return { cycleTarget: cycle.name, startsAt: cycle.startsAt.toISOString() };
  }

  async list(query: ListWaitlistQuery) {
    const where = this.buildWhere(query);
    const skip = (query.page - 1) * query.pageSize;
    const [items, total] = await Promise.all([
      this.prisma.waitlistEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.pageSize,
      }),
      this.prisma.waitlistEntry.count({ where }),
    ]);
    return { items: items as WaitlistRow[], total, page: query.page, pageSize: query.pageSize };
  }

  async stats() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [total, last7d, wantsUpdatesCount, courseGroups, skillGroups] = await Promise.all([
      this.prisma.waitlistEntry.count(),
      this.prisma.waitlistEntry.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.waitlistEntry.count({ where: { wantsUpdates: true } }),
      this.prisma.waitlistEntry.groupBy({ by: ['course'],      _count: { _all: true } }),
      this.prisma.waitlistEntry.groupBy({ by: ['skillLevel'],  _count: { _all: true } }),
    ]);
    return {
      total,
      last7d,
      wantsUpdatesPct: total > 0 ? Math.round((wantsUpdatesCount / total) * 100) : 0,
      byCourse: courseGroups.map((g: any) => ({ course: g.course as Course, count: g._count._all })),
      bySkill:  skillGroups.map((g: any) => ({ skillLevel: g.skillLevel as number, count: g._count._all })),
    };
  }

  async *iterateAll(): AsyncGenerator<WaitlistRow> {
    const PAGE = 500;
    let cursor: string | undefined;
    while (true) {
      const rows = (await this.prisma.waitlistEntry.findMany({
        orderBy: { createdAt: 'desc' },
        take: PAGE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      })) as WaitlistRow[];
      if (rows.length === 0) return;
      for (const r of rows) yield r;
      if (rows.length < PAGE) return;
      cursor = rows[rows.length - 1]!.id;
    }
  }

  private buildWhere(q: ListWaitlistQuery) {
    const where: Record<string, unknown> = {};
    if (q.course)       where.course = q.course;
    if (q.skillMin || q.skillMax) {
      where.skillLevel = {
        ...(q.skillMin ? { gte: q.skillMin } : {}),
        ...(q.skillMax ? { lte: q.skillMax } : {}),
      };
    }
    if (q.wantsUpdates !== undefined) where.wantsUpdates = q.wantsUpdates;
    if (q.q) {
      where.OR = [
        { name:  { contains: q.q, mode: 'insensitive' } },
        { email: { contains: q.q.toLowerCase() } },
      ];
    }
    return where;
  }
}

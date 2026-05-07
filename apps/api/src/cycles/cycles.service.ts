import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { findOverlappingActiveMembership } from '../common/cycle/active-cycle.js';

type CreateInput = { name: string; startsAt: Date; endsAt: Date };
type UpdateInput = Partial<CreateInput> & { rankingVisibleToMembers?: boolean };

@Injectable()
export class CyclesService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateInput) {
    return this.prisma.cycle.create({
      data: { ...input, status: 'ACTIVE' },
    });
  }

  list() {
    return this.prisma.cycle.findMany({
      orderBy: { startsAt: 'desc' },
      include: {
        _count: { select: { memberships: true } },
        memberships: { select: { userId: true } },
      },
    });
  }

  async getById(id: string) {
    const c = await this.prisma.cycle.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            user: { select: { id: true, name: true, email: true, pictureUrl: true } },
          },
        },
        weeklyPlans: {
          select: {
            id: true,
            userId: true,
            weekStart: true,
            weekEnd: true,
            status: true,
            _count: { select: { items: true } },
            items: { select: { outcome: true } },
          },
          orderBy: { weekStart: 'desc' },
        },
      },
    });
    if (!c) throw new NotFoundException('cycle not found');
    return c;
  }

  update(id: string, input: UpdateInput) {
    return this.prisma.cycle.update({ where: { id }, data: input });
  }

  archive(id: string) {
    return this.prisma.cycle.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }

  async addMember(cycleId: string, userId: string) {
    const cycle = await this.prisma.cycle.findUnique({ where: { id: cycleId } });
    if (!cycle) throw new NotFoundException('cycle not found');

    // One active membership per user: reject if the user is already in any
    // non-ARCHIVED cycle whose date range overlaps the target. Archived
    // cycles never block — they are how the admin retires a cycle.
    const conflict = await findOverlappingActiveMembership(this.prisma, userId, cycle);
    if (conflict) {
      throw new ConflictException({
        code: 'member-already-in-overlapping-cycle',
        message: `Member is already enrolled in "${conflict.cycle.name}", which overlaps this cycle. Remove or archive that membership first.`,
        conflictCycleId: conflict.cycle.id,
        conflictCycleName: conflict.cycle.name,
      });
    }

    const membership = await this.prisma.cycleMembership.create({
      data: { cycleId, userId },
    });
    // Once the user is enrolled in any cycle the pending InvitedEmail row
    // has served its purpose — drop it so the admin UI stops listing them
    // as pending. Safe no-op if there was no invite (bootstrap admins, etc).
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (user?.email) {
      await this.prisma.invitedEmail.deleteMany({ where: { email: user.email } });
    }
    return membership;
  }

  async removeMember(cycleId: string, userId: string) {
    return this.prisma.cycleMembership.deleteMany({
      where: { cycleId, userId },
    });
  }
}

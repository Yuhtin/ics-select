import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Role } from '@ics-select/prisma';
import { PrismaService } from '../../common/prisma/prisma.service.js';

type CycleSummary = {
  id: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
};

type ListedInvite = {
  id: string;
  email: string;
  role: Role;
  createdAt: Date;
  createdBy: { id: string; name: string; email: string } | null;
  cycle: CycleSummary | null;
};

@Injectable()
export class InvitesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<ListedInvite[]> {
    const rows = await this.prisma.invitedEmail.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        cycle: { select: { id: true, name: true, startsAt: true, endsAt: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      role: r.role,
      createdAt: r.createdAt,
      createdBy: r.createdBy
        ? { id: r.createdBy.id, name: r.createdBy.name, email: r.createdBy.email }
        : null,
      cycle: r.cycle
        ? {
            id: r.cycle.id,
            name: r.cycle.name,
            startsAt: r.cycle.startsAt,
            endsAt: r.cycle.endsAt,
          }
        : null,
    }));
  }

  async create(input: {
    email: string;
    role: Role;
    cycleId?: string;
    createdById: string;
  }): Promise<ListedInvite> {
    const email = input.email.trim().toLowerCase();

    // MEMBER invites must specify a cycle — otherwise first-login wouldn't
    // know where to enroll the user. ADMIN invites are cycle-agnostic.
    if (input.role === 'MEMBER' && !input.cycleId) {
      throw new BadRequestException('cycle-required-for-member');
    }

    let cycleId: string | null = null;
    if (input.cycleId) {
      const cycle = await this.prisma.cycle.findUnique({
        where: { id: input.cycleId },
        select: { id: true, status: true },
      });
      if (!cycle) throw new NotFoundException('cycle-not-found');
      if (cycle.status === 'ARCHIVED') {
        throw new BadRequestException('cycle-archived');
      }
      cycleId = cycle.id;
    }

    // If a User row already exists for this email, inviting is a no-op —
    // that person already has access. Surface as 409 so the admin UI can
    // show a friendly "already a user" toast instead of silently creating a
    // duplicate invite.
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('user-already-exists');
    }

    try {
      const created = await this.prisma.invitedEmail.create({
        data: {
          email,
          role: input.role,
          cycleId,
          createdById: input.createdById,
        },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
          cycle: { select: { id: true, name: true, startsAt: true, endsAt: true } },
        },
      });
      return {
        id: created.id,
        email: created.email,
        role: created.role,
        createdAt: created.createdAt,
        createdBy: created.createdBy
          ? {
              id: created.createdBy.id,
              name: created.createdBy.name,
              email: created.createdBy.email,
            }
          : null,
        cycle: created.cycle
          ? {
              id: created.cycle.id,
              name: created.cycle.name,
              startsAt: created.cycle.startsAt,
              endsAt: created.cycle.endsAt,
            }
          : null,
      };
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'P2002') throw new ConflictException('invite-already-exists');
      throw err;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.prisma.invitedEmail.delete({ where: { id } });
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'P2025') throw new NotFoundException('invite-not-found');
      throw err;
    }
  }
}

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Role } from '@ics-select/prisma';
import { PrismaService } from '../../common/prisma/prisma.service.js';

type ListedInvite = {
  id: string;
  email: string;
  role: Role;
  createdAt: Date;
  createdBy: { id: string; name: string; email: string } | null;
};

@Injectable()
export class InvitesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<ListedInvite[]> {
    const rows = await this.prisma.invitedEmail.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
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
    }));
  }

  async create(input: {
    email: string;
    role: Role;
    createdById: string;
  }): Promise<ListedInvite> {
    const email = input.email.trim().toLowerCase();

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
        data: { email, role: input.role, createdById: input.createdById },
        include: {
          createdBy: { select: { id: true, name: true, email: true } },
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

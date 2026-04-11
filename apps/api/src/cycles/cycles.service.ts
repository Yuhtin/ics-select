import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';

type CreateInput = { name: string; startsAt: Date; endsAt: Date };
type UpdateInput = Partial<CreateInput>;

@Injectable()
export class CyclesService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateInput) {
    return this.prisma.cycle.create({
      data: { ...input, status: 'ACTIVE' },
    });
  }

  list() {
    return this.prisma.cycle.findMany({ orderBy: { startsAt: 'desc' } });
  }

  async getById(id: string) {
    const c = await this.prisma.cycle.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            user: true,
          },
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
    return this.prisma.cycleMembership.create({
      data: { cycleId, userId },
    });
  }

  async removeMember(cycleId: string, userId: string) {
    return this.prisma.cycleMembership.deleteMany({
      where: { cycleId, userId },
    });
  }
}

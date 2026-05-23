import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import type { CreateMockInput, UpdateMockInput } from './dto.js';

@Injectable()
export class MocksService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List mocks for a member, newest first. Optional `cycleId` narrows to a
   * single cycle — the cockpit always passes the currently selected cycle so
   * the KPI ("avg / N mocks") and the raw-data tab agree on scope.
   */
  listForMember(userId: string, cycleId?: string | null) {
    return this.prisma.mockInterview.findMany({
      where: { userId, ...(cycleId ? { cycleId } : {}) },
      orderBy: { conductedAt: 'desc' },
    });
  }

  create(input: CreateMockInput) {
    return this.prisma.mockInterview.create({
      data: {
        userId: input.userId,
        cycleId: input.cycleId,
        type: input.type,
        score: input.score,
        feedback: input.feedback ?? null,
        conductedBy: input.conductedBy ?? null,
        conductedAt: input.conductedAt ?? new Date(),
        topics: input.topics ?? [],
      },
    });
  }

  async update(id: string, input: UpdateMockInput) {
    const existing = await this.prisma.mockInterview.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('mock not found');
    return this.prisma.mockInterview.update({
      where: { id },
      data: {
        type: input.type,
        score: input.score,
        feedback: input.feedback,
        conductedBy: input.conductedBy,
        conductedAt: input.conductedAt,
        topics: input.topics,
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.mockInterview.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('mock not found');
    await this.prisma.mockInterview.delete({ where: { id } });
  }
}

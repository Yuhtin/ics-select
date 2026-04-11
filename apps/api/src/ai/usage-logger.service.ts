import { Injectable } from '@nestjs/common';
import { Prisma } from '@ics-select/prisma';
import { PrismaService } from '../common/prisma/prisma.service.js';
import type { Usage } from '../common/anthropic/anthropic.provider.js';

type LogInput = {
  userId: string | null;
  purpose: 'draft_plan' | 'brief_plan' | 'diagnose' | 'chat';
  model: string;
  usage: Usage;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class UsageLoggerService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: LogInput) {
    return this.prisma.aiGeneration.create({
      data: {
        userId: input.userId,
        purpose: input.purpose,
        model: input.model,
        promptTokens: input.usage.inputTokens,
        responseTokens: input.usage.outputTokens,
        costUsd: input.usage.costUsd,
        metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async getUsageForWeek(since: Date) {
    return this.prisma.aiGeneration.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
    });
  }
}

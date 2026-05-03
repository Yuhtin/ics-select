import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { PrismaService } from '../common/prisma/prisma.service.js';

const SESSION_GAP_MS = 30 * 60 * 1000;

type AuthedRequest = Request & { user?: { sub: string } };

@Injectable()
export class ActivityMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ActivityMiddleware.name);

  constructor(private readonly prisma: PrismaService) {}

  async use(req: AuthedRequest, _res: Response, next: NextFunction): Promise<void> {
    next();
    const userId = req.user?.sub;
    if (!userId) return;

    setImmediate(() => {
      void this.recordSessionStart(userId);
    });
  }

  private async recordSessionStart(userId: string): Promise<void> {
    try {
      const latest = await this.prisma.userEvent.findFirst({
        where: { userId },
        orderBy: { occurredAt: 'desc' },
        select: { occurredAt: true },
      });

      const isStale =
        !latest || Date.now() - latest.occurredAt.getTime() > SESSION_GAP_MS;
      if (!isStale) return;

      await this.prisma.userEvent.create({
        data: { userId, type: 'SESSION_START' },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to record SESSION_START for ${userId}: ${(err as Error).message}`,
      );
    }
  }
}

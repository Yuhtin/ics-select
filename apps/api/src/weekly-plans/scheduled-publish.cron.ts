import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { PublicationService } from './publication.service.js';

/**
 * Every minute, flip any SCHEDULED plan whose publishAt is <= now into
 * PUBLISHED and trigger its admin-picked side effects (Calendar events,
 * WhatsApp). Runs in-process via @nestjs/schedule — fine at the current
 * member count, not something we'd scale without a proper queue.
 */
@Injectable()
export class ScheduledPublishCron {
  private readonly logger = new Logger(ScheduledPublishCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publication: PublicationService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async flipDue(now: Date = new Date()): Promise<void> {
    const due = await this.prisma.weeklyPlan.findMany({
      where: {
        status: 'SCHEDULED',
        publishAt: { lte: now },
      },
      select: { id: true },
    });
    if (due.length === 0) return;

    this.logger.log(`scheduled publish: ${due.length} plan(s) due`);
    for (const { id } of due) {
      try {
        await this.publication.executeScheduledPublish(id, now);
      } catch (err) {
        this.logger.warn(`scheduled publish: ${id} failed: ${String(err)}`);
      }
    }
  }
}

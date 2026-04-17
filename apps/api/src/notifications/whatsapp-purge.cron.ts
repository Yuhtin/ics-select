import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service.js';

const RETENTION_DAYS = 90;

@Injectable()
export class WhatsappPurgeCron {
  private readonly logger = new Logger(WhatsappPurgeCron.name);

  constructor(private readonly prisma: PrismaService) {}

  // Daily at 03:10 UTC — off-peak for most timezones
  @Cron('10 3 * * *')
  async purge(now: Date = new Date()): Promise<void> {
    const cutoff = new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.whatsappLog.deleteMany({
      where: { sentAt: { lt: cutoff } },
    });
    if (count > 0) {
      this.logger.log(
        `whatsapp-purge: deleted ${count} logs older than ${RETENTION_DAYS}d`,
      );
    }
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// Cron and CronExpression will be re-enabled in PR 3 when reminders are reimplemented
import { PrismaService } from '../common/prisma/prisma.service.js';
import { WhatsappService } from '../whatsapp/whatsapp.service.js';

@Injectable()
export class RemindersCron {
  private readonly logger = new Logger(RemindersCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly config: ConfigService,
  ) {}

  // PR 1: disabled — PR 3 will reimplement by reading Google Calendar events
  // with "ICS ID:" markers in the description. No StudySession table anymore.
  // @Cron(CronExpression.EVERY_MINUTE)
  async sendReminders(): Promise<void> {
    // intentionally no-op until PR 3
    return;
  }
}

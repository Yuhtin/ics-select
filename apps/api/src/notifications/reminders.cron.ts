import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
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

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    const now = Date.now();
    const lo = new Date(now + 9 * 60 * 1000);
    const hi = new Date(now + 11 * 60 * 1000);
    const sessions = await this.prisma.studySession.findMany({
      where: {
        status: 'SCHEDULED',
        scheduledAt: { gte: lo, lte: hi },
      },
      include: {
        weeklyPlanItem: {
          include: { libraryItem: true, weeklyPlan: { include: { user: true } } },
        },
      },
    });
    for (const s of sessions) {
      const user = s.weeklyPlanItem.weeklyPlan.user;
      if (!user.email) continue;
      // The member's WhatsApp number is not stored yet — Phase 7 uses email-as-phone
      // fallback (to be replaced when the availability flow collects WhatsApp).
      const to = user.email;
      const text = `⏰ Sessão ICS Select começa em 10min: ${s.weeklyPlanItem.libraryItem.title} (${s.durationMinutes}min).`;
      await this.whatsapp.send({ userId: user.id, kind: 'session_reminder', to, text });
    }
    if (sessions.length > 0) this.logger.log(`Sent ${sessions.length} session reminders`);
  }
}

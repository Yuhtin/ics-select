import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { WhatsappTemplateService } from '../whatsapp/whatsapp-template.service.js';
import { GoogleCalendarService } from '../google-calendar/google-calendar.service.js';
import { extractIcsId } from '../common/ics-id/ics-id.js';

@Injectable()
export class RemindersCron {
  private readonly logger = new Logger(RemindersCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly templates: WhatsappTemplateService,
    private readonly calendar: GoogleCalendarService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sendReminders(now: Date = new Date()): Promise<void> {
    const timeMin = new Date(now.getTime() + 9 * 60_000);
    const timeMax = new Date(now.getTime() + 11 * 60_000);

    const members = await this.prisma.user.findMany({
      where: { role: 'MEMBER', whatsappPhone: { not: null } },
      select: { id: true, name: true, whatsappPhone: true },
    });

    for (const member of members) {
      try {
        const events = await this.calendar.listEventsInRange(member.id, timeMin, timeMax);
        for (const event of events) {
          const ids = extractIcsId(event.description);
          if (!ids) continue;
          const minutesAway = Math.max(
            0,
            Math.round((event.start.getTime() - now.getTime()) / 60_000),
          );
          const firstName = member.name?.split(' ')[0] ?? '';
          const rendered = await this.templates.render('session_reminder', {
            firstName,
            minutesAway,
            summary: event.summary,
          });
          if (!rendered.enabled) continue;
          await this.whatsapp
            .send({
              userId: member.id,
              kind: 'session_reminder',
              to: member.whatsappPhone!,
              text: rendered.text,
            })
            .catch(() => undefined);
        }
      } catch (err) {
        this.logger.warn(`reminders: skipped member ${member.id}: ${String(err)}`);
      }
    }
  }
}

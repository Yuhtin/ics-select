import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { WhatsappService } from '../whatsapp/whatsapp.service.js';
import { WhatsappTemplateService } from '../whatsapp/whatsapp-template.service.js';

@Injectable()
export class RetroCron {
  private readonly logger = new Logger(RetroCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
    private readonly templates: WhatsappTemplateService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async tick(now: Date = new Date()): Promise<void> {
    const weekStart = this.mondayUTC(now);
    const members = await this.prisma.user.findMany({
      where: { role: 'MEMBER', whatsappPhone: { not: null } },
      select: {
        id: true,
        name: true,
        whatsappPhone: true,
        availability: { select: { timezone: true } },
      },
    });

    for (const member of members) {
      const tz = member.availability?.timezone ?? 'America/Sao_Paulo';
      try {
        const parts = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          weekday: 'short',
          hour: 'numeric',
          minute: 'numeric',
          hour12: false,
        }).formatToParts(now);
        const weekday = parts.find((p) => p.type === 'weekday')?.value;
        const hourStr = parts.find((p) => p.type === 'hour')?.value ?? '';
        const minuteStr = parts.find((p) => p.type === 'minute')?.value ?? '';
        const hour = Number(hourStr);
        const minute = Number(minuteStr);
        if (weekday !== 'Fri') continue;
        if (hour !== 18 || minute >= 10) continue;

        const existing = await this.prisma.retroReminderSent.findUnique({
          where: { userId_weekStart: { userId: member.id, weekStart } },
        });
        if (existing) continue;

        const firstName = member.name?.split(' ')[0] ?? '';
        const rendered = await this.templates.render('retro_reminder', { firstName });
        if (!rendered.enabled) continue;
        await this.whatsapp
          .send({
            userId: member.id,
            kind: 'retro_reminder',
            to: member.whatsappPhone!,
            text: rendered.text,
          })
          .catch((err) => {
            this.logger.warn(`retro reminder send failed for ${member.id}: ${String(err)}`);
          });

        await this.prisma.retroReminderSent.create({
          data: { userId: member.id, weekStart },
        });
      } catch (err) {
        this.logger.warn(`retro cron: skipped member ${member.id}: ${String(err)}`);
      }
    }
  }

  private mondayUTC(now: Date): Date {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const day = d.getUTCDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    return d;
  }
}

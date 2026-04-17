import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WhatsappModule } from '../whatsapp/whatsapp.module.js';
import { GoogleCalendarModule } from '../google-calendar/google-calendar.module.js';
import { RemindersCron } from './reminders.cron.js';
import { RetroCron } from './retro.cron.js';
import { WhatsappPurgeCron } from './whatsapp-purge.cron.js';

@Module({
  imports: [ScheduleModule.forRoot(), WhatsappModule, GoogleCalendarModule],
  providers: [RemindersCron, RetroCron, WhatsappPurgeCron],
})
export class NotificationsModule {}

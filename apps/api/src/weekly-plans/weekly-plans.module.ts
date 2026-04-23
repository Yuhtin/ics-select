import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { WeeklyPlansController } from './weekly-plans.controller.js';
import { WeeklyPlansService } from './weekly-plans.service.js';
import { PublicationService } from './publication.service.js';
import { ScheduledPublishCron } from './scheduled-publish.cron.js';
import { SchedulerModule } from '../scheduler/scheduler.module.js';
import { GoogleCalendarModule } from '../google-calendar/google-calendar.module.js';
import { WhatsappModule } from '../whatsapp/whatsapp.module.js';

@Module({
  imports: [ScheduleModule.forRoot(), SchedulerModule, GoogleCalendarModule, WhatsappModule],
  controllers: [WeeklyPlansController],
  providers: [WeeklyPlansService, PublicationService, ScheduledPublishCron],
  exports: [WeeklyPlansService],
})
export class WeeklyPlansModule {}

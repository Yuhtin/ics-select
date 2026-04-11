import { Module } from '@nestjs/common';
import { WeeklyPlansController } from './weekly-plans.controller.js';
import { WeeklyPlansService } from './weekly-plans.service.js';
import { PublicationService } from './publication.service.js';
import { SchedulerModule } from '../scheduler/scheduler.module.js';
import { GoogleCalendarModule } from '../google-calendar/google-calendar.module.js';

@Module({
  imports: [SchedulerModule, GoogleCalendarModule],
  controllers: [WeeklyPlansController],
  providers: [WeeklyPlansService, PublicationService],
  exports: [WeeklyPlansService],
})
export class WeeklyPlansModule {}

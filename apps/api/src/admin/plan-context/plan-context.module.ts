import { Module } from '@nestjs/common';
import { GoogleCalendarModule } from '../../google-calendar/google-calendar.module.js';
import { PlanContextService } from './plan-context.service.js';
import { PlanContextController } from './plan-context.controller.js';

@Module({
  imports: [GoogleCalendarModule],
  providers: [PlanContextService],
  controllers: [PlanContextController],
})
export class PlanContextModule {}

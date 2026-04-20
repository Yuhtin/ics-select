import { Module } from '@nestjs/common';
import { GoogleCalendarModule } from '../../google-calendar/google-calendar.module.js';
import { MeCalendarService } from './calendar.service.js';
import { MeCalendarController } from './calendar.controller.js';

@Module({
  imports: [GoogleCalendarModule],
  controllers: [MeCalendarController],
  providers: [MeCalendarService],
  exports: [MeCalendarService],
})
export class MeCalendarModule {}

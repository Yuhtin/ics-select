import { Module } from '@nestjs/common';
import { GoogleCalendarService } from './google-calendar.service.js';

@Module({
  providers: [GoogleCalendarService],
  exports: [GoogleCalendarService],
})
export class GoogleCalendarModule {}

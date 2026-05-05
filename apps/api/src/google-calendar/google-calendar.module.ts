import { Module } from '@nestjs/common';
import { GoogleCalendarService } from './google-calendar.service.js';
import { BusyCacheService } from './busy-cache.service.js';

@Module({
  providers: [GoogleCalendarService, BusyCacheService],
  exports: [GoogleCalendarService, BusyCacheService],
})
export class GoogleCalendarModule {}

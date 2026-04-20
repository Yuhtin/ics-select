import { Module } from '@nestjs/common';
import { MeCalendarService } from './calendar.service.js';

@Module({
  providers: [MeCalendarService],
  exports: [MeCalendarService],
})
export class MeCalendarModule {}

import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../../auth/strategies/jwt.strategy.js';
import { MeCalendarService } from './calendar.service.js';

@Controller('me/calendar')
export class MeCalendarController {
  constructor(private readonly svc: MeCalendarService) {}

  @Get()
  getWeek(
    @CurrentUser() user: JwtStrategyPayload,
    @Query('weekStart') weekStart?: string,
  ) {
    if (!weekStart) {
      throw new BadRequestException('weekStart query param is required (YYYY-MM-DD)');
    }
    const parsed = new Date(weekStart + 'T00:00:00');
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException('weekStart must be a valid YYYY-MM-DD date');
    }
    return this.svc.getWeek(user.sub, parsed);
  }

  @Patch('events/:eventId')
  @HttpCode(204)
  async reschedule(
    @CurrentUser() user: JwtStrategyPayload,
    @Param('eventId') eventId: string,
    @Body() body: { start?: string; end?: string },
  ): Promise<void> {
    if (!body.start || !body.end) {
      throw new BadRequestException('start and end are required ISO datetimes');
    }
    const start = new Date(body.start);
    const end = new Date(body.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('start and end must be valid ISO datetimes');
    }
    if (end.getTime() <= start.getTime()) {
      throw new BadRequestException('end must be after start');
    }
    await this.svc.reschedule(user.sub, eventId, start, end);
  }
}

import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../../auth/strategies/jwt.strategy.js';
import { HomeService } from './home.service.js';
import { LogEvent } from '../../activity/log-event.decorator.js';

@Controller('me')
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get('home')
  @LogEvent('PLAN_VIEW', ({ result }) => {
    const r = result as { today?: unknown[]; streak?: { current?: number } } | null;
    return r ? { todayCount: (r.today ?? []).length, streak: r.streak?.current ?? 0 } : undefined;
  })
  getHome(@CurrentUser() user: JwtStrategyPayload) {
    return this.home.getHome(user.sub);
  }
}

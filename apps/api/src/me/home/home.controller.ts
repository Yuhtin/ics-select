import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../../auth/strategies/jwt.strategy.js';
import { HomeService } from './home.service.js';

@Controller('me')
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get('home')
  getHome(@CurrentUser() user: JwtStrategyPayload) {
    return this.home.getHome(user.sub);
  }
}

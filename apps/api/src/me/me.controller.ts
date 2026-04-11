import { Controller, Delete, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../auth/strategies/jwt.strategy.js';
import { MeService } from './me.service.js';

@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get('export')
  export(@CurrentUser() user: JwtStrategyPayload) {
    return this.me.exportForUser(user.sub);
  }

  @Delete()
  delete(@CurrentUser() user: JwtStrategyPayload) {
    return this.me.deleteUser(user.sub);
  }
}

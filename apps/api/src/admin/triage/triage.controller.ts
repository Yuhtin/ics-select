import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../../auth/strategies/jwt.strategy.js';
import { TriageService } from './triage.service.js';

@Controller('admin')
@Roles('ADMIN')
export class TriageController {
  constructor(private readonly triage: TriageService) {}

  @Get('triage')
  getTriage(
    @CurrentUser() user: JwtStrategyPayload,
    @Query('cycleId') cycleId?: string,
  ) {
    return this.triage.getTriage(new Date(), user.sub, cycleId);
  }
}

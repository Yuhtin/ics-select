import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../../auth/strategies/jwt.strategy.js';
import { CohortService } from './cohort.service.js';

@Controller('me')
export class CohortController {
  constructor(private readonly cohort: CohortService) {}

  @Get('cohort')
  getCohort(@CurrentUser() user: JwtStrategyPayload) {
    return this.cohort.getCohort(user.sub);
  }
}

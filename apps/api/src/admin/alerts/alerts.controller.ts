import { Body, Controller, Post } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../../auth/strategies/jwt.strategy.js';
import { AlertsService } from './alerts.service.js';
import { DismissAlertSchema } from './dto.js';

@Controller('admin/alerts')
@Roles('ADMIN')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Post('dismiss')
  dismiss(@CurrentUser() user: JwtStrategyPayload, @Body() body: unknown) {
    const input = DismissAlertSchema.parse(body);
    return this.alerts.dismiss(user.sub, input);
  }
}

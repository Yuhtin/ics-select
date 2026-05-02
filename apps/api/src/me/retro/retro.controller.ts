import { Body, Controller, Get, Post } from '@nestjs/common';
import { CurrentUser } from '../../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../../auth/strategies/jwt.strategy.js';
import { RetroService } from './retro.service.js';
import { SubmitRetroSchema } from './dto.js';
import { LogEvent } from '../../activity/log-event.decorator.js';

@Controller('me/retro')
export class RetroController {
  constructor(private readonly retro: RetroService) {}

  @Get('current')
  current(@CurrentUser() user: JwtStrategyPayload) {
    return this.retro.getCurrent(user.sub);
  }

  @Post()
  @LogEvent('RETRO_SUBMITTED', ({ body }) => {
    const b = body as { valuedItemId?: string | null; stuckItemId?: string | null };
    return { valuedItemId: b.valuedItemId ?? null, stuckItemId: b.stuckItemId ?? null };
  })
  submit(@CurrentUser() user: JwtStrategyPayload, @Body() body: unknown) {
    const input = SubmitRetroSchema.parse(body);
    return this.retro.submit(user.sub, input);
  }
}

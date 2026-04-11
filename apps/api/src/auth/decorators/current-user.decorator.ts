import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtStrategyPayload } from '../strategies/jwt.strategy.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtStrategyPayload => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as JwtStrategyPayload;
  },
);

import { Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../auth/strategies/jwt.strategy.js';
import { UsersService } from '../users/users.service.js';

@Controller('me/privacy')
export class PrivacyController {
  constructor(private readonly users: UsersService) {}

  @Post('accept')
  async accept(@CurrentUser() current: JwtStrategyPayload) {
    const user = await this.users.acceptPrivacy(current.sub);
    return { privacyAcceptedAt: user.privacyAcceptedAt };
  }
}

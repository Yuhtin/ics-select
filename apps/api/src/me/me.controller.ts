import { Body, Controller, Delete, Get, HttpCode, Patch } from '@nestjs/common';
import { UpdateThemePreferenceSchema } from '@ics-select/shared';
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

  @Patch('theme')
  @HttpCode(204)
  async updateTheme(
    @CurrentUser() user: JwtStrategyPayload,
    @Body() body: unknown,
  ) {
    const parsed = UpdateThemePreferenceSchema.parse(body);
    await this.me.updateThemePreference(user.sub, parsed.themePreference);
  }
}

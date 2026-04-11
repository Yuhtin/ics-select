import { Controller, Get } from '@nestjs/common';
import { APP_VERSION } from '@ics-select/shared';
import { Public } from '../auth/decorators/public.decorator.js';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  health(): { status: 'ok'; version: string; uptimeSeconds: number } {
    return {
      status: 'ok',
      version: APP_VERSION,
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }
}

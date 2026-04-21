import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ListWaitlistQuerySchema } from './dto/list-waitlist.query.js';
import { WaitlistService } from './waitlist.service.js';

@Roles('ADMIN')
@Controller('admin/waitlist')
export class AdminWaitlistController {
  constructor(private readonly service: WaitlistService) {}

  @Get()
  async list(@Query() query: unknown) {
    const parsed = ListWaitlistQuerySchema.safeParse(query);
    if (!parsed.success) {
      const detail = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      throw new BadRequestException(`invalid query — ${detail}`);
    }
    return this.service.list(parsed.data);
  }

  @Get('stats')
  stats() {
    return this.service.stats();
  }
}

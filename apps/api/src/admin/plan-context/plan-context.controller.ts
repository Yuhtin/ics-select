import { Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { PlanContextService } from './plan-context.service.js';

@Roles('ADMIN')
@Controller('admin/member')
export class PlanContextController {
  constructor(private readonly context: PlanContextService) {}

  @Get(':id/plan-context')
  getContext(@Param('id') id: string, @Query('weekStart') weekStart: string) {
    return this.context.getContext({ memberId: id, weekStart: new Date(weekStart) });
  }
}

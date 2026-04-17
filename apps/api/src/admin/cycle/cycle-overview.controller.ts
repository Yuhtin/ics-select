import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { CycleOverviewService } from './cycle-overview.service.js';

@Controller('admin/cycle')
@Roles('ADMIN')
export class CycleOverviewController {
  constructor(private readonly service: CycleOverviewService) {}

  @Get(':id')
  overview(@Param('id') id: string) {
    return this.service.getOverview(id);
  }
}

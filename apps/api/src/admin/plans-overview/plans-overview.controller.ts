import { BadRequestException, Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { PlansOverviewService, type PlansOverviewStatus } from './plans-overview.service.js';

const ALLOWED: ReadonlySet<PlansOverviewStatus> = new Set(['all', 'draft', 'published']);

@Controller('admin/cycles')
@Roles('ADMIN')
export class PlansOverviewController {
  constructor(private readonly service: PlansOverviewService) {}

  @Get(':cycleId/plans')
  list(
    @Param('cycleId') cycleId: string,
    @Query('status') status?: string,
  ) {
    const normalized = (status ?? 'all') as PlansOverviewStatus;
    if (!ALLOWED.has(normalized)) {
      throw new BadRequestException(`Invalid status filter: ${status}`);
    }
    return this.service.list(cycleId, normalized);
  }
}

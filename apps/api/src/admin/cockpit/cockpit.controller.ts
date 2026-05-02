import { Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { CockpitService } from './cockpit.service.js';
import type { CockpitRange } from './cockpit.types.js';

const VALID_RANGES = new Set<CockpitRange>(['cycle', '7d', 'all']);

@Roles('ADMIN')
@Controller('admin/member')
export class CockpitController {
  constructor(private readonly svc: CockpitService) {}

  @Get(':id/cockpit')
  get(
    @Param('id') id: string,
    @Query('cycleId') cycleId?: string,
    @Query('range') rangeParam?: string,
  ) {
    const range: CockpitRange = VALID_RANGES.has(rangeParam as CockpitRange)
      ? (rangeParam as CockpitRange)
      : 'cycle';
    return this.svc.getCockpit(id, cycleId ?? null, range);
  }
}

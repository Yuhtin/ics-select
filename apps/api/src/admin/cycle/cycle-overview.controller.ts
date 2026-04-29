import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { Roles } from '../../auth/decorators/roles.decorator.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { resolveActiveCycle } from '../../common/cycle/active-cycle.js';
import { CycleOverviewService } from './cycle-overview.service.js';

@Controller('admin/cycle')
@Roles('ADMIN')
export class CycleOverviewController {
  constructor(
    private readonly service: CycleOverviewService,
    private readonly prisma: PrismaService,
  ) {}

  // Static path matched before the :id catch-all — admin home now lands here
  // so the user always sees the cycle that's actually running.
  @Get('active')
  async active() {
    const cycle = await resolveActiveCycle(this.prisma);
    if (!cycle) throw new NotFoundException('no active cycle');
    return this.service.getOverview(cycle.id);
  }

  @Get(':id')
  overview(@Param('id') id: string) {
    return this.service.getOverview(id);
  }
}

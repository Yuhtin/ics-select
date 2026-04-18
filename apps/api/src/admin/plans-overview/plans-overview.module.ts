import { Module } from '@nestjs/common';
import { PlansOverviewService } from './plans-overview.service.js';
import { PlansOverviewController } from './plans-overview.controller.js';

@Module({
  providers: [PlansOverviewService],
  controllers: [PlansOverviewController],
})
export class PlansOverviewModule {}

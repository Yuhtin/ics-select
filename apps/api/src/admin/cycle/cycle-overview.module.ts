import { Module } from '@nestjs/common';
import { CycleOverviewService } from './cycle-overview.service.js';
import { CycleOverviewController } from './cycle-overview.controller.js';

@Module({
  providers: [CycleOverviewService],
  controllers: [CycleOverviewController],
})
export class CycleOverviewModule {}

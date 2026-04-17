import { Module } from '@nestjs/common';
import { PlanDraftsService } from './plan-drafts.service.js';
import { PlanDraftsController } from './plan-drafts.controller.js';

@Module({
  providers: [PlanDraftsService],
  controllers: [PlanDraftsController],
})
export class PlanDraftsModule {}

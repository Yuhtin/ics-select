import { Module } from '@nestjs/common';
import { AiController } from './ai.controller.js';
import { DraftPlanService } from './draft-plan.service.js';
import { BriefPlanService } from './brief-plan.service.js';
import { DiagnoseService } from './diagnose.service.js';
import { ChatService } from './chat.service.js';
import { UsageLoggerService } from './usage-logger.service.js';
import { LibraryModule } from '../library/library.module.js';
import { WeeklyPlansModule } from '../weekly-plans/weekly-plans.module.js';

@Module({
  imports: [LibraryModule, WeeklyPlansModule],
  controllers: [AiController],
  providers: [DraftPlanService, BriefPlanService, DiagnoseService, ChatService, UsageLoggerService],
  exports: [UsageLoggerService],
})
export class AiModule {}

import { Module } from '@nestjs/common';
import { PlanContextService } from './plan-context.service.js';
import { PlanContextController } from './plan-context.controller.js';

@Module({
  providers: [PlanContextService],
  controllers: [PlanContextController],
})
export class PlanContextModule {}

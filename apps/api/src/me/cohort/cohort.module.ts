import { Module } from '@nestjs/common';
import { CohortService } from './cohort.service.js';
import { CohortController } from './cohort.controller.js';

@Module({
  providers: [CohortService],
  controllers: [CohortController],
})
export class CohortModule {}

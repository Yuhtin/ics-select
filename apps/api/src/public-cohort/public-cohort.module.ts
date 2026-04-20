import { Module } from '@nestjs/common';
import { PublicCohortController } from './public-cohort.controller.js';

@Module({
  controllers: [PublicCohortController],
})
export class PublicCohortModule {}

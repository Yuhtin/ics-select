import { Module } from '@nestjs/common';
import { TopicsService } from './topics.service.js';
import { TopicsController } from './topics.controller.js';

@Module({
  providers: [TopicsService],
  controllers: [TopicsController],
  exports: [TopicsService],
})
export class TopicsModule {}

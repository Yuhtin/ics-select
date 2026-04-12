import { Module } from '@nestjs/common';
import { InterestController } from './interest.controller.js';

@Module({
  controllers: [InterestController],
})
export class InterestModule {}

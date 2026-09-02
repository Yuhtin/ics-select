import { Module } from '@nestjs/common';
import { AdminChallengesService } from './admin-challenges.service.js';
import { AdminChallengesController } from './admin-challenges.controller.js';

@Module({
  providers: [AdminChallengesService],
  controllers: [AdminChallengesController],
  exports: [AdminChallengesService],
})
export class AdminChallengesModule {}

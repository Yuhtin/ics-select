import { Module } from '@nestjs/common';
import { ChallengesService } from './challenges.service.js';
import { ChallengesController } from './challenges.controller.js';
import { SandboxModule } from '../../sandbox/sandbox.module.js';

@Module({
  imports: [SandboxModule],
  providers: [ChallengesService],
  controllers: [ChallengesController],
  exports: [ChallengesService],
})
export class MeChallengesModule {}

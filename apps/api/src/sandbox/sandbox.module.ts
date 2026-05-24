import { Module } from '@nestjs/common';
import { SandboxService } from './sandbox.service.js';
import { SandboxQueueService } from './queue.service.js';
import { TestRunnerService } from './test-runner.service.js';

@Module({
  providers: [SandboxQueueService, SandboxService, TestRunnerService],
  exports: [SandboxQueueService, SandboxService, TestRunnerService],
})
export class SandboxModule {}

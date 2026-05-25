import { Module } from '@nestjs/common';
import { SandboxService } from './sandbox.service.js';
import { TestRunnerService } from './test-runner.service.js';

@Module({
  providers: [SandboxService, TestRunnerService],
  exports: [SandboxService, TestRunnerService],
})
export class SandboxModule {}

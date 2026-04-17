import { Module } from '@nestjs/common';
import { TriageService } from './triage.service.js';
import { TriageController } from './triage.controller.js';

@Module({
  providers: [TriageService],
  controllers: [TriageController],
})
export class TriageModule {}

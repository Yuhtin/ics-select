import { Module } from '@nestjs/common';
import { TriageModule } from './triage/triage.module.js';
import { AlertsModule } from './alerts/alerts.module.js';

@Module({ imports: [TriageModule, AlertsModule] })
export class AdminModule {}

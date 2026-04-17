import { Module } from '@nestjs/common';
import { TriageModule } from './triage/triage.module.js';
import { AlertsModule } from './alerts/alerts.module.js';
import { CycleOverviewModule } from './cycle/cycle-overview.module.js';

@Module({ imports: [TriageModule, AlertsModule, CycleOverviewModule] })
export class AdminModule {}

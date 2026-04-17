import { Module } from '@nestjs/common';
import { TriageModule } from './triage/triage.module.js';
import { AlertsModule } from './alerts/alerts.module.js';
import { CycleOverviewModule } from './cycle/cycle-overview.module.js';
import { PlanContextModule } from './plan-context/plan-context.module.js';
import { PlanDraftsModule } from './plan-drafts/plan-drafts.module.js';
import { NotesModule } from './notes/notes.module.js';
import { MemberDetailModule } from './member-detail/member-detail.module.js';

@Module({
  imports: [
    TriageModule,
    AlertsModule,
    CycleOverviewModule,
    PlanContextModule,
    PlanDraftsModule,
    NotesModule,
    MemberDetailModule,
  ],
})
export class AdminModule {}

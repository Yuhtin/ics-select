import { Module } from '@nestjs/common';
import { TriageModule } from './triage/triage.module.js';
import { AlertsModule } from './alerts/alerts.module.js';
import { CycleOverviewModule } from './cycle/cycle-overview.module.js';
import { PlanContextModule } from './plan-context/plan-context.module.js';
import { PlanDraftsModule } from './plan-drafts/plan-drafts.module.js';
import { NotesModule } from './notes/notes.module.js';
import { MemberDetailModule } from './member-detail/member-detail.module.js';
import { PlansOverviewModule } from './plans-overview/plans-overview.module.js';
import { InvitesModule } from './invites/invites.module.js';
import { CockpitModule } from './cockpit/cockpit.module.js';
import { CycleReceiptModule } from './cycle-receipt/cycle-receipt.module.js';
import { MocksModule } from './mocks/mocks.module.js';
import { AdminChallengesModule } from './challenges/admin-challenges.module.js';

@Module({
  imports: [
    TriageModule,
    AlertsModule,
    CycleOverviewModule,
    PlanContextModule,
    PlanDraftsModule,
    NotesModule,
    MemberDetailModule,
    PlansOverviewModule,
    InvitesModule,
    CockpitModule,
    CycleReceiptModule,
    MocksModule,
    AdminChallengesModule,
  ],
  exports: [InvitesModule, MocksModule, AdminChallengesModule],
})
export class AdminModule {}

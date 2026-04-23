-- Scheduled publish: admin can pick a future moment to go live.
-- At publish time, the plan gets status=SCHEDULED with publishAt set; a cron
-- worker flips it to PUBLISHED when publishAt <= now, running the Calendar +
-- WhatsApp side-effects at that moment. sendWhatsapp/autoSchedule get
-- persisted so the worker knows what the admin picked at publish time.

ALTER TYPE "WeeklyPlanStatus" ADD VALUE 'SCHEDULED' BEFORE 'PUBLISHED';

ALTER TABLE "WeeklyPlan"
  ADD COLUMN "publishAt" TIMESTAMP(3),
  ADD COLUMN "sendWhatsapp" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "autoSchedule" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "WeeklyPlan_status_publishAt_idx" ON "WeeklyPlan"("status", "publishAt");

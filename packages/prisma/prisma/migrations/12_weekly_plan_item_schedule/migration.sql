-- Cache the scheduler's planned time on each WeeklyPlanItem so the UI
-- can show "19:00 · 45m" without round-tripping to Google Calendar.
-- Calendar events remain source-of-truth for reminders (PR 3).

ALTER TABLE "WeeklyPlanItem"
  ADD COLUMN "scheduledAt" TIMESTAMP(3),
  ADD COLUMN "scheduledMinutes" INTEGER;

CREATE INDEX "WeeklyPlanItem_scheduledAt_idx"
  ON "WeeklyPlanItem"("scheduledAt");

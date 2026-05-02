-- Additive: add optional FK columns to WeeklyRetro so each retro entry can
-- reference the specific WeeklyPlanItem the member flagged as "most valued"
-- (Q2) or "stuck / in doubt" (Q1).  ON DELETE SET NULL means deleting a plan
-- item never erases the retro text — the FKs just become NULL.

ALTER TABLE "WeeklyRetro"
  ADD COLUMN "valuedItemId" TEXT,
  ADD COLUMN "stuckItemId"  TEXT;

ALTER TABLE "WeeklyRetro"
  ADD CONSTRAINT "WeeklyRetro_valuedItemId_fkey"
  FOREIGN KEY ("valuedItemId") REFERENCES "WeeklyPlanItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WeeklyRetro"
  ADD CONSTRAINT "WeeklyRetro_stuckItemId_fkey"
  FOREIGN KEY ("stuckItemId") REFERENCES "WeeklyPlanItem"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "WeeklyRetro_valuedItemId_idx" ON "WeeklyRetro"("valuedItemId");
CREATE INDEX "WeeklyRetro_stuckItemId_idx"  ON "WeeklyRetro"("stuckItemId");

-- Waitlist morphs from "notify me" to "sign up for selection process". Add
-- `year` (1-4 faculdade) so admin can triage, and drop `wantsUpdates` since
-- the monthly-updates concept no longer applies to an inscription flow.

-- Add year as nullable first, backfill, then enforce NOT NULL.
ALTER TABLE "WaitlistEntry" ADD COLUMN "year" INTEGER;
UPDATE "WaitlistEntry" SET "year" = 1 WHERE "year" IS NULL;
ALTER TABLE "WaitlistEntry" ALTER COLUMN "year" SET NOT NULL;

-- Drop wantsUpdates — the flag was a checkbox that's already been removed
-- from the modal UI (commit 8a53012) and now has no semantic meaning in the
-- selection-process framing.
ALTER TABLE "WaitlistEntry" DROP COLUMN "wantsUpdates";

-- Add target-cycle to InvitedEmail so admin invites pin the new member to a
-- specific cycle. Nullable for backward compatibility with pending invites
-- created before this migration (they fall back to the legacy manual-enroll
-- flow: admin adds the member via /admin/cycle/:id after first login).
--
-- ON DELETE SET NULL — if the cycle is hard-deleted the invite stays valid as
-- a "no target cycle" invite, matching the legacy fallback behavior. In
-- practice cycles are archived (status=ARCHIVED) rather than deleted, so this
-- branch is defensive.

ALTER TABLE "InvitedEmail"
  ADD COLUMN "cycleId" TEXT;

ALTER TABLE "InvitedEmail"
  ADD CONSTRAINT "InvitedEmail_cycleId_fkey"
  FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "InvitedEmail_cycleId_idx" ON "InvitedEmail"("cycleId");

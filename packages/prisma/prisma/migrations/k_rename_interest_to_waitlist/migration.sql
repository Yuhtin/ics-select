-- Rename the legacy interest submissions table. InterestSubmission existed
-- from the landing v1 but the current frontend never called /interest, so
-- this table is effectively empty in production. Rename preserves any
-- stragglers instead of dropping; the unique-email index later in this
-- migration will refuse to run if duplicates exist, surfacing the problem
-- loudly instead of silently corrupting data.

-- CreateEnum
CREATE TYPE "Course" AS ENUM (
  'CIENCIA_COMPUTACAO',
  'ADMINISTRACAO',
  'ENGENHARIA_SOFTWARE',
  'ENGENHARIA_COMPUTACAO',
  'SISTEMAS_INFORMACAO'
);

-- RenameTable
ALTER TABLE "InterestSubmission" RENAME TO "WaitlistEntry";

-- DropIndex
DROP INDEX "InterestSubmission_email_idx";

-- AddColumns (nullable first so existing rows survive)
ALTER TABLE "WaitlistEntry"
  ADD COLUMN "course"        "Course",
  ADD COLUMN "skillLevel"    INTEGER,
  ADD COLUMN "github"        TEXT,
  ADD COLUMN "linkedin"      TEXT,
  ADD COLUMN "wantsUpdates"  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "cycleTarget"   TEXT,
  ADD COLUMN "ipHash"        TEXT,
  ADD COLUMN "userAgent"     TEXT,
  ADD COLUMN "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill sentinels for any residual rows so NOT NULL can be enforced.
UPDATE "WaitlistEntry" SET "course"      = 'CIENCIA_COMPUTACAO'  WHERE "course"      IS NULL;
UPDATE "WaitlistEntry" SET "skillLevel"  = 1                     WHERE "skillLevel"  IS NULL;
UPDATE "WaitlistEntry" SET "cycleTarget" = '2026.3'              WHERE "cycleTarget" IS NULL;

-- Enforce NOT NULL
ALTER TABLE "WaitlistEntry"
  ALTER COLUMN "course"      SET NOT NULL,
  ALTER COLUMN "skillLevel"  SET NOT NULL,
  ALTER COLUMN "cycleTarget" SET NOT NULL;

-- UniqueIndex on email (aborts migration if duplicates exist — desired)
CREATE UNIQUE INDEX "WaitlistEntry_email_key" ON "WaitlistEntry"("email");

-- Supporting indexes
CREATE INDEX "WaitlistEntry_cycleTarget_createdAt_idx" ON "WaitlistEntry"("cycleTarget", "createdAt");
CREATE INDEX "WaitlistEntry_course_idx" ON "WaitlistEntry"("course");

-- pgcrypto is required for gen_random_uuid() used in the backfill.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create the slot table
CREATE TABLE "AvailabilitySlot" (
  "id"          TEXT NOT NULL,
  "userId"      TEXT NOT NULL,
  "dayOfWeek"   INTEGER NOT NULL,
  "startMinute" INTEGER NOT NULL,
  "endMinute"   INTEGER NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AvailabilitySlot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AvailabilitySlot_dayOfWeek_check"
    CHECK ("dayOfWeek" >= 0 AND "dayOfWeek" <= 6),
  CONSTRAINT "AvailabilitySlot_end_after_start_check"
    CHECK ("endMinute" > "startMinute")
);
CREATE UNIQUE INDEX "AvailabilitySlot_userId_dayOfWeek_startMinute_key"
  ON "AvailabilitySlot"("userId", "dayOfWeek", "startMinute");
CREATE INDEX "AvailabilitySlot_userId_dayOfWeek_idx"
  ON "AvailabilitySlot"("userId", "dayOfWeek");
ALTER TABLE "AvailabilitySlot"
  ADD CONSTRAINT "AvailabilitySlot_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- Make per-day cap columns nullable
ALTER TABLE "MemberAvailability"
  ALTER COLUMN "mondayMinutes"    DROP NOT NULL,
  ALTER COLUMN "tuesdayMinutes"   DROP NOT NULL,
  ALTER COLUMN "wednesdayMinutes" DROP NOT NULL,
  ALTER COLUMN "thursdayMinutes"  DROP NOT NULL,
  ALTER COLUMN "fridayMinutes"    DROP NOT NULL,
  ALTER COLUMN "saturdayMinutes"  DROP NOT NULL,
  ALTER COLUMN "sundayMinutes"    DROP NOT NULL;

-- Backfill: for every (userId, dayOfWeek) where the matching column > 0,
-- create a default slot 08:00 (480) - 22:00 (1320).
INSERT INTO "AvailabilitySlot" ("id", "userId", "dayOfWeek", "startMinute", "endMinute", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  m."userId",
  d.day_idx,
  480,
  1320,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "MemberAvailability" m
CROSS JOIN LATERAL (VALUES
  (0, m."mondayMinutes"),
  (1, m."tuesdayMinutes"),
  (2, m."wednesdayMinutes"),
  (3, m."thursdayMinutes"),
  (4, m."fridayMinutes"),
  (5, m."saturdayMinutes"),
  (6, m."sundayMinutes")
) AS d(day_idx, minutes)
WHERE d.minutes IS NOT NULL AND d.minutes > 0;

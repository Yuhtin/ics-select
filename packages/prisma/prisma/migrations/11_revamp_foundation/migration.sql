-- Revamp foundation migration (PR 1)
-- Adds: Track, ItemOutcome, AlertType enums;
--        Topic, WeeklyRetro, AdminNote, DismissedAlert tables;
--        User.whatsappPhone, Cycle.rankingVisibleToMembers,
--        CycleMembership.track, LibraryItem.topicId,
--        LibraryItem.tracks, WeeklyPlanItem.outcome,
--        WeeklyPlanItem.carriedFromItemId.
-- Removes: StudySession table;
--          WeeklyPlanItem.status, WeeklyPlanItem.stuck,
--          WeeklyPlanItem.stuckAt, WeeklyPlanItem.difficultyRating.
-- Destructive: no production users, no backfill.

-- =====================================================
-- Enums
-- =====================================================

CREATE TYPE "Track" AS ENUM (
  'BIG_TECH',
  'CONSULTING_TECH',
  'COMPETITIVE_PROGRAMMING',
  'STARTUP',
  'OTHER'
);

CREATE TYPE "ItemOutcome" AS ENUM (
  'PENDING',
  'DONE_EASY',
  'DONE_HARD',
  'DOUBTS',
  'STUCK'
);

CREATE TYPE "AlertType" AS ENUM (
  'STUCK_RECENT',
  'DISAPPEARED',
  'STUCK_REPEATEDLY',
  'FINISHED_EARLY',
  'SKIPPED_RETROS',
  'PLAN_PENDING',
  'CALENDAR_BROKEN'
);

-- =====================================================
-- New tables
-- =====================================================

CREATE TABLE "Topic" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "label" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "WeeklyRetro" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "cycleId" TEXT NOT NULL REFERENCES "Cycle"("id") ON DELETE CASCADE,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "whatClicked" TEXT,
  "whatStuck" TEXT,
  "nextWeekWish" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "WeeklyRetro_userId_weekStart_key"
  ON "WeeklyRetro"("userId", "weekStart");
CREATE INDEX "WeeklyRetro_cycleId_weekStart_idx"
  ON "WeeklyRetro"("cycleId", "weekStart");

CREATE TABLE "AdminNote" (
  "id" TEXT PRIMARY KEY,
  "aboutId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "authorId" TEXT NOT NULL REFERENCES "User"("id"),
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AdminNote_aboutId_idx" ON "AdminNote"("aboutId");

CREATE TABLE "DismissedAlert" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "alertType" "AlertType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "DismissedAlert_userId_expiresAt_idx"
  ON "DismissedAlert"("userId", "expiresAt");

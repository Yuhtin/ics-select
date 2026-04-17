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

-- Drop the entire Challenge Mode / Problems surface that was reverted
-- in code. The objects below were introduced by migrations that no
-- longer live on disk (z_challenge_attempts and za_problems_pivot) —
-- their _prisma_migrations rows stay orphaned, which is fine for
-- `migrate deploy` (it only blocks on drift in `migrate dev`).
--
-- Drop order respects FK dependencies:
--   ProblemTopic → Problem  (and Topic, which we keep)
--   ChallengeAttempt → Problem, User, Cycle
--
-- All statements use IF EXISTS so re-running the migration on a DB
-- that's already partially cleaned is a no-op.

DROP TABLE IF EXISTS "ProblemTopic";

DROP TABLE IF EXISTS "ChallengeAttempt";

DROP TABLE IF EXISTS "Problem";

ALTER TABLE "LibraryItem" DROP COLUMN IF EXISTS "testCases";
ALTER TABLE "LibraryItem" DROP COLUMN IF EXISTS "testCasesLanguages";

DROP TYPE IF EXISTS "ChallengeLanguage";
DROP TYPE IF EXISTS "ChallengeRating";

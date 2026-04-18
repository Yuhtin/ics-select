-- Step 1: dedupe (userId, weekStart) collisions.
-- Keep the PUBLISHED row if one exists; otherwise keep the most recently created.
-- WeeklyPlanItem has ON DELETE CASCADE so deleted plans cascade their items.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "userId", "weekStart"
      ORDER BY (CASE WHEN status = 'PUBLISHED' THEN 0 ELSE 1 END), "createdAt" DESC
    ) AS rn
  FROM "WeeklyPlan"
)
DELETE FROM "WeeklyPlan"
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Step 2: replace the non-unique index with a unique one.
DROP INDEX IF EXISTS "WeeklyPlan_userId_weekStart_idx";
CREATE UNIQUE INDEX "WeeklyPlan_userId_weekStart_key"
  ON "WeeklyPlan"("userId", "weekStart");

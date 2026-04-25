-- Track which Google Calendar events belong to each WeeklyPlanItem so we can
-- delete them by id without scanning the member's whole calendar via
-- events.list. One item can have multiple chunks (scheduler splits long
-- materials), so this is 1-to-many: item → events.

CREATE TABLE "WeeklyPlanItemCalendarEvent" (
  "id"               TEXT NOT NULL,
  "weeklyPlanItemId" TEXT NOT NULL,
  "googleEventId"    TEXT NOT NULL,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WeeklyPlanItemCalendarEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WeeklyPlanItemCalendarEvent_googleEventId_key"
  ON "WeeklyPlanItemCalendarEvent"("googleEventId");

CREATE INDEX "WeeklyPlanItemCalendarEvent_weeklyPlanItemId_idx"
  ON "WeeklyPlanItemCalendarEvent"("weeklyPlanItemId");

ALTER TABLE "WeeklyPlanItemCalendarEvent"
  ADD CONSTRAINT "WeeklyPlanItemCalendarEvent_weeklyPlanItemId_fkey"
  FOREIGN KEY ("weeklyPlanItemId") REFERENCES "WeeklyPlanItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

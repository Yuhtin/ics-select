-- Add a per-member preference: should ICS-created study events on Google
-- Calendar show as "Busy" (default, legacy behavior) or "Free"?
--
-- When false, GoogleCalendarService.createEvent stamps
-- events.transparency = 'transparent' so other people scheduling 1:1s on this
-- member's calendar can still book over the study block. Existing rows keep
-- the legacy semantics via the NOT NULL DEFAULT true.
--
-- Additive, non-destructive: column is appended with a server-side default
-- (Postgres rewrites no rows for a static default).

ALTER TABLE "MemberAvailability"
  ADD COLUMN "calendarBusy" BOOLEAN NOT NULL DEFAULT true;

-- Migration: 13_retro_reminder_sent
-- Tracks which members have already received the Friday retro reminder
-- for a given week, ensuring the cron is idempotent.

CREATE TABLE "RetroReminderSent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RetroReminderSent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RetroReminderSent_userId_weekStart_key"
    ON "RetroReminderSent"("userId", "weekStart");

CREATE INDEX "RetroReminderSent_weekStart_idx"
    ON "RetroReminderSent"("weekStart");

ALTER TABLE "RetroReminderSent" ADD CONSTRAINT "RetroReminderSent_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

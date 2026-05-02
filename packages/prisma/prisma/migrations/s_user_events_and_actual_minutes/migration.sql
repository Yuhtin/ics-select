-- CreateEnum
CREATE TYPE "UserEventType" AS ENUM ('SESSION_START', 'PLAN_VIEW', 'ITEM_VIEW', 'OUTCOME_MARKED', 'RETRO_SUBMITTED', 'AVAILABILITY_SAVED');

-- AlterTable
ALTER TABLE "WeeklyPlanItem" ADD COLUMN "actualMinutes" INTEGER;

-- CreateTable
CREATE TABLE "UserEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "UserEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,

    CONSTRAINT "UserEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserEvent_userId_occurredAt_idx" ON "UserEvent"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "UserEvent_userId_type_occurredAt_idx" ON "UserEvent"("userId", "type", "occurredAt");

-- AddForeignKey
ALTER TABLE "UserEvent" ADD CONSTRAINT "UserEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

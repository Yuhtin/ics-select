-- CreateEnum
CREATE TYPE "CompletionStatus" AS ENUM ('DONE', 'STUCK', 'DOUBTS');

-- AlterTable
ALTER TABLE "WeeklyPlanItem" ADD COLUMN "completionStatus" "CompletionStatus",
ADD COLUMN "feedback" TEXT;

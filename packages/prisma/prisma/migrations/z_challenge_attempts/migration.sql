-- CreateEnum
CREATE TYPE "ChallengeLanguage" AS ENUM ('PYTHON', 'CPP');

-- CreateEnum
CREATE TYPE "ChallengeRating" AS ENUM ('EASY', 'MEDIUM', 'HARD', 'ABANDONED');

-- AlterTable
ALTER TABLE "LibraryItem"
  ADD COLUMN "testCases" JSONB,
  ADD COLUMN "testCasesLanguages" "ChallengeLanguage"[] DEFAULT ARRAY[]::"ChallengeLanguage"[];

-- CreateTable
CREATE TABLE "ChallengeAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "libraryItemId" TEXT NOT NULL,
    "language" "ChallengeLanguage" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "approachText" TEXT NOT NULL DEFAULT '',
    "finalCode" TEXT NOT NULL DEFAULT '',
    "selfRating" "ChallengeRating" NOT NULL DEFAULT 'ABANDONED',
    "notes" TEXT,
    "testsPassed" INTEGER,
    "testsTotal" INTEGER,
    "testResults" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChallengeAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChallengeAttempt_userId_cycleId_idx" ON "ChallengeAttempt"("userId", "cycleId");

-- CreateIndex
CREATE INDEX "ChallengeAttempt_userId_libraryItemId_idx" ON "ChallengeAttempt"("userId", "libraryItemId");

-- CreateIndex
CREATE INDEX "ChallengeAttempt_libraryItemId_submittedAt_idx" ON "ChallengeAttempt"("libraryItemId", "submittedAt");

-- AddForeignKey
ALTER TABLE "ChallengeAttempt" ADD CONSTRAINT "ChallengeAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeAttempt" ADD CONSTRAINT "ChallengeAttempt_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeAttempt" ADD CONSTRAINT "ChallengeAttempt_libraryItemId_fkey" FOREIGN KEY ("libraryItemId") REFERENCES "LibraryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "SandboxExecutionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "attemptId" TEXT,
    "language" "ChallengeLanguage" NOT NULL,
    "status" TEXT NOT NULL,
    "exitCode" INTEGER,
    "durationMs" INTEGER NOT NULL,
    "stdoutBytes" INTEGER NOT NULL DEFAULT 0,
    "stderrBytes" INTEGER NOT NULL DEFAULT 0,
    "codeBytes" INTEGER NOT NULL DEFAULT 0,
    "stdinBytes" INTEGER NOT NULL DEFAULT 0,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxExecutionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SandboxExecutionLog_occurredAt_idx" ON "SandboxExecutionLog"("occurredAt");

-- CreateIndex
CREATE INDEX "SandboxExecutionLog_userId_occurredAt_idx" ON "SandboxExecutionLog"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "SandboxExecutionLog_status_occurredAt_idx" ON "SandboxExecutionLog"("status", "occurredAt");

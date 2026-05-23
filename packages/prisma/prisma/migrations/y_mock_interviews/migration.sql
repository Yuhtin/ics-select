-- CreateEnum
CREATE TYPE "MockType" AS ENUM ('BEHAVIORAL', 'CODING', 'SYSTEM_DESIGN');

-- CreateTable
CREATE TABLE "MockInterview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "type" "MockType" NOT NULL,
    "score" INTEGER NOT NULL,
    "feedback" TEXT,
    "conductedBy" TEXT,
    "conductedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MockInterview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MockInterview_userId_cycleId_idx" ON "MockInterview"("userId", "cycleId");

-- CreateIndex
CREATE INDEX "MockInterview_userId_conductedAt_idx" ON "MockInterview"("userId", "conductedAt");

-- CreateIndex
CREATE INDEX "MockInterview_type_idx" ON "MockInterview"("type");

-- AddForeignKey
ALTER TABLE "MockInterview" ADD CONSTRAINT "MockInterview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MockInterview" ADD CONSTRAINT "MockInterview_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

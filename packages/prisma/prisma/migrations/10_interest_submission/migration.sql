-- CreateTable
CREATE TABLE "InterestSubmission" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterestSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterestSubmission_email_idx" ON "InterestSubmission"("email");

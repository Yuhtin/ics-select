-- CreateEnum
CREATE TYPE "ItemFormat" AS ENUM ('VIDEO', 'ARTICLE', 'BOOK', 'PROBLEM', 'OTHER');

-- CreateEnum
CREATE TYPE "ItemDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateTable
CREATE TABLE "LibraryItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "description" TEXT,
    "format" "ItemFormat" NOT NULL,
    "difficulty" "ItemDifficulty" NOT NULL,
    "estimatedMinutes" INTEGER NOT NULL,
    "source" TEXT,
    "tags" TEXT[],
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LibraryItem_format_idx" ON "LibraryItem"("format");

-- CreateIndex
CREATE INDEX "LibraryItem_difficulty_idx" ON "LibraryItem"("difficulty");

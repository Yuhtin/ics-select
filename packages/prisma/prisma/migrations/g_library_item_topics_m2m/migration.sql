-- LibraryItem ↔ Topic: single FK (`topicId`) → many-to-many join table
-- (`LibraryItemTopic`). Data-preserving migration: existing items backfill
-- into the join table with `isPrimary = true`.

-- 1) Create join table
CREATE TABLE "LibraryItemTopic" (
  "itemId"    TEXT      NOT NULL,
  "topicId"   TEXT      NOT NULL,
  "isPrimary" BOOLEAN   NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LibraryItemTopic_pkey" PRIMARY KEY ("itemId", "topicId")
);

CREATE INDEX "LibraryItemTopic_topicId_idx"
  ON "LibraryItemTopic"("topicId");

CREATE INDEX "LibraryItemTopic_itemId_isPrimary_idx"
  ON "LibraryItemTopic"("itemId", "isPrimary");

ALTER TABLE "LibraryItemTopic"
  ADD CONSTRAINT "LibraryItemTopic_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "LibraryItem"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LibraryItemTopic"
  ADD CONSTRAINT "LibraryItemTopic_topicId_fkey"
    FOREIGN KEY ("topicId") REFERENCES "Topic"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- 2) Backfill: every item that has a current topicId becomes the primary
--    row in the join table.
INSERT INTO "LibraryItemTopic" ("itemId", "topicId", "isPrimary")
SELECT "id", "topicId", true
FROM "LibraryItem"
WHERE "topicId" IS NOT NULL;

-- 3) Drop the old single-topic FK + index + column
ALTER TABLE "LibraryItem" DROP CONSTRAINT IF EXISTS "LibraryItem_topicId_fkey";
DROP INDEX IF EXISTS "LibraryItem_topicId_idx";
ALTER TABLE "LibraryItem" DROP COLUMN "topicId";

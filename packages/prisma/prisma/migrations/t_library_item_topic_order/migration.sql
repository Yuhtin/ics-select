-- Pedagogical order of library items within a topic. Null means
-- "no manual order"; the sort falls back to difficulty (E→M→H) then
-- title A-Z. Cross-topic items can have different orders in different
-- topics (a video can be #1 under `tree` but #5 under `array`).

ALTER TABLE "LibraryItemTopic" ADD COLUMN "order" INTEGER;

CREATE INDEX "LibraryItemTopic_topicId_order_idx" ON "LibraryItemTopic"("topicId", "order");

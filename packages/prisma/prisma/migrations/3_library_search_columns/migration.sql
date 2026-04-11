-- Add pgvector embedding column
ALTER TABLE "LibraryItem" ADD COLUMN "embedding" vector(1536);

-- Add tsvector for full-text search (Portuguese config)
ALTER TABLE "LibraryItem" ADD COLUMN "search_vector" tsvector;

-- Function that recomputes search_vector from title + description + tags
CREATE OR REPLACE FUNCTION update_library_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector('portuguese',
      coalesce(NEW.title, '') || ' ' ||
      coalesce(NEW.description, '') || ' ' ||
      coalesce(array_to_string(NEW.tags, ' '), '')
    );
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Trigger that runs on insert/update
DROP TRIGGER IF EXISTS library_item_search_vector_trigger ON "LibraryItem";
CREATE TRIGGER library_item_search_vector_trigger
BEFORE INSERT OR UPDATE OF title, description, tags ON "LibraryItem"
FOR EACH ROW EXECUTE FUNCTION update_library_search_vector();

-- GIN index for tsvector
CREATE INDEX "LibraryItem_search_vector_idx" ON "LibraryItem" USING GIN ("search_vector");

-- IVFFlat index for embedding (cosine distance). Lists=100 is a sensible default
-- for small collections; we'll tune when the library grows beyond 1k items.
CREATE INDEX "LibraryItem_embedding_idx" ON "LibraryItem"
USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100);

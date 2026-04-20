-- Migration h_library_search_english
-- Switch LibraryItem tsvector from 'simple' to 'english' for real stemming
-- ("explain"/"explained"/"explains" match each other), add `source` to the
-- vector, and keep the URL alnum-split with `simple` (stemming would break
-- slugs and domains).

CREATE OR REPLACE FUNCTION update_library_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english',
      array_to_string(coalesce(NEW.tags, '{}'::text[]), ' ')
    ), 'C') ||
    setweight(to_tsvector('english', coalesce(NEW.source, '')), 'D') ||
    setweight(to_tsvector('simple',
      regexp_replace(coalesce(NEW.url, ''), '[^[:alnum:]]+', ' ', 'g')
    ), 'D');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Recreate the trigger so it also fires on source changes.
DROP TRIGGER IF EXISTS library_item_search_vector_trigger ON "LibraryItem";
CREATE TRIGGER library_item_search_vector_trigger
BEFORE INSERT OR UPDATE OF title, description, tags, url, source ON "LibraryItem"
FOR EACH ROW EXECUTE FUNCTION update_library_search_vector();

-- Recompute existing rows' search_vector.
UPDATE "LibraryItem" SET "title" = "title";

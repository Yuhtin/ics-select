-- Migration: 14_library_search_v2
-- Switch the LibraryItem tsvector from 'portuguese' stemming to 'simple' and
-- include URL tokens. Library content is typically English/mixed language;
-- Portuguese stemming was failing to match English titles. `simple` keeps the
-- tokens as-is (no stemming) which works well for both languages.
--
-- We also include the URL so members/admins can search by domain or slug
-- (e.g. "leetcode", "mit.edu"). URLs are tokenized by replacing non-word
-- characters with spaces before feeding into to_tsvector.

CREATE OR REPLACE FUNCTION update_library_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector('simple',
      lower(
        coalesce(NEW.title, '') || ' ' ||
        coalesce(NEW.description, '') || ' ' ||
        coalesce(array_to_string(NEW.tags, ' '), '') || ' ' ||
        regexp_replace(coalesce(NEW.url, ''), '[^[:alnum:]]+', ' ', 'g')
      )
    );
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Re-create the trigger so it fires on url changes too.
DROP TRIGGER IF EXISTS library_item_search_vector_trigger ON "LibraryItem";
CREATE TRIGGER library_item_search_vector_trigger
BEFORE INSERT OR UPDATE OF title, description, tags, url ON "LibraryItem"
FOR EACH ROW EXECUTE FUNCTION update_library_search_vector();

-- Recompute existing rows' search_vector.
UPDATE "LibraryItem" SET "title" = "title";

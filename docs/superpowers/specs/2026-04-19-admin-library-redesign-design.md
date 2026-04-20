# Admin Library Redesign — Design Spec

**Date:** 2026-04-19
**Scope:** `/admin/library` page UX + client-side fuzzy search + server-side `/library/search` fix
**Branch target:** new feat branch off `main`

## Problem

The admin library is how the Diretor Educacional curates study materials. It has grown past the point where the current UI holds up:

- **Topic chips overflow.** 37 topics today, more coming. The topic filter row stacks as a flex-wrap of chips that dominates the screen and buries the list.
- **No pagination.** The page fetches `limit: 100` and renders everything; beyond a hundred items, the list becomes unusable.
- **Search returns irrelevant results.** `LibraryService.search` has a silent fallback: when the tsquery returns fewer than 5 hits, it pads the response with the most recent items matching the other filters. A query like `"graph"` or `"explained"` returns 3 real hits plus 97 unrelated items, feeling "broken."
- **Stemming absent.** The tsvector uses the `simple` config, which does no stemming. `"explained"` does not match `"explain"`/`"explains"`.
- **Dead embedding write.** `LibraryItem.embedding` is written on every create/update (costing OpenAI ~300ms per save) but never read by any `SELECT` in the codebase. Kept intentionally for a future semantic-search feature; see Decisions.

Both the admin page and the AI `search_library` tool share this endpoint, so the same bug distorts both workflows: the admin gets noisy search, the LLM receives unrelated items and treats them as valid plan candidates.

## Goals

1. Admin library page renders fast at 500–1000+ items and stays fast as the acervo grows.
2. Topic filter scales to 60+ topics without visual overflow.
3. Searching from the admin page returns relevant results instantly and tolerates typos.
4. The AI `search_library` tool receives clean, relevant results — no silent fallback padding.
5. URL state is shareable and stable (page, filters, query survive navigation and reload).

## Non-goals

- Semantic (vector) search. The `embedding` column stays wired (writes only) for a future feature but is not consumed by this design.
- Member-facing library. This is admin-only.
- Changes to `ItemFormModal`, `TopicsModal`, `UrlImportService`, or `DraftPlanService` beyond the existing `LibraryService.search` contract.
- Any schema change beyond a single migration that rewrites the tsvector trigger.

## Decisions (from brainstorming)

| # | Decision | Chosen |
|---|---|---|
| Q1 | Search strategy | **Split** — client-side Fuse.js for admin, server-side tsvector for LLM |
| Q2 | Topic navigation at scale | **Combobox + search** with category grouping; breadcrumb in header when active |
| Q3 | Pagination | **Numbered pagination**, 25/page, URL-synced |
| Q4 | Format/Diff/Track filters | **One row, 3 compact multi-select popovers** |
| Q5 | Dead embedding write | **Keep** (user wants it preserved for future semantic search) |
| Q6 | Server `/library/search` fix | Remove silent fallback + switch to `english` stemming + include `source` in tsvector + service-side topic-label match |

## Architecture

Two independent search paths, each matched to its consumer:

```
Admin curating                           AI tool (LLM assembling plan)
─────────────────                        ─────────────────────────────
GET /library                             POST /library/search
  ↓                                        ↓
full list (all items, all topics)        tsvector (english stemming)
  ↓                                      + source in vector
TanStack Query cache                     + topic-label match (service side)
  ↓                                      + ILIKE ranked fallback
Fuse.js index (useMemo)                  − silent "pad with recent" fallback
  ↓                                        ↓
filter chain:                            ≤20 relevant items (or empty)
  topic → format/diff/track
  → fuzzy → sort → paginate
  ↓
URL sync (useSearchParams)
```

**Why split.** Low hundreds of items fit easily in memory; round-tripping per keystroke is pure cost with no benefit. Fuse.js gives typo tolerance and multi-field ranking out of the box. The LLM does not need typo tolerance — it needs precision, so server-side stays strict and predictable.

## Page layout

```
┌──────────────────────────────────────────────────────────────┐
│ Library · Infra & DevOps / Databases       [Topics] [+ New]  │  header
│ 247 items · showing 1–25                                     │
├──────────────────────────────────────────────────────────────┤
│ [🔍 Search title, url, topic, format…]                       │  search
├──────────────────────────────────────────────────────────────┤
│ [Databases ▾]  [Format ▾]  [Diff ▾]  [Track ▾]  ✕ clear all │  filters
├──────────────────────────────────────────────────────────────┤
│ ▍YT  How indexes actually work    · video · med · 12m · …    │
│ ▍LC  Design a URL shortener       · problem · hard · 45m · … │  list
│ ▍GH  raft-consensus-paper         · article · hard · 30m · … │  (25/page)
│ …                                                             │
├──────────────────────────────────────────────────────────────┤
│               ← 1  2  3  4 … 10  →                            │  pagination
└──────────────────────────────────────────────────────────────┘
```

### Header

- Eyebrow `Library` + h1 in Source Serif 4 (dense-data voice, per `docs/design-system.md`).
- **Breadcrumb inline only when `topicId` is active:** `Library · <category> / <topic label>`. Clicking `Library` clears the topic; category text is non-interactive (just context).
- Meta line: `{total} items` when unfiltered, or `{filteredCount} of {total} · showing {a}–{b}` when filtered.
- Actions (right-aligned, unchanged from current): `[Manage topics]`, `[+ New item]`.

### Search input

- Full width, placeholder `Search title, url, topic, format…`.
- Debounce 150ms (down from 300ms — client-side is instant).
- `/` keyboard shortcut focuses the input.

### Filter row (one line, four controls)

- **Topic combobox first** (most-used filter). Trigger shows active topic label or "All topics".
- **Format / Difficulty / Track** — each is a compact multi-select popover. Trigger shows the category name and, when active, the count (e.g. `Format · 2`).
- **Clear all** link on the far right, only visible when any filter is active.

### List row

Unchanged from current. 3px platform-color left border, title in Newsreader, meta line in IBM Plex Mono. Hover-reveal actions `open ↗ / edit / delete`. Do not redesign the row in this scope.

### Pagination footer

- Layout: `← 1 2 3 … 10 →`. Standard windowing (5 pages around current + first/last).
- Page size: **25**. Rationale: row height ~60px × 25 ≈ 1500px fits a single scroll for most viewports.
- Disabled prev/next at boundaries.
- URL param `?page=2` syncs both directions.

### Empty state

- `No items match.` pill (current style) with secondary link `Clear filters` when filters are active, or `Reset search` when only query is set.

## Topic combobox (new component)

```
┌──────────────────────────────┐
│ [Databases ▾]        ← trigger │
└──────────────────────────────┘
       │ click
       ▼
┌──────────────────────────────┐
│ [🔍 Filter topics…]   ← autofocus │
├──────────────────────────────┤
│  All topics           (247)  │
├──────────────────────────────┤
│  DATA STRUCTURES & ALGORITHMS │  ← category header (non-interactive)
│    Array                 (18) │
│    Lists                 (12) │
│    Tree                  (22) │
│    …                          │
│  INFRA & DEVOPS               │
│    Databases   ✓         (14) │  ← active row
│    Networking            (9)  │
│    …                          │
└──────────────────────────────┘
```

**Behavior**

- Single-select (replaces current `topicId: string | null`).
- Input at the top filters topic labels (case-insensitive substring). Esc closes. ↑/↓ navigate, Enter selects.
- Categories derived from `topic.order` via a pure helper:
  - `0–19` → `Data Structures & Algorithms`
  - `20–29` → `Infra & DevOps`
  - `30–39` → `System Components`
  - `40–49` → `Principles`
  - `50–59` → `Cases`
  - fallback `60+` → `Other`
- Counts computed client-side via `useMemo` over the full item list, summing `topics[].id` matches (counts are **unconditional** — they reflect total per topic regardless of other active filters, to avoid the user chasing a moving target).
- Active row: check icon + `bg-focus/5` background.
- Popover ~320px wide, max-height 480px, internal scroll.

**Files**

- `apps/web/components/admin/library/topic-combobox.tsx` — component.
- `apps/web/lib/format/topic-category.ts` — pure `topicCategory(order: number)` + `groupTopicsByCategory(topics)`.

## Multi-select filter combobox (new shared component)

Used for Format, Difficulty, Track. Same popover shell as the topic one, but:

- No category grouping.
- Multi-select with checkboxes on the left.
- Trigger label shows `<Name>` when empty, `<Name> · N` when active.
- No internal search input (lists are ≤6 items each).
- Includes `Clear` link at the bottom.

**File:** `apps/web/components/admin/library/multi-filter-combobox.tsx`.

## Filter & search pipeline (client-side)

Pure, memoized chain:

```
items (from GET /library)
  → filter by topicId (exact match on any topics[].id)
  → filter by format (multi-select OR)
  → filter by difficulty (multi-select OR)
  → filter by track (multi-select OR, with tracks=[] wildcard preserved)
  → fuzzy search with Fuse.js (skipped if query is empty)
  → sort by Fuse score (with query) or createdAt desc (without)
  → paginate: slice(page * 25, (page + 1) * 25)
```

**Fuse.js config** (in `apps/web/lib/library/fuse-index.ts`):

```ts
new Fuse(items, {
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'description', weight: 0.2 },
    { name: 'url', weight: 0.15 },
    { name: 'source', weight: 0.1 },
    { name: 'tags', weight: 0.05 },
    { name: 'topics.label', weight: 0.05 },
    { name: 'format', weight: 0.025 },
    { name: 'difficulty', weight: 0.025 },
  ],
  threshold: 0.35,
  ignoreLocation: true,
  minMatchCharLength: 2,
});
```

Threshold 0.35 balances typo tolerance against noise (Fuse default 0.6 is too permissive for this dataset size). `ignoreLocation: true` makes matches anywhere in the string score equally.

**Track wildcard preserved.** Items with `tracks = []` pass any track filter — same rule as `LibraryService.search` today.

**Index invalidation.** `useMemo([items])` — Fuse rebuilds when TanStack Query re-emits. After a create/update/delete mutation, `invalidateQueries(['admin', 'library'])` fires a refetch, which re-renders the page with a fresh index. Index build at 1000 items is <10ms — no need to debounce.

## URL state sync

Query params drive the filter/page state via `useSearchParams` + `router.replace` (so the change stays on the same entry and doesn't pollute browser history):

- `?q=<query>&topic=<uuid>&format=VIDEO,ARTICLE&difficulty=HARD&track=BIG_TECH&page=2`
- Any filter change resets `page` to 1 (implicit, by omitting `page` from the next URL).
- Parsing runs once on mount; state is kept in React state synced to URL — we do **not** read `useSearchParams` on every render.
- Multi-value params are serialized comma-separated (`format=VIDEO,ARTICLE`).

## Server-side search fix — `/library/search` for LLM

### Migration `h_library_search_english`

`packages/prisma/prisma/migrations/h_library_search_english/migration.sql`:

```sql
-- Switch tsvector from 'simple' (no stemming) to 'english' stemming, and
-- add `source` to the vector. Prior version lives in e_library_search_v2.

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

-- Re-create the trigger so it also fires on source changes.
DROP TRIGGER IF EXISTS library_item_search_vector_trigger ON "LibraryItem";
CREATE TRIGGER library_item_search_vector_trigger
BEFORE INSERT OR UPDATE OF title, description, tags, url, source ON "LibraryItem"
FOR EACH ROW EXECUTE FUNCTION update_library_search_vector();

-- Recompute existing rows.
UPDATE "LibraryItem" SET "title" = "title";
```

URL stays with `simple` stemming (stemming breaks slugs / domains). Weights A/B/C/D rank title > description > tags > source/url.

### `LibraryService.search` refactor

`apps/api/src/library/library.service.ts`:

1. Swap `plainto_tsquery('simple', lower($1))` → `plainto_tsquery('english', $1)`. Remove the `lower()` — English stemming is case-insensitive via `to_tsvector` itself.
2. **Delete** the silent fallback block (current lines ~262–272).
3. Add a topic-label match step: when `hasQuery`, run one extra `SELECT id FROM "Topic" WHERE label ILIKE '%' || $1 || '%' OR slug ILIKE '%' || $1 || '%'`, then union in items linked to those topics that aren't already in the tsvector hit set. Score these lower than tsvector hits, higher than raw ILIKE fallback. Respect the `limit`.
4. `attachTopics` call order stays; topic-label matches are already attached since they come through the same `LibraryItemTopic` join.

### Behavior after fix

| Query | Before | After |
|---|---|---|
| `"graph"` | 3 hits + 97 unrelated recent items | ~10 items covering Graph topic + graph-related titles |
| `"explained"` | 0 hits + 100 unrelated recent items | items with `explain*` (stemming) |
| `"xyzqwe"` | 0 hits + 100 unrelated recent items | `[]` |
| `"fireship"` | matches via ILIKE url, padded | ranks items with `source = 'Fireship'` via tsvector source weight |
| `"databases"` (topic name, no item titled that) | 0 hits + pad | items in Databases topic (via topic-label match) |

## Data flow — create/update/delete

No change to write paths. `useCreateLibraryItem` / `useUpdateLibraryItem` / `useDeleteLibraryItem` already invalidate `['admin', 'library']`; Fuse rebuilds on next render.

Embedding write preserved. `LibraryService.create`/`update` continue calling `writeEmbedding`.

## Tests

### Backend — `apps/api/src/library/library.service.spec.ts`

New cases (use existing mocked Prisma pattern; migration applied via `packages/prisma` in CI):

- `search "graph" returns items tagged with Graph topic or matching title` — seeds 3 Graph items + 50 unrelated, asserts only Graph-related come back.
- `search "explained" matches "explain", "explains", "explained"` — English stemming live.
- `search with no matches returns empty array` — regression gate for the fallback bug.
- `search "fireship" ranks items with source=Fireship above plain ILIKE hits` — source field weighted in vector.
- `search "databases" matches items of the Databases topic even when the word is absent from title/description` — topic-label match path.

### Frontend — unit

- `apps/web/lib/format/topic-category.spec.ts` — `topicCategory(order)` for each range + the `60+` fallback; `groupTopicsByCategory` preserves original topic order within each category.
- `apps/web/lib/library/fuse-index.spec.ts` — typo tolerance (`"graps"` finds Graph items), topic-label match (`"database"` finds items whose topic label is Databases even if title is `"Understanding indexes"`), source match (`"fireship"` finds items where source is `"Fireship"`).

### Frontend — Playwright

- `apps/web/tests/admin-library.spec.ts` (new):
  - loads page, types `graph`, sees graph-related items only.
  - opens topic combobox, types `data`, sees Databases, selects it, confirms breadcrumb + URL.
  - applies format `VIDEO` + difficulty `HARD`, sees count in triggers.
  - paginates to page 2, reloads → still on page 2 with same filters (URL state).
  - creates a new item, returns to list, item present without manual refresh.

## Out of scope

- Any change to `ItemFormModal`, `TopicsModal`, `UrlImportService`, `DraftPlanService`, or the AI `search_library` tool wrapper.
- Any Prisma schema change (no new columns, no new tables; just a trigger/function rewrite).
- Member-side library surfaces (none exist today).
- Bulk actions (multi-edit/delete).
- Column sorting on the list (current sort is `createdAt desc` with no UI to change it; keep it that way).

## Open follow-ups (not this scope)

- **CLAUDE.md is stale** about "semantic-search queries go through `$queryRawUnsafe`" — library search is tsvector + ILIKE only. Update the `Prisma & pgvector` section in CLAUDE.md as part of this PR for accuracy (separate small commit).
- If the embedding write is eventually consumed, this design leaves space — a `search_library_semantic` service method can live beside the current `search` without disturbing the admin fuzzy path.

## File tree (changes)

**New**
- `apps/web/components/admin/library/topic-combobox.tsx`
- `apps/web/components/admin/library/multi-filter-combobox.tsx`
- `apps/web/components/admin/library/pagination.tsx`
- `apps/web/lib/format/topic-category.ts`
- `apps/web/lib/format/topic-category.spec.ts`
- `apps/web/lib/library/fuse-index.ts`
- `apps/web/lib/library/fuse-index.spec.ts`
- `apps/web/tests/admin-library.spec.ts`
- `packages/prisma/prisma/migrations/h_library_search_english/migration.sql`

**Modified**
- `apps/web/app/(admin)/admin/library/page.tsx` — rewrites state/filter/pagination; swaps `useAdminLibrarySearch` → `useAdminLibrary`.
- `apps/web/lib/queries/admin-library.ts` — `useAdminLibrary` return type exposes `topics[]`.
- `apps/api/src/library/library.service.ts` — `search` rewrite per section above.
- `apps/api/src/library/library.service.spec.ts` — new cases.
- `CLAUDE.md` — fix stale "semantic search" claim.

**Deleted**
- `apps/web/components/admin/library/filters-bar.tsx` — replaced by the four comboboxes in the page itself.

## Dependencies

- Add `fuse.js` to `apps/web/package.json` (no transitive changes; ~5kb gzipped).

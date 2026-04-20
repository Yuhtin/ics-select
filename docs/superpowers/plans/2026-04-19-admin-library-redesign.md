# Admin Library Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a scalable `/admin/library` — numbered pagination, grouped topic combobox, multi-select filter popovers, client-side fuzzy search via Fuse.js. Fix `/library/search` server-side so the AI tool stops receiving padded results.

**Architecture:** Split search strategies. Admin page fetches full list via `GET /library` and runs Fuse.js + filters + pagination client-side with URL-synced state. The LLM keeps using `POST /library/search`, which switches to English stemming, adds `source` to the tsvector, does a service-side topic-label match, and drops the silent fallback block.

**Tech Stack:** Next.js 15 App Router + HeroUI + TanStack Query + Tailwind 3 + Framer Motion + fuse.js (new). NestJS 10 + Prisma 5 + PostgreSQL 16 on the API. No new test framework — backend uses existing Jest setup, frontend verified manually in the browser (no Playwright configured in `apps/web` today).

**Spec:** `docs/superpowers/specs/2026-04-19-admin-library-redesign-design.md`

---

## File structure

### Backend
- Create: `packages/prisma/prisma/migrations/h_library_search_english/migration.sql` — tsvector trigger rewrite.
- Modify: `apps/api/src/library/library.service.ts` — `search()` method.
- Modify: `apps/api/src/library/library.service.spec.ts` — new cases; smarter `$queryRawUnsafe` mock.

### Frontend — new
- `apps/web/lib/format/topic-category.ts` — pure `topicCategory(order)` + `groupTopicsByCategory(topics)`.
- `apps/web/lib/library/fuse-index.ts` — builds Fuse instance over items; exposes `useFuseFilter(items, query)`.
- `apps/web/components/admin/library/topic-combobox.tsx` — topic popover with internal search.
- `apps/web/components/admin/library/multi-filter-combobox.tsx` — shared multi-select popover.
- `apps/web/components/admin/library/pagination.tsx` — numbered pagination footer.

### Frontend — modified
- `apps/web/app/(admin)/admin/library/page.tsx` — rewrites state + pipeline.
- `apps/web/lib/queries/admin-library.ts` — `AdminLibraryItem` gains `topics[]` and `source`.

### Frontend — deleted
- `apps/web/components/admin/library/filters-bar.tsx` — replaced.

### Docs
- Modify: `CLAUDE.md` — drop the stale "semantic-search queries go through $queryRawUnsafe" line.

---

## Phase 1 — Backend: `/library/search` fix

### Task 1: Create `english` tsvector migration

**Files:**
- Create: `packages/prisma/prisma/migrations/h_library_search_english/migration.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
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
```

- [ ] **Step 2: Apply locally and verify no error**

Run: `pnpm --filter @ics-select/prisma exec prisma migrate dev --name library_search_english`

Expected: Prisma reports "Applied migration h_library_search_english" and no error. If a conflict with migration name appears, use the pre-created directory name `h_library_search_english` and run:

Run: `pnpm --filter @ics-select/prisma exec prisma migrate deploy`

Expected: "1 migration applied".

- [ ] **Step 3: Sanity-check with a manual query**

Run:
```bash
docker compose exec postgres psql -U postgres -d ics_select -c \
  "SELECT title FROM \"LibraryItem\" WHERE search_vector @@ plainto_tsquery('english', 'explained') LIMIT 5;"
```

Expected: at least one title containing a stem of "explain" (e.g. "How indexes explain themselves", "React Explained"). If zero rows and you know such an item exists, the trigger didn't regenerate — re-run the `UPDATE "LibraryItem" SET "title" = "title";` line by hand.

- [ ] **Step 4: Commit**

```bash
git add packages/prisma/prisma/migrations/h_library_search_english/
git commit -m "feat(library): switch search tsvector to english stemming + source"
```

---

### Task 2: Upgrade `fakePrisma.$queryRawUnsafe` mock to simulate query-aware matching

The existing mock returns every item with `score: 0.5`, so new tests for "no silent fallback" / "empty results on no match" would still see padded data. We teach the mock to inspect the first argument (the `query` string the service passes) and only return items that contain the query substring in title/description/tags/source.

**Files:**
- Modify: `apps/api/src/library/library.service.spec.ts` (lines 70-73 area)

- [ ] **Step 1: Replace the `$queryRawUnsafe` mock body**

Replace the current block:

```ts
$queryRawUnsafe: jest.fn(async (_sql: string, ..._values: unknown[]) => {
  return Array.from(items.values()).map((it) => ({ ...it, score: 0.5 }));
}),
```

with:

```ts
// Simulates tsvector + ILIKE behavior without a real Postgres. We inspect
// the first positional arg (the user query) and return items whose title /
// description / tags / source contain it (case-insensitive), scored by
// which field matched.
$queryRawUnsafe: jest.fn(async (_sql: string, ...values: unknown[]) => {
  const q = ((values[0] as string | null) ?? '').trim().toLowerCase();
  if (!q) return [];
  const hit = (s: string | null | undefined) =>
    !!s && s.toLowerCase().includes(q);
  return Array.from(items.values())
    .map((it) => {
      if (hit(it.title)) return { ...it, score: 4 };
      if (hit(it.description)) return { ...it, score: 2 };
      if (hit(it.tags.join(' '))) return { ...it, score: 1 };
      if (hit(it.source)) return { ...it, score: 1 };
      if (hit(it.url)) return { ...it, score: 0.5 };
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score);
}),
```

- [ ] **Step 2: Declare two closure-scoped arrays at the top of `fakePrisma`**

Add these two lines right after `const items = new Map<string, Item>();` and `const raw: Array<...> = [];`:

```ts
const topicRows: Array<{ id: string; slug: string; label: string }> = [];
const libraryItemTopicRows: Array<{
  itemId: string;
  topicId: string;
  isPrimary: boolean;
}> = [];
```

These are closed over by both the returned mock and by whatever the test assigns to `prisma.topic.rows` / `prisma.libraryItemTopic.rows` (proxied — see step 4).

- [ ] **Step 3: Replace the `topic` mock to answer label/slug lookups**

Replace:
```ts
topic: {
  findMany: jest.fn(async () => []),
},
```

with:
```ts
topic: {
  // Tests seed rows via `prisma.topic.rows.push(...)` or by assigning.
  rows: topicRows,
  findMany: jest.fn(async (args?: any) => {
    const w = args?.where;
    if (!w) return [...topicRows];
    if (w.slug?.in) {
      return topicRows.filter((r) => (w.slug.in as string[]).includes(r.slug));
    }
    // OR: [{ label: { contains: q, mode: 'insensitive' } }, { slug: { contains: q, mode: 'insensitive' } }]
    if (Array.isArray(w.OR)) {
      const q: string =
        w.OR[0]?.label?.contains ?? w.OR[0]?.slug?.contains ?? '';
      const qLow = q.toLowerCase();
      return topicRows.filter(
        (r) =>
          r.label.toLowerCase().includes(qLow) ||
          r.slug.toLowerCase().includes(qLow),
      );
    }
    return [...topicRows];
  }),
},
```

- [ ] **Step 4: Replace the `libraryItemTopic` mock to resolve joins**

Replace:
```ts
libraryItemTopic: {
  findMany: jest.fn(async () => []),
  deleteMany: jest.fn(async () => ({ count: 0 })),
  create: jest.fn(async ({ data }: any) => data),
},
```

with:
```ts
libraryItemTopic: {
  rows: libraryItemTopicRows,
  findMany: jest.fn(async (args?: any) => {
    const w = args?.where ?? {};
    const filtered = libraryItemTopicRows.filter((r) => {
      if (w.itemId?.in && !w.itemId.in.includes(r.itemId)) return false;
      if (w.topicId?.in && !w.topicId.in.includes(r.topicId)) return false;
      if (w.topicId && typeof w.topicId === 'string' && r.topicId !== w.topicId) {
        return false;
      }
      return true;
    });
    // If the service asked for `include: { topic: { select: ... } }`,
    // emulate the join; otherwise return the raw rows.
    if (args?.include?.topic) {
      const byId = new Map(topicRows.map((t) => [t.id, t]));
      return filtered.map((r) => ({ ...r, topic: byId.get(r.topicId) ?? null }));
    }
    return filtered;
  }),
  deleteMany: jest.fn(async () => ({ count: 0 })),
  create: jest.fn(async ({ data }: any) => data),
},
```

Tests MUST mutate the arrays in place via `push` (e.g. `prisma.topic.rows.push({...})`). Do NOT reassign `prisma.topic.rows = [...]` — the mock closes over the original array reference, so reassignment would leave the mock reading a stale empty array.

- [ ] **Step 4: Run the existing test suite to confirm the mocks still work**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern library.service`

Expected: existing 4 tests still pass. `search returns results via raw query` — its query is "arrays" and the seeded item's tag is `['arrays']`, so the new mock returns it with `score: 1`. Should still pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/library/library.service.spec.ts
git commit -m "test(library): upgrade fakePrisma mock for query-aware search tests"
```

---

### Task 3: Failing test — empty result on no match (silent fallback regression)

**Files:**
- Modify: `apps/api/src/library/library.service.spec.ts`

- [ ] **Step 1: Add the failing test inside the `describe('LibraryService', …)` block**

```ts
it('search returns empty array when the query matches nothing', async () => {
  const prisma = fakePrisma();
  const svc = new LibraryService(prisma as any, openai as any);
  // Seed two items that do NOT mention "zzzunmatchable".
  await svc.create({
    title: 'Arrays 101', description: null, url: null, format: 'ARTICLE',
    difficulty: 'EASY', estimatedMinutes: 10, source: null, tags: ['arrays'],
    createdById: 'u-1',
  });
  await svc.create({
    title: 'Trees 101', description: null, url: null, format: 'ARTICLE',
    difficulty: 'EASY', estimatedMinutes: 10, source: null, tags: ['tree'],
    createdById: 'u-1',
  });
  const results = await svc.search({ query: 'zzzunmatchable' });
  expect(results).toEqual([]);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern library.service -t "empty array when"`

Expected: FAIL. Current service runs the silent fallback: `filtered.length < Math.min(5, limit)` is true, so it pads with the full listing and returns 2 items instead of `[]`.

---

### Task 4: Remove the silent fallback + switch tsquery to `english`

**Files:**
- Modify: `apps/api/src/library/library.service.ts` (the `search` method, around lines 157–275)

- [ ] **Step 1: Replace the tsvector SQL block to use `english` and drop `lower()`**

Find (around line 201–228):
```ts
const sql = `
  SELECT
    "id", "title", "url", "description", "format", "difficulty",
    "estimatedMinutes", "source", "tags", "tracks",
    "createdAt", "updatedAt",
    CASE
      WHEN search_vector @@ plainto_tsquery('simple', lower($1))
        THEN ts_rank(search_vector, plainto_tsquery('simple', lower($1))) * 4
      WHEN "title" ILIKE '%' || $1 || '%' THEN 2
      WHEN "description" ILIKE '%' || $1 || '%' THEN 1
      WHEN "url" ILIKE '%' || $1 || '%' THEN 0.5
      ELSE 0.01
    END AS score
  FROM "LibraryItem"
  WHERE
    (
      search_vector @@ plainto_tsquery('simple', lower($1))
      OR "title" ILIKE '%' || $1 || '%'
      OR "description" ILIKE '%' || $1 || '%'
      OR "url" ILIKE '%' || $1 || '%'
    )
    AND ($2::"ItemFormat"[] IS NULL OR "format" = ANY($2::"ItemFormat"[]))
    AND ($3::"ItemDifficulty"[] IS NULL OR "difficulty" = ANY($3::"ItemDifficulty"[]))
    AND ($4::int IS NULL OR "estimatedMinutes" <= $4)
    AND ($5::text[] IS NULL OR "tags" && $5::text[])
  ORDER BY score DESC, "createdAt" DESC
  LIMIT $6
`;
```

Replace with (same structure, `english`, no `lower()` — Postgres dictionaries normalize case themselves):

```ts
const sql = `
  SELECT
    "id", "title", "url", "description", "format", "difficulty",
    "estimatedMinutes", "source", "tags", "tracks",
    "createdAt", "updatedAt",
    CASE
      WHEN search_vector @@ plainto_tsquery('english', $1)
        THEN ts_rank(search_vector, plainto_tsquery('english', $1)) * 4
      WHEN "title" ILIKE '%' || $1 || '%' THEN 2
      WHEN "description" ILIKE '%' || $1 || '%' THEN 1
      WHEN "url" ILIKE '%' || $1 || '%' THEN 0.5
      ELSE 0.01
    END AS score
  FROM "LibraryItem"
  WHERE
    (
      search_vector @@ plainto_tsquery('english', $1)
      OR "title" ILIKE '%' || $1 || '%'
      OR "description" ILIKE '%' || $1 || '%'
      OR "url" ILIKE '%' || $1 || '%'
    )
    AND ($2::"ItemFormat"[] IS NULL OR "format" = ANY($2::"ItemFormat"[]))
    AND ($3::"ItemDifficulty"[] IS NULL OR "difficulty" = ANY($3::"ItemDifficulty"[]))
    AND ($4::int IS NULL OR "estimatedMinutes" <= $4)
    AND ($5::text[] IS NULL OR "tags" && $5::text[])
  ORDER BY score DESC, "createdAt" DESC
  LIMIT $6
`;
```

- [ ] **Step 2: Delete the silent fallback block**

Find and remove the block (around lines 262–272):

```ts
// Supplement with the filtered listing when the query returned too few hits.
if (filtered.length < Math.min(5, limit)) {
  const fallback = await filteredListing();
  const seen = new Set(filtered.map((i) => i.id as string));
  for (const item of fallback) {
    if (seen.has(item.id as string)) continue;
    filtered.push(item);
    if (filtered.length >= limit) break;
  }
}
```

The `filteredListing` closure above it is still used by the `if (!hasQuery) return filteredListing();` path — do NOT remove it.

- [ ] **Step 3: Run the failing test — it should now pass**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern library.service -t "empty array when"`

Expected: PASS.

- [ ] **Step 4: Run the full library spec to confirm nothing regressed**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern library.service`

Expected: all cases pass (5 existing + 1 new = 6).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/library/library.service.ts apps/api/src/library/library.service.spec.ts
git commit -m "fix(library): remove silent fallback + switch search to english stemming"
```

---

### Task 5: Failing test — topic-label match path

Query `"databases"` should match items linked to the Databases topic even when the word never appears in title/description/tags.

**Files:**
- Modify: `apps/api/src/library/library.service.spec.ts`

- [ ] **Step 1: Add the failing test**

```ts
it('search matches items by topic label even when tsvector has no hit', async () => {
  const prisma = fakePrisma();
  const svc = new LibraryService(prisma as any, openai as any);
  // Seed a Databases topic (push, not reassign — mock closes over the array).
  prisma.topic.rows.push({ id: 't-db', slug: 'databases', label: 'Databases' });
  // Item whose title / desc / tags do NOT contain "databases".
  const item = await svc.create({
    title: 'Understanding indexes',
    description: 'How B-trees keep reads fast.',
    url: null, format: 'ARTICLE', difficulty: 'MEDIUM',
    estimatedMinutes: 15, source: null, tags: [],
    createdById: 'u-1',
  });
  // Link it to the Databases topic.
  prisma.libraryItemTopic.rows.push({
    itemId: item.id, topicId: 't-db', isPrimary: true,
  });
  const results = await svc.search({ query: 'databases' });
  expect(results.map((r: any) => r.id)).toContain(item.id);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern library.service -t "topic label"`

Expected: FAIL. Current service only queries `LibraryItem`; it never consults `Topic.label`.

---

### Task 6: Add topic-label match path to `LibraryService.search`

**Files:**
- Modify: `apps/api/src/library/library.service.ts`

- [ ] **Step 1: After the `$queryRawUnsafe` call + track filter, before `attachTopics(filtered)`, insert the topic-label match block**

Find (around line 253 after Task 4's edits):

```ts
    // Attach topics via one follow-up query so the admin UI / AI receive the
    // full shape (`topics[]`, derived `topicId`, `topic`).
    await this.attachTopics(filtered);
```

Replace with:

```ts
    // Topic-label match: any Topic whose label or slug contains the query
    // contributes its items as additional hits, ranked below tsvector hits.
    // This lets the LLM (and the admin UI) find "Databases" items by the
    // category name even when the word is absent from title/description.
    const labelTopics = await this.prisma.topic.findMany({
      where: {
        OR: [
          { label: { contains: input.query!, mode: 'insensitive' } },
          { slug: { contains: input.query!, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (labelTopics.length > 0) {
      const topicIds = labelTopics.map((t) => t.id);
      const joins = await this.prisma.libraryItemTopic.findMany({
        where: { topicId: { in: topicIds } },
        select: { itemId: true },
      });
      const wantedItemIds = Array.from(new Set(joins.map((j) => j.itemId)));
      const existingIds = new Set(filtered.map((i) => i.id as string));
      const missingIds = wantedItemIds.filter((id) => !existingIds.has(id));
      if (missingIds.length > 0) {
        const extras = await this.prisma.libraryItem.findMany({
          where: { id: { in: missingIds } },
          include: TOPIC_INCLUDE,
        });
        for (const extra of extras) {
          if (filtered.length >= limit) break;
          filtered.push({ ...shapeItem(extra), score: 0.25 });
        }
      }
    }

    // Attach topics via one follow-up query so the admin UI / AI receive the
    // full shape (`topics[]`, derived `topicId`, `topic`).
    await this.attachTopics(filtered);
```

Note: the non-null assertion `input.query!` is safe because this branch only runs when `hasQuery` is true (checked earlier at the top of the method).

- [ ] **Step 2: Run the failing test — should now pass**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern library.service -t "topic label"`

Expected: PASS.

- [ ] **Step 3: Run the full library spec**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern library.service`

Expected: 7 cases pass.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/library/library.service.ts apps/api/src/library/library.service.spec.ts
git commit -m "feat(library): match by topic label/slug in search"
```

---

### Task 7: Failing test — `source` ranked via tsvector weight

**Files:**
- Modify: `apps/api/src/library/library.service.spec.ts`

- [ ] **Step 1: Add the test**

```ts
it('search returns items whose source matches the query', async () => {
  const prisma = fakePrisma();
  const svc = new LibraryService(prisma as any, openai as any);
  await svc.create({
    title: 'How JavaScript works', description: null, url: null,
    format: 'VIDEO', difficulty: 'MEDIUM', estimatedMinutes: 10,
    source: 'Fireship', tags: [],
    createdById: 'u-1',
  });
  const results = await svc.search({ query: 'fireship' });
  expect(results.length).toBeGreaterThan(0);
  expect(results[0].title).toBe('How JavaScript works');
});
```

- [ ] **Step 2: Run — confirm it passes (mock already covers source)**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern library.service -t "source matches"`

Expected: PASS. (The mock upgrade in Task 2 already inspects `source`.)

This test documents the invariant; the real behavior comes from the migration's `setweight(..., 'D')` clause on `source`, which unit tests can't exercise against mocked Prisma. Manual verification follows in Task 8.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/library/library.service.spec.ts
git commit -m "test(library): assert source-match behavior"
```

---

### Task 8: Manual verification of English stemming against the real DB

- [ ] **Step 1: Start Postgres and the API**

Run:
```bash
docker compose up -d postgres
pnpm --filter @ics-select/api seed:library   # only if DB empty
pnpm --filter @ics-select/api dev
```

Wait for `Nest application successfully started`.

- [ ] **Step 2: Hit the search endpoint with a stemming query**

Run (replace `$JWT` with an admin token from your local session, or test via the admin UI later):
```bash
curl -s -X POST http://localhost:3001/library/search \
  -H "Content-Type: application/json" \
  -H "Cookie: ics_access=$JWT" \
  -d '{"query":"explained"}' | jq '.data[].title' | head -5
```

Expected: at least one title whose stem is `explain` (e.g. "React Explained", "How indexes actually work"). If none of your seeded items have such a title, seed one first:

```bash
docker compose exec postgres psql -U postgres -d ics_select -c \
  "INSERT INTO \"LibraryItem\"(id, title, format, difficulty, \"estimatedMinutes\", tags, tracks, \"createdAt\", \"updatedAt\") \
   VALUES (gen_random_uuid(), 'React explains itself', 'ARTICLE', 'EASY', 10, '{}', '{}', now(), now());"
```

Then re-run the curl.

- [ ] **Step 3: Verify "no match" returns empty**

Run:
```bash
curl -s -X POST http://localhost:3001/library/search \
  -H "Content-Type: application/json" \
  -H "Cookie: ics_access=$JWT" \
  -d '{"query":"zzzunmatchable"}' | jq '.data | length'
```

Expected: `0`.

- [ ] **Step 4: Verify topic-label match**

Run:
```bash
curl -s -X POST http://localhost:3001/library/search \
  -H "Content-Type: application/json" \
  -H "Cookie: ics_access=$JWT" \
  -d '{"query":"databases"}' | jq '.data | length'
```

Expected: > 0 (items linked to the Databases topic). Record actual count:

```
Count: ____ (write in PR description)
```

No commit for this task — it's verification only.

---

## Phase 2 — Frontend utilities

### Task 9: Install `fuse.js`

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml` (auto)

- [ ] **Step 1: Add the dep**

Run: `pnpm --filter @ics-select/web add fuse.js@^7.0.0`

Expected: `+ fuse.js 7.x.x` in the diff; lockfile updated.

- [ ] **Step 2: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(web): add fuse.js for admin library fuzzy search"
```

---

### Task 10: Topic category helper

**Files:**
- Create: `apps/web/lib/format/topic-category.ts`

- [ ] **Step 1: Write the helper**

```ts
import type { Topic } from '../queries/admin-topics';

export type TopicCategory =
  | 'Data Structures & Algorithms'
  | 'Infra & DevOps'
  | 'System Components'
  | 'Principles'
  | 'Cases'
  | 'Other';

export function topicCategory(order: number): TopicCategory {
  if (order < 20) return 'Data Structures & Algorithms';
  if (order < 30) return 'Infra & DevOps';
  if (order < 40) return 'System Components';
  if (order < 50) return 'Principles';
  if (order < 60) return 'Cases';
  return 'Other';
}

export const TOPIC_CATEGORY_ORDER: TopicCategory[] = [
  'Data Structures & Algorithms',
  'Infra & DevOps',
  'System Components',
  'Principles',
  'Cases',
  'Other',
];

export type GroupedTopics = Array<{
  category: TopicCategory;
  topics: Topic[];
}>;

export function groupTopicsByCategory(topics: Topic[]): GroupedTopics {
  const byCat = new Map<TopicCategory, Topic[]>();
  const sorted = [...topics].sort((a, b) => a.order - b.order);
  for (const t of sorted) {
    const cat = topicCategory(t.order);
    const arr = byCat.get(cat) ?? [];
    arr.push(t);
    byCat.set(cat, arr);
  }
  return TOPIC_CATEGORY_ORDER
    .filter((c) => byCat.has(c))
    .map((c) => ({ category: c, topics: byCat.get(c)! }));
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/format/topic-category.ts
git commit -m "feat(web): topic-category helper for grouped topic filter"
```

---

### Task 11: Fuse.js index helper

**Files:**
- Create: `apps/web/lib/library/fuse-index.ts`

- [ ] **Step 1: Write the helper**

```ts
import Fuse, { type IFuseOptions } from 'fuse.js';
import type { AdminLibraryItem } from '../queries/admin-library';

const FUSE_OPTIONS: IFuseOptions<AdminLibraryItem> = {
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
  includeScore: true,
};

export function buildFuse(items: AdminLibraryItem[]): Fuse<AdminLibraryItem> {
  return new Fuse(items, FUSE_OPTIONS);
}

/**
 * Run Fuse against `items` with `query`. Returns results in Fuse-ranked order.
 * When `query` is empty, returns items unchanged (caller keeps its own sort).
 */
export function fuseFilter(
  items: AdminLibraryItem[],
  query: string,
): AdminLibraryItem[] {
  const q = query.trim();
  if (q.length < 2) return items;
  const fuse = buildFuse(items);
  return fuse.search(q).map((r) => r.item);
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/library/fuse-index.ts
git commit -m "feat(web): fuse.js fuzzy filter helper for admin library"
```

---

## Phase 3 — Frontend components

### Task 12: Multi-filter combobox (shared)

**Files:**
- Create: `apps/web/components/admin/library/multi-filter-combobox.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { clsx } from 'clsx';

export interface MultiFilterOption {
  value: string;
  label: string;
}

interface Props {
  label: string;
  options: MultiFilterOption[];
  value: string[];
  onChange: (next: string[]) => void;
}

export function MultiFilterCombobox({ label, options, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };

  const triggerLabel =
    value.length === 0 ? label : `${label} · ${value.length}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-label px-3 py-1.5 rounded-pill border transition-colors',
          value.length > 0
            ? 'bg-paper-warm border-ink text-ink'
            : 'bg-paper border-rule text-ink-soft hover:bg-paper-warm',
        )}
      >
        {triggerLabel}
        {value.length > 0 ? (
          <X
            className="h-3 w-3"
            strokeWidth={1.5}
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
          />
        ) : (
          <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
        )}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-56 rounded-card border border-rule bg-surface shadow-sm">
          <ul className="max-h-72 overflow-auto py-1">
            {options.map((opt) => {
              const active = value.includes(opt.value);
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    onClick={() => toggle(opt.value)}
                    className={clsx(
                      'flex w-full items-center justify-between px-3 py-1.5 font-sans text-sm text-left',
                      active ? 'bg-focus/5 text-ink' : 'text-ink-soft hover:bg-paper-warm',
                    )}
                  >
                    <span>{opt.label}</span>
                    {active && <Check className="h-3.5 w-3.5" strokeWidth={1.5} />}
                  </button>
                </li>
              );
            })}
          </ul>
          {value.length > 0 && (
            <div className="border-t border-rule px-3 py-1.5">
              <button
                type="button"
                onClick={() => onChange([])}
                className="font-mono text-[10px] uppercase tracking-label text-ink-mute hover:text-ink"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/admin/library/multi-filter-combobox.tsx
git commit -m "feat(web): multi-select filter combobox for admin library"
```

---

### Task 13: Topic combobox (grouped, searchable)

**Files:**
- Create: `apps/web/components/admin/library/topic-combobox.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check, X, Search } from 'lucide-react';
import { clsx } from 'clsx';
import type { Topic } from '../../../lib/queries/admin-topics';
import { groupTopicsByCategory } from '../../../lib/format/topic-category';

interface Props {
  topics: Topic[];
  counts: Map<string, number>; // topicId → item count
  totalCount: number;
  value: string | null; // topicId
  onChange: (next: string | null) => void;
}

export function TopicCombobox({ topics, counts, totalCount, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setFilter('');
    const id = requestAnimationFrame(() => inputRef.current?.focus());
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(id);
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const grouped = useMemo(() => {
    if (!filter.trim()) return groupTopicsByCategory(topics);
    const q = filter.toLowerCase();
    const matched = topics.filter((t) => t.label.toLowerCase().includes(q));
    return groupTopicsByCategory(matched);
  }, [topics, filter]);

  const activeTopic = value ? topics.find((t) => t.id === value) : null;
  const triggerLabel = activeTopic ? activeTopic.label : 'All topics';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-label px-3 py-1.5 rounded-pill border transition-colors',
          value
            ? 'bg-paper-warm border-ink text-ink'
            : 'bg-paper border-rule text-ink-soft hover:bg-paper-warm',
        )}
      >
        {triggerLabel}
        {value ? (
          <X
            className="h-3 w-3"
            strokeWidth={1.5}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
          />
        ) : (
          <ChevronDown className="h-3 w-3" strokeWidth={1.5} />
        )}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-80 rounded-card border border-rule bg-surface shadow-sm">
          <div className="flex items-center gap-2 border-b border-rule px-3 py-2">
            <Search className="h-3.5 w-3.5 text-ink-mute" strokeWidth={1.5} />
            <input
              ref={inputRef}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter topics…"
              className="w-full bg-transparent font-sans text-sm focus:outline-none"
            />
          </div>
          <div className="max-h-96 overflow-auto py-1">
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className={clsx(
                'flex w-full items-center justify-between px-3 py-1.5 font-sans text-sm',
                !value ? 'bg-focus/5 text-ink' : 'text-ink-soft hover:bg-paper-warm',
              )}
            >
              <span className="flex items-center gap-2">
                {!value && <Check className="h-3.5 w-3.5" strokeWidth={1.5} />}
                <span className={!value ? '' : 'pl-5'}>All topics</span>
              </span>
              <span className="font-mono text-[11px] text-ink-mute">
                ({totalCount})
              </span>
            </button>
            {grouped.map(({ category, topics: ts }) => (
              <div key={category}>
                <div className="px-3 pt-2 pb-1 font-mono text-[10px] uppercase tracking-eyebrow text-ink-mute">
                  {category}
                </div>
                {ts.map((t) => {
                  const active = value === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        onChange(t.id);
                        setOpen(false);
                      }}
                      className={clsx(
                        'flex w-full items-center justify-between px-3 py-1.5 font-sans text-sm',
                        active ? 'bg-focus/5 text-ink' : 'text-ink-soft hover:bg-paper-warm',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        {active && <Check className="h-3.5 w-3.5" strokeWidth={1.5} />}
                        <span className={active ? '' : 'pl-5'}>{t.label}</span>
                      </span>
                      <span className="font-mono text-[11px] text-ink-mute">
                        ({counts.get(t.id) ?? 0})
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
            {grouped.length === 0 && (
              <p className="px-3 py-3 font-mono text-[11px] text-ink-mute">
                No topics match.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/admin/library/topic-combobox.tsx
git commit -m "feat(web): grouped topic combobox with internal search"
```

---

### Task 14: Pagination component

**Files:**
- Create: `apps/web/components/admin/library/pagination.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  page: number; // 1-based
  totalPages: number;
  onChange: (page: number) => void;
}

/**
 * Windowed pagination: shows first, last, current, and 2 on each side.
 * Renders ellipsis `…` where the window skips.
 */
export function Pagination({ page, totalPages, onChange }: Props) {
  if (totalPages <= 1) return null;
  const pages = windowedPages(page, totalPages);

  return (
    <nav className="flex items-center justify-center gap-1 pt-4" aria-label="Pagination">
      <PageButton
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria="Previous page"
      >
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
      </PageButton>
      {pages.map((p, i) =>
        p === null ? (
          <span
            key={`gap-${i}`}
            className="font-mono text-[11px] text-ink-mute px-1"
          >
            …
          </span>
        ) : (
          <PageButton
            key={p}
            active={p === page}
            onClick={() => onChange(p)}
            aria={`Page ${p}`}
          >
            {p}
          </PageButton>
        ),
      )}
      <PageButton
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria="Next page"
      >
        <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
      </PageButton>
    </nav>
  );
}

function PageButton({
  children,
  onClick,
  active,
  disabled,
  aria,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  aria: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={aria}
      aria-current={active ? 'page' : undefined}
      className={clsx(
        'inline-flex items-center justify-center min-w-7 h-7 px-2 rounded-input font-mono text-[11px] transition-colors',
        active
          ? 'bg-ink text-paper'
          : 'text-ink-soft hover:bg-paper-warm disabled:opacity-40 disabled:hover:bg-transparent',
      )}
    >
      {children}
    </button>
  );
}

function windowedPages(page: number, total: number): Array<number | null> {
  const W = 1; // pages to show on each side of current
  const out: Array<number | null> = [];
  const add = (p: number) => {
    if (p < 1 || p > total) return;
    if (out[out.length - 1] !== p) out.push(p);
  };
  add(1);
  if (page - W > 2) out.push(null);
  for (let p = Math.max(2, page - W); p <= Math.min(total - 1, page + W); p++) {
    add(p);
  }
  if (page + W < total - 1) out.push(null);
  add(total);
  return out;
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/admin/library/pagination.tsx
git commit -m "feat(web): numbered pagination with windowed page list"
```

---

## Phase 4 — Frontend: data flow + page rewrite

### Task 15: Expose `topics[]` and `source` on `AdminLibraryItem`

**Files:**
- Modify: `apps/web/lib/queries/admin-library.ts`

- [ ] **Step 1: Extend the type**

Find:
```ts
export type AdminLibraryItem = {
  id: string;
  title: string;
  url: string | null;
  description: string | null;
  format: 'VIDEO' | 'ARTICLE' | 'BOOK' | 'PROBLEM' | 'OTHER';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  estimatedMinutes: number;
  source: string | null;
  tags: string[];
  tracks: string[];
  topicId: string | null;
  createdAt: string;
};
```

Replace with:
```ts
export type AdminTopicOnItem = {
  id: string;
  slug: string;
  label: string;
  isPrimary: boolean;
};

export type AdminLibraryItem = {
  id: string;
  title: string;
  url: string | null;
  description: string | null;
  format: 'VIDEO' | 'ARTICLE' | 'BOOK' | 'PROBLEM' | 'OTHER';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  estimatedMinutes: number;
  source: string | null;
  tags: string[];
  tracks: string[];
  topicId: string | null;
  topics: AdminTopicOnItem[];
  createdAt: string;
};
```

`GET /library` already returns `topics[]` and `source` in the shape (see `LibraryService.list` via `shapeItem`) — we're just reflecting that in the TS type.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: no errors (existing consumers only read `topicId`, which is still present).

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/queries/admin-library.ts
git commit -m "refactor(web): surface topics[] and source on AdminLibraryItem"
```

---

### Task 16: Rewrite `/admin/library/page.tsx`

**Files:**
- Modify: `apps/web/app/(admin)/admin/library/page.tsx`

- [ ] **Step 1: Replace the file contents**

```tsx
'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Layers, Pencil, Trash2, Search } from 'lucide-react';
import {
  useAdminLibrary,
  useDeleteLibraryItem,
  type AdminLibraryItem,
} from '../../../../lib/queries/admin-library';
import { useTopics } from '../../../../lib/queries/admin-topics';
import { Eyebrow } from '../../../../components/ui/eyebrow';
import { ItemFormModal } from '../../../../components/admin/library/item-form-modal';
import { TopicsModal } from '../../../../components/admin/library/topics-modal';
import { TopicCombobox } from '../../../../components/admin/library/topic-combobox';
import {
  MultiFilterCombobox,
  type MultiFilterOption,
} from '../../../../components/admin/library/multi-filter-combobox';
import { Pagination } from '../../../../components/admin/library/pagination';
import { fuseFilter } from '../../../../lib/library/fuse-index';
import { topicCategory } from '../../../../lib/format/topic-category';
import {
  detectPlatform,
  platformLabel,
} from '../../../../lib/format/platform';

const PAGE_SIZE = 25;

const FORMAT_OPTIONS: MultiFilterOption[] = [
  { value: 'VIDEO', label: 'Video' },
  { value: 'ARTICLE', label: 'Article' },
  { value: 'BOOK', label: 'Book' },
  { value: 'PROBLEM', label: 'Problem' },
  { value: 'OTHER', label: 'Other' },
];

const DIFFICULTY_OPTIONS: MultiFilterOption[] = [
  { value: 'EASY', label: 'Easy' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HARD', label: 'Hard' },
];

const TRACK_OPTIONS: MultiFilterOption[] = [
  { value: 'BIG_TECH', label: 'Big Tech' },
  { value: 'CONSULTING_TECH', label: 'Consulting tech' },
  { value: 'COMPETITIVE_PROGRAMMING', label: 'Competitive' },
  { value: 'STARTUP', label: 'Startup' },
  { value: 'OTHER', label: 'Other' },
];

const PLATFORM_BORDER: Record<string, string> = {
  youtube: 'border-l-platform-youtube',
  leetcode: 'border-l-platform-leetcode',
  medium: 'border-l-platform-medium',
  github: 'border-l-platform-github',
  article: 'border-l-platform-article',
  book: 'border-l-platform-book',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function parseCsv(v: string | null): string[] {
  if (!v) return [];
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

export default function AdminLibraryPage() {
  const router = useRouter();
  const params = useSearchParams();

  const { data: topics } = useTopics();
  const { data: items, isLoading } = useAdminLibrary();

  // URL-driven state (read once per render).
  const query = params.get('q') ?? '';
  const topicId = params.get('topic');
  const formats = parseCsv(params.get('format'));
  const difficulties = parseCsv(params.get('difficulty'));
  const tracks = parseCsv(params.get('track'));
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1);

  // Local-only state: search input is debounced before it syncs to URL.
  const [searchInput, setSearchInput] = useState(query);
  useEffect(() => setSearchInput(query), [query]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput !== query) writeUrl({ q: searchInput, page: 1 });
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  // `/` shortcut focuses the search input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' &&
          document.activeElement?.tagName !== 'TEXTAREA') {
        const el = document.getElementById('library-search-input');
        if (el) {
          e.preventDefault();
          (el as HTMLInputElement).focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  function writeUrl(next: {
    q?: string;
    topic?: string | null;
    format?: string[];
    difficulty?: string[];
    track?: string[];
    page?: number;
  }) {
    const sp = new URLSearchParams(params.toString());
    const setOrDelete = (k: string, v: string | null | undefined) => {
      if (v && v.length > 0) sp.set(k, v);
      else sp.delete(k);
    };
    if ('q' in next) setOrDelete('q', next.q);
    if ('topic' in next) setOrDelete('topic', next.topic);
    if ('format' in next) setOrDelete('format', next.format!.join(','));
    if ('difficulty' in next) setOrDelete('difficulty', next.difficulty!.join(','));
    if ('track' in next) setOrDelete('track', next.track!.join(','));
    if ('page' in next) {
      if (!next.page || next.page === 1) sp.delete('page');
      else sp.set('page', String(next.page));
    }
    router.replace(`?${sp.toString()}`);
  }

  // ----- Filter pipeline -----
  const allItems = items ?? [];

  const filtered = useMemo(() => {
    let list = allItems;
    if (topicId) {
      list = list.filter((i) => i.topics.some((t) => t.id === topicId));
    }
    if (formats.length > 0) list = list.filter((i) => formats.includes(i.format));
    if (difficulties.length > 0) {
      list = list.filter((i) => difficulties.includes(i.difficulty));
    }
    if (tracks.length > 0) {
      list = list.filter((i) => {
        // Empty tracks[] = wildcard (applies everywhere).
        if (!i.tracks || i.tracks.length === 0) return true;
        return i.tracks.some((t) => tracks.includes(t));
      });
    }
    if (query.trim().length >= 2) list = fuseFilter(list, query);
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allItems, topicId, formats.join(','), difficulties.join(','), tracks.join(','), query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Topic counts (unconditional — reflect total per topic).
  const topicCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of allItems) for (const t of it.topics) {
      m.set(t.id, (m.get(t.id) ?? 0) + 1);
    }
    return m;
  }, [allItems]);

  // Breadcrumb context.
  const activeTopic = topicId ? (topics ?? []).find((t) => t.id === topicId) : null;
  const activeCategory = activeTopic ? topicCategory(activeTopic.order) : null;

  // Handlers
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AdminLibraryItem | null>(null);
  const [topicsOpen, setTopicsOpen] = useState(false);
  const remove = useDeleteLibraryItem();

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (item: AdminLibraryItem) => { setEditing(item); setFormOpen(true); };
  const closeForm = () => { setFormOpen(false); setEditing(null); };
  const removeItem = (item: AdminLibraryItem) => {
    if (!confirm(`Delete "${item.title}"?`)) return;
    remove.mutate(item.id);
  };

  const anyFilterActive =
    query.length > 0 || topicId || formats.length > 0 ||
    difficulties.length > 0 || tracks.length > 0;

  const clearAll = () => {
    setSearchInput('');
    router.replace('?');
  };

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Eyebrow>Library</Eyebrow>
          <h1 className="mt-2 font-serif-tool text-3xl font-semibold tracking-tight">
            {activeTopic ? (
              <span>
                Library
                <span className="text-ink-mute"> · {activeCategory} / </span>
                {activeTopic.label}
              </span>
            ) : (
              'Library'
            )}
          </h1>
          <p className="mt-1 font-mono text-xs text-ink-mute">
            {anyFilterActive
              ? `${filtered.length} of ${allItems.length} · showing ${pageItems.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–${(safePage - 1) * PAGE_SIZE + pageItems.length}`
              : `${allItems.length} item${allItems.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTopicsOpen(true)}
            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-label px-4 py-2 bg-paper-warm text-ink-soft rounded-pill hover:bg-rule"
          >
            <Layers className="h-3.5 w-3.5" strokeWidth={1.5} /> Manage topics
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 font-mono text-xs uppercase tracking-label px-4 py-2 bg-ink text-paper rounded-pill hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.5} /> New item
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-mute"
          strokeWidth={1.5}
        />
        <input
          id="library-search-input"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search title, url, topic, format…"
          className="w-full rounded-input border border-rule bg-paper pl-9 pr-4 py-2 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-focus/40"
        />
      </div>

      {/* Filters row */}
      <div className="flex items-center gap-2 flex-wrap">
        <TopicCombobox
          topics={topics ?? []}
          counts={topicCounts}
          totalCount={allItems.length}
          value={topicId}
          onChange={(id) => writeUrl({ topic: id, page: 1 })}
        />
        <MultiFilterCombobox
          label="Format"
          options={FORMAT_OPTIONS}
          value={formats}
          onChange={(v) => writeUrl({ format: v, page: 1 })}
        />
        <MultiFilterCombobox
          label="Difficulty"
          options={DIFFICULTY_OPTIONS}
          value={difficulties}
          onChange={(v) => writeUrl({ difficulty: v, page: 1 })}
        />
        <MultiFilterCombobox
          label="Track"
          options={TRACK_OPTIONS}
          value={tracks}
          onChange={(v) => writeUrl({ track: v, page: 1 })}
        />
        {anyFilterActive && (
          <button
            type="button"
            onClick={clearAll}
            className="font-mono text-[10px] uppercase tracking-label text-ink-mute hover:text-ink"
          >
            ✕ clear all
          </button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <p className="font-mono text-xs uppercase tracking-label text-ink-mute">
          Loading…
        </p>
      ) : pageItems.length === 0 ? (
        <div className="font-mono text-xs text-ink-mute py-12 text-center border border-dashed border-rule rounded-card space-y-3">
          <p>No items match.</p>
          {anyFilterActive && (
            <button
              type="button"
              onClick={clearAll}
              className="font-mono text-[11px] uppercase tracking-label text-focus hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {pageItems.map((item) => {
            const platform = detectPlatform(item.url ?? null, item.format);
            const primaryTopic = item.topics.find((t) => t.isPrimary) ?? null;
            const borderClass = PLATFORM_BORDER[platform] ?? 'border-l-rule';
            return (
              <li
                key={item.id}
                className={`group flex items-start gap-3 border border-rule border-l-[3px] ${borderClass} rounded-card bg-surface px-4 py-3 hover:bg-paper-warm/60 transition-colors`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-serif-tool text-base font-semibold text-ink">
                    {item.title}
                  </p>
                  <div className="mt-1 flex items-center gap-2 flex-wrap font-mono text-[10px] uppercase tracking-label text-ink-mute">
                    <span>{platformLabel(platform)}</span>
                    {primaryTopic && (
                      <>
                        <span>·</span>
                        <span>{primaryTopic.label}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>{item.format}</span>
                    <span>·</span>
                    <span>{item.difficulty.toLowerCase()}</span>
                    <span>·</span>
                    <span>{item.estimatedMinutes}m</span>
                    {item.tracks.length > 0 && (
                      <>
                        <span>·</span>
                        <span>
                          {item.tracks
                            .map((t) => t.replace(/_/g, ' ').toLowerCase())
                            .join(', ')}
                        </span>
                      </>
                    )}
                    <span>·</span>
                    <span>{formatDate(item.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 font-mono text-[11px]">
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-focus hover:underline"
                    >
                      open ↗
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="text-ink-soft hover:text-ink inline-flex items-center gap-1"
                  >
                    <Pencil className="h-3 w-3" strokeWidth={1.5} /> edit
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(item)}
                    className="text-ink-soft hover:text-outcome-stuck inline-flex items-center gap-1"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={1.5} /> delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Pagination */}
      <Pagination
        page={safePage}
        totalPages={totalPages}
        onChange={(p) => writeUrl({ page: p })}
      />

      <ItemFormModal
        open={formOpen}
        initial={editing}
        onClose={closeForm}
      />
      <TopicsModal open={topicsOpen} onClose={() => setTopicsOpen(false)} />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(admin\)/admin/library/page.tsx
git commit -m "feat(web): redesign /admin/library with fuse search + pagination + combobox filters"
```

---

### Task 17: Delete the old filters-bar

**Files:**
- Delete: `apps/web/components/admin/library/filters-bar.tsx`

- [ ] **Step 1: Confirm nothing else imports it**

Run: `pnpm --filter @ics-select/web typecheck` (done in Task 16) plus:

Run: `grep -r "filters-bar" apps/web --include='*.tsx' --include='*.ts'`

Expected: zero results (we replaced the only import in Task 16).

- [ ] **Step 2: Delete the file**

Run: `rm apps/web/components/admin/library/filters-bar.tsx`

- [ ] **Step 3: Typecheck and build**

Run: `pnpm --filter @ics-select/web typecheck && pnpm --filter @ics-select/shared build`

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add -A apps/web/components/admin/library/
git commit -m "chore(web): remove unused filters-bar (replaced by combobox row)"
```

---

### Task 18: Manual verification in the browser

Golden path + edge cases.

- [ ] **Step 1: Start the stack**

Run (in separate terminals):
```bash
docker compose up -d postgres
pnpm --filter @ics-select/api dev
pnpm --filter @ics-select/web dev
```

Visit: `http://localhost:3000/admin/library`.

- [ ] **Step 2: Page layout**

Check the following visually:
- Header shows `Library` + item count meta line.
- Search input is full-width with a search icon on the left.
- Filter row has four pills: `All topics`, `Format`, `Difficulty`, `Track`. No `clear all` visible.
- List shows items with the platform-color stripe on the left, identical row design to before the refactor.
- Pagination bar at the bottom shows page numbers if items > 25.

- [ ] **Step 3: Topic combobox**

- Click `All topics` → popover opens, categories visible, search input focused.
- Type `data` → list narrows to topics with "data" in the label; categories that become empty collapse out.
- Select `Databases` → popover closes. Trigger now reads `Databases`. Header h1 becomes `Library · Infra & DevOps / Databases`. URL now has `?topic=<uuid>`. List filters to items linked to Databases.
- Click the `×` on the trigger → topic clears. Header + list return to unfiltered. URL loses `topic` param.

- [ ] **Step 4: Search (Fuse.js)**

- Type `graph` → list instantly narrows to graph-related items (title match + Graph topic items if any). URL has `?q=graph`.
- Type `graps` (typo) → still shows Graph items (typo tolerance, threshold 0.35).
- Type `zzzqqq` → empty state shows `No items match.` + `Clear filters` link.
- Click `Clear filters` → returns to full list.

- [ ] **Step 5: Multi-select filters**

- Click `Format` → popover with `Video / Article / Book / Problem / Other`.
- Select `Video` + `Article` → trigger shows `Format · 2`. URL has `?format=VIDEO,ARTICLE`.
- Click `×` on trigger → clears both. URL param gone.
- Esc closes popover. Click outside also closes.

- [ ] **Step 6: Pagination + URL state**

- Scroll to bottom, click page 2 → list updates to items 26–50. URL has `?page=2`.
- Reload the page → still on page 2 with same filters. Position is preserved.
- Change a filter → page resets to 1.

- [ ] **Step 7: Edit flow preserves position**

- Navigate to page 2 with `?topic=tree`.
- Edit an item, save. List refreshes; you are still on page 2 of tree items. The edited row shows the new title.

- [ ] **Step 8: `/` shortcut**

- Click anywhere (not in an input) → press `/`. The search input focuses.

- [ ] **Step 9: Record the happy path in the PR description**

Write a one-line summary of what you verified (e.g. "Verified search/topic/filters/pagination/edit-preserves-position on local dev"). No commit for this task.

---

## Phase 5 — Docs

### Task 19: Update stale CLAUDE.md reference to "semantic search"

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Find the stale sentence**

In CLAUDE.md, the section `### Prisma & pgvector` says:

> Prisma can't describe `vector(1536)` or `tsvector` natively, so migrations `0_init` (extension), `3_library_search_columns` (embedding column + tsvector + trigger + ivfflat index) and all semantic-search queries go through `$queryRawUnsafe` / `$executeRawUnsafe` in `apps/api/src/library/library.service.ts`. Re-embedding happens on create/update via `OpenAiService.embed`. The `tsvector` is maintained by a Postgres trigger, not from app code.

The phrase "all semantic-search queries" is inaccurate — the search code path uses tsvector (lexical), not pgvector cosine. The embedding is written but not consulted by any `SELECT`.

- [ ] **Step 2: Edit the sentence**

Replace the paragraph above with:

```
Prisma can't describe `vector(1536)` or `tsvector` natively, so migrations `0_init` (extension), `3_library_search_columns` / `e_library_search_v2` / `h_library_search_english` (embedding column + tsvector + trigger + ivfflat index) go through `$queryRawUnsafe` / `$executeRawUnsafe` in `apps/api/src/library/library.service.ts`. The `search` method uses **lexical** tsvector (`english` stemming, weighted title/description/tags/source + simple-tokenized URL) plus a service-side topic-label match; vector embeddings are written on create/update via `OpenAiService.embed` but are **not** consumed by any `SELECT` today — the column is maintained for a future semantic-search feature. The `tsvector` is maintained by a Postgres trigger, not from app code.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude-md): correct library search description (tsvector, not vector)"
```

---

## Self-review checklist (completed inline)

**Spec coverage — each spec section maps to a task:**
- Split architecture (spec §Architecture) → Tasks 15, 16 (client), Tasks 4, 6 (server)
- Combobox with category grouping (spec §Topic combobox) → Task 10 (helper), Task 13 (component), Task 16 (integration)
- Breadcrumb in header (spec §Header) → Task 16
- Multi-select format/diff/track (spec §Filter row) → Task 12, Task 16
- Numbered pagination 25/page + URL sync (spec §Pagination + §URL state sync) → Task 14, Task 16
- Fuse.js config (spec §Filter & search pipeline) → Task 11, Task 16
- Migration h_library_search_english (spec §Migration) → Task 1
- LibraryService.search refactor (spec §refactor) → Tasks 2–8
- Test matrix (spec §Tests backend) → Tasks 3, 5, 7 (covers "no match" / topic-label / source). English stemming covered by Task 8 manual step — no unit test (requires real DB).
- CLAUDE.md correction (spec §Open follow-ups) → Task 19
- Embedding write preserved → left untouched in all tasks.
- fuse.js dep add → Task 9.
- filters-bar deletion → Task 17.

**Placeholder scan:** no TBD/TODO; every code block is complete; no "similar to Task N" shortcuts.

**Type consistency:** `AdminLibraryItem.topics: AdminTopicOnItem[]` (Task 15) matches Fuse key `topics.label` (Task 11) matches `TopicCombobox` consumption (Task 13) matches page use `item.topics.find(t => t.isPrimary)` (Task 16). `writeUrl` signature stable across all callers. `PAGE_SIZE = 25` lives in the page module.

**Scope:** single feature, single worktree, ~1 day of focused work.

---

## Dependencies between tasks

- Task 1 (migration) → prerequisite for Task 8 (manual verification against real DB).
- Tasks 2–7 independent of frontend; can land before or after frontend tasks.
- Tasks 9 (fuse dep), 10, 11 precede Task 12–14 (components).
- Tasks 12–14 precede Task 16 (page rewrite).
- Task 15 precedes Task 16 (page uses new type).
- Task 16 precedes Task 17 (page must stop importing filters-bar first).
- Task 18 runs after everything frontend-side lands.
- Task 19 (docs) independent; lands last.

Recommended execution order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19.

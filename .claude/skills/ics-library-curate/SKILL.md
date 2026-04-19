---
name: ics-library-curate
description: Use when filling the ICS Select library acervo with study materials, when the user says "preencher acervo", "curar library", "find study materials", "library gaps", "fill topic X", or when topics in the Topic table have zero or too few LibraryItems.
---

# ICS Library Curate

Batch-curate `LibraryItem` rows for the ICS Select acervo, following the layered EASY→MEDIUM→HARD model, the approved-channels list, and the seed-script review flow. **Never insert items without user approval.**

## Iron Rule

**Every proposed item must be approved by the user before entering the seed script.** No autonomous writes to the DB. No bypassing the seed script.

## Workflow (follow in order)

1. **Read curation memory first** — `cat ~/.claude/projects/-Users-daviduarte-development-personal-ics-select/memory/feedback_library_curation.md`. This file is the source of truth for approved channels, rejected channels, the layered strategy, the track-mapping rules, and the book-section pattern. **If this file doesn't exist, STOP and ask the user.** Do not proceed from guesses.

2. **Query the DB for gaps** — use the `DATABASE_URL` from `apps/api/.env`. Concrete command (use `psql` via Bash — do NOT write a one-off Node script):
   ```bash
   source apps/api/.env && psql "$DATABASE_URL" -c "
   SELECT t.slug, t.label, t.\"order\",
          COUNT(i.id) AS total,
          COUNT(i.id) FILTER (WHERE i.difficulty = 'EASY')   AS easy,
          COUNT(i.id) FILTER (WHERE i.difficulty = 'MEDIUM') AS medium,
          COUNT(i.id) FILTER (WHERE i.difficulty = 'HARD')   AS hard
   FROM \"Topic\" t
   LEFT JOIN \"LibraryItem\" i ON i.\"topicId\" = t.id
   GROUP BY t.id
   ORDER BY total ASC, t.\"order\" ASC;
   "
   ```
   Treat as a gap: `total < 4`, or any of `easy/medium/hard = 0`. If `psql` isn't installed, ask user for a workaround — **do not** bypass by writing custom Node scripts that hit the DB directly; that breaks the "only the seed touches the DB" rule.

3. **Pick ONE topic to work on**. If the user named a topic, use it. Otherwise surface the top 3 gaps and ask which to fill. **Never curate multiple topics in one batch** — it's too much for the user to review at once.

4. **Plan the layered ladder** for that topic before searching:
   - 1× EASY entry-point (Fireship "X in 100 seconds" style when available).
   - 2–3× MEDIUM practical/architectural.
   - 1–2× HARD deep-dive / internals / pitfalls.
   - 1× ARTICLE (Medium post, engineering blog).
   - 1× BOOK section (Grokking chapter) when the topic has one.

5. **Search for real URLs** — use `WebSearch` (not guessing from memory). **Never fabricate a YouTube video ID.** For each candidate:
   - Verify title + channel with a real search result. **Even if you "remember" the URL from training data, still search** — video IDs get removed, channels rename, URLs rot. No exceptions.
   - **MANDATORY for YouTube videos**: fetch exact duration via `curl` scrape:
     ```bash
     curl -s -A "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" \
       -H "Cookie: CONSENT=YES+cb" \
       "https://www.youtube.com/watch?v=VIDEO_ID" \
       | grep -oE '"lengthSeconds":"[0-9]+"' | head -1 | grep -oE '[0-9]+'
     ```
     Returns seconds; do `ceil(secs/60)` for `estimatedMinutes`. Never estimate — Davi caught a video cadastrado as `8 min` that was actually 87s (2 min). Guessing distorts weekly plan budgets.
     **Note on the CONSENT cookie**: older YouTube videos (pre-2015 mycodeschool etc.) serve a consent-wall HTML without the JSON when fetched without `Cookie: CONSENT=YES+cb`. Always include the cookie. If it still returns empty, try oembed as fallback: `curl -s "https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=ID&format=json"` (returns title/author but not duration).
   - For ARTICLE items: use Medium's "X min read" badge if available, else estimate reasonably.
   - For BOOK items: reading time for the chapter only (15–30 min typical).
   - If no good match from an approved channel exists, **leave the slot empty and flag it to the user — do not fill with a rejected channel**. Propose fewer items rather than lower-quality items.
   - Verify each slug in `topicSlugs` appears in the `TOPICS` array of `apps/api/scripts/seed-library.ts`. Typos → `Unknown topicSlug` at runtime. **First slug is primary** (the item's "home"); any remaining slugs are secondary covers that count toward those topics' completion %.

6. **Propose in a markdown table** for user approval:
   ```
   | # | Format | Diff | Title | URL | ~min | Tracks | Source |
   |---|--------|------|-------|-----|------|--------|--------|
   ```
   Ask explicitly: "Aprova os N itens? Corta algum? Ajusta tracks?"

7. **After approval**, append **only the approved** items to `apps/api/scripts/seed-library.ts` (into the `ITEMS` array — do NOT replace existing entries, append). If the user approves 4 of 6 proposed items, append 4. Also: before appending, scan the existing `ITEMS` array for duplicates by `title+url` and skip those — the seed is idempotent at the DB level but duplicate array entries create noisy diffs.

8. **Run the seed**: `pnpm --filter @ics-select/api seed:library`. Report the created/updated counts back to the user.

9. **Commit** on a feature branch with message `feat(library): seed items for <topic-slug>`. Do not commit to `main` directly.

## Approved channels (source of truth)

**Always re-read `feedback_library_curation.md` — this list may be updated.** Shown here for quick reference:

| Channel | Use for | Filter |
|---|---|---|
| Fireship | EASY entry-point ("X in 100 seconds" ONLY) | No long screencasts |
| 3Blue1Brown | Math/CS mental models | — |
| Reducible | Algorithm visualization | — |
| William Fiset | Graphs | ONLY the Graph Theory playlist |
| ByteByteGo | System Design (all tiers) | — |
| The Coding Gopher | Engineering deep-dives | — |
| Hussein Nasser | Networking + database internals | HTTP/TCP/DB protocols, MVCC, WAL, pages, storage engines |
| Lucas Montano (BR) | Architecture videos | Architecture content only |
| mycodeschool | Algorithms & DS fundamentals | Whiteboard-style, zero IDE. Canonical for basic DS. |
| Back To Back SWE | Interview prep / algorithms | Animated slides + whiteboard, zero VSCode |
| NeetCode | Arrays/hashing/algos animated explainers | **Only animated explanation videos, NOT LC solve-alongs** in VSCode. If title is "Leetcode X - Python" with code walkthrough, skip. |
| Filipe Deschamps (BR) | Architecture-only | Filter out VSCode screencasts video-by-video. Heuristic: titles with "criando X", "codando Y", "montando Z" with a specific framework name are usually screencasts — skip. Architectural titles ("como funciona", "por que X", "entendendo Y") are usually OK. When in doubt, open the video page and check the thumbnail/description for IDE shots. |
| Arthur Takeda (BR) | BR tech content | — |
| Augusto Galego (BR) | Senior interview prep | Whole channel OK; senior eng playlist = BIG_TECH only |

**Rejected channels — NEVER propose**: Michael Sambol, Gaurav Sen, Jordan has no life, Fabio Akita, IBM Technology.

## Tag vocabulary (MANDATORY)

Three orthogonal axes classify each item. Use each for its purpose:

| Axis | Cardinality | Purpose |
|---|---|---|
| `topicSlugs[]` | N per item (first = primary) | Main subjects. Item is "home" at primary; secondary slugs mark cross-topic coverage |
| `tags` | N per item | Flavor + descriptors |
| `tracks` | N per item | Career routing |

**Cross-topic items (e.g. Fireship "5 wild data structures" — B-tree + Radix + Rope + Bloom filter + Cuckoo hashing) use `topicSlugs` to count toward every topic they cover:**
```ts
{
  title: '5 wild data structures every developer should know',
  topicSlugs: ['tree', 'array', 'databases'], // primary=tree, covers=array+databases
  // ...
}
```
All three topics' completion % will include this item. The admin finds it under `tree` (primary) but it also shows in filtered searches for `array` and `databases`.

**Kind tag (pick exactly one per item)**:

| Kind | When to use |
|---|---|
| `concept` | Default — teaching what/how something works |
| `tradeoffs` | Comparison content (A vs B, "when to pick") |
| `practice` | Hands-on with a specific tool/service |
| `case-study` | Full system design walkthrough |

After the kind tag, add free-form tags: technologies (`redis`, `postgres`, `kafka`), sources (`fireship`, `bytebytego`), concept names (`cache-aside`, `mvcc`, `mvcc`).

**Example**:
```ts
{
  title: 'SQL vs NoSQL — When to Use What',
  topicSlug: 'databases',
  tags: ['tradeoffs', 'sql', 'nosql', 'postgres', 'mongo'],
  tracks: ['BIG_TECH', 'CONSULTING_TECH', 'STARTUP'],
  // ...
}
```

**Never skip the kind tag.** Admin filters by `tags: ['tradeoffs']` to see trade-off content across all topics — items without a kind tag are invisible to that filter.

## Track tagging cheat sheet

Every item's `tracks: Track[]` is a routing primitive — admin filters items by the member's track.

| Item type | Tracks |
|---|---|
| Interview prep (senior eng hiring signals) | `['BIG_TECH']` |
| Engineering internals (how DBs/caches work) | `['BIG_TECH', 'CONSULTING_TECH', 'STARTUP']` |
| Algorithms & DS | `['BIG_TECH', 'COMPETITIVE_PROGRAMMING']` |
| System design fundamentals | `['BIG_TECH', 'CONSULTING_TECH']` |
| Pure competitive programming | `['COMPETITIVE_PROGRAMMING']` |
| Startup / product / scrappy infra | `['STARTUP']` |
| Universal concept (intro "what is X") | `[]` (empty = applies to all; library service handles this) |

**Never over-tag.** If unsure whether an item is useful for STARTUP, don't add it — noise breaks the routing.

## Book items (whitelisted)

Books are cadastrados as **one item per chapter/section**, not one item per book.

**Whitelisted books** (only these — no others):

| Book | Use for | Notes |
|---|---|---|
| **Grokking Data Structures** (La Rocca, Manning) | `array`, `lists`, `tree`, `trie`, `heap`, `graph` | Visual-heavy, perfect fit |
| **Grokking Algorithms / Entendendo Algoritmos** (Bhargava) | `recursion`, `dp`, `sorting`, `searching`, `greedy`, `graph` | Cartoon-style visual |
| **Grokking Deep Learning** (Trask) | ML topics | **On-hold** — don't seed items yet |

**Explicitly NOT approved**: Grokking System Design Interview, Designing Data-Intensive Applications, any other. Don't propose.

Item format:
- `title` format: `"Book Name — Chapter Topic (chapter)"` e.g. `"Grokking Algorithms — Breadth-First Search (chapter)"`.
- `url`: PDF link from a public GitHub repo (search for the title).
- `source`: `"Book — <full book title>"`.
- `description`: what the chapter covers + note like "Read only the BFS chapter, not the whole book."
- `estimatedMinutes`: reading time for the chapter only (usually 15–30 min).
- `format`: `'BOOK'`.

**Topics without a whitelisted book fit**: leave them without a BOOK item. Don't stretch to fit a non-approved book. `databases` currently has no whitelisted book (DDIA would fit but isn't approved).

## Layered-ladder example (template)

For topic `caching` (already done — use as reference):

| # | Format | Diff | Kind | Role |
|---|--------|------|------|------|
| 1 | VIDEO | EASY | `concept` | Fireship — "Redis in 100 Seconds" (entry) |
| 2 | VIDEO | MEDIUM | `tradeoffs` | ByteByteGo — "5 Caching Strategies" (pick one) |
| 3 | VIDEO | MEDIUM | `concept` | ByteByteGo — "Cache Systems Every Dev Should Know" |
| 4 | VIDEO | HARD | `concept` | ByteByteGo — "Caching Pitfalls" (what goes wrong) |
| 5 | VIDEO | HARD | `concept` | ByteByteGo — "Cache Invalidation Explained" |
| 6 | ARTICLE | MEDIUM | `tradeoffs` | ByteByteGo Blog — "Top Caching Strategies" |
| 7 | BOOK | MEDIUM | `concept` | Grokking SD — Caching chapter |

New topics should match this shape (quantity and tier distribution), swapping channels per topic speciality.

## Red flags — STOP and fix before proceeding

- ❌ About to propose a channel not in the approved list → STOP. Only use approved channels.
- ❌ URL from memory without a WebSearch hit → STOP. Search first.
- ❌ All proposed items are the same difficulty → STOP. Re-plan the ladder.
- ❌ `estimatedMinutes` for a YouTube video wasn't fetched via curl scrape (mandatory) → STOP. Fetch exact.
- ❌ About to propose a BOOK item that isn't on the whitelist (Grokking Data Structures / Algorithms / Deep Learning) → STOP. Leave the topic without a BOOK rather than forcing a non-approved book.
- ❌ About to write directly to the DB via Prisma client or REST API → STOP. Only the seed script inserts items.
- ❌ About to cadastrar a whole book as one item → STOP. Break into chapters.
- ❌ About to insert before user approves → STOP. Present the table, wait for "aprovo".
- ❌ Item has no kind tag (one of `concept`/`tradeoffs`/`practice`/`case-study`) → STOP. Add one.
- ❌ About to create a `<topic>-tradeoffs` or `<topic>-practice` topic → STOP. Use a tag, not a new topic. See "Tag vocabulary" section.
- ❌ Filipe Deschamps video is mostly him typing in VSCode → STOP. Only architecture-heavy videos from him.
- ❌ Memory file `feedback_library_curation.md` not found → STOP. Ask the user.

## Seed-script append pattern

Do NOT rewrite `apps/api/scripts/seed-library.ts`. Append to the `ITEMS` array:

```ts
// apps/api/scripts/seed-library.ts  (append at end of ITEMS array)
const ITEMS: ItemSeed[] = [
  // ... existing items ...
  {
    title: 'Load Balancer Explained',
    url: 'https://www.youtube.com/watch?v=XXXX',
    description: 'ByteByteGo — L4 vs L7, round robin, least connections.',
    format: 'VIDEO',
    difficulty: 'MEDIUM',
    estimatedMinutes: 8,
    topicSlugs: ['load-balancers'],
    tracks: ['BIG_TECH', 'CONSULTING_TECH'],
    source: 'YouTube — ByteByteGo',
    tags: ['concept', 'load-balancer', 'l4', 'l7'],
  },
];
```

The seed is idempotent (upsert by title+url), so re-running doesn't duplicate.

## Running the seed

```bash
# with embeddings:
OPENAI_API_KEY=... pnpm --filter @ics-select/api seed:library

# without embeddings (items get no embedding; admin can re-save via UI to trigger embedding later):
pnpm --filter @ics-select/api seed:library
```

Expected output: `N created, M updated`. If it says `0 created, 0 updated` for items you just added, check your topicSlug matches one in the `TOPICS` array.

## When NOT to use this skill

- User wants to add ONE specific item they found themselves → just append to seed and run, skip the full workflow.
- User is designing a new Topic (taxonomy change) → this skill only fills existing topics.
- User wants to delete/reorganize items → use admin UI or direct Prisma edits; this skill only adds.

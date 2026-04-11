# ICS Select — Fase 2 (Acervo + Busca Semântica) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Ship the library of study materials. The admin can add items (videos, articles, books, LeetCode problems) by pasting a URL — the server auto-extracts metadata, computes an OpenAI embedding, and stores both the embedding (pgvector) and a tsvector for full-text search. The admin can search the library by natural-language query plus structured filters (format, difficulty, tags, max minutes) with a hybrid score combining cosine similarity and ts_rank. A functional admin UI exposes all of this.

**Architecture:** A new `LibraryItem` Prisma model with a `vector(1536)` column for `text-embedding-3-small` and a `tsvector` column for Portuguese full-text search, both maintained by the `LibraryService` on create/update. A secondary SQL migration adds the extension columns and triggers (pgvector + tsvector) that Prisma cannot express directly. The `LibraryService` uses `$queryRaw` for semantic searches and plain Prisma for CRUD. URL auto-import uses server-side HTTP fetching + lightweight HTML parsing (`cheerio`) to extract Open Graph tags, plus heuristics for specific known sources (LeetCode, Medium, YouTube). The frontend uses TanStack Query + HeroUI Autocomplete for live search and a Drawer-based form for create/edit.

**Tech Stack (new in this phase):** `openai` npm client (embeddings only — no chat yet), `cheerio` for HTML parsing, `undici` (already bundled with Node 20+) for fetching, `zod` (already in use) for validation.

---

## Pre-flight (manual)

1. **OpenAI API key:** create or reuse a project key at platform.openai.com with access to `text-embedding-3-small`. Add to `apps/api/.env` and to the VPS `.env` as `OPENAI_API_KEY`.
2. **pgvector extension:** already enabled by the Phase 0 `0_init` migration. No action required.

---

## File Structure

### packages/prisma

| Path | Purpose |
|---|---|
| `packages/prisma/prisma/schema.prisma` | Add `LibraryItem` model, `ItemFormat`, `ItemDifficulty` enums |
| `packages/prisma/prisma/migrations/2_library/migration.sql` | CreateTable + enums |
| `packages/prisma/prisma/migrations/3_library_search_columns/migration.sql` | Add `embedding vector(1536)`, `search_vector tsvector`, trigger |

### apps/api

| Path | Purpose |
|---|---|
| `apps/api/src/config/env.ts` | Add `OPENAI_API_KEY` |
| `apps/api/src/config/env.spec.ts` | Cover the new var |
| `apps/api/src/common/openai/openai.module.ts` | Provides configured `OpenAI` client |
| `apps/api/src/common/openai/openai.service.ts` | Thin wrapper around `openai.embeddings.create` |
| `apps/api/src/common/openai/openai.service.spec.ts` | Unit tests with mocked SDK |
| `apps/api/src/library/library.module.ts` | Module |
| `apps/api/src/library/library.service.ts` | CRUD + semantic search |
| `apps/api/src/library/library.service.spec.ts` | Unit tests |
| `apps/api/src/library/library.controller.ts` | REST endpoints |
| `apps/api/src/library/library.controller.spec.ts` | Unit tests |
| `apps/api/src/library/url-import.service.ts` | URL scraping + metadata extraction |
| `apps/api/src/library/url-import.service.spec.ts` | Unit tests with mocked `fetch` |
| `apps/api/src/library/dto/library.dto.ts` | Zod schemas for request bodies |
| `apps/api/src/app.module.ts` | Import new modules |

### apps/web

| Path | Purpose |
|---|---|
| `apps/web/app/(app)/admin/library/page.tsx` | List + search + filters |
| `apps/web/app/(app)/admin/library/new/page.tsx` | URL import + manual form |
| `apps/web/app/(app)/admin/library/[id]/page.tsx` | Edit page |
| `apps/web/components/library/library-filters.tsx` | Filter sidebar |
| `apps/web/components/library/library-item-card.tsx` | Reusable card |
| `apps/web/components/nav/app-nav.tsx` | Add "Acervo" link for admin |

---

## Task 1: Prisma schema — LibraryItem

**Files:**
- Modify: `packages/prisma/prisma/schema.prisma`
- Create: `packages/prisma/prisma/migrations/2_library/migration.sql`

- [ ] **Step 1: Add enums + model to schema**

Append to `packages/prisma/prisma/schema.prisma` (after existing models):

```prisma
enum ItemFormat {
  VIDEO
  ARTICLE
  BOOK
  PROBLEM
  OTHER
}

enum ItemDifficulty {
  EASY
  MEDIUM
  HARD
}

model LibraryItem {
  id               String         @id @default(cuid())
  title            String
  url              String?
  description      String?
  format           ItemFormat
  difficulty       ItemDifficulty
  estimatedMinutes Int
  source           String?
  tags             String[]
  createdById      String
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  @@index([format])
  @@index([difficulty])
}
```

Note: `embedding` and `searchVector` are **not** declared here. Prisma's `Unsupported` type cannot be populated via the generated client, so we manage them via raw SQL in a separate migration (next task) and update them via `$queryRaw` in the service.

- [ ] **Step 2: Generate the Prisma migration for the model**

Create `packages/prisma/prisma/migrations/2_library/migration.sql`:

```sql
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
```

- [ ] **Step 3: Regenerate Prisma client**

Run: `pnpm --filter @ics-select/prisma exec prisma generate`
Expected: the client now exports `LibraryItem`, `ItemFormat`, `ItemDifficulty`.

- [ ] **Step 4: Apply migration**

Run:
```bash
docker compose up -d postgres
pnpm --filter @ics-select/prisma exec prisma migrate deploy
```
Expected: "1 migration applied" (migration 2).

- [ ] **Step 5: Commit**

```bash
git add packages/prisma/prisma/schema.prisma packages/prisma/prisma/migrations/2_library
git commit -m "feat(prisma): add LibraryItem model with ItemFormat/ItemDifficulty enums"
```

---

## Task 2: SQL migration — embedding + tsvector columns + trigger

**Files:**
- Create: `packages/prisma/prisma/migrations/3_library_search_columns/migration.sql`

- [ ] **Step 1: Create migration**

```sql
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
```

- [ ] **Step 2: Apply migration**

Run: `pnpm --filter @ics-select/prisma exec prisma migrate deploy`
Expected: "1 migration applied" (migration 3).

- [ ] **Step 3: Verify in psql**

Run:
```bash
docker exec ics-select-postgres psql -U ics -d ics_select -c "\d \"LibraryItem\""
```
Expected: columns include `embedding` and `search_vector`; indexes include `LibraryItem_embedding_idx` and `LibraryItem_search_vector_idx`.

- [ ] **Step 4: Commit**

```bash
git add packages/prisma/prisma/migrations/3_library_search_columns
git commit -m "feat(prisma): add LibraryItem embedding and tsvector columns"
```

---

## Task 3: Env config — OPENAI_API_KEY

**Files:**
- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/src/config/env.spec.ts`
- Modify: `apps/api/.env.example`

- [ ] **Step 1: Update the test first**

Add this block to the `baseEnv` constant in `apps/api/src/config/env.spec.ts`:

```ts
    OPENAI_API_KEY: 'sk-test-key',
```

And append this test case:

```ts
  it('throws when OPENAI_API_KEY is missing', () => {
    const { OPENAI_API_KEY: _key, ...incomplete } = baseEnv;
    expect(() => loadEnv(incomplete)).toThrow(/OPENAI_API_KEY/);
  });
```

- [ ] **Step 2: Run test to see it fail**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern env`
Expected: fails.

- [ ] **Step 3: Add the field to the Zod schema**

In `apps/api/src/config/env.ts`, add to `EnvSchema.object(...)`:

```ts
  OPENAI_API_KEY: z.string().min(1),
```

- [ ] **Step 4: Verify**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern env`
Expected: all env tests pass.

- [ ] **Step 5: Update `.env.example`**

Add to `apps/api/.env.example`:

```env
# OpenAI
OPENAI_API_KEY=sk-replace-me
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/config apps/api/.env.example
git commit -m "feat(api): require OPENAI_API_KEY env var"
```

---

## Task 4: OpenAI wrapper service (TDD)

**Files:**
- Create: `apps/api/src/common/openai/openai.service.ts`
- Create: `apps/api/src/common/openai/openai.service.spec.ts`
- Create: `apps/api/src/common/openai/openai.module.ts`
- Modify: `apps/api/package.json` (add `openai`)
- Modify: `apps/api/src/app.module.ts` (import `OpenAiModule`)

- [ ] **Step 1: Install the SDK**

Run: `pnpm --filter @ics-select/api add openai`

- [ ] **Step 2: Write failing tests**

Create `apps/api/src/common/openai/openai.service.spec.ts`:

```ts
import { OpenAiService } from './openai.service';

const createMock = jest.fn();

class FakeOpenAI {
  embeddings = { create: createMock };
}

describe('OpenAiService.embed', () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it('calls text-embedding-3-small with the input and returns the vector', async () => {
    createMock.mockResolvedValueOnce({
      data: [{ embedding: [0.1, 0.2, 0.3] }],
    });
    const svc = new OpenAiService(new FakeOpenAI() as any);
    const vec = await svc.embed('hello world');
    expect(createMock).toHaveBeenCalledWith({
      model: 'text-embedding-3-small',
      input: 'hello world',
    });
    expect(vec).toEqual([0.1, 0.2, 0.3]);
  });

  it('throws if the response is empty', async () => {
    createMock.mockResolvedValueOnce({ data: [] });
    const svc = new OpenAiService(new FakeOpenAI() as any);
    await expect(svc.embed('x')).rejects.toThrow(/no embedding/i);
  });
});
```

- [ ] **Step 3: Run test to see failure**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern openai.service`
Expected: fails.

- [ ] **Step 4: Implement service**

Create `apps/api/src/common/openai/openai.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

export const OPENAI_CLIENT = 'OPENAI_CLIENT';

@Injectable()
export class OpenAiService {
  constructor(private readonly client: OpenAI) {}

  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    const first = response.data[0];
    if (!first) throw new Error('OpenAI returned no embedding');
    return first.embedding;
  }
}
```

- [ ] **Step 5: Create module**

Create `apps/api/src/common/openai/openai.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { OpenAiService } from './openai.service.js';

@Global()
@Module({
  providers: [
    {
      provide: OpenAI,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new OpenAI({ apiKey: config.getOrThrow<string>('OPENAI_API_KEY') }),
    },
    OpenAiService,
  ],
  exports: [OpenAiService],
})
export class OpenAiModule {}
```

- [ ] **Step 6: Import module in `AppModule`**

Add `OpenAiModule` to the imports in `apps/api/src/app.module.ts`.

- [ ] **Step 7: Run tests and build**

Run: `pnpm --filter @ics-select/api test && pnpm --filter @ics-select/api build`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/common/openai apps/api/src/app.module.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(api): add OpenAI embeddings wrapper service"
```

---

## Task 5: URL import service (TDD)

**Files:**
- Create: `apps/api/src/library/url-import.service.ts`
- Create: `apps/api/src/library/url-import.service.spec.ts`
- Modify: `apps/api/package.json` (add `cheerio`)

- [ ] **Step 1: Install cheerio**

Run: `pnpm --filter @ics-select/api add cheerio`

- [ ] **Step 2: Write failing tests**

Create `apps/api/src/library/url-import.service.spec.ts`:

```ts
import { UrlImportService } from './url-import.service';

type MockFetch = (url: string) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;

function withFetch(html: string): UrlImportService {
  const mockFetch: MockFetch = async () => ({
    ok: true,
    status: 200,
    text: async () => html,
  });
  return new UrlImportService(mockFetch as unknown as typeof fetch);
}

describe('UrlImportService.extract', () => {
  it('extracts Open Graph metadata from a generic article', async () => {
    const svc = withFetch(`
      <html>
        <head>
          <meta property="og:title" content="Demystifying Hash Maps" />
          <meta property="og:description" content="A walkthrough of hash table internals." />
          <meta property="og:site_name" content="Example Tech Blog" />
        </head>
      </html>
    `);
    const result = await svc.extract('https://example.com/hashmaps');
    expect(result.title).toBe('Demystifying Hash Maps');
    expect(result.description).toBe('A walkthrough of hash table internals.');
    expect(result.source).toBe('Example Tech Blog');
    expect(result.format).toBe('ARTICLE');
  });

  it('falls back to <title> when og:title is missing', async () => {
    const svc = withFetch(`<html><head><title>Fallback Title</title></head></html>`);
    const result = await svc.extract('https://example.com/x');
    expect(result.title).toBe('Fallback Title');
    expect(result.format).toBe('ARTICLE');
  });

  it('detects YouTube URLs as VIDEO', async () => {
    const svc = withFetch(`<html><head><meta property="og:title" content="DP Tutorial" /></head></html>`);
    const result = await svc.extract('https://www.youtube.com/watch?v=abc');
    expect(result.format).toBe('VIDEO');
    expect(result.source).toBe('YouTube');
  });

  it('detects LeetCode URLs as PROBLEM', async () => {
    const svc = withFetch(`<html><head><title>Two Sum - LeetCode</title></head></html>`);
    const result = await svc.extract('https://leetcode.com/problems/two-sum/');
    expect(result.format).toBe('PROBLEM');
    expect(result.source).toBe('LeetCode');
  });

  it('returns default metadata when fetch fails', async () => {
    const mockFetch: MockFetch = async () => ({
      ok: false,
      status: 500,
      text: async () => '',
    });
    const svc = new UrlImportService(mockFetch as unknown as typeof fetch);
    const result = await svc.extract('https://example.com/broken');
    expect(result.title).toBe('example.com/broken');
    expect(result.format).toBe('OTHER');
  });
});
```

- [ ] **Step 3: Run test to see failure**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern url-import`
Expected: fails.

- [ ] **Step 4: Implement service**

Create `apps/api/src/library/url-import.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';

export type ImportedMetadata = {
  title: string;
  description: string | null;
  source: string | null;
  format: 'VIDEO' | 'ARTICLE' | 'BOOK' | 'PROBLEM' | 'OTHER';
  estimatedMinutes: number;
  url: string;
};

@Injectable()
export class UrlImportService {
  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async extract(url: string): Promise<ImportedMetadata> {
    const host = safeHost(url);
    const format = detectFormat(host, url);
    const source = detectSource(host);

    let html = '';
    try {
      const res = await this.fetcher(url);
      if (res.ok) html = await res.text();
    } catch {
      // ignore; fall through
    }

    if (!html) {
      return {
        title: url.replace(/^https?:\/\//, ''),
        description: null,
        source,
        format,
        estimatedMinutes: defaultMinutesFor(format),
        url,
      };
    }

    const $ = cheerio.load(html);
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogDescription = $('meta[property="og:description"]').attr('content');
    const ogSiteName = $('meta[property="og:site_name"]').attr('content');
    const docTitle = $('title').first().text();

    return {
      title: (ogTitle || docTitle || url).trim(),
      description: ogDescription?.trim() ?? null,
      source: source ?? ogSiteName?.trim() ?? null,
      format,
      estimatedMinutes: defaultMinutesFor(format),
      url,
    };
  }
}

function safeHost(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function detectFormat(host: string, url: string): ImportedMetadata['format'] {
  if (host.includes('youtube.com') || host.includes('youtu.be') || host.includes('vimeo.com')) {
    return 'VIDEO';
  }
  if (host.includes('leetcode.com') || url.match(/\/problems?\//)) {
    return 'PROBLEM';
  }
  if (host.includes('medium.com') || host.includes('dev.to') || host.endsWith('.blog')) {
    return 'ARTICLE';
  }
  if (host.includes('amazon.com') || host.includes('oreilly.com')) {
    return 'BOOK';
  }
  if (host) return 'ARTICLE';
  return 'OTHER';
}

function detectSource(host: string): string | null {
  if (host.includes('youtube.com') || host.includes('youtu.be')) return 'YouTube';
  if (host.includes('leetcode.com')) return 'LeetCode';
  if (host.includes('medium.com')) return 'Medium';
  if (host.includes('dev.to')) return 'DEV';
  if (host.includes('neetcode.io')) return 'NeetCode';
  return null;
}

function defaultMinutesFor(format: ImportedMetadata['format']): number {
  switch (format) {
    case 'VIDEO':
      return 15;
    case 'ARTICLE':
      return 10;
    case 'PROBLEM':
      return 30;
    case 'BOOK':
      return 240;
    case 'OTHER':
      return 20;
  }
}
```

- [ ] **Step 5: Run tests to verify**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern url-import`
Expected: 5 passing tests.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/library/url-import.service.ts apps/api/src/library/url-import.service.spec.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(api): add URL import service with heuristic metadata extraction"
```

---

## Task 6: LibraryService (CRUD + search)

**Files:**
- Create: `apps/api/src/library/library.service.ts`
- Create: `apps/api/src/library/library.service.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/library/library.service.spec.ts`:

```ts
import { LibraryService } from './library.service';

type Item = {
  id: string;
  title: string;
  url: string | null;
  description: string | null;
  format: 'VIDEO' | 'ARTICLE' | 'BOOK' | 'PROBLEM' | 'OTHER';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  estimatedMinutes: number;
  source: string | null;
  tags: string[];
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

function fakePrisma() {
  const items = new Map<string, Item>();
  const raw: Array<{ embeddingRaw: number[]; id: string }> = [];
  return {
    items,
    raw,
    libraryItem: {
      create: jest.fn(async ({ data }: { data: Omit<Item, 'id' | 'createdAt' | 'updatedAt'> }) => {
        const id = `li-${items.size + 1}`;
        const rec: Item = {
          id,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        items.set(id, rec);
        return rec;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<Item> }) => {
        const cur = items.get(where.id)!;
        const next = { ...cur, ...data, updatedAt: new Date() };
        items.set(where.id, next);
        return next;
      }),
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => items.get(where.id) ?? null),
      findMany: jest.fn(async () => Array.from(items.values())),
      delete: jest.fn(async ({ where }: { where: { id: string } }) => {
        const rec = items.get(where.id);
        items.delete(where.id);
        return rec;
      }),
    },
    $executeRawUnsafe: jest.fn(async (_sql: string, ...values: unknown[]) => {
      const [id, vectorLiteral] = values as [string, string];
      const nums = vectorLiteral.replace(/[\[\]]/g, '').split(',').map(Number);
      raw.push({ id, embeddingRaw: nums });
      return 1;
    }),
    $queryRawUnsafe: jest.fn(async (_sql: string, ..._values: unknown[]) => {
      return Array.from(items.values()).map((it) => ({ ...it, score: 0.5 }));
    }),
  };
}

const openai = {
  embed: jest.fn(async (_text: string) => [0.1, 0.2, 0.3]),
};

describe('LibraryService', () => {
  beforeEach(() => {
    openai.embed.mockClear();
  });

  it('create stores the item, computes embedding, and writes it via raw SQL', async () => {
    const prisma = fakePrisma();
    const svc = new LibraryService(prisma as any, openai as any);
    const created = await svc.create({
      title: 'DP Intro',
      description: 'Intro to dynamic programming',
      url: 'https://x.com/dp',
      format: 'VIDEO',
      difficulty: 'EASY',
      estimatedMinutes: 20,
      source: 'YouTube',
      tags: ['dp'],
      createdById: 'u-1',
    });
    expect(created.id).toBe('li-1');
    expect(openai.embed).toHaveBeenCalledWith(expect.stringContaining('DP Intro'));
    expect(prisma.raw).toHaveLength(1);
    expect(prisma.raw[0]?.id).toBe('li-1');
    expect(prisma.raw[0]?.embeddingRaw).toEqual([0.1, 0.2, 0.3]);
  });

  it('update re-embeds when content-affecting fields change', async () => {
    const prisma = fakePrisma();
    const svc = new LibraryService(prisma as any, openai as any);
    const created = await svc.create({
      title: 'Old',
      description: null,
      url: null,
      format: 'ARTICLE',
      difficulty: 'EASY',
      estimatedMinutes: 10,
      source: null,
      tags: [],
      createdById: 'u-1',
    });
    openai.embed.mockClear();
    await svc.update(created.id, { title: 'New title' });
    expect(openai.embed).toHaveBeenCalled();
  });

  it('search returns results via raw query', async () => {
    const prisma = fakePrisma();
    const svc = new LibraryService(prisma as any, openai as any);
    await svc.create({
      title: 'Arrays 101',
      description: null,
      url: null,
      format: 'ARTICLE',
      difficulty: 'EASY',
      estimatedMinutes: 10,
      source: null,
      tags: ['arrays'],
      createdById: 'u-1',
    });
    const results = await svc.search({ query: 'arrays' });
    expect(results.length).toBeGreaterThan(0);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
  });

  it('list returns items sorted newest first', async () => {
    const prisma = fakePrisma();
    const svc = new LibraryService(prisma as any, openai as any);
    await svc.create({
      title: 'A',
      description: null,
      url: null,
      format: 'ARTICLE',
      difficulty: 'EASY',
      estimatedMinutes: 10,
      source: null,
      tags: [],
      createdById: 'u-1',
    });
    await svc.create({
      title: 'B',
      description: null,
      url: null,
      format: 'ARTICLE',
      difficulty: 'EASY',
      estimatedMinutes: 10,
      source: null,
      tags: [],
      createdById: 'u-1',
    });
    const items = await svc.list();
    expect(items).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run test to see failure**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern library.service`
Expected: fails.

- [ ] **Step 3: Implement service**

Create `apps/api/src/library/library.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { OpenAiService } from '../common/openai/openai.service.js';

export type CreateLibraryItemInput = {
  title: string;
  url: string | null;
  description: string | null;
  format: 'VIDEO' | 'ARTICLE' | 'BOOK' | 'PROBLEM' | 'OTHER';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  estimatedMinutes: number;
  source: string | null;
  tags: string[];
  createdById: string;
};

export type UpdateLibraryItemInput = Partial<CreateLibraryItemInput>;

export type SearchInput = {
  query?: string;
  format?: ('VIDEO' | 'ARTICLE' | 'BOOK' | 'PROBLEM' | 'OTHER')[];
  difficulty?: ('EASY' | 'MEDIUM' | 'HARD')[];
  tags?: string[];
  maxMinutes?: number;
  limit?: number;
};

const CONTENT_AFFECTING_FIELDS: Array<keyof CreateLibraryItemInput> = [
  'title',
  'description',
  'tags',
];

@Injectable()
export class LibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly openai: OpenAiService,
  ) {}

  async create(input: CreateLibraryItemInput) {
    const item = await this.prisma.libraryItem.create({
      data: {
        title: input.title,
        url: input.url,
        description: input.description,
        format: input.format,
        difficulty: input.difficulty,
        estimatedMinutes: input.estimatedMinutes,
        source: input.source,
        tags: input.tags,
        createdById: input.createdById,
      },
    });
    await this.writeEmbedding(item.id, input.title, input.description, input.tags);
    return item;
  }

  async update(id: string, input: UpdateLibraryItemInput) {
    const existing = await this.prisma.libraryItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('library item not found');
    const merged = { ...existing, ...input };
    const updated = await this.prisma.libraryItem.update({
      where: { id },
      data: input,
    });
    const contentChanged = CONTENT_AFFECTING_FIELDS.some((f) => f in input);
    if (contentChanged) {
      await this.writeEmbedding(id, merged.title, merged.description, merged.tags);
    }
    return updated;
  }

  list() {
    return this.prisma.libraryItem.findMany({ orderBy: { createdAt: 'desc' } });
  }

  getById(id: string) {
    return this.prisma.libraryItem.findUnique({ where: { id } });
  }

  async delete(id: string) {
    return this.prisma.libraryItem.delete({ where: { id } });
  }

  async search(input: SearchInput) {
    const limit = input.limit ?? 20;
    const hasQuery = !!input.query && input.query.trim().length > 0;

    if (!hasQuery) {
      // Fallback to filtered list
      const items = await this.prisma.libraryItem.findMany({
        where: {
          ...(input.format ? { format: { in: input.format } } : {}),
          ...(input.difficulty ? { difficulty: { in: input.difficulty } } : {}),
          ...(input.maxMinutes ? { estimatedMinutes: { lte: input.maxMinutes } } : {}),
          ...(input.tags && input.tags.length > 0 ? { tags: { hasSome: input.tags } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return items.map((i) => ({ ...i, score: null }));
    }

    const embedding = await this.openai.embed(input.query!);
    const vectorLiteral = `[${embedding.join(',')}]`;

    // Raw hybrid query. Prisma's $queryRawUnsafe lets us parametrize with positional $1/$2.
    const sql = `
      SELECT
        "id", "title", "url", "description", "format", "difficulty",
        "estimatedMinutes", "source", "tags", "createdAt", "updatedAt",
        (1 - (embedding <=> $1::vector)) * 0.6
          + COALESCE(ts_rank(search_vector, plainto_tsquery('portuguese', $2)), 0) * 0.4
          AS score
      FROM "LibraryItem"
      WHERE
        ($3::"ItemFormat"[] IS NULL OR "format" = ANY($3::"ItemFormat"[]))
        AND ($4::"ItemDifficulty"[] IS NULL OR "difficulty" = ANY($4::"ItemDifficulty"[]))
        AND ($5::int IS NULL OR "estimatedMinutes" <= $5)
        AND ($6::text[] IS NULL OR "tags" && $6::text[])
      ORDER BY score DESC
      LIMIT $7
    `;

    const results = (await this.prisma.$queryRawUnsafe(
      sql,
      vectorLiteral,
      input.query,
      input.format ?? null,
      input.difficulty ?? null,
      input.maxMinutes ?? null,
      input.tags ?? null,
      limit,
    )) as unknown[];
    return results;
  }

  private async writeEmbedding(
    id: string,
    title: string,
    description: string | null,
    tags: string[],
  ): Promise<void> {
    const text = [title, description ?? '', tags.join(' ')].join('\n').trim();
    const vector = await this.openai.embed(text);
    const vectorLiteral = `[${vector.join(',')}]`;
    await this.prisma.$executeRawUnsafe(
      `UPDATE "LibraryItem" SET "embedding" = $2::vector WHERE "id" = $1`,
      id,
      vectorLiteral,
    );
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern library.service`
Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/library/library.service.ts apps/api/src/library/library.service.spec.ts
git commit -m "feat(api): add LibraryService with hybrid pgvector+tsvector search"
```

---

## Task 7: Library DTOs, controller, module

**Files:**
- Create: `apps/api/src/library/dto/library.dto.ts`
- Create: `apps/api/src/library/library.controller.ts`
- Create: `apps/api/src/library/library.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: DTOs**

Create `apps/api/src/library/dto/library.dto.ts`:

```ts
import { z } from 'zod';

export const ItemFormatSchema = z.enum(['VIDEO', 'ARTICLE', 'BOOK', 'PROBLEM', 'OTHER']);
export const ItemDifficultySchema = z.enum(['EASY', 'MEDIUM', 'HARD']);

export const CreateLibraryItemSchema = z.object({
  title: z.string().min(1),
  url: z.string().url().nullable(),
  description: z.string().nullable(),
  format: ItemFormatSchema,
  difficulty: ItemDifficultySchema,
  estimatedMinutes: z.number().int().positive(),
  source: z.string().nullable(),
  tags: z.array(z.string()).default([]),
});

export const UpdateLibraryItemSchema = CreateLibraryItemSchema.partial();

export const SearchLibrarySchema = z.object({
  query: z.string().optional(),
  format: z.array(ItemFormatSchema).optional(),
  difficulty: z.array(ItemDifficultySchema).optional(),
  tags: z.array(z.string()).optional(),
  maxMinutes: z.number().int().positive().optional(),
  limit: z.number().int().positive().max(100).optional(),
});

export const ImportUrlSchema = z.object({
  url: z.string().url(),
});
```

- [ ] **Step 2: Controller**

Create `apps/api/src/library/library.controller.ts`:

```ts
import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../auth/strategies/jwt.strategy.js';
import { LibraryService } from './library.service.js';
import { UrlImportService } from './url-import.service.js';
import {
  CreateLibraryItemSchema,
  UpdateLibraryItemSchema,
  SearchLibrarySchema,
  ImportUrlSchema,
} from './dto/library.dto.js';

@Roles('ADMIN')
@Controller('library')
export class LibraryController {
  constructor(
    private readonly library: LibraryService,
    private readonly urlImport: UrlImportService,
  ) {}

  @Get()
  list() {
    return this.library.list();
  }

  @Post('search')
  async search(@Body() body: unknown) {
    const parsed = SearchLibrarySchema.parse(body);
    const data = await this.library.search(parsed);
    return { data, total: Array.isArray(data) ? data.length : 0 };
  }

  @Post()
  create(@Body() body: unknown, @CurrentUser() user: JwtStrategyPayload) {
    const parsed = CreateLibraryItemSchema.parse(body);
    return this.library.create({ ...parsed, createdById: user.sub });
  }

  @Post('import')
  async import(@Body() body: unknown) {
    const parsed = ImportUrlSchema.parse(body);
    return this.urlImport.extract(parsed.url);
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const item = await this.library.getById(id);
    if (!item) throw new NotFoundException('library item not found');
    return item;
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateLibraryItemSchema.parse(body);
    return this.library.update(id, parsed);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.library.delete(id);
  }
}
```

- [ ] **Step 3: Module**

Create `apps/api/src/library/library.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { LibraryController } from './library.controller.js';
import { LibraryService } from './library.service.js';
import { UrlImportService } from './url-import.service.js';

@Module({
  controllers: [LibraryController],
  providers: [LibraryService, UrlImportService],
  exports: [LibraryService],
})
export class LibraryModule {}
```

- [ ] **Step 4: Wire into `AppModule`**

Add `LibraryModule` to imports.

- [ ] **Step 5: Run tests and build**

Run: `pnpm --filter @ics-select/api test && pnpm --filter @ics-select/api test:e2e && pnpm --filter @ics-select/api build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/library apps/api/src/app.module.ts
git commit -m "feat(api): add library controller and module"
```

---

## Task 8: Frontend — admin library list + search page

**Files:**
- Create: `apps/web/app/(app)/admin/library/page.tsx`
- Create: `apps/web/components/library/library-item-card.tsx`
- Modify: `apps/web/components/nav/app-nav.tsx`

- [ ] **Step 1: Add "Acervo" link to nav**

Modify `apps/web/components/nav/app-nav.tsx` — in the admin conditional, add a link to `/admin/library`:

```tsx
            <Link href="/admin/library" className="text-foreground/80 hover:text-foreground">
              Acervo
            </Link>
```

Place it between "Membros" and the avatar.

- [ ] **Step 2: Create `library-item-card.tsx`**

```tsx
import { Card, CardBody, Chip } from '@heroui/react';
import Link from 'next/link';

export type LibraryItemCardProps = {
  id: string;
  title: string;
  url: string | null;
  format: 'VIDEO' | 'ARTICLE' | 'BOOK' | 'PROBLEM' | 'OTHER';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  estimatedMinutes: number;
  tags: string[];
  source: string | null;
};

export function LibraryItemCard(props: LibraryItemCardProps) {
  return (
    <Card as={Link} href={`/admin/library/${props.id}`} isPressable className="w-full">
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold">{props.title}</h3>
          <Chip size="sm" variant="flat">{props.format}</Chip>
        </div>
        <div className="flex items-center gap-2 text-xs text-foreground/60">
          {props.source && <span>{props.source}</span>}
          <span>•</span>
          <span>{props.estimatedMinutes} min</span>
          <span>•</span>
          <span>{props.difficulty}</span>
        </div>
        {props.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {props.tags.map((t) => (
              <Chip key={t} size="sm" variant="flat" color="default">
                {t}
              </Chip>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
```

- [ ] **Step 3: Create library list/search page**

```tsx
'use client';

import { Button, Card, CardBody, Input, Select, SelectItem } from '@heroui/react';
import { Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiFetch } from '../../../../lib/api/client';
import { LibraryItemCard, type LibraryItemCardProps } from '../../../../components/library/library-item-card';

const FORMAT_OPTIONS = [
  { key: 'VIDEO', label: 'Vídeo' },
  { key: 'ARTICLE', label: 'Artigo' },
  { key: 'BOOK', label: 'Livro' },
  { key: 'PROBLEM', label: 'Problema' },
  { key: 'OTHER', label: 'Outro' },
];

const DIFFICULTY_OPTIONS = [
  { key: 'EASY', label: 'Fácil' },
  { key: 'MEDIUM', label: 'Médio' },
  { key: 'HARD', label: 'Difícil' },
];

type Item = LibraryItemCardProps & { description: string | null };

export default function AdminLibraryPage() {
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<string[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: ['library', query, format, difficulty],
    queryFn: async () => {
      if (!query && format.length === 0 && difficulty.length === 0) {
        return apiFetch<Item[]>('/library');
      }
      const body = {
        query: query || undefined,
        format: format.length > 0 ? format : undefined,
        difficulty: difficulty.length > 0 ? difficulty : undefined,
      };
      const res = await apiFetch<{ data: Item[] }>('/library/search', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      return res.data;
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Acervo</h1>
        <Button as={Link} href="/admin/library/new" color="primary" startContent={<Plus className="h-4 w-4" />}>
          Novo item
        </Button>
      </div>

      <Card>
        <CardBody className="space-y-3">
          <Input
            placeholder="Buscar (semântica + full-text)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            startContent={<Search className="h-4 w-4 text-foreground/50" />}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              selectionMode="multiple"
              label="Formato"
              selectedKeys={format}
              onSelectionChange={(keys) => setFormat(Array.from(keys as Set<string>))}
            >
              {FORMAT_OPTIONS.map((o) => (
                <SelectItem key={o.key}>{o.label}</SelectItem>
              ))}
            </Select>
            <Select
              selectionMode="multiple"
              label="Dificuldade"
              selectedKeys={difficulty}
              onSelectionChange={(keys) => setDifficulty(Array.from(keys as Set<string>))}
            >
              {DIFFICULTY_OPTIONS.map((o) => (
                <SelectItem key={o.key}>{o.label}</SelectItem>
              ))}
            </Select>
          </div>
        </CardBody>
      </Card>

      {isLoading ? (
        <p className="text-foreground/60">Carregando...</p>
      ) : (data ?? []).length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-foreground/60">Nenhum item. Clique em "Novo item" para começar.</p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(data ?? []).map((item) => (
            <LibraryItemCard key={item.id} {...item} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Build check**

Run: `pnpm --filter @ics-select/web build`
Expected: compiles.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(app\)/admin/library/page.tsx apps/web/components/library apps/web/components/nav/app-nav.tsx
git commit -m "feat(web): add admin library list and search page"
```

---

## Task 9: Frontend — new library item page

**Files:**
- Create: `apps/web/app/(app)/admin/library/new/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
'use client';

import { Button, Card, CardBody, CardHeader, Input, Select, SelectItem, Textarea } from '@heroui/react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch } from '../../../../../lib/api/client';

type ImportedMetadata = {
  title: string;
  description: string | null;
  source: string | null;
  format: 'VIDEO' | 'ARTICLE' | 'BOOK' | 'PROBLEM' | 'OTHER';
  estimatedMinutes: number;
  url: string;
};

export default function NewLibraryItemPage() {
  const router = useRouter();
  const [urlInput, setUrlInput] = useState('');
  const [draft, setDraft] = useState<Partial<ImportedMetadata & { difficulty: string; tags: string }>>({
    difficulty: 'MEDIUM',
    tags: '',
  });

  const importMutation = useMutation({
    mutationFn: (url: string) =>
      apiFetch<ImportedMetadata>('/library/import', { method: 'POST', body: JSON.stringify({ url }) }),
    onSuccess: (data) => setDraft((d) => ({ ...d, ...data })),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ id: string }>('/library', {
        method: 'POST',
        body: JSON.stringify({
          title: draft.title ?? '',
          url: draft.url ?? null,
          description: draft.description ?? null,
          format: draft.format ?? 'ARTICLE',
          difficulty: draft.difficulty ?? 'MEDIUM',
          estimatedMinutes: draft.estimatedMinutes ?? 10,
          source: draft.source ?? null,
          tags: (draft.tags ?? '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      }),
    onSuccess: () => router.push('/admin/library'),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold">Novo item do acervo</h1>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Importar por URL</h2>
        </CardHeader>
        <CardBody className="space-y-2">
          <Input
            placeholder="https://..."
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
          />
          <Button
            color="primary"
            variant="flat"
            isLoading={importMutation.isPending}
            onPress={() => importMutation.mutate(urlInput)}
          >
            Extrair metadados
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold">Dados do item</h2>
        </CardHeader>
        <CardBody className="space-y-3">
          <Input
            label="Título"
            value={draft.title ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
          <Input
            label="URL"
            value={draft.url ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
          />
          <Textarea
            label="Descrição"
            value={draft.description ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Formato"
              selectedKeys={draft.format ? [draft.format] : []}
              onSelectionChange={(keys) => {
                const val = Array.from(keys as Set<string>)[0] as ImportedMetadata['format'];
                setDraft((d) => ({ ...d, format: val }));
              }}
            >
              <SelectItem key="VIDEO">Vídeo</SelectItem>
              <SelectItem key="ARTICLE">Artigo</SelectItem>
              <SelectItem key="BOOK">Livro</SelectItem>
              <SelectItem key="PROBLEM">Problema</SelectItem>
              <SelectItem key="OTHER">Outro</SelectItem>
            </Select>
            <Select
              label="Dificuldade"
              selectedKeys={draft.difficulty ? [draft.difficulty] : []}
              onSelectionChange={(keys) => {
                const val = Array.from(keys as Set<string>)[0] as string;
                setDraft((d) => ({ ...d, difficulty: val }));
              }}
            >
              <SelectItem key="EASY">Fácil</SelectItem>
              <SelectItem key="MEDIUM">Médio</SelectItem>
              <SelectItem key="HARD">Difícil</SelectItem>
            </Select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              type="number"
              label="Estimativa (min)"
              value={String(draft.estimatedMinutes ?? 10)}
              onChange={(e) => setDraft((d) => ({ ...d, estimatedMinutes: Number(e.target.value) }))}
            />
            <Input
              label="Fonte"
              value={draft.source ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, source: e.target.value }))}
            />
          </div>
          <Input
            label="Tags (separadas por vírgula)"
            value={draft.tags ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
          />
          <Button
            color="primary"
            isLoading={createMutation.isPending}
            onPress={() => createMutation.mutate()}
          >
            Criar
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Build check**

Run: `pnpm --filter @ics-select/web build`
Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(app\)/admin/library/new
git commit -m "feat(web): add new library item page with URL import"
```

---

## Task 10: Frontend — edit page (minimal)

**Files:**
- Create: `apps/web/app/(app)/admin/library/[id]/page.tsx`

- [ ] **Step 1: Create**

```tsx
'use client';

import { Button, Card, CardBody, CardHeader, Input, Select, SelectItem, Textarea } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { use, useEffect, useState } from 'react';
import { apiFetch } from '../../../../../lib/api/client';

type Item = {
  id: string;
  title: string;
  url: string | null;
  description: string | null;
  format: 'VIDEO' | 'ARTICLE' | 'BOOK' | 'PROBLEM' | 'OTHER';
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  estimatedMinutes: number;
  source: string | null;
  tags: string[];
};

export default function EditLibraryItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Partial<Item & { tagsInput: string }>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['library', id],
    queryFn: () => apiFetch<Item>(`/library/${id}`),
  });

  useEffect(() => {
    if (data) {
      setDraft({ ...data, tagsInput: data.tags.join(', ') });
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: () =>
      apiFetch<Item>(`/library/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: draft.title,
          url: draft.url,
          description: draft.description,
          format: draft.format,
          difficulty: draft.difficulty,
          estimatedMinutes: draft.estimatedMinutes,
          source: draft.source,
          tags: (draft.tagsInput ?? '')
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      router.push('/admin/library');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiFetch(`/library/${id}`, { method: 'DELETE' }),
    onSuccess: () => router.push('/admin/library'),
  });

  if (isLoading || !draft.id) return <p className="text-foreground/60">Carregando...</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-semibold">Editar item</h1>
        </CardHeader>
        <CardBody className="space-y-3">
          <Input
            label="Título"
            value={draft.title ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
          <Input
            label="URL"
            value={draft.url ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
          />
          <Textarea
            label="Descrição"
            value={draft.description ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Formato"
              selectedKeys={draft.format ? [draft.format] : []}
              onSelectionChange={(keys) => {
                const val = Array.from(keys as Set<string>)[0] as Item['format'];
                setDraft((d) => ({ ...d, format: val }));
              }}
            >
              <SelectItem key="VIDEO">Vídeo</SelectItem>
              <SelectItem key="ARTICLE">Artigo</SelectItem>
              <SelectItem key="BOOK">Livro</SelectItem>
              <SelectItem key="PROBLEM">Problema</SelectItem>
              <SelectItem key="OTHER">Outro</SelectItem>
            </Select>
            <Select
              label="Dificuldade"
              selectedKeys={draft.difficulty ? [draft.difficulty] : []}
              onSelectionChange={(keys) => {
                const val = Array.from(keys as Set<string>)[0] as Item['difficulty'];
                setDraft((d) => ({ ...d, difficulty: val }));
              }}
            >
              <SelectItem key="EASY">Fácil</SelectItem>
              <SelectItem key="MEDIUM">Médio</SelectItem>
              <SelectItem key="HARD">Difícil</SelectItem>
            </Select>
          </div>
          <Input
            type="number"
            label="Estimativa (min)"
            value={String(draft.estimatedMinutes ?? 10)}
            onChange={(e) => setDraft((d) => ({ ...d, estimatedMinutes: Number(e.target.value) }))}
          />
          <Input
            label="Tags (separadas por vírgula)"
            value={draft.tagsInput ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, tagsInput: e.target.value }))}
          />
          <div className="flex gap-2">
            <Button color="primary" isLoading={updateMutation.isPending} onPress={() => updateMutation.mutate()}>
              Salvar
            </Button>
            <Button color="danger" variant="flat" isLoading={deleteMutation.isPending} onPress={() => deleteMutation.mutate()}>
              Excluir
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Build check**

Run: `pnpm --filter @ics-select/web build`
Expected: compiles.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(app\)/admin/library/\[id\]
git commit -m "feat(web): add library item edit page"
```

---

## Task 11: Final verification

- [ ] **Step 1: Full build + tests**

Run:
```bash
pnpm install
pnpm --filter @ics-select/shared build
pnpm --filter @ics-select/prisma exec prisma generate
pnpm lint
pnpm typecheck
pnpm test
pnpm --filter @ics-select/api test:e2e
pnpm build
```
Expected: everything passes.

- [ ] **Step 2: Git log**

Run: `git log --oneline main..HEAD`
Expected: 10+ commits for Tasks 1-10.

- [ ] **Step 3: Clean status**

`git status` should be clean except the 3 root PDFs.

Phase 2 complete. Next: Phase 3 — disponibilidade + Google Calendar.

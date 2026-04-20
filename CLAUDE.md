# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**ICS Select** is a private platform for the Inteli Consulting Society's selective program. It prepares students for technical interviews across the full spectrum of tech careers, not just Big Tech. The canonical scope is the `Track` enum on `User`: `BIG_TECH | CONSULTING_TECH | COMPETITIVE_PROGRAMMING | STARTUP | OTHER` — a member who is grinding ICPC and a member who wants Stripe are both in-scope. **Never reduce the program's framing to "Big Techs only" in copy, metadata, OG tags, or member-facing UI.** The landing uses "tech de elite" as the umbrella chip-word; the bigtechs section lists representative companies (Apple/Google/Meta/Netflix/LinkedIn + Discord/Stripe/xAI/Anthropic/OpenAI) but explicitly labels them as "alvos", not the whole scope.

The admin (`Diretor Educacional`) builds personalized weekly study plans from a searchable library of materials; selected members (≤12 per cycle) follow the plans, auto-schedule study sessions against their Google Calendar, mark items with one of five outcomes (`Nailed it` / `Got it (hard)` / `Had doubts` / `Stuck` / `Not yet`), and the admin sees cohort progress + AI-assisted insights.

Full product spec lives at `docs/superpowers/specs/2026-04-11-ics-select-design.md`. Per-phase implementation plans live in `docs/superpowers/plans/`.

## Stack

Monorepo (pnpm 9 + Turborepo 2), Node 20:

- `apps/api` — **NestJS 10** + **Prisma 5** + **PostgreSQL 16 + pgvector**. Google OAuth via passport, short-lived JWT + rotating refresh tokens in cookies, AES-256-GCM-encrypted Google tokens. Modules live under `src/<feature>/` (auth, users, cycles, library, availability, weekly-plans, scheduler, classes, admin-dashboard, ai, whatsapp, notifications, google-calendar, me, reports, privacy, health).
- `apps/web` — **Next.js 15 App Router** + **HeroUI** + **Tailwind 3** + **Framer Motion** + **next-themes** + **TanStack Query** + **lucide-react**. Route group `(app)` holds the admin shell; route group `(member)` holds the gamified member experience; unauthenticated routes are `/login`, `/privacy`, `/auth/callback`.
- `packages/prisma` — `schema.prisma` (nine numbered migrations, pgvector + tsvector managed via raw SQL), re-exports the generated client. The runtime image points `main` at `generated/client/index.js` directly — no TS wrapper.
- `packages/shared` — Compiled with tsc to `dist/` as CommonJS (required because `apps/api` resolves it at runtime, not via ts-jest). Holds `APP_VERSION` and (future) Zod contract schemas.

AI features use **OpenAI `gpt-5.4-mini`** via `apps/api/src/common/openai/openai-chat.provider.ts` (`callJson`, `callText`, async-generator `stream`). Embeddings use the same client with `text-embedding-3-small`. There is no Anthropic dependency.

## Commands

```bash
pnpm install                                  # bootstraps all workspaces
pnpm dev                                      # turbo: runs api + web in watch mode
pnpm build                                    # turbo: shared → prisma generate → api + web
pnpm lint                                     # turbo lint (api has eslint flat config; web is currently a placeholder)
pnpm typecheck                                # turbo typecheck
pnpm test                                     # turbo: vitest (shared) + jest (api) + playwright (web)
pnpm db:generate                              # regen Prisma client
pnpm db:migrate                               # prisma migrate dev (local; needs DATABASE_URL)
pnpm db:deploy                                # prisma migrate deploy (prod; used in Dockerfile entrypoint)
```

### Per-package commands

```bash
pnpm --filter @ics-select/api test            # jest unit
pnpm --filter @ics-select/api test:e2e        # jest e2e (test/*.e2e-spec.ts; uses real AppModule with mocked Prisma connect)
pnpm --filter @ics-select/api dev             # nest start --watch
pnpm --filter @ics-select/api build           # nest build → dist/src/main.js (note: rootDir is "./", so output is under dist/src/)
pnpm --filter @ics-select/web dev             # next dev on :3000
pnpm --filter @ics-select/web test            # playwright (starts next dev automatically via webServer)
pnpm --filter @ics-select/web test:update     # regenerate snapshot baselines
pnpm --filter @ics-select/shared build        # tsc → packages/shared/dist (REQUIRED before running compiled api — not for tests)
pnpm --filter @ics-select/prisma exec prisma migrate deploy   # apply migrations
```

### Running a single test

```bash
pnpm --filter @ics-select/api test -- --testPathPattern library.service
pnpm --filter @ics-select/web test tests/auth-flow.spec.ts
```

### Docker (api)

```bash
docker build -t ics-select-api .              # multi-stage: deps → build (pnpm deploy --prod /out) → runtime (alpine + prisma CLI global)
```

The runtime stage runs `apps/api/docker-entrypoint.sh`, which calls `prisma migrate deploy --schema=/app/node_modules/@ics-select/prisma/prisma/schema.prisma` before `exec "$@"` (default CMD: `node dist/src/main.js`). Any new migration ships itself on the next container start.

### Local Postgres (pgvector)

```bash
cp .env.example .env                          # POSTGRES_* for the compose file
docker compose up -d postgres                 # pgvector/pgvector:pg16 on :5432
```

## Architecture notes that matter

### HeroUI + pnpm content path

pnpm stores packages under `node_modules/.pnpm/` with symlinks — they do **not** live at the conventional `node_modules/@heroui/theme/` path. The Tailwind `content` array in `apps/web/tailwind.config.ts` must use the real pnpm path:

```
'../../node_modules/.pnpm/@heroui+theme@*/node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}'
```

If this path is wrong, HeroUI component styles (Modal backdrop, centering, shadows, `rounded-large`, `bg-content1`, etc.) silently fail — components render without any visual styling. This caused a production modal bug that was invisible in unit tests because Playwright tests don't check visual styles. **Always verify HeroUI components visually after changes to the Tailwind config or pnpm version.**

The `<html>` element must also have `className="light"` and `data-theme="light"` for the HeroUI theme to apply to portal-rendered components like Modal (which render outside the React tree at `document.body`).

### Shared package build discipline

`packages/shared/package.json` declares `"main": "./dist/index.js"` with `"files": ["dist"]` and builds via `tsc -p tsconfig.build.json` to CommonJS. When running the compiled API (`node dist/src/main.js` or the Docker image), `dist/` **must exist** — otherwise Node throws `ERR_MODULE_NOT_FOUND`. Jest in `apps/api` bypasses this via `moduleNameMapper` that resolves `@ics-select/shared` straight to `packages/shared/src/index.ts`, so unit tests don't need a pre-build.

### Prisma & pgvector

Prisma can't describe `vector(1536)` or `tsvector` natively, so migrations `0_init` (extension), `3_library_search_columns` / `e_library_search_v2` / `h_library_search_english` (embedding column + tsvector + trigger + ivfflat index) go through `$queryRawUnsafe` / `$executeRawUnsafe` in `apps/api/src/library/library.service.ts`. The `search` method uses **lexical** tsvector (`english` stemming, weighted title/description/tags/source + simple-tokenized URL) plus a service-side topic-label match; vector embeddings are written on create/update via `OpenAiService.embed` but are **not** consumed by any `SELECT` today — the column is maintained for a future semantic-search feature. The `tsvector` is maintained by a Postgres trigger, not from app code.

### Library (acervo) curation & topic M2M

The library is populated via **`apps/api/scripts/seed-library.ts`** (entry `pnpm --filter @ics-select/api seed:library`). The seed is idempotent — topics upsert by `slug`, items upsert by `(title, url)`, and each item's `LibraryItemTopic` join rows are rewritten atomically per run. Embeddings are generated when `OPENAI_API_KEY` is set.

**Item ↔ Topic is many-to-many.** `LibraryItem` has no `topicId` FK; instead, `LibraryItemTopic (itemId, topicId, isPrimary)` joins them (migration `g_library_item_topics_m2m`). Exactly one row per item has `isPrimary = true` (the "home" topic for admin navigation); additional rows mark secondary covers. `LibraryService.shapeItem` derives `{ topicId, topic, topics }` on reads so the admin UI keeps consuming a single primary topic.

**Cross-topic items count toward every topic they cover.** `HomeService.computeTopicCoverage`, `MemberDetailService.computeTopicCoverage`, `PlanContextService.computeTopicCoverage`, and the AI's `DraftPlanService` prompt all iterate every `item.topics` — a Fireship "5 wild data structures" video with `topicSlugs: ['tree', 'array', 'databases']` increments all three topics' `planned/done` counts. Topic completion % drives the frontend phase-progress UI and the AI's next-week recommendations, so wrong tagging directly distorts both.

**Curation workflow.** The project-local skill `.claude/skills/ics-library-curate/SKILL.md` encodes the layered EASY/MEDIUM/HARD ladder, approved-channels whitelist, kind-tag vocabulary (`concept`/`tradeoffs`/`practice`/`case-study`), exact-YouTube-duration rule (scrape `lengthSeconds` via `curl`), and book whitelist (Grokking Data Structures / Algorithms / Deep Learning only). When adding a new item manually, set `topicSlugs: [primary, ...covers]` in the seed — the first slug is the primary, the rest are covers.

**Browse order.** `GET /library` returns rows `ORDER BY createdAt DESC` (admin CRUD convenience), so any surface that presents items to learners must re-sort client-side. `/admin/library` (and the future member view it clones) sort each shelf/grid via `sortLibraryItems` in `apps/web/app/(admin)/admin/library/page.tsx`: primary `Topic.order` → difficulty ladder (`EASY → MEDIUM → HARD`, mirroring the SKILL's entry-point → practical → deep-dive ladder) → title A-Z as a neutral tiebreaker. Fuse search results keep their relevance ranking and bypass this sort. If you add a new library-browse surface, use the same helper — don't invent another order.

### Global guards

`AppModule` registers `JwtAuthGuard` and `RolesGuard` as `APP_GUARD` providers, so every controller is authenticated by default. Use `@Public()` to opt out (currently only `/health` and the `/auth/google*` routes) and `@Roles('ADMIN')` to restrict admin-only endpoints. `@CurrentUser()` pulls the JWT payload off the request.

### The active cycle

There is always exactly one "active cycle" at a time, and the rule is **not** "latest `Cycle` with `status=ACTIVE`". Use `resolveActiveCycle(prisma)` in `apps/api/src/common/cycle/active-cycle.ts`:

1. If an `ACTIVE` cycle contains `now` (`startsAt <= now <= endsAt`), that's it.
2. Otherwise, the nearest upcoming `ACTIVE` cycle (earliest `startsAt > now`).
3. `ARCHIVED` cycles are never returned. If every cycle is archived, callers get `null`.

There is also `resolveActiveMembership(prisma, userId)` for the member-scoped equivalent and `computeWeekPosition(cycle, now)` for "week X of N · Y days until week ends" labels. Any new endpoint that answers "which cycle is the user / landing / admin looking at right now?" must go through these helpers — hand-rolled `findFirst({ status: 'ACTIVE', orderBy: { startsAt: 'desc' } })` is wrong and will regress in the month between two cycles.

### Weekly plan flow

The critical path is `apps/api/src/weekly-plans/` + `apps/api/src/scheduler/`. `WeeklyPlansService` handles CRUD on plan drafts; `PublicationService.publish` wires the scheduler + Google Calendar:

1. Loads the plan's `items` (with library item metadata) and the member's `MemberAvailability`.
2. Calls `SchedulerService.plan` — a greedy chunker that splits each item by `preferredSessionMinutes` and packs chunks day-by-day into the weekly budget (Phase 4 ignores real Calendar busy time and just uses declared daily minutes).
3. If `overflow` is non-empty and `force=false`, throws `PlanOverflowError` (HTTP 409, plan stays DRAFT, no sessions/events created).
4. Creates one `GoogleCalendarService.createEvent` per scheduler-output chunk. Calendar failures are swallowed. No longer writes DB-side session rows — events on Google Calendar are the source of truth for time blocks. PR 3 will embed `ICS ID: <planId>/<itemId>` in the description so downstream reminders/cleanup can find them.
5. Plan transitions to PUBLISHED.

### Google Calendar auth

`AuthService.loginWithGoogle` persists the OAuth access + refresh tokens encrypted via `AesGcmService`. `GoogleCalendarService.clientFor(userId)` decrypts them each request and constructs a fresh `google.auth.OAuth2` client — tokens never leave the service. The `clientFactory` parameter is injectable so unit tests can stub the googleapis Calendar client entirely.

### AI module

Four use cases (`draft-plan`, `brief-plan`, `diagnose`, `chat`) live in `apps/api/src/ai/`. They all go through `OpenAiChatProvider` (`callJson` uses `response_format: json_object`; `stream` is an async generator that yields plain strings). Every call records tokens + USD cost to `AiGeneration` via `UsageLoggerService`. `DiagnoseService` has a 24h in-memory cache keyed by `memberId`. `ChatController` streams SSE from `ChatService.stream(...)` — the frontend (`apps/web/components/ai/context-chat.tsx`) reads `text/event-stream` manually via `fetch` + ReadableStream (not TanStack Query).

### Exception mapping

Global `HttpExceptionFilter` in `apps/api/src/common/filters/` maps NestJS exceptions to the `{ error: { code, message, details? } }` envelope documented in the spec. **Known gap:** Zod errors thrown inline from controllers (`Schema.parse(body)`) currently fall through to `INTERNAL` (500) because there is no `ZodError` branch. Fix this if you touch validation.

### Route groups in Next.js App Router

Two route groups for authenticated users:

- `(app)` — Admin shell with sidebar nav. Used by all `/admin/*` routes and `/me/availability`. Layout: `AppShell` with `Sidebar` + `Topbar`.
- `(member)` — Placeholder shell post-revamp PR 1. Single route `/home` with a minimal layout. PR 2 rebuilds the real Magazine Editorial shell (floating topbar: *Today · Cohort · Calendar · avatar*; bottom tab bar on mobile) along with `/me`, `/me/plan`, `/me/item/[id]`, `/me/cohort`, `/me/retro`, `/me/settings`.

**Never add `page.tsx` at a route group root** (`(app)/page.tsx` or `(member)/page.tsx`) — it collides with `app/page.tsx` and breaks Next.js 15's client-reference-manifest generation during static export. Use a subpath like `(member)/home/page.tsx` (as PR 1 does).

### Deploy pipeline

- `.github/workflows/ci.yml`: lint → typecheck → unit tests (postgres+pgvector service) → e2e → api build → web build → Playwright → upload playwright-report artifact on failure. Concurrency group cancels superseded runs on the same ref.
- `.github/workflows/deploy.yml`: runs on `workflow_run` after a successful CI on `main`. Builds the multi-stage Docker image, pushes to `ghcr.io/yuhtin/ics-select-api:<sha-short>` + `:latest`. No SSH — EasyPanel on the VPS pulls on its own.
- Vercel (frontend): linked to the repo root (not `apps/web/`). The project has Root Directory = `apps/web` and `sourceFilesOutsideRootDirectory: true` configured on the Vercel side (not in vercel.json). `apps/web/vercel.json` overrides the install/build commands to bounce to the repo root: `cd ../.. && pnpm install --frozen-lockfile` and `cd ../.. && pnpm --filter shared build && prisma generate && pnpm --filter web build`.

## Production URLs & secrets

- Frontend: `https://ics.daviduarte.com.br` (Vercel project `bitsbrs-projects/ics-select`)
- Backend: `https://ics-api.daviduarte.com.br` (EasyPanel on VPS, behind its TLS)
- Secrets checklist for a deploy lives in `apps/api/.env.example` — the file is grouped by purpose with comments explaining how to generate each secret. Required vars: `DATABASE_URL`, `CORS_ALLOWED_ORIGINS`, `JWT_SECRET`, `ENCRYPTION_KEY`, `GOOGLE_OAUTH_CLIENT_ID/SECRET/CALLBACK_URL`, `ALLOWED_EMAIL_DOMAINS`, `FRONTEND_BASE_URL`, `OPENAI_API_KEY`.

## Visual identity and design system

**Full reference: `docs/design-system.md`.** Read it before building member/admin UI. The summary below is a pointer.

### Dual-serif Magazine Editorial

**Narrative surfaces** (home, item, cohort, retro, admin triage, member detail): **Newsreader** (Google Fonts, variable `opsz 6..72`). Voz de jornal digital.

**Dense-data surfaces** (plan editor, cycle page, library, ai-usage): **Source Serif 4** (Google Fonts, variable `opsz 8..60`). Voz Bloomberg/terminal. Numbers use `font-variant-numeric: tabular-nums`.

**UI chrome** (buttons, labels, nav, eyebrows, meta): **Inter** (400–700).
**Numeric badges / hours / IDs**: **IBM Plex Mono** (400/600).

Fonts load via `<link>` in `layout.tsx`. **Never** `@import url()` in CSS (blocks Next.js dev server).

### Palette (disciplined)

```
--paper         #FAFAF7   page bg (creme warm)
--paper-warm    #EFEEE8   section bg
--surface       #FFFFFF   card, input bg
--ink           #1A1A1A   primary text + primary button
--ink-soft      #44403C   secondary text
--ink-mute      #78716C   meta / eyebrow
--ink-faint     #A8A29E   placeholder, disabled
--rule          #E5E4DF   dividers, borders
--accent        #C45D3A   terracotta — reflective / returning (carry-over, AI rationale)
--focus         #4F46E5   indigo — act-now / momentum (now hero, 30d streak, start CTA)
```

### Accent meaning (earned — never decorative)

| Token | When to use |
|---|---|
| `--focus` | "This is your moment to act" — hero `now` state (border + eyebrow + CTA), 30-day streak milestone. |
| `--accent` | "Returning / reflective" — carry-over sections, AI rationale block, 14-day streak. |
| `--outcome-stuck` | "Urgent / right now" — running_late hero, stuck banner, urgent admin alerts. |
| `--outcome-done-hard` | "Past-due warning" — late list row border + badge. |
| `--outcome-done-easy` | "Completed / on track" — all-done hero dot, 7-day streak, done-dots. |

**Rule:** one accent per visual unit (hero / card / section). Priority if multiple fit: `stuck > late > focus > accent > default`. Full examples + code patterns in `docs/design-system.md`.


### Outcome tokens (dot 6–10px or left border 3px, never full background)

```
--done-easy   #065F46
--done-hard   #B45309
--doubts      #6B21A8
--stuck       #991B1B
--pending     #A8A29E
```

### Geometry

- Spacing: multiples of 4 (4, 8, 12, 16, 24, 32, 48, 64).
- Radius: cards 12, inputs 8, pills 999, images 8.
- **No box-shadow** on main design. Plane separation via `paper → paper-warm → surface` + `1px rule` border.
- Motion via Framer Motion: 150ms hover, 200ms modal, 300ms page transitions. Easing `[0.16, 1, 0.3, 1]`.

### Platform colors (study material borders)

Each material source has a signature color used in card borders and item accents:

| Platform | CSS var | Color |
|---|---|---|
| YouTube | `--platform-youtube` | Red `#FF0000` |
| LeetCode | `--platform-leetcode` | Orange `#FFA116` |
| Medium | `--platform-medium` | Black `#191919` |
| GitHub | `--platform-github` | Purple `#8B5CF6` |
| Article | `--platform-article` | Teal `#0D9488` |
| Book | `--platform-book` | Amber `#D97706` |

Platform detection lives at `apps/web/lib/format/platform.ts`: URL pattern first (`youtube.com` → YouTube, `leetcode.com` → LeetCode, etc.), then falls back to `ItemFormat` (`VIDEO` → YouTube). Helper exports `detectPlatform()` + `platformLabel()`.

Platform colors appear as **3px vertical stripes** before item titles in list rows (see `ListRow.platform` prop). Creates natural visual variety without decoration. Never used as text color, never as backgrounds bigger than a pill.

### What was removed

- 3D map (`components/member/map-3d/`) and 2D map (`components/member/map-2d/`) — learning-path metaphor replaced by daily list + cohort feed.
- `StudySession` entity — progress tracked on `WeeklyPlanItem.outcome`; Google Calendar events are source-of-truth for time blocks via `ICS ID:` markers in the description.
- Legacy `status + stuck + difficultyRating` fields on `WeeklyPlanItem` — unified as `ItemOutcome` enum (`PENDING | DONE_EASY | DONE_HARD | DOUBTS | STUCK`).

## Conventions worth preserving

- UI chrome in English (`Today`, `Up next`, `Cohort`, `Streak`, etc.) and user-generated content in pt-BR (reflections, retros, admin notes, feedback). Never use emojis — use `lucide-react` icons (stroke 1.5).
- All admin endpoints use `@Roles('ADMIN')`; ownership checks for member-owned resources are inline in controllers (look for `if (user.role !== 'ADMIN' && plan.userId !== user.sub)`).
- Commit messages follow `type(scope): subject` (see `git log`). Merges to `main` use `--no-ff` and the release tags follow `vX.Y.Z`.
- The three PDFs at the repo root (`Apresentação.pdf`, `Plano Educacional.pdf`, `Proposta.pdf`) are program reference material only; they are gitignored and never committed (the Apresentação exceeds GitHub's 100MB hard limit).

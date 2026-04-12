# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**ICS Select** is a private platform for the Inteli Consulting Society's selective program that prepares students for technical interviews at Big Techs. The admin (`Diretor Educacional`) builds personalized weekly study plans from a searchable library of materials; selected members (≤12 per cycle) follow the plans, auto-schedule study sessions against their Google Calendar, mark items as done with fácil/difícil ratings, and the admin sees cohort progress + AI-assisted insights.

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

### Shared package build discipline

`packages/shared/package.json` declares `"main": "./dist/index.js"` with `"files": ["dist"]` and builds via `tsc -p tsconfig.build.json` to CommonJS. When running the compiled API (`node dist/src/main.js` or the Docker image), `dist/` **must exist** — otherwise Node throws `ERR_MODULE_NOT_FOUND`. Jest in `apps/api` bypasses this via `moduleNameMapper` that resolves `@ics-select/shared` straight to `packages/shared/src/index.ts`, so unit tests don't need a pre-build.

### Prisma & pgvector

Prisma can't describe `vector(1536)` or `tsvector` natively, so migrations `0_init` (extension), `3_library_search_columns` (embedding column + tsvector + trigger + ivfflat index) and all semantic-search queries go through `$queryRawUnsafe` / `$executeRawUnsafe` in `apps/api/src/library/library.service.ts`. Re-embedding happens on create/update via `OpenAiService.embed`. The `tsvector` is maintained by a Postgres trigger, not from app code.

### Global guards

`AppModule` registers `JwtAuthGuard` and `RolesGuard` as `APP_GUARD` providers, so every controller is authenticated by default. Use `@Public()` to opt out (currently only `/health` and the `/auth/google*` routes) and `@Roles('ADMIN')` to restrict admin-only endpoints. `@CurrentUser()` pulls the JWT payload off the request.

### Weekly plan flow

The critical path is `apps/api/src/weekly-plans/` + `apps/api/src/scheduler/`. `WeeklyPlansService` handles CRUD on plan drafts; `PublicationService.publish` wires the scheduler + Google Calendar:

1. Loads the plan's `items` (with library item metadata) and the member's `MemberAvailability`.
2. Calls `SchedulerService.plan` — a greedy chunker that splits each item by `preferredSessionMinutes` and packs chunks day-by-day into the weekly budget (Phase 4 ignores real Calendar busy time and just uses declared daily minutes).
3. If `overflow` is non-empty and `force=false`, throws `PlanOverflowError` (HTTP 409, plan stays DRAFT, no sessions/events created).
4. Otherwise deletes pre-existing `StudySession` rows for the plan, creates new ones, and fires one `GoogleCalendarService.createEvent` per session. Calendar failures are swallowed per session (`googleEventId` left null, admin can re-publish).
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
- `(member)` — Gamified member experience. Holds `/map`, `/calendar`, `/members`. Layout: transparent floating `TopbarMember` + `BottomTabBar` (mobile). No sidebar — the map takes full width with a sticky stats sidebar on the right.

**Do not add `page.tsx` to any route group root** (`(app)/page.tsx` or `(member)/page.tsx`) — it collides with `app/page.tsx` (root redirect) and breaks Next.js 15's client-reference-manifest generation during static export. We learned this the hard way twice.

Members without an active `CycleMembership` see a blocking `NoCycleScreen` instead of the member layout — they cannot access the map, calendar, or members pages.

### Deploy pipeline

- `.github/workflows/ci.yml`: lint → typecheck → unit tests (postgres+pgvector service) → e2e → api build → web build → Playwright → upload playwright-report artifact on failure. Concurrency group cancels superseded runs on the same ref.
- `.github/workflows/deploy.yml`: runs on `workflow_run` after a successful CI on `main`. Builds the multi-stage Docker image, pushes to `ghcr.io/yuhtin/ics-select-api:<sha-short>` + `:latest`. No SSH — EasyPanel on the VPS pulls on its own.
- Vercel (frontend): linked to the repo root (not `apps/web/`). The project has Root Directory = `apps/web` and `sourceFilesOutsideRootDirectory: true` configured on the Vercel side (not in vercel.json). `apps/web/vercel.json` overrides the install/build commands to bounce to the repo root: `cd ../.. && pnpm install --frozen-lockfile` and `cd ../.. && pnpm --filter shared build && prisma generate && pnpm --filter web build`.

## Production URLs & secrets

- Frontend: `https://ics.daviduarte.com.br` (Vercel project `bitsbrs-projects/ics-select`)
- Backend: `https://ics-api.daviduarte.com.br` (EasyPanel on VPS, behind its TLS)
- Secrets checklist for a deploy lives in `apps/api/.env.example` — the file is grouped by purpose with comments explaining how to generate each secret. Required vars: `DATABASE_URL`, `CORS_ALLOWED_ORIGINS`, `JWT_SECRET`, `ENCRYPTION_KEY`, `GOOGLE_OAUTH_CLIENT_ID/SECRET/CALLBACK_URL`, `ALLOWED_EMAIL_DOMAINS`, `FRONTEND_BASE_URL`, `OPENAI_API_KEY`.

## Visual identity and design system

### Warm coral palette

The platform uses a warm, inviting palette — not corporate blue. The old `#005ab4` blue lives only in the logo mark (`BrandLockup`). All UI surfaces, accents, and interactive elements use the warm coral theme.

| Token | HSL | Hex approx | Usage |
|---|---|---|---|
| `--background` | `30 50% 98%` | `#FDF8F3` | Page background (creme) |
| `--foreground` | `30 30% 12%` | `#2D2418` | Primary text (warm brown) |
| `--brand` | `24 95% 53%` | `#F97316` | Primary accent (coral) — buttons, active states, links |
| `--brand-soft` | `24 100% 93%` | | Soft accent backgrounds |
| `--surface` | `0 0% 100%` | `#FFFFFF` | Cards, modals |
| `--surface-muted` | `30 30% 96%` | | Subtle card backgrounds |

### Platform colors (for study material nodes)

Each material source has a signature color used in card borders and node accents on the learning map:

| Platform | CSS var | Color |
|---|---|---|
| YouTube | `--platform-youtube` | Red `#FF0000` |
| LeetCode | `--platform-leetcode` | Orange `#FFA116` |
| Medium | `--platform-medium` | Black `#191919` |
| GitHub | `--platform-github` | Purple `#8B5CF6` |
| Article | `--platform-article` | Teal `#0D9488` |
| Book | `--platform-book` | Amber `#D97706` |

Platform detection uses URL pattern matching first (e.g. `youtube.com` → YouTube), then falls back to `ItemFormat` (e.g. `VIDEO` → YouTube). Logic lives in `apps/web/components/member/platform-colors.ts`.

### Status colors

| Status | Color | Usage |
|---|---|---|
| Consegui (DONE) | Green `#10B981` | Completed successfully |
| Travei (STUCK) | Red `#EF4444` | Got stuck |
| Tive duvidas (DOUBTS) | Yellow `#F59E0B` | Had questions |
| Pendente | Warm gray `#A8A29E` | Not started |

### Member experience — gamified learning map

The member-facing UI (`(member)` route group) is a **gamified progression map**, not a dashboard:

- **Node map** (`/map`): S-curve SVG path with positioned circular nodes representing weekly plan items. Nodes have status-based styling (done/stuck/doubts/active/pending). Hover shows a floating card with platform-colored border; click expands to full card with material link + feedback form (Consegui/Travei/Tive duvidas + textarea).
- **World select**: Each weekly plan is a "world". Past worlds are revisitable, the active one glows, future ones show a lock. Accessed via "Ver todos os mundos" from the map.
- **Decorative elements**: Stars, flags, clouds (inline SVGs) placed between nodes for game-like feel.
- **Stats sidebar** (desktop right, ~300px): Progress ring, modules count, days remaining, streak.
- **Mobile**: Bottom tab bar replaces topbar; stats collapse to horizontal banner; expanded cards open as fixed modals.

### Design principles

- **Warm over corporate**: Creme backgrounds, coral accents, warm browns. Never cold blues/grays for UI chrome.
- **Ludico/illustrated**: The map should feel like a game path (Super Mario / Candy Crush / Duolingo), not a flowchart.
- **DOM-based map**: Nodes are React components with CSS absolute positioning, paths are SVG beziers. Framer Motion for hover/expand animations. No canvas.
- **Platform identity**: Material sources are color-coded throughout (map nodes, calendar cards, hover cards).
- **Admin stays dashboard**: Only the member experience is gamified. Admin retains the sidebar + data-table layout.

## Conventions worth preserving

- pt-BR everywhere in UI copy, with accents (except auto-generated code comments). No emojis anywhere — use `lucide-react` icons.
- All admin endpoints use `@Roles('ADMIN')`; ownership checks for member-owned resources are inline in controllers (look for `if (user.role !== 'ADMIN' && plan.userId !== user.sub)`).
- Commit messages follow `type(scope): subject` (see `git log`). Merges to `main` use `--no-ff` and the release tags follow `vX.Y.Z`.
- The three PDFs at the repo root (`Apresentação.pdf`, `Plano Educacional.pdf`, `Proposta.pdf`) are program reference material only; they are gitignored and never committed (the Apresentação exceeds GitHub's 100MB hard limit).

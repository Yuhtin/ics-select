# PR 1 — Domain Migration + Kill Dead Code (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the database to the revamp's new domain model (unified `outcome` enum, `Topic` taxonomy, `Track` enum, `WeeklyRetro`/`AdminNote`/`DismissedAlert` tables, `whatsappPhone`, `rankingVisibleToMembers`, `carriedFromItemId`), drop `StudySession`, update backend services to use the new outcome, and remove the dead 2D/3D map frontend so PRs 2–4 start on a clean slate.

**Architecture:** One consolidated Prisma migration (`11_revamp_foundation`) applies all schema changes atomically. Since the platform has zero production users (per `docs/superpowers/specs/2026-04-16-revamp-design.md §1`), the migration is destructive — `WeeklyPlanItem.status`/`stuck`/`difficultyRating` are dropped without a backfill, and `StudySession` is dropped entirely. Backend services are refactored to use `ItemOutcome`. The reminders cron is temporarily **disabled** (comment out the `@Cron` decorator); PR 3 will rewrite it to parse `ICS ID:` from Google Calendar event descriptions. Frontend dead code (map-3d, map-2d, old components, broken routes) is deleted; the member shell is reduced to a minimal placeholder page until PR 2 rebuilds it.

**Tech Stack:** Prisma 5 · PostgreSQL 16 + pgvector · NestJS 10 (TypeScript) · Next.js 15 App Router · pnpm 9 · Jest (API unit) · Playwright (web e2e).

**Reference spec:** `docs/superpowers/specs/2026-04-16-revamp-design.md` (commit `a089d18`).

**Out of scope in this PR:** new UI, new endpoints, IA enhancements, retrô cron, WhatsApp purge, scheduler free/busy fix. All arrive in PRs 2–4.

---

## File Structure

### Created

- `packages/prisma/prisma/migrations/11_revamp_foundation/migration.sql`
- `packages/shared/src/domain/index.ts`
- `packages/shared/src/domain/outcome.ts`
- `packages/shared/src/domain/track.ts`
- `packages/shared/src/domain/alert.ts`

### Modified

- `packages/prisma/prisma/schema.prisma`
- `packages/shared/src/index.ts`
- `apps/api/src/weekly-plans/weekly-plans.service.ts`
- `apps/api/src/weekly-plans/weekly-plans.service.spec.ts`
- `apps/api/src/weekly-plans/weekly-plans.controller.ts`
- `apps/api/src/weekly-plans/publication.service.ts`
- `apps/api/src/weekly-plans/publication.service.spec.ts`
- `apps/api/src/weekly-plans/dto.ts`
- `apps/api/src/notifications/reminders.cron.ts`
- `apps/api/src/ai/draft-plan.service.ts`
- `apps/api/src/ai/draft-plan.service.spec.ts`
- `apps/api/src/ai/diagnose.service.ts`
- `apps/api/src/ai/diagnose.service.spec.ts`
- `apps/api/src/admin-dashboard/admin-dashboard.service.ts`
- `apps/api/src/admin-dashboard/admin-dashboard.service.spec.ts`
- `apps/web/app/page.tsx` (root redirect unchanged, but verify)
- `apps/web/app/(member)/layout.tsx` (reduced to placeholder)
- `apps/web/app/(member)/page.tsx` (created as placeholder home, see Task 17)
- `apps/web/app/(app)/layout.tsx` (admin-only shell, unchanged)
- `CLAUDE.md`

### Deleted

- `apps/web/components/member/map-3d/` (entire directory — 21+ files)
- `apps/web/components/member/map-2d/` (entire directory)
- `apps/web/components/member/plan-dock.tsx`
- `apps/web/components/member/stats-sidebar.tsx`
- `apps/web/components/member/stats-banner-mobile.tsx`
- `apps/web/components/member/map-viewport.tsx`
- `apps/web/components/member/no-cycle-screen.tsx`
- `apps/web/components/member/bottom-tab-bar.tsx`
- `apps/web/components/member/feedback-form.tsx`
- `apps/web/components/member/topbar-member.tsx`
- `apps/web/components/member/member-mural-card.tsx`
- `apps/web/components/member/calendar-day-list.tsx`
- `apps/web/components/member/calendar-mini.tsx`
- `apps/web/components/member/calendar-session-card.tsx`
- `apps/web/components/member/calendar-weekly.tsx`
- `apps/web/components/ai/` (context-chat and AI UI — entire dir if present)
- `apps/web/app/dev/` (whole dir — test-harness routes for 3D)
- `apps/web/app/(member)/map/`
- `apps/web/app/(member)/calendar/`
- `apps/web/app/(member)/members/`
- `apps/web/app/(app)/me/` (member pages that were in the wrong shell)
- `apps/web/app/test-modal/`
- `apps/web/public/models/` (GLB models for 3D — large binaries)

---

## Tasks

### Task 1: Prepare the migration directory and empty SQL file

**Files:**
- Create: `packages/prisma/prisma/migrations/11_revamp_foundation/migration.sql`

- [ ] **Step 1: Create the migration directory**

Run:

```bash
mkdir -p packages/prisma/prisma/migrations/11_revamp_foundation
```

- [ ] **Step 2: Create the empty SQL file with a header comment**

Write `packages/prisma/prisma/migrations/11_revamp_foundation/migration.sql`:

```sql
-- Revamp foundation migration (PR 1)
-- Adds: Track, ItemOutcome, AlertType enums;
--        Topic, WeeklyRetro, AdminNote, DismissedAlert tables;
--        User.whatsappPhone, Cycle.rankingVisibleToMembers,
--        CycleMembership.track, LibraryItem.topicId,
--        LibraryItem.tracks, WeeklyPlanItem.outcome,
--        WeeklyPlanItem.carriedFromItemId.
-- Removes: StudySession table;
--          WeeklyPlanItem.status, WeeklyPlanItem.stuck,
--          WeeklyPlanItem.stuckAt, WeeklyPlanItem.difficultyRating.
-- Destructive: no production users, no backfill.
```

- [ ] **Step 3: Commit the empty migration shell**

```bash
git add packages/prisma/prisma/migrations/11_revamp_foundation/migration.sql
git commit -m "chore(prisma): scaffold revamp foundation migration"
```

---

### Task 2: Add the new enums to the migration SQL

**Files:**
- Modify: `packages/prisma/prisma/migrations/11_revamp_foundation/migration.sql`

- [ ] **Step 1: Append enum creation statements**

Append to the migration file:

```sql

-- =====================================================
-- Enums
-- =====================================================

CREATE TYPE "Track" AS ENUM (
  'BIG_TECH',
  'CONSULTING_TECH',
  'COMPETITIVE_PROGRAMMING',
  'STARTUP',
  'OTHER'
);

CREATE TYPE "ItemOutcome" AS ENUM (
  'PENDING',
  'DONE_EASY',
  'DONE_HARD',
  'DOUBTS',
  'STUCK'
);

CREATE TYPE "AlertType" AS ENUM (
  'STUCK_RECENT',
  'DISAPPEARED',
  'STUCK_REPEATEDLY',
  'FINISHED_EARLY',
  'SKIPPED_RETROS',
  'PLAN_PENDING',
  'CALENDAR_BROKEN'
);
```

- [ ] **Step 2: Commit**

```bash
git add packages/prisma/prisma/migrations/11_revamp_foundation/migration.sql
git commit -m "feat(prisma): add Track, ItemOutcome, AlertType enums to migration"
```

---

### Task 3: Add the new tables (Topic, WeeklyRetro, AdminNote, DismissedAlert)

**Files:**
- Modify: `packages/prisma/prisma/migrations/11_revamp_foundation/migration.sql`

- [ ] **Step 1: Append CREATE TABLE statements**

Append to the migration file:

```sql

-- =====================================================
-- New tables
-- =====================================================

CREATE TABLE "Topic" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "label" TEXT NOT NULL,
  "order" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "WeeklyRetro" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "cycleId" TEXT NOT NULL REFERENCES "Cycle"("id") ON DELETE CASCADE,
  "weekStart" TIMESTAMP(3) NOT NULL,
  "whatClicked" TEXT,
  "whatStuck" TEXT,
  "nextWeekWish" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "WeeklyRetro_userId_weekStart_key"
  ON "WeeklyRetro"("userId", "weekStart");
CREATE INDEX "WeeklyRetro_cycleId_weekStart_idx"
  ON "WeeklyRetro"("cycleId", "weekStart");

CREATE TABLE "AdminNote" (
  "id" TEXT PRIMARY KEY,
  "aboutId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "authorId" TEXT NOT NULL REFERENCES "User"("id"),
  "text" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AdminNote_aboutId_idx" ON "AdminNote"("aboutId");

CREATE TABLE "DismissedAlert" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "alertType" "AlertType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "dismissedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "DismissedAlert_userId_expiresAt_idx"
  ON "DismissedAlert"("userId", "expiresAt");
```

- [ ] **Step 2: Commit**

```bash
git add packages/prisma/prisma/migrations/11_revamp_foundation/migration.sql
git commit -m "feat(prisma): add Topic, WeeklyRetro, AdminNote, DismissedAlert tables"
```

---

### Task 4: Alter existing tables (new columns)

**Files:**
- Modify: `packages/prisma/prisma/migrations/11_revamp_foundation/migration.sql`

- [ ] **Step 1: Append ALTER TABLE statements for new columns**

Append to the migration file:

```sql

-- =====================================================
-- New columns on existing tables
-- =====================================================

ALTER TABLE "User"
  ADD COLUMN "whatsappPhone" TEXT;

ALTER TABLE "Cycle"
  ADD COLUMN "rankingVisibleToMembers" BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE "CycleMembership"
  ADD COLUMN "track" "Track";

ALTER TABLE "LibraryItem"
  ADD COLUMN "topicId" TEXT REFERENCES "Topic"("id"),
  ADD COLUMN "tracks" "Track"[] NOT NULL DEFAULT ARRAY[]::"Track"[];

CREATE INDEX "LibraryItem_topicId_idx" ON "LibraryItem"("topicId");

ALTER TABLE "WeeklyPlanItem"
  ADD COLUMN "outcome" "ItemOutcome" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "carriedFromItemId" TEXT REFERENCES "WeeklyPlanItem"("id");
```

- [ ] **Step 2: Commit**

```bash
git add packages/prisma/prisma/migrations/11_revamp_foundation/migration.sql
git commit -m "feat(prisma): add new columns to User, Cycle, CycleMembership, LibraryItem, WeeklyPlanItem"
```

---

### Task 5: Drop legacy columns and StudySession table

**Files:**
- Modify: `packages/prisma/prisma/migrations/11_revamp_foundation/migration.sql`

- [ ] **Step 1: Append destructive drops**

Append to the migration file:

```sql

-- =====================================================
-- Destructive drops (no production users)
-- =====================================================

-- WeeklyPlanItem legacy fields (replaced by ItemOutcome)
ALTER TABLE "WeeklyPlanItem"
  DROP COLUMN IF EXISTS "status",
  DROP COLUMN IF EXISTS "stuck",
  DROP COLUMN IF EXISTS "stuckAt",
  DROP COLUMN IF EXISTS "difficultyRating";

-- StudySession: replaced by Google Calendar events with "ICS ID:" markers
DROP TABLE IF EXISTS "StudySession" CASCADE;

-- Legacy enums that only existed to support the dropped columns
DROP TYPE IF EXISTS "ItemStatus";
DROP TYPE IF EXISTS "DifficultyRating";
DROP TYPE IF EXISTS "StudySessionStatus";
```

- [ ] **Step 2: Commit**

```bash
git add packages/prisma/prisma/migrations/11_revamp_foundation/migration.sql
git commit -m "feat(prisma): drop legacy WeeklyPlanItem cols and StudySession table"
```

---

### Task 6: Update `schema.prisma` to match the migration

**Files:**
- Modify: `packages/prisma/prisma/schema.prisma`

- [ ] **Step 1: Read current schema to establish context**

```bash
wc -l packages/prisma/prisma/schema.prisma
```

Expected: the file is ~200-300 lines.

- [ ] **Step 2: Replace the schema with the revamp version**

Write the entire file (overwrite):

```prisma
generator client {
  provider        = "prisma-client-js"
  output          = "../generated/client"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector]
}

enum Role {
  ADMIN
  MEMBER
}

enum CycleStatus {
  ACTIVE
  ARCHIVED
}

enum Track {
  BIG_TECH
  CONSULTING_TECH
  COMPETITIVE_PROGRAMMING
  STARTUP
  OTHER
}

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

enum WeeklyPlanStatus {
  DRAFT
  PUBLISHED
  COMPLETED
  ARCHIVED
}

enum ItemOutcome {
  PENDING
  DONE_EASY
  DONE_HARD
  DOUBTS
  STUCK
}

enum AttendanceStatus {
  PRESENT
  ABSENT
  LATE
}

enum AlertType {
  STUCK_RECENT
  DISAPPEARED
  STUCK_REPEATEDLY
  FINISHED_EARLY
  SKIPPED_RETROS
  PLAN_PENDING
  CALENDAR_BROKEN
}

model User {
  id                  String    @id @default(cuid())
  email               String    @unique
  name                String
  pictureUrl          String?
  role                Role      @default(MEMBER)
  whatsappPhone       String?
  privacyAcceptedAt   DateTime?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  refreshTokens       RefreshToken[]
  memberships         CycleMembership[]
  googleAccount       GoogleAccount?
  availability        MemberAvailability?
  weeklyPlans         WeeklyPlan[]
  attendance          ClassAttendance[]
  retros              WeeklyRetro[]
  adminNotesAuthored  AdminNote[]        @relation("author")
  adminNotesAbout     AdminNote[]        @relation("about")
  dismissedAlerts     DismissedAlert[]
}

model RefreshToken {
  id        String    @id @default(cuid())
  userId    String
  tokenHash String    @unique
  expiresAt DateTime
  createdAt DateTime  @default(now())
  revokedAt DateTime?
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId])
}

model GoogleAccount {
  id              String   @id @default(cuid())
  userId          String   @unique
  accessTokenEnc  String
  refreshTokenEnc String
  expiresAt       DateTime
  scope           String
  updatedAt       DateTime @updatedAt
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Cycle {
  id                      String      @id @default(cuid())
  name                    String      @unique
  startsAt                DateTime
  endsAt                  DateTime
  status                  CycleStatus @default(ACTIVE)
  rankingVisibleToMembers Boolean     @default(false)
  createdAt               DateTime    @default(now())

  memberships CycleMembership[]
  classes     ClassSession[]
  weeklyPlans WeeklyPlan[]
  retros      WeeklyRetro[]
}

model CycleMembership {
  id       String   @id @default(cuid())
  userId   String
  cycleId  String
  track    Track?
  joinedAt DateTime @default(now())
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  cycle    Cycle    @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  @@unique([userId, cycleId])
}

model MemberAvailability {
  id                      String   @id @default(cuid())
  userId                  String   @unique
  mondayMinutes           Int      @default(0)
  tuesdayMinutes          Int      @default(0)
  wednesdayMinutes        Int      @default(0)
  thursdayMinutes         Int      @default(0)
  fridayMinutes           Int      @default(0)
  saturdayMinutes         Int      @default(0)
  sundayMinutes           Int      @default(0)
  preferredSessionMinutes Int      @default(60)
  timezone                String   @default("America/Sao_Paulo")
  updatedAt               DateTime @updatedAt
  user                    User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model ClassSession {
  id          String   @id @default(cuid())
  cycleId     String
  title       String
  topic       String?
  scheduledAt DateTime
  durationMin Int      @default(90)
  notes       String?
  cycle       Cycle    @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  attendance  ClassAttendance[]
}

model ClassAttendance {
  id             String           @id @default(cuid())
  classSessionId String
  userId         String
  status         AttendanceStatus
  classSession   ClassSession     @relation(fields: [classSessionId], references: [id], onDelete: Cascade)
  user           User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([classSessionId, userId])
}

model Topic {
  id        String        @id @default(cuid())
  slug      String        @unique
  label     String
  order     Int           @default(0)
  createdAt DateTime      @default(now())
  items     LibraryItem[]
}

model LibraryItem {
  id               String                       @id @default(cuid())
  title            String
  url              String?
  description      String?
  format           ItemFormat
  difficulty       ItemDifficulty
  estimatedMinutes Int
  topicId          String?
  tracks           Track[]                      @default([])
  source           String?
  tags             String[]
  embedding        Unsupported("vector(1536)")?
  searchVector     Unsupported("tsvector")?
  createdById      String
  createdAt        DateTime                     @default(now())
  updatedAt        DateTime                     @updatedAt

  topic     Topic?           @relation(fields: [topicId], references: [id])
  planItems WeeklyPlanItem[]
  @@index([format])
  @@index([difficulty])
  @@index([topicId])
}

model WeeklyPlan {
  id          String           @id @default(cuid())
  userId      String
  cycleId     String
  weekStart   DateTime
  weekEnd     DateTime
  status      WeeklyPlanStatus @default(DRAFT)
  adminNotes  String?
  createdAt   DateTime         @default(now())
  publishedAt DateTime?

  user  User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  cycle Cycle            @relation(fields: [cycleId], references: [id])
  items WeeklyPlanItem[]
  @@index([userId, weekStart])
}

model WeeklyPlanItem {
  id                String      @id @default(cuid())
  weeklyPlanId      String
  libraryItemId     String
  order             Int
  outcome           ItemOutcome @default(PENDING)
  reflection        String?
  completedAt       DateTime?
  carriedFromItemId String?

  weeklyPlan  WeeklyPlan       @relation(fields: [weeklyPlanId], references: [id], onDelete: Cascade)
  libraryItem LibraryItem      @relation(fields: [libraryItemId], references: [id])
  carriedFrom WeeklyPlanItem?  @relation("carry", fields: [carriedFromItemId], references: [id])
  carriedTo   WeeklyPlanItem[] @relation("carry")
  @@unique([weeklyPlanId, order])
}

model WeeklyRetro {
  id           String   @id @default(cuid())
  userId       String
  cycleId      String
  weekStart    DateTime
  whatClicked  String?
  whatStuck    String?
  nextWeekWish String?
  submittedAt  DateTime @default(now())

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  cycle Cycle @relation(fields: [cycleId], references: [id], onDelete: Cascade)
  @@unique([userId, weekStart])
  @@index([cycleId, weekStart])
}

model AdminNote {
  id        String   @id @default(cuid())
  aboutId   String
  authorId  String
  text      String
  createdAt DateTime @default(now())

  about  User @relation("about",  fields: [aboutId],  references: [id], onDelete: Cascade)
  author User @relation("author", fields: [authorId], references: [id])
  @@index([aboutId])
}

model DismissedAlert {
  id          String    @id @default(cuid())
  userId      String
  alertType   AlertType
  targetId    String
  dismissedAt DateTime  @default(now())
  expiresAt   DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId, expiresAt])
}

model AiGeneration {
  id             String   @id @default(cuid())
  userId         String?
  purpose        String
  model          String
  promptTokens   Int
  responseTokens Int
  costUsd        Decimal  @db.Decimal(10, 6)
  metadata       Json?
  createdAt      DateTime @default(now())
}

model WhatsappLog {
  id          String    @id @default(cuid())
  userId      String
  kind        String
  payload     Json
  sentAt      DateTime  @default(now())
  deliveredAt DateTime?
  error       String?
}

// Note: any other existing models (e.g. InterestSubmission from migration 10)
// MUST be preserved here. Before committing this file, diff against the
// previous schema.prisma and re-add any preserved models that weren't
// touched by the revamp.
```

- [ ] **Step 3: Verify no pre-revamp models got lost**

Run:

```bash
git diff packages/prisma/prisma/schema.prisma | grep "^-model" | sort -u
```

Expected: the only model that should appear as removed is `StudySession`. If any other `model X` shows up as deleted, re-add it to the new schema by copying from the git history.

- [ ] **Step 4: Commit**

```bash
git add packages/prisma/prisma/schema.prisma
git commit -m "feat(prisma): update schema.prisma to match revamp migration"
```

---

### Task 7: Apply the migration and regenerate the client

**Files:**
- No files changed manually; generator outputs `packages/prisma/generated/client/**`.

- [ ] **Step 1: Ensure local Postgres is running**

Run:

```bash
docker compose up -d postgres
docker compose ps postgres
```

Expected: `postgres` container shows `running` status.

- [ ] **Step 2: Apply the migration**

Run from repo root:

```bash
pnpm db:deploy
```

(This wraps `prisma migrate deploy --schema=packages/prisma/prisma/schema.prisma`.)

Expected output includes: `Applying migration 11_revamp_foundation` and `No migration needed` or `Successfully applied 1 migration`.

If it errors with schema drift, run `pnpm --filter @ics-select/prisma exec prisma migrate reset` (wipes local DB — OK since no users), then `pnpm db:deploy` again.

- [ ] **Step 3: Regenerate the Prisma client**

Run:

```bash
pnpm db:generate
```

Expected output: `Generated Prisma Client` in `packages/prisma/generated/client`.

- [ ] **Step 4: Smoke check the new client**

Run a one-liner to assert the enums exist:

```bash
node -e "const {ItemOutcome, Track, AlertType} = require('./packages/prisma/generated/client'); console.log(Object.keys(ItemOutcome), Object.keys(Track), Object.keys(AlertType));"
```

Expected output: arrays containing the enum values (`PENDING`, `DONE_EASY`, etc. / `BIG_TECH`, etc. / `STUCK_RECENT`, etc.).

- [ ] **Step 5: Commit the generated client lockfile changes (if any)**

If the command left any tracked files changed (unusual — `generated/` should be gitignored; double-check with `git status`), review them. Otherwise skip.

```bash
git status
```

Expected: clean working tree (nothing tracked was modified).

---

### Task 8: Export the new enums from `@ics-select/shared`

**Files:**
- Create: `packages/shared/src/domain/outcome.ts`
- Create: `packages/shared/src/domain/track.ts`
- Create: `packages/shared/src/domain/alert.ts`
- Create: `packages/shared/src/domain/index.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Write the outcome module**

Write `packages/shared/src/domain/outcome.ts`:

```typescript
export const ITEM_OUTCOMES = [
  'PENDING',
  'DONE_EASY',
  'DONE_HARD',
  'DOUBTS',
  'STUCK',
] as const;

export type ItemOutcome = (typeof ITEM_OUTCOMES)[number];

export const POSITIVE_OUTCOMES: ReadonlySet<ItemOutcome> = new Set([
  'DONE_EASY',
  'DONE_HARD',
]);

export function isPositiveOutcome(o: ItemOutcome): boolean {
  return POSITIVE_OUTCOMES.has(o);
}
```

- [ ] **Step 2: Write the track module**

Write `packages/shared/src/domain/track.ts`:

```typescript
export const TRACKS = [
  'BIG_TECH',
  'CONSULTING_TECH',
  'COMPETITIVE_PROGRAMMING',
  'STARTUP',
  'OTHER',
] as const;

export type Track = (typeof TRACKS)[number];
```

- [ ] **Step 3: Write the alert module**

Write `packages/shared/src/domain/alert.ts`:

```typescript
export const ALERT_TYPES = [
  'STUCK_RECENT',
  'DISAPPEARED',
  'STUCK_REPEATEDLY',
  'FINISHED_EARLY',
  'SKIPPED_RETROS',
  'PLAN_PENDING',
  'CALENDAR_BROKEN',
] as const;

export type AlertType = (typeof ALERT_TYPES)[number];

export const ALERT_SEVERITY: Record<AlertType, 'urgent' | 'attention' | 'scheduled'> = {
  STUCK_RECENT: 'urgent',
  DISAPPEARED: 'urgent',
  CALENDAR_BROKEN: 'urgent',
  STUCK_REPEATEDLY: 'attention',
  FINISHED_EARLY: 'attention',
  SKIPPED_RETROS: 'attention',
  PLAN_PENDING: 'scheduled',
};
```

- [ ] **Step 4: Write the domain barrel**

Write `packages/shared/src/domain/index.ts`:

```typescript
export * from './outcome.js';
export * from './track.js';
export * from './alert.js';
```

- [ ] **Step 5: Re-export from the package root**

Edit `packages/shared/src/index.ts`. Read the current file first:

```bash
cat packages/shared/src/index.ts
```

Then replace the file with:

```typescript
export * from './version.js';
export * from './design/index.js';
export * from './domain/index.js';
```

- [ ] **Step 6: Build the shared package**

Run:

```bash
pnpm --filter @ics-select/shared build
```

Expected: `dist/` directory contains `domain/outcome.js`, `domain/track.js`, `domain/alert.js`, `domain/index.js` and types.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/domain packages/shared/src/index.ts
git commit -m "feat(shared): export ItemOutcome, Track, AlertType enums"
```

---

### Task 9: Refactor `WeeklyPlansService.markItemDone` / `markItemStuck` into a single `setItemOutcome`

**Files:**
- Modify: `apps/api/src/weekly-plans/weekly-plans.service.ts`
- Modify: `apps/api/src/weekly-plans/weekly-plans.service.spec.ts`
- Modify: `apps/api/src/weekly-plans/dto.ts`
- Modify: `apps/api/src/weekly-plans/weekly-plans.controller.ts`

Context: the pre-revamp service has two methods (`markItemDone({rating, reflection})`, `markItemStuck()`). The revamp collapses them into one method that takes an `ItemOutcome` and optional reflection.

- [ ] **Step 1: Write the failing unit test**

Read the existing test file:

```bash
cat apps/api/src/weekly-plans/weekly-plans.service.spec.ts | head -80
```

Append a new `describe` block to `apps/api/src/weekly-plans/weekly-plans.service.spec.ts` (before the final closing brace of the top-level `describe`):

```typescript
describe('setItemOutcome', () => {
  it('sets outcome DONE_EASY and reflection, stamps completedAt', async () => {
    const itemId = 'item-1';
    const userId = 'user-1';

    prismaMock.weeklyPlanItem.findUnique.mockResolvedValue({
      id: itemId,
      weeklyPlan: { userId },
    } as any);
    prismaMock.weeklyPlanItem.update.mockResolvedValue({
      id: itemId,
      outcome: 'DONE_EASY',
      reflection: 'foi tranquilo',
      completedAt: new Date(),
    } as any);

    const result = await service.setItemOutcome(itemId, userId, {
      outcome: 'DONE_EASY',
      reflection: 'foi tranquilo',
    });

    expect(prismaMock.weeklyPlanItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: itemId },
        data: expect.objectContaining({
          outcome: 'DONE_EASY',
          reflection: 'foi tranquilo',
          completedAt: expect.any(Date),
        }),
      }),
    );
    expect(result.outcome).toBe('DONE_EASY');
  });

  it('leaves completedAt null when outcome is PENDING', async () => {
    const itemId = 'item-2';
    const userId = 'user-1';

    prismaMock.weeklyPlanItem.findUnique.mockResolvedValue({
      id: itemId,
      weeklyPlan: { userId },
    } as any);
    prismaMock.weeklyPlanItem.update.mockResolvedValue({
      id: itemId,
      outcome: 'PENDING',
      completedAt: null,
    } as any);

    await service.setItemOutcome(itemId, userId, { outcome: 'PENDING' });

    expect(prismaMock.weeklyPlanItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          outcome: 'PENDING',
          completedAt: null,
        }),
      }),
    );
  });

  it('throws ForbiddenException when the caller does not own the item', async () => {
    prismaMock.weeklyPlanItem.findUnique.mockResolvedValue({
      id: 'x',
      weeklyPlan: { userId: 'someone-else' },
    } as any);

    await expect(
      service.setItemOutcome('x', 'me', { outcome: 'DONE_EASY' }),
    ).rejects.toThrow(/forbidden/i);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
pnpm --filter @ics-select/api test -- --testPathPattern weekly-plans.service.spec
```

Expected: fails with `service.setItemOutcome is not a function` or similar.

- [ ] **Step 3: Implement `setItemOutcome` on the service**

Open `apps/api/src/weekly-plans/weekly-plans.service.ts` and replace the existing `markItemDone` and `markItemStuck` methods with a single `setItemOutcome`. Preserve imports; add `ItemOutcome` from `@ics-select/shared`.

Add near the top (keep existing imports):

```typescript
import type { ItemOutcome } from '@ics-select/shared';
import { isPositiveOutcome } from '@ics-select/shared';
```

Add the method (replacing both old methods):

```typescript
async setItemOutcome(
  itemId: string,
  userId: string,
  input: { outcome: ItemOutcome; reflection?: string | null },
) {
  const item = await this.prisma.weeklyPlanItem.findUnique({
    where: { id: itemId },
    include: { weeklyPlan: { select: { userId: true } } },
  });
  if (!item) throw new NotFoundException('Item not found');
  if (item.weeklyPlan.userId !== userId) {
    throw new ForbiddenException('Cannot change someone else item');
  }

  const completed = input.outcome !== 'PENDING';

  return this.prisma.weeklyPlanItem.update({
    where: { id: itemId },
    data: {
      outcome: input.outcome,
      reflection: input.reflection ?? undefined,
      completedAt: completed ? new Date() : null,
    },
  });
}
```

Delete the old `markItemDone` and `markItemStuck` methods entirely.

- [ ] **Step 4: Run the tests and verify they pass**

Run:

```bash
pnpm --filter @ics-select/api test -- --testPathPattern weekly-plans.service.spec
```

Expected: all three new tests pass. Existing tests that referenced `markItemDone` / `markItemStuck` will fail — fix them in the next step.

- [ ] **Step 5: Delete or update legacy tests in the same spec file**

Search for the old method names:

```bash
grep -n "markItemDone\|markItemStuck" apps/api/src/weekly-plans/weekly-plans.service.spec.ts
```

For each occurrence, either:
- **Delete** the legacy `describe`/`it` block if it tested the old behavior directly, OR
- **Rewrite** it to use `setItemOutcome` with the equivalent `outcome` value (`DONE_EASY`, `DONE_HARD`, or `STUCK`).

- [ ] **Step 6: Update the controller to expose `PATCH /plans/:planId/items/:itemId/outcome`**

Read the current controller:

```bash
grep -n "markItemDone\|markItemStuck\|items/:itemId" apps/api/src/weekly-plans/weekly-plans.controller.ts
```

Replace the two old routes with one. In `apps/api/src/weekly-plans/weekly-plans.controller.ts`, locate the old `@Post('plans/:id/items/:itemId/done')` / `/stuck` handlers and replace them with:

```typescript
@Patch('plans/:planId/items/:itemId/outcome')
setItemOutcome(
  @Param('planId') _planId: string,
  @Param('itemId') itemId: string,
  @CurrentUser() user: JwtPayload,
  @Body() body: SetItemOutcomeDto,
) {
  return this.weeklyPlansService.setItemOutcome(itemId, user.sub, {
    outcome: body.outcome,
    reflection: body.reflection,
  });
}
```

Add to imports at top of the controller file:

```typescript
import { Patch } from '@nestjs/common';
import { SetItemOutcomeDto } from './dto';
```

- [ ] **Step 7: Define `SetItemOutcomeDto`**

Open `apps/api/src/weekly-plans/dto.ts`. Append:

```typescript
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ITEM_OUTCOMES, type ItemOutcome } from '@ics-select/shared';

export class SetItemOutcomeDto {
  @IsIn(ITEM_OUTCOMES as unknown as string[])
  outcome!: ItemOutcome;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reflection?: string;
}
```

Also remove any existing `MarkItemDoneDto` / `MarkItemStuckDto` from this file (if present). Run:

```bash
grep -n "MarkItemDoneDto\|MarkItemStuckDto" apps/api/src/weekly-plans/dto.ts
```

If they exist, delete those classes. Search the rest of the codebase for references and clean them up:

```bash
grep -rn "MarkItemDoneDto\|MarkItemStuckDto" apps/api/src
```

- [ ] **Step 8: Run the full API test suite**

Run:

```bash
pnpm --filter @ics-select/api test
```

Expected: all tests pass. If any still reference the old methods/DTOs, fix them following the same pattern.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/weekly-plans
git commit -m "feat(weekly-plans): unify done/stuck into setItemOutcome + outcome enum"
```

---

### Task 10: Remove `StudySession` references from the API

Context: `StudySession` was previously written from `PublicationService` and read from `reminders.cron.ts`. PR 1 drops the table; PR 3 reimplements reminders via Google Calendar event descriptions with `ICS ID:` markers. For this PR, we remove all references and temporarily disable the reminder cron.

**Files:**
- Modify: `apps/api/src/weekly-plans/publication.service.ts`
- Modify: `apps/api/src/weekly-plans/publication.service.spec.ts`
- Modify: `apps/api/src/notifications/reminders.cron.ts`

- [ ] **Step 1: Enumerate remaining StudySession references**

Run:

```bash
grep -rn "StudySession\|studySession" apps/api/src
```

Capture the list. Expected files: `publication.service.ts`, `publication.service.spec.ts`, `reminders.cron.ts`, and possibly a scheduler type file.

- [ ] **Step 2: Disable the reminder cron**

Open `apps/api/src/notifications/reminders.cron.ts`. Comment out the `@Cron(...)` decorator and replace the method body with a log line + early return.

Apply this diff logic: wrap the existing class method so the decorator is commented and the body is:

```typescript
// PR 1: disabled — PR 3 will reimplement by reading Google Calendar events
// with "ICS ID:" markers in the description. No StudySession table anymore.
// @Cron(CronExpression.EVERY_MINUTE)
async sendReminders(): Promise<void> {
  // intentionally no-op until PR 3
  return;
}
```

Remove any imports of `StudySession`-related Prisma types (`import type { StudySession } from ...` etc.) — they no longer exist. Keep `@nestjs/schedule` imports in case PR 3 reuses them.

- [ ] **Step 3: Remove StudySession creation from PublicationService**

Read the current file:

```bash
grep -n "studySession\|StudySession\|createEvent" apps/api/src/weekly-plans/publication.service.ts
```

Locate the block that loops over the scheduler output and creates `StudySession` rows + Google Calendar events. For PR 1, remove only the `prisma.studySession.create` calls. Preserve the `GoogleCalendarService.createEvent` calls (PR 3 will update them to embed `ICS ID:`).

After the edit, the publish flow becomes: run scheduler → create Google Calendar events (without embedding ICS ID yet) → mark plan PUBLISHED. Any reference to `session.id` / `googleEventId` assignment to a `StudySession` must be deleted.

- [ ] **Step 4: Update `publication.service.spec.ts`**

Search for StudySession in the spec:

```bash
grep -n "studySession\|StudySession" apps/api/src/weekly-plans/publication.service.spec.ts
```

For each occurrence:
- Remove mocks of `prisma.studySession.*`.
- Remove assertions about session creation.
- Keep assertions that verify Google Calendar `createEvent` was called N times (where N = scheduled chunks from the scheduler output).

- [ ] **Step 5: Run the publication tests**

Run:

```bash
pnpm --filter @ics-select/api test -- --testPathPattern publication.service.spec
```

Expected: all tests pass with no StudySession references.

- [ ] **Step 6: Run full API test suite to confirm no other bleed**

Run:

```bash
pnpm --filter @ics-select/api test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/weekly-plans apps/api/src/notifications
git commit -m "feat(api): drop StudySession; disable reminder cron until PR 3"
```

---

### Task 11: Fix downstream services that read `status`/`stuck`/`difficultyRating`

Context: several services (AI draft/diagnose, admin dashboard) read the old WeeklyPlanItem fields. They now need to read `outcome` instead.

**Files:**
- Modify: `apps/api/src/ai/draft-plan.service.ts`
- Modify: `apps/api/src/ai/draft-plan.service.spec.ts`
- Modify: `apps/api/src/ai/diagnose.service.ts`
- Modify: `apps/api/src/ai/diagnose.service.spec.ts`
- Modify: `apps/api/src/admin-dashboard/admin-dashboard.service.ts`
- Modify: `apps/api/src/admin-dashboard/admin-dashboard.service.spec.ts`

- [ ] **Step 1: Enumerate references**

Run:

```bash
grep -rn "difficultyRating\|\.stuck\b\|ItemStatus\.DONE\|ItemStatus\.PENDING\|item\.status" apps/api/src
```

Capture the file list.

- [ ] **Step 2: Define a small helper in shared to summarize items**

Append to `packages/shared/src/domain/outcome.ts`:

```typescript
export function summarizeOutcomes(
  items: ReadonlyArray<{ outcome: ItemOutcome }>,
): Record<ItemOutcome, number> {
  const counts: Record<ItemOutcome, number> = {
    PENDING: 0,
    DONE_EASY: 0,
    DONE_HARD: 0,
    DOUBTS: 0,
    STUCK: 0,
  };
  for (const item of items) counts[item.outcome]++;
  return counts;
}
```

Rebuild:

```bash
pnpm --filter @ics-select/shared build
```

- [ ] **Step 3: Write failing tests for the AI draft prompt context**

Open `apps/api/src/ai/draft-plan.service.spec.ts` and add a new test. Find the existing `describe` block and add inside it:

```typescript
it('passes outcome counts and reflections to the LLM prompt', async () => {
  prismaMock.weeklyPlanItem.findMany.mockResolvedValue([
    { outcome: 'DONE_HARD', reflection: 'difícil mas saiu', libraryItem: { title: 'Foo', tags: ['arrays'] } },
    { outcome: 'STUCK', reflection: 'travei', libraryItem: { title: 'Bar', tags: ['dp'] } },
    { outcome: 'DONE_EASY', reflection: null, libraryItem: { title: 'Baz', tags: ['arrays'] } },
  ] as any);
  // library search mock
  libraryMock.search.mockResolvedValue([]);

  await service.draftPlan({ userId: 'u1', targetWeek: '2026-W17' });

  const promptArg = openAiMock.callJson.mock.calls[0][0] as string;
  expect(promptArg).toMatch(/DONE_HARD/);
  expect(promptArg).toMatch(/STUCK/);
  expect(promptArg).toMatch(/travei/);
});
```

Run:

```bash
pnpm --filter @ics-select/api test -- --testPathPattern draft-plan.service.spec
```

Expected: fails (either because of old field references or because the service still uses `status`/`stuck` in its prompt).

- [ ] **Step 4: Fix `draft-plan.service.ts`**

Open `apps/api/src/ai/draft-plan.service.ts`. Find the section that reads recent items. Replace references to `item.status` / `item.stuck` / `item.difficultyRating` with `item.outcome`.

Example transformation — wherever the code had:

```typescript
if (item.status === 'DONE' && item.difficultyRating === 'HARD') { /* ... */ }
if (item.stuck) { /* ... */ }
```

Replace with:

```typescript
if (item.outcome === 'DONE_HARD') { /* ... */ }
if (item.outcome === 'STUCK') { /* ... */ }
```

When building the prompt text, include the outcome string verbatim for each item:

```typescript
const itemsSummary = recentItems
  .map((i) => `- [${i.outcome}] ${i.libraryItem.title}${i.reflection ? ` — "${i.reflection}"` : ''}`)
  .join('\n');
```

- [ ] **Step 5: Verify the draft test passes**

Run:

```bash
pnpm --filter @ics-select/api test -- --testPathPattern draft-plan.service.spec
```

Expected: pass.

- [ ] **Step 6: Apply the same transformation to `diagnose.service.ts`**

Read:

```bash
grep -n "status\|stuck\|difficultyRating" apps/api/src/ai/diagnose.service.ts
```

Replace references using the same patterns as Step 4. Typically diagnose aggregates outcomes — use `summarizeOutcomes` from shared:

```typescript
import { summarizeOutcomes } from '@ics-select/shared';

const counts = summarizeOutcomes(allItems);
// counts.DONE_EASY, counts.DONE_HARD, counts.STUCK, counts.DOUBTS, counts.PENDING
```

Update `diagnose.service.spec.ts` accordingly — any fixture that previously set `status: 'DONE', difficultyRating: 'HARD'` becomes `outcome: 'DONE_HARD'`.

Run:

```bash
pnpm --filter @ics-select/api test -- --testPathPattern diagnose.service.spec
```

Expected: pass.

- [ ] **Step 7: Apply the same transformation to `admin-dashboard.service.ts`**

Read:

```bash
grep -n "status\|stuck\|difficultyRating\|DONE\|PENDING" apps/api/src/admin-dashboard/admin-dashboard.service.ts
```

Typical change: methods that computed `doneItems`/`stuckItems` by counting `status === 'DONE'` and `stuck === true` now use `outcome`:

```typescript
const doneItems = items.filter((i) =>
  i.outcome === 'DONE_EASY' || i.outcome === 'DONE_HARD',
).length;
const stuckItems = items.filter((i) => i.outcome === 'STUCK').length;
```

Update the corresponding spec fixtures.

Run:

```bash
pnpm --filter @ics-select/api test -- --testPathPattern admin-dashboard
```

Expected: pass.

- [ ] **Step 8: Full API test suite**

Run:

```bash
pnpm --filter @ics-select/api test
```

Expected: all tests pass. If a stragglers appears (`grep -rn difficultyRating apps/api/src`), fix it the same way.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/ai apps/api/src/admin-dashboard packages/shared/src/domain/outcome.ts
git commit -m "refactor(api): migrate AI + admin services to ItemOutcome"
```

---

### Task 12: Delete the frontend 3D map directory

**Files:**
- Delete: `apps/web/components/member/map-3d/` (entire directory)
- Delete: `apps/web/app/dev/` (entire directory)
- Delete: `apps/web/public/models/` (GLB models)

- [ ] **Step 1: Verify nothing in the keep-list imports from map-3d**

Run:

```bash
grep -rn "map-3d\|Map3D" apps/web/app apps/web/components --include='*.ts' --include='*.tsx'
```

Expected: matches only inside `apps/web/components/member/map-3d/`, `apps/web/components/member/map-viewport.tsx` (will also be deleted in Task 13), and maybe `apps/web/app/dev/map-3d/page.tsx` (also being deleted).

If anything outside those paths imports map-3d, add a note and fix in Task 14.

- [ ] **Step 2: Delete the map-3d directory**

Run:

```bash
rm -rf apps/web/components/member/map-3d
```

- [ ] **Step 3: Delete the dev route**

Run:

```bash
rm -rf apps/web/app/dev
```

- [ ] **Step 4: Delete the 3D model binaries**

Run:

```bash
rm -rf apps/web/public/models
```

- [ ] **Step 5: Remove stale 3D-related dependencies from `apps/web/package.json`**

Read the dependencies:

```bash
grep -E '"@react-three|"three|"zustand|"@types/three"' apps/web/package.json
```

For every match (`@react-three/fiber`, `@react-three/drei`, `three`, `zustand`, `@types/three`, and anything else 3D-only), remove the line from `apps/web/package.json`.

**Caveat:** if `zustand` is imported outside `map-3d/`, keep it. Check:

```bash
grep -rn "from 'zustand'\|from \"zustand\"" apps/web --include='*.ts' --include='*.tsx'
```

If no matches outside map-3d, safe to remove.

- [ ] **Step 6: Refresh the lockfile**

Run:

```bash
pnpm install
```

Expected: lockfile updates; no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/components/member apps/web/app apps/web/public
git commit -m "chore(web): delete 3D map, dev route, model binaries, 3D deps"
```

---

### Task 13: Delete remaining dead member components

**Files:**
- Delete: `apps/web/components/member/map-2d/` (entire directory)
- Delete: `apps/web/components/member/plan-dock.tsx`
- Delete: `apps/web/components/member/stats-sidebar.tsx`
- Delete: `apps/web/components/member/stats-banner-mobile.tsx`
- Delete: `apps/web/components/member/map-viewport.tsx`
- Delete: `apps/web/components/member/no-cycle-screen.tsx`
- Delete: `apps/web/components/member/bottom-tab-bar.tsx`
- Delete: `apps/web/components/member/feedback-form.tsx`
- Delete: `apps/web/components/member/topbar-member.tsx`
- Delete: `apps/web/components/member/member-mural-card.tsx`
- Delete: `apps/web/components/member/calendar-day-list.tsx`
- Delete: `apps/web/components/member/calendar-mini.tsx`
- Delete: `apps/web/components/member/calendar-session-card.tsx`
- Delete: `apps/web/components/member/calendar-weekly.tsx`

- [ ] **Step 1: Check for any remaining imports of these files**

Run:

```bash
grep -rn "components/member/\(plan-dock\|stats-sidebar\|stats-banner-mobile\|map-viewport\|no-cycle-screen\|bottom-tab-bar\|feedback-form\|topbar-member\|member-mural-card\|calendar-\|map-2d\)" apps/web/app --include='*.ts' --include='*.tsx'
```

If any `apps/web/app/*` file still imports these, note them — we handle route deletions in Task 14.

- [ ] **Step 2: Delete the files**

Run:

```bash
rm -rf apps/web/components/member/map-2d
rm apps/web/components/member/plan-dock.tsx
rm apps/web/components/member/stats-sidebar.tsx
rm apps/web/components/member/stats-banner-mobile.tsx
rm apps/web/components/member/map-viewport.tsx
rm apps/web/components/member/no-cycle-screen.tsx
rm apps/web/components/member/bottom-tab-bar.tsx
rm apps/web/components/member/feedback-form.tsx
rm apps/web/components/member/topbar-member.tsx
rm apps/web/components/member/member-mural-card.tsx
rm apps/web/components/member/calendar-day-list.tsx
rm apps/web/components/member/calendar-mini.tsx
rm apps/web/components/member/calendar-session-card.tsx
rm apps/web/components/member/calendar-weekly.tsx
```

- [ ] **Step 3: Check remaining contents of `components/member/`**

Run:

```bash
ls apps/web/components/member/
```

Expected: `platform-colors.ts` may still remain (PR 2 will reuse it). Otherwise empty. Delete any orphan file that turns out to be unused (double-check with `grep -rn "components/member/<name>"`).

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/member
git commit -m "chore(web): remove dead member components (map/calendar/plan-dock/stats/etc)"
```

---

### Task 14: Delete the member/app routes that will be reborn in PR 2

**Files:**
- Delete: `apps/web/app/(member)/map/`
- Delete: `apps/web/app/(member)/calendar/`
- Delete: `apps/web/app/(member)/members/`
- Delete: `apps/web/app/(app)/me/` (entire subtree)
- Delete: `apps/web/app/test-modal/`

- [ ] **Step 1: Delete the member route subtrees**

Run:

```bash
rm -rf apps/web/app/\(member\)/map
rm -rf apps/web/app/\(member\)/calendar
rm -rf apps/web/app/\(member\)/members
```

- [ ] **Step 2: Delete the member pages stuck in the admin shell**

Run:

```bash
rm -rf apps/web/app/\(app\)/me
```

- [ ] **Step 3: Delete the test-modal route**

Run:

```bash
rm -rf apps/web/app/test-modal
```

- [ ] **Step 4: Check that the AI chat component is gone (if present)**

```bash
ls apps/web/components/ai 2>/dev/null
```

If the directory exists, delete it:

```bash
rm -rf apps/web/components/ai
```

- [ ] **Step 5: Verify the tree builds structurally**

Run:

```bash
find apps/web/app -type f -name '*.tsx' | sort
```

Expected files remaining (approximate):
- `apps/web/app/layout.tsx`
- `apps/web/app/page.tsx`
- `apps/web/app/providers.tsx`
- `apps/web/app/login/page.tsx`
- `apps/web/app/privacy/page.tsx`
- `apps/web/app/auth/callback/page.tsx`
- `apps/web/app/(app)/layout.tsx` + admin pages under `(app)/admin/*`
- `apps/web/app/(member)/layout.tsx` (to be simplified in Task 15)

- [ ] **Step 6: Commit**

```bash
git add apps/web/app apps/web/components
git commit -m "chore(web): delete member/map, /calendar, /members, /(app)/me, /test-modal routes"
```

---

### Task 15: Replace the `(member)` layout and add a minimal placeholder home

**Files:**
- Modify: `apps/web/app/(member)/layout.tsx`
- Create: `apps/web/app/(member)/page.tsx`

Context: after the deletions in Task 14, `(member)/layout.tsx` still imports components that no longer exist. Rather than repair it piecemeal, we replace it with a minimal placeholder. PR 2 rebuilds it with the real magazine-editorial shell.

- [ ] **Step 1: Read the current layout to see what it imports**

Run:

```bash
cat apps/web/app/\(member\)/layout.tsx
```

- [ ] **Step 2: Overwrite with a minimal layout**

Write `apps/web/app/(member)/layout.tsx`:

```tsx
import type { ReactNode } from 'react';

// Minimal placeholder layout. PR 2 rebuilds this with the Magazine Editorial
// shell (floating topbar + bottom tab bar on mobile).
export default function MemberLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-3xl px-6 py-12">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Create a placeholder home page**

Write `apps/web/app/(member)/page.tsx`:

```tsx
export default function MemberPlaceholderHome() {
  return (
    <section>
      <p className="text-sm font-semibold uppercase tracking-widest text-foreground/60">
        ICS Select
      </p>
      <h1 className="mt-3 text-3xl font-semibold">
        Your study home is being rebuilt.
      </h1>
      <p className="mt-4 text-base text-foreground/75">
        The member experience is under construction and will ship in the next
        release. Reach out to the program director for anything urgent.
      </p>
    </section>
  );
}
```

- [ ] **Step 4: Confirm `apps/web/app/page.tsx` still routes properly**

Read the root page:

```bash
cat apps/web/app/page.tsx
```

Expected: role-based redirect (`admin` → `/admin`, `member` → `/` inside the `(member)` group). If the current implementation redirects to `/me`, `/map`, or `/calendar`, update it to redirect members to `/` (the placeholder home) — which is the `(member)/page.tsx` we just wrote. For admins, keep redirecting to `/admin`.

Exact logic depends on the current file; the critical assertion is: after the redirect, no broken route is followed.

- [ ] **Step 5: Start the web dev server and confirm it compiles**

Run:

```bash
pnpm --filter @ics-select/web dev
```

Expected: the server starts on `http://localhost:3000`. Open it in a browser, log in as a member (or bypass auth via existing mocks), and confirm the placeholder home renders without 500s.

Stop the server with `Ctrl+C` once verified.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/\(member\)
git commit -m "feat(web): replace member shell with placeholder until PR 2"
```

---

### Task 16: Remove `no-cycle-screen` usage and `MemberGate` references (if any)

**Files:**
- Modify: any file that previously imported `no-cycle-screen` or gated routes by active cycle membership.

- [ ] **Step 1: Find remaining references**

Run:

```bash
grep -rn "NoCycleScreen\|no-cycle-screen\|MemberGate" apps/web --include='*.ts' --include='*.tsx'
```

Expected: zero hits after Task 13 if no other file used these. If there are hits, they're in files like `apps/web/app/(member)/layout.tsx` (we already rewrote that) or a providers/wrapper file.

- [ ] **Step 2: For each remaining hit, remove the reference**

Rule of thumb: the new placeholder `(member)` shell doesn't gate by cycle membership — the placeholder is always accessible to authenticated members. If any wrapper component (outside `(member)/layout.tsx`) imports `NoCycleScreen`, remove the import and unconditionally render its children instead.

- [ ] **Step 3: Confirm the project still typechecks**

Run:

```bash
pnpm --filter @ics-select/web typecheck
```

Expected: zero errors. If there are type errors, they're the surface of a missing import we didn't clean up; follow the trail and delete.

- [ ] **Step 4: Commit (if any edits in this task)**

```bash
git add apps/web
git commit -m "chore(web): drop lingering NoCycleScreen/MemberGate refs"
```

If `git status` shows nothing changed, skip the commit.

---

### Task 17: Update `CLAUDE.md` to reflect the revamp conventions

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Read the current file**

```bash
wc -l CLAUDE.md
```

Expected: roughly 90–140 lines.

- [ ] **Step 2: Update the "Conventions worth preserving" section**

Find the bullet that says `pt-BR everywhere in UI copy, with accents ...` and replace it with:

```markdown
- UI chrome in English (`Today`, `Up next`, `Cohort`, `Streak`, etc.) and user-generated content in pt-BR (reflections, retros, admin notes, feedback). Never use emojis — use `lucide-react` icons (stroke 1.5).
```

- [ ] **Step 3: Replace the "Visual identity" section with the dual-serif system**

Find the heading that starts with `## Visual identity and design system` (or similar) and replace the entire section with:

```markdown
## Visual identity and design system

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
--ink-mute     #78716C   meta / eyebrow
--ink-faint     #A8A29E   placeholder, disabled
--rule          #E5E4DF   dividers, borders
--accent        #C45D3A   terracotta — AI rationale, editorial accent (sparingly)
```

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

### What was removed

- 3D map (`components/member/map-3d/`) and 2D map (`components/member/map-2d/`) — learning-path metaphor replaced by daily list + cohort feed.
- `StudySession` entity — progress tracked on `WeeklyPlanItem.outcome`; Google Calendar events are source-of-truth for time blocks via `ICS ID:` markers in the description.
- Legacy `status + stuck + difficultyRating` fields on `WeeklyPlanItem` — unified as `ItemOutcome` enum (`PENDING | DONE_EASY | DONE_HARD | DOUBTS | STUCK`).
```

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(claude): update conventions for revamp (i18n, dual-serif, outcome enum)"
```

---

### Task 18: Full regression — run lint, typecheck, tests, build

**Files:**
- No files changed manually in this task. This is a gate before merging PR 1.

- [ ] **Step 1: Lint**

Run:

```bash
pnpm lint
```

Expected: passes (the web package has a placeholder lint; the api uses eslint flat config).

- [ ] **Step 2: Typecheck**

Run:

```bash
pnpm typecheck
```

Expected: zero type errors. Common culprits if this fails:
- An API file still imports `ItemStatus` from `@prisma/client`.
- A frontend file still imports a deleted component.

Fix any errors by grepping for the offending symbol and removing / replacing.

- [ ] **Step 3: Run the full test suite**

Run:

```bash
pnpm test
```

Expected: API unit + e2e tests pass; the web Playwright tests may fail on routes we deleted (that's expected). For this PR, skip the web snapshot updates — PR 2 will regenerate them.

If any API test fails, fix the underlying issue (don't update snapshots blindly).

- [ ] **Step 4: Build both apps**

Run:

```bash
pnpm build
```

Expected: `@ics-select/shared` builds (tsc), `@ics-select/prisma` generates the client, `@ics-select/api` builds (nest), `@ics-select/web` builds (next). Any build failure here is a hard blocker.

- [ ] **Step 5: Docker image builds (sanity)**

If Docker is available locally:

```bash
docker build -t ics-select-api:pr1 .
```

Expected: multi-stage build completes; runtime image starts without crashing. If Docker unavailable, skip — CI will catch it.

- [ ] **Step 6: No commit needed — this is verification only.**

---

### Task 19: Prune Playwright snapshots that reference deleted routes

**Files:**
- Delete: any obsolete snapshots under `apps/web/tests/__screenshots__/` or next to specs that covered `/map`, `/calendar`, `/members`, `/me/*`.

- [ ] **Step 1: Locate current Playwright specs and snapshots**

Run:

```bash
find apps/web/tests -type f -name '*.spec.ts' | sort
find apps/web/tests -type d -name '__screenshots__' 2>/dev/null
```

- [ ] **Step 2: For each spec that targets a deleted route, delete the spec file and its snapshot directory**

For example, if `apps/web/tests/map.spec.ts` exists, delete it and its adjacent snapshot dir. Repeat for calendar / members / me / member-map-3d specs.

**Do not delete** specs for `/login`, `/privacy`, `/auth/callback`, or `/admin/*` — they still apply.

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests
git commit -m "chore(web): remove Playwright specs + snapshots for deleted routes"
```

If nothing changed, skip.

---

### Task 20: Final sanity + PR 1 merge commit

**Files:**
- No files changed; this task prepares the branch for review.

- [ ] **Step 1: Re-run the top-level gates**

Run:

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: all pass.

- [ ] **Step 2: Inspect the commit history**

Run:

```bash
git log --oneline origin/main..HEAD
```

Expected: a readable sequence of commits (migration scaffolding → enums → tables → columns → drops → schema → client → shared → service refactors → StudySession removal → downstream services → frontend deletions → placeholder shell → docs → verification cleanups). Each commit is scoped and reviewable.

- [ ] **Step 3: Confirm the working tree is clean**

Run:

```bash
git status
```

Expected: `nothing to commit, working tree clean`.

- [ ] **Step 4: (Optional) Push and open a draft PR**

Only if the user asks to push/open a PR. Command:

```bash
git push -u origin HEAD
gh pr create --draft --title "PR 1 — Domain migration + kill dead code" --body "$(cat <<'EOF'
## Summary

- Applies the revamp foundation migration (new enums, tables, columns; drops StudySession + legacy outcome fields)
- Refactors backend services to use ItemOutcome
- Deletes the dead 3D/2D map frontend, stale routes, Calendar-only member pages
- Replaces the (member) shell with a placeholder until PR 2 rebuilds it
- Updates CLAUDE.md conventions (i18n split, dual-serif system, outcome enum)

## Test plan

- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` passes
- [ ] Local Postgres migrates cleanly from prior state
- [ ] Member placeholder renders after login with no console errors
- [ ] Admin dashboard unaffected (smoke test `/admin`)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-review

**Spec coverage:**
- §7.1 domain mudanças: Tasks 2–5 cover every new enum/table/column; Task 5 drops StudySession and legacy WeeklyPlanItem cols. ✅
- §7.2 full schema.prisma: Task 6 replaces the file to match. ✅
- §8.1–8.3 added/modified/removed endpoints: PR 1 scope is domain only; endpoint additions (`/me/home`, `/admin/triage`, etc.) land in PRs 2–3. The one endpoint this PR touches is `PATCH /plans/:planId/items/:itemId/outcome` (Task 9). ✅
- §8.4 crons: reminder cron disabled (Task 10); retro + purge crons are PR 3–4 scope.
- §9.1 kill list (frontend): Tasks 12–14 cover map-3d, map-2d, plan-dock, stats-sidebar, stats-banner-mobile, map-viewport, no-cycle-screen, bottom-tab-bar, feedback-form, topbar-member, member-mural-card, calendar-*, context-chat, dev/, test-modal, member route subtrees, (app)/me. ✅
- §9.1 kill list (backend): reminders cron disabled, StudySession removed from publication + spec (Task 10). Further backend cleanups (chat.* module) are optional — PR 1 leaves chat.ts untouched since it's not imported by any controller after the frontend `context-chat.tsx` is deleted.
- §9.3 keep-with-adjust: WeeklyPlansService (Task 9), PublicationService (Task 10), AI services (Task 11), admin-dashboard (Task 11), CLAUDE.md (Task 17) all touched.
- §7.3 pgvector + tsvector: preserved — migration 11 doesn't touch them.

**Placeholder scan:** no "TBD", "TODO", "fill in", "similar to Task N", or vague "add validation" directives. Every code block is complete.

**Type consistency:** `ItemOutcome` is the canonical name throughout; `setItemOutcome` is the single service method name used in controller, service, tests, and DTO. `SetItemOutcomeDto` is defined once and imported elsewhere. `summarizeOutcomes` helper returns `Record<ItemOutcome, number>` — used consistently in diagnose and admin-dashboard. `ItemOutcome` enum values are the same string in SQL, schema.prisma, shared package, and DTO validation list.

**Ambiguities fixed inline:**
- Clarified that `reflections` field is optional; service passes `undefined` when not provided (Task 9 Step 3).
- Clarified that PR 1 preserves `GoogleCalendarService.createEvent` calls but drops the DB session rows they feed; PR 3 will embed `ICS ID:` markers (Task 10 Step 3).
- Clarified that `zustand` dep removal is conditional on no remaining imports (Task 12 Step 5).

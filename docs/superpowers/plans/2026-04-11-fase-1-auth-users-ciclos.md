# ICS Select — Fase 1 (Auth + Usuários + Ciclos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the first usable flow of ICS Select: the admin can log in via Google OAuth (restricted to the Inteli domain), create a cycle, invite members, the members log in and see their carometro in the admin dashboard, and all members accept a privacy notice before getting access. By the end of this phase, running a real cycle is possible even though plans, scheduling, and AI come later.

**Architecture:** Google OAuth 2.0 with passport-google-oauth20 on the backend, issuing short-lived JWTs plus rotating refresh tokens. Google access/refresh tokens are encrypted with AES-256-GCM and stored in Postgres. The backend validates the email domain on every login. A global `JwtAuthGuard` plus `RolesGuard` and `OwnershipGuard` decorators enforce access. The frontend wraps pages with an auth context that reads the JWT from a cookie on every API call via a TanStack Query client. Role-based routes show different navigation for admin vs member. A mandatory privacy acceptance page blocks the rest of the app on first login.

**Tech Stack (new in this phase):** `passport-google-oauth20`, `@nestjs/passport`, `@nestjs/jwt`, `@nestjs/config`, `bcrypt` (for refresh-token hashing), Node `crypto` module (AES-256-GCM), `cookie-parser`, TanStack Query on the frontend, `next-auth`-free (we roll our own client because auth is backend-driven).

---

## Pre-flight (manual, done by human)

These are external configuration steps the engineer executing this plan cannot automate. Verify they are done before starting Task 1.

1. **Google Cloud Console OAuth credentials:**
   - Create a project `ics-select` in Google Cloud Console (or reuse existing).
   - Enable the "Google Calendar API" and "Google People API" on the project (Calendar is used in Phase 3 but we request the scope now).
   - Create an OAuth 2.0 Client ID of type "Web application".
   - Authorized JavaScript origins: `http://localhost:3000`, `http://localhost:3001`, `https://ics.daviduarte.com.br`, `https://ics-api.daviduarte.com.br`.
   - Authorized redirect URIs: `http://localhost:3001/auth/google/callback` and `https://ics-api.daviduarte.com.br/auth/google/callback`.
   - Copy the Client ID and Client Secret to the local `apps/api/.env` and to the VPS `.env` plus GitHub Secrets (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`).
2. **Generate secrets:**
   - `JWT_SECRET`: `openssl rand -base64 48` → put in dev `.env` and VPS `.env`.
   - `ENCRYPTION_KEY`: `openssl rand -base64 32` (AES-256 key) → put in dev `.env` and VPS `.env`.
3. **Inteli email domain:** confirm the official student email domain. The spec assumes `sou.inteli.edu.br`. If it is different, set `ALLOWED_EMAIL_DOMAINS` env var to a comma-separated list (e.g. `sou.inteli.edu.br,inteli.edu.br`). Multi-value is useful during development so your personal account can log in as admin.
4. **Initial admin bootstrap:** the first admin cannot be "invited" by another admin because no admin exists yet. Solution documented below: a bootstrap env var `BOOTSTRAP_ADMIN_EMAILS` (comma-separated emails) promotes any user with one of those emails to `ADMIN` on first login. Set this to your email locally and on the VPS during this phase. It is a bootstrap tool; after the real admin exists, you can remove the env var.

---

## File Structure

New or modified files in this phase.

### packages/shared

| Path | Purpose |
|---|---|
| `packages/shared/src/enums.ts` | Mirrors Prisma enums for frontend/DTO use |
| `packages/shared/src/schemas/auth.ts` | Zod schemas for auth payloads |
| `packages/shared/src/schemas/cycles.ts` | Zod schemas for cycle CRUD |
| `packages/shared/src/schemas/users.ts` | Zod schemas for user/members |
| `packages/shared/src/schemas/index.ts` | Barrel |
| `packages/shared/src/index.ts` | Updated barrel |

### packages/prisma

| Path | Purpose |
|---|---|
| `packages/prisma/prisma/schema.prisma` | Add `User`, `RefreshToken`, `Cycle`, `CycleMembership`, remove `Phase0Marker` |
| `packages/prisma/prisma/migrations/1_auth_users_cycles/migration.sql` | New migration |

### apps/api

| Path | Purpose |
|---|---|
| `apps/api/src/config/env.ts` | Add `JWT_SECRET`, `ENCRYPTION_KEY`, OAuth, `ALLOWED_EMAIL_DOMAINS`, `BOOTSTRAP_ADMIN_EMAILS` |
| `apps/api/src/config/env.spec.ts` | New test cases for the new fields |
| `apps/api/src/common/crypto/aes-gcm.service.ts` | AES-256-GCM encrypt/decrypt |
| `apps/api/src/common/crypto/aes-gcm.service.spec.ts` | Unit tests (round-trip, tamper detection) |
| `apps/api/src/common/crypto/crypto.module.ts` | Module |
| `apps/api/src/auth/auth.module.ts` | Bindings |
| `apps/api/src/auth/auth.controller.ts` | OAuth routes |
| `apps/api/src/auth/auth.controller.spec.ts` | Unit tests for controller behavior |
| `apps/api/src/auth/auth.service.ts` | Login/refresh/logout orchestration |
| `apps/api/src/auth/auth.service.spec.ts` | Unit tests |
| `apps/api/src/auth/strategies/google.strategy.ts` | passport-google-oauth20 |
| `apps/api/src/auth/strategies/jwt.strategy.ts` | passport-jwt |
| `apps/api/src/auth/guards/jwt-auth.guard.ts` | JWT guard |
| `apps/api/src/auth/guards/roles.guard.ts` | Roles guard |
| `apps/api/src/auth/guards/ownership.guard.ts` | Ownership guard |
| `apps/api/src/auth/decorators/current-user.decorator.ts` | `@CurrentUser()` param decorator |
| `apps/api/src/auth/decorators/roles.decorator.ts` | `@Roles()` decorator |
| `apps/api/src/auth/decorators/public.decorator.ts` | `@Public()` (skip guard) |
| `apps/api/src/auth/tokens/jwt-token.service.ts` | Sign/verify JWTs |
| `apps/api/src/auth/tokens/refresh-token.service.ts` | Issue/rotate/revoke refresh tokens |
| `apps/api/src/auth/tokens/refresh-token.service.spec.ts` | Unit tests |
| `apps/api/src/users/users.module.ts` | Module |
| `apps/api/src/users/users.controller.ts` | `/me`, `/members` |
| `apps/api/src/users/users.controller.spec.ts` | Unit tests |
| `apps/api/src/users/users.service.ts` | Business logic |
| `apps/api/src/users/users.service.spec.ts` | Unit tests |
| `apps/api/src/cycles/cycles.module.ts` | Module |
| `apps/api/src/cycles/cycles.controller.ts` | CRUD |
| `apps/api/src/cycles/cycles.controller.spec.ts` | Unit tests |
| `apps/api/src/cycles/cycles.service.ts` | Business logic |
| `apps/api/src/cycles/cycles.service.spec.ts` | Unit tests |
| `apps/api/src/privacy/privacy.controller.ts` | `POST /me/privacy/accept` |
| `apps/api/src/privacy/privacy.module.ts` | Module |
| `apps/api/src/main.ts` | Wire cookie-parser, global JwtAuthGuard with `@Public()` reflector |
| `apps/api/src/app.module.ts` | Import new modules |
| `apps/api/test/auth.e2e-spec.ts` | e2e against the real modules with a mocked Google strategy |
| `apps/api/test/cycles.e2e-spec.ts` | e2e for cycles CRUD |

### apps/web

| Path | Purpose |
|---|---|
| `apps/web/app/layout.tsx` | Add auth provider |
| `apps/web/app/providers.tsx` | Wrap with TanStack Query + auth context |
| `apps/web/lib/api/client.ts` | Typed HTTP client with credentials |
| `apps/web/lib/auth/auth-context.tsx` | React context with user + refresh flow |
| `apps/web/lib/auth/use-current-user.ts` | Query hook |
| `apps/web/app/login/page.tsx` | Landing for logged-out users |
| `apps/web/app/privacy/page.tsx` | Privacy acceptance gate |
| `apps/web/app/(app)/layout.tsx` | Authenticated app shell with nav |
| `apps/web/app/(app)/page.tsx` | Default landing after login (redirects by role) |
| `apps/web/app/(app)/admin/cycles/page.tsx` | List cycles, create form |
| `apps/web/app/(app)/admin/cycles/[id]/page.tsx` | Cycle detail + members list |
| `apps/web/app/(app)/admin/members/page.tsx` | Full carometro |
| `apps/web/app/(app)/me/page.tsx` | Member home (placeholder until Phase 4) |
| `apps/web/components/auth/require-auth.tsx` | Route guard wrapper |
| `apps/web/components/nav/app-nav.tsx` | Nav bar |
| `apps/web/tests/auth-flow.spec.ts` | Playwright e2e mocking Google flow |

---

## Task 1: Update Prisma schema with auth/cycles models

**Goal:** Add the `User`, `RefreshToken`, `Cycle`, and `CycleMembership` models, plus the `Role`, `CycleStatus` enums. Remove the transient `Phase0Marker`. Create the migration.

**Files:**
- Modify: `packages/prisma/prisma/schema.prisma`
- Create: `packages/prisma/prisma/migrations/1_auth_users_cycles/migration.sql`

- [ ] **Step 1: Replace `packages/prisma/prisma/schema.prisma`**

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

model User {
  id                String    @id @default(cuid())
  email             String    @unique
  name              String
  pictureUrl        String?
  role              Role      @default(MEMBER)
  privacyAcceptedAt DateTime?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  refreshTokens RefreshToken[]
  memberships   CycleMembership[]
}

model RefreshToken {
  id        String    @id @default(cuid())
  userId    String
  tokenHash String    @unique
  expiresAt DateTime
  createdAt DateTime  @default(now())
  revokedAt DateTime?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model Cycle {
  id        String      @id @default(cuid())
  name      String      @unique
  startsAt  DateTime
  endsAt    DateTime
  status    CycleStatus @default(ACTIVE)
  createdAt DateTime    @default(now())

  memberships CycleMembership[]
}

model CycleMembership {
  id       String   @id @default(cuid())
  userId   String
  cycleId  String
  joinedAt DateTime @default(now())

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  cycle Cycle @relation(fields: [cycleId], references: [id], onDelete: Cascade)

  @@unique([userId, cycleId])
  @@index([cycleId])
}
```

- [ ] **Step 2: Create the migration directory and SQL**

Create `packages/prisma/prisma/migrations/1_auth_users_cycles/migration.sql`:

```sql
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "CycleStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pictureUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "privacyAcceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cycle" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "CycleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CycleMembership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Cycle_name_key" ON "Cycle"("name");

-- CreateIndex
CREATE UNIQUE INDEX "CycleMembership_userId_cycleId_key" ON "CycleMembership"("userId", "cycleId");

-- CreateIndex
CREATE INDEX "CycleMembership_cycleId_idx" ON "CycleMembership"("cycleId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleMembership" ADD CONSTRAINT "CycleMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleMembership" ADD CONSTRAINT "CycleMembership_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "Cycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Regenerate Prisma client**

Run: `pnpm --filter @ics-select/prisma exec prisma generate`
Expected: successful generation, no warnings about missing models.

- [ ] **Step 4: Apply migration against local DB (requires docker-compose postgres up)**

Run:
```bash
docker compose up -d postgres
pnpm --filter @ics-select/prisma exec prisma migrate deploy
```
Expected: "1 migration applied" (the new one). Verify tables exist:
```bash
docker exec ics-select-postgres psql -U ics -d ics_select -c "\dt"
```
Expected: `Cycle`, `CycleMembership`, `RefreshToken`, `User` listed.

- [ ] **Step 5: Commit**

```bash
git add packages/prisma/prisma/schema.prisma packages/prisma/prisma/migrations/1_auth_users_cycles
git commit -m "feat(prisma): add User, RefreshToken, Cycle, CycleMembership models"
```

---

## Task 2: Expand env config

**Goal:** Add the new env vars (`JWT_SECRET`, `ENCRYPTION_KEY`, Google OAuth, allowed domains, bootstrap admins) with Zod validation and tests first.

**Files:**
- Modify: `apps/api/src/config/env.ts`
- Modify: `apps/api/src/config/env.spec.ts`
- Modify: `apps/api/.env.example`

- [ ] **Step 1: Update the test (TDD)**

Replace `apps/api/src/config/env.spec.ts` with:

```ts
import { loadEnv } from './env';

describe('loadEnv', () => {
  const baseEnv = {
    NODE_ENV: 'test',
    PORT: '3001',
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db?schema=public',
    CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    LOG_LEVEL: 'debug',
    JWT_SECRET: 'test-jwt-secret-at-least-32-chars-long-padded',
    ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // 32 bytes base64
    GOOGLE_OAUTH_CLIENT_ID: 'client.apps.googleusercontent.com',
    GOOGLE_OAUTH_CLIENT_SECRET: 'gocspx-test',
    GOOGLE_OAUTH_CALLBACK_URL: 'http://localhost:3001/auth/google/callback',
    ALLOWED_EMAIL_DOMAINS: 'sou.inteli.edu.br',
    BOOTSTRAP_ADMIN_EMAILS: '',
    FRONTEND_BASE_URL: 'http://localhost:3000',
  };

  it('parses a valid env object', () => {
    const env = loadEnv(baseEnv);
    expect(env.NODE_ENV).toBe('test');
    expect(env.PORT).toBe(3001);
    expect(env.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.ENCRYPTION_KEY).toBeInstanceOf(Buffer);
    expect(env.ENCRYPTION_KEY.length).toBe(32);
    expect(env.ALLOWED_EMAIL_DOMAINS).toEqual(['sou.inteli.edu.br']);
    expect(env.BOOTSTRAP_ADMIN_EMAILS).toEqual([]);
  });

  it('accepts multiple allowed domains', () => {
    const env = loadEnv({ ...baseEnv, ALLOWED_EMAIL_DOMAINS: 'sou.inteli.edu.br,inteli.edu.br' });
    expect(env.ALLOWED_EMAIL_DOMAINS).toEqual(['sou.inteli.edu.br', 'inteli.edu.br']);
  });

  it('parses bootstrap admin emails', () => {
    const env = loadEnv({
      ...baseEnv,
      BOOTSTRAP_ADMIN_EMAILS: 'admin@a.com, admin@b.com',
    });
    expect(env.BOOTSTRAP_ADMIN_EMAILS).toEqual(['admin@a.com', 'admin@b.com']);
  });

  it('throws when JWT_SECRET is too short', () => {
    expect(() => loadEnv({ ...baseEnv, JWT_SECRET: 'short' })).toThrow(/JWT_SECRET/);
  });

  it('throws when ENCRYPTION_KEY is not 32 bytes', () => {
    expect(() => loadEnv({ ...baseEnv, ENCRYPTION_KEY: 'AAAA' })).toThrow(/ENCRYPTION_KEY/);
  });

  it('throws when DATABASE_URL is missing', () => {
    const { DATABASE_URL: _DATABASE_URL, ...incomplete } = baseEnv;
    expect(() => loadEnv(incomplete)).toThrow(/DATABASE_URL/);
  });

  it('defaults LOG_LEVEL to info when omitted', () => {
    const { LOG_LEVEL: _LOG_LEVEL, ...withoutLogLevel } = baseEnv;
    const env = loadEnv(withoutLogLevel);
    expect(env.LOG_LEVEL).toBe('info');
  });
});
```

- [ ] **Step 2: Run test to see it fail**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern env`
Expected: Fails because `JWT_SECRET`, etc. are not in the schema yet.

- [ ] **Step 3: Replace `apps/api/src/config/env.ts`**

```ts
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z
    .string()
    .default('3001')
    .transform((s) => Number.parseInt(s, 10))
    .pipe(z.number().int().positive()),
  DATABASE_URL: z.string().url(),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .transform((s) => s.split(',').map((o) => o.trim()).filter(Boolean)),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ENCRYPTION_KEY: z
    .string()
    .refine((s) => {
      try {
        return Buffer.from(s, 'base64').length === 32;
      } catch {
        return false;
      }
    }, 'ENCRYPTION_KEY must be 32 bytes base64')
    .transform((s) => Buffer.from(s, 'base64')),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1),
  GOOGLE_OAUTH_CALLBACK_URL: z.string().url(),
  ALLOWED_EMAIL_DOMAINS: z
    .string()
    .transform((s) => s.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean))
    .pipe(z.array(z.string()).min(1, 'At least one allowed domain required')),
  BOOTSTRAP_ADMIN_EMAILS: z
    .string()
    .optional()
    .default('')
    .transform((s) => s.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)),
  FRONTEND_BASE_URL: z.string().url(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${formatted}`);
  }
  return parsed.data;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern env`
Expected: all 8 tests pass.

- [ ] **Step 5: Update `apps/api/.env.example`**

Replace contents with:
```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://ics:ics_dev_password@localhost:5432/ics_select?schema=public
CORS_ALLOWED_ORIGINS=http://localhost:3000
LOG_LEVEL=debug

# Auth
JWT_SECRET=replace-with-at-least-32-random-chars
ENCRYPTION_KEY=replace-with-32-bytes-base64-openssl-rand-base64-32
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_CALLBACK_URL=http://localhost:3001/auth/google/callback
ALLOWED_EMAIL_DOMAINS=sou.inteli.edu.br
BOOTSTRAP_ADMIN_EMAILS=
FRONTEND_BASE_URL=http://localhost:3000
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/config apps/api/.env.example
git commit -m "feat(api): extend env config with auth and crypto settings"
```

---

## Task 3: AES-256-GCM crypto service (TDD)

**Goal:** Provide a testable symmetric encryption service for sensitive tokens (Google OAuth tokens in Phase 3).

**Files:**
- Create: `apps/api/src/common/crypto/aes-gcm.service.ts`
- Create: `apps/api/src/common/crypto/aes-gcm.service.spec.ts`
- Create: `apps/api/src/common/crypto/crypto.module.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/common/crypto/aes-gcm.service.spec.ts`:

```ts
import { AesGcmService } from './aes-gcm.service';
import { randomBytes } from 'crypto';

describe('AesGcmService', () => {
  const key = randomBytes(32);
  const svc = new AesGcmService(key);

  it('round-trips a plaintext string', () => {
    const cipher = svc.encrypt('hello world');
    expect(cipher).not.toBe('hello world');
    expect(svc.decrypt(cipher)).toBe('hello world');
  });

  it('produces different ciphertexts for the same plaintext', () => {
    const a = svc.encrypt('same');
    const b = svc.encrypt('same');
    expect(a).not.toBe(b);
  });

  it('rejects tampered ciphertext', () => {
    const cipher = svc.encrypt('integrity');
    const tampered = cipher.slice(0, -2) + (cipher.slice(-2) === 'AA' ? 'BB' : 'AA');
    expect(() => svc.decrypt(tampered)).toThrow();
  });

  it('rejects ciphertext encrypted with a different key', () => {
    const other = new AesGcmService(randomBytes(32));
    const cipher = svc.encrypt('cross-key');
    expect(() => other.decrypt(cipher)).toThrow();
  });

  it('rejects construction with a wrong-length key', () => {
    expect(() => new AesGcmService(randomBytes(16))).toThrow(/32/);
  });
});
```

- [ ] **Step 2: Run test to see it fail**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern aes-gcm`
Expected: Fails with "Cannot find module './aes-gcm.service'".

- [ ] **Step 3: Implement `AesGcmService`**

Create `apps/api/src/common/crypto/aes-gcm.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

@Injectable()
export class AesGcmService {
  constructor(private readonly key: Buffer) {
    if (key.length !== KEY_LENGTH) {
      throw new Error(`AES-256-GCM key must be ${KEY_LENGTH} bytes`);
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(payload: string): string {
    const buf = Buffer.from(payload, 'base64');
    if (buf.length < IV_LENGTH + TAG_LENGTH) {
      throw new Error('ciphertext too short');
    }
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
```

- [ ] **Step 4: Create `CryptoModule`**

Create `apps/api/src/common/crypto/crypto.module.ts`:

```ts
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AesGcmService } from './aes-gcm.service.js';

@Global()
@Module({
  providers: [
    {
      provide: AesGcmService,
      useFactory: (config: ConfigService) => {
        const key = config.get<Buffer>('ENCRYPTION_KEY');
        if (!key) throw new Error('ENCRYPTION_KEY not configured');
        return new AesGcmService(key);
      },
      inject: [ConfigService],
    },
  ],
  exports: [AesGcmService],
})
export class CryptoModule {}
```

- [ ] **Step 5: Run tests to verify**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern aes-gcm`
Expected: all 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/common/crypto
git commit -m "feat(api): add AES-256-GCM crypto service"
```

---

## Task 4: JWT token service

**Goal:** Sign and verify short-lived (15 min) access JWTs.

**Files:**
- Create: `apps/api/src/auth/tokens/jwt-token.service.ts`
- Create: `apps/api/src/auth/tokens/jwt-token.service.spec.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/src/auth/tokens/jwt-token.service.spec.ts`:

```ts
import { JwtService } from '@nestjs/jwt';
import { JwtTokenService } from './jwt-token.service';

describe('JwtTokenService', () => {
  const nest = new JwtService({ secret: 'test-secret-at-least-32-chars-abcdefgh' });
  const svc = new JwtTokenService(nest);

  it('signs and verifies a JWT with the expected payload shape', () => {
    const token = svc.sign({ sub: 'user-1', role: 'ADMIN', email: 'a@b.com' });
    const decoded = svc.verify(token);
    expect(decoded.sub).toBe('user-1');
    expect(decoded.role).toBe('ADMIN');
    expect(decoded.email).toBe('a@b.com');
  });

  it('rejects an invalid token', () => {
    expect(() => svc.verify('not-a-jwt')).toThrow();
  });

  it('expires after 15 minutes', () => {
    const token = svc.sign({ sub: 'u', role: 'MEMBER', email: 'e@x.com' });
    const decoded = svc.verify(token);
    expect(decoded.exp - decoded.iat).toBe(15 * 60);
  });
});
```

- [ ] **Step 2: Run test to see it fail**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern jwt-token`
Expected: Fails with "Cannot find module './jwt-token.service'".

- [ ] **Step 3: Implement the service**

Create `apps/api/src/auth/tokens/jwt-token.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

export type JwtPayload = {
  sub: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
};

export type DecodedJwt = JwtPayload & { iat: number; exp: number };

@Injectable()
export class JwtTokenService {
  constructor(private readonly jwt: JwtService) {}

  sign(payload: JwtPayload): string {
    return this.jwt.sign(payload, { expiresIn: '15m' });
  }

  verify(token: string): DecodedJwt {
    return this.jwt.verify<DecodedJwt>(token);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern jwt-token`
Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/tokens
git commit -m "feat(api): add JwtTokenService with 15min expiry"
```

---

## Task 5: Refresh token service (TDD)

**Goal:** Issue and validate rotating refresh tokens, stored as bcrypt hashes in the `RefreshToken` table.

**Files:**
- Create: `apps/api/src/auth/tokens/refresh-token.service.ts`
- Create: `apps/api/src/auth/tokens/refresh-token.service.spec.ts`
- Modify: `apps/api/package.json` (add `bcrypt`)

- [ ] **Step 1: Install bcrypt**

Run: `pnpm --filter @ics-select/api add bcrypt && pnpm --filter @ics-select/api add -D @types/bcrypt`
Expected: successful install.

- [ ] **Step 2: Write failing tests**

Create `apps/api/src/auth/tokens/refresh-token.service.spec.ts`:

```ts
import { RefreshTokenService } from './refresh-token.service';

type Stored = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
};

function fakePrisma() {
  const store = new Map<string, Stored>();
  return {
    store,
    refreshToken: {
      create: jest.fn(async ({ data }: { data: Omit<Stored, 'id'> }) => {
        const id = `rt-${store.size + 1}`;
        const rec: Stored = { id, revokedAt: null, ...data };
        store.set(id, rec);
        return rec;
      }),
      findUnique: jest.fn(async ({ where }: { where: { tokenHash: string } }) => {
        for (const r of store.values()) {
          if (r.tokenHash === where.tokenHash) return r;
        }
        return null;
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<Stored> }) => {
        const cur = store.get(where.id);
        if (!cur) throw new Error('not found');
        const next = { ...cur, ...data };
        store.set(where.id, next);
        return next;
      }),
      deleteMany: jest.fn(async () => ({ count: 0 })),
    },
  };
}

describe('RefreshTokenService', () => {
  it('issues a unique token each call and stores its hash', async () => {
    const prisma = fakePrisma();
    const svc = new RefreshTokenService(prisma as any);
    const a = await svc.issue('user-1');
    const b = await svc.issue('user-1');
    expect(a.plaintext).not.toBe(b.plaintext);
    expect(prisma.store.size).toBe(2);
  });

  it('validates a previously issued token by looking up its hash', async () => {
    const prisma = fakePrisma();
    const svc = new RefreshTokenService(prisma as any);
    const issued = await svc.issue('user-1');
    const rec = await svc.validate(issued.plaintext);
    expect(rec?.userId).toBe('user-1');
  });

  it('rejects a revoked token', async () => {
    const prisma = fakePrisma();
    const svc = new RefreshTokenService(prisma as any);
    const issued = await svc.issue('user-1');
    await svc.revoke(issued.plaintext);
    const rec = await svc.validate(issued.plaintext);
    expect(rec).toBeNull();
  });

  it('rejects an expired token', async () => {
    const prisma = fakePrisma();
    const svc = new RefreshTokenService(prisma as any);
    const issued = await svc.issue('user-1');
    // Manually expire it in the store
    for (const r of prisma.store.values()) {
      r.expiresAt = new Date(Date.now() - 1000);
    }
    const rec = await svc.validate(issued.plaintext);
    expect(rec).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to see it fail**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern refresh-token`
Expected: Fails.

- [ ] **Step 4: Implement the service**

Create `apps/api/src/auth/tokens/refresh-token.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service.js';

const REFRESH_TOKEN_BYTES = 48;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

@Injectable()
export class RefreshTokenService {
  constructor(private readonly prisma: PrismaService) {}

  async issue(userId: string): Promise<{ plaintext: string; expiresAt: Date }> {
    const plaintext = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    const tokenHash = this.hash(plaintext);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
    return { plaintext, expiresAt };
  }

  async validate(plaintext: string): Promise<{ id: string; userId: string } | null> {
    const tokenHash = this.hash(plaintext);
    const rec = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!rec) return null;
    if (rec.revokedAt) return null;
    if (rec.expiresAt.getTime() < Date.now()) return null;
    return { id: rec.id, userId: rec.userId };
  }

  async revoke(plaintext: string): Promise<void> {
    const tokenHash = this.hash(plaintext);
    const rec = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!rec) return;
    await this.prisma.refreshToken.update({
      where: { id: rec.id },
      data: { revokedAt: new Date() },
    });
  }

  async rotate(plaintext: string, userId: string): Promise<{ plaintext: string; expiresAt: Date }> {
    await this.revoke(plaintext);
    return this.issue(userId);
  }

  private hash(plaintext: string): string {
    // We use SHA-256 rather than bcrypt for refresh tokens because the tokens are
    // already high-entropy (48 random bytes) and we need O(1) lookup by hash.
    // bcrypt is appropriate for low-entropy passwords, not random tokens.
    return createHash('sha256').update(plaintext).digest('hex');
  }
}
```

Note: we dropped bcrypt from the plan — SHA-256 is correct for random tokens. Revert Step 1:

Run: `pnpm --filter @ics-select/api remove bcrypt @types/bcrypt`
Expected: packages removed.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern refresh-token`
Expected: 4 passing tests.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/auth/tokens pnpm-lock.yaml apps/api/package.json
git commit -m "feat(api): add RefreshTokenService with SHA-256 hash lookup"
```

---

## Task 6: Auth strategies (Google + JWT)

**Goal:** Wire passport strategies for the Google OAuth flow and for subsequent JWT-protected requests.

**Files:**
- Create: `apps/api/src/auth/strategies/google.strategy.ts`
- Create: `apps/api/src/auth/strategies/jwt.strategy.ts`
- Modify: `apps/api/package.json` (add `@nestjs/passport`, `@nestjs/jwt`, `passport`, `passport-google-oauth20`, `passport-jwt`, `cookie-parser`, types)

- [ ] **Step 1: Install deps**

Run:
```bash
pnpm --filter @ics-select/api add @nestjs/passport @nestjs/jwt passport passport-google-oauth20 passport-jwt cookie-parser
pnpm --filter @ics-select/api add -D @types/passport-google-oauth20 @types/passport-jwt @types/cookie-parser
```
Expected: successful install.

- [ ] **Step 2: Create `google.strategy.ts`**

Create `apps/api/src/auth/strategies/google.strategy.ts`:

```ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

export type GoogleProfilePayload = {
  email: string;
  name: string;
  pictureUrl: string | null;
  accessToken: string;
  refreshToken: string | null;
};

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly config: ConfigService) {
    super({
      clientID: config.getOrThrow<string>('GOOGLE_OAUTH_CLIENT_ID'),
      clientSecret: config.getOrThrow<string>('GOOGLE_OAUTH_CLIENT_SECRET'),
      callbackURL: config.getOrThrow<string>('GOOGLE_OAUTH_CALLBACK_URL'),
      scope: [
        'email',
        'profile',
        'https://www.googleapis.com/auth/calendar.events',
        'https://www.googleapis.com/auth/calendar.readonly',
      ],
      accessType: 'offline',
      prompt: 'consent',
    });
  }

  validate(
    accessToken: string,
    refreshToken: string | undefined,
    profile: {
      emails?: { value: string; verified?: boolean }[];
      displayName?: string;
      photos?: { value: string }[];
    },
    done: VerifyCallback,
  ): void {
    const email = profile.emails?.[0]?.value?.toLowerCase();
    if (!email) {
      return done(new UnauthorizedException('Google profile missing email'), false);
    }
    const allowed = this.config
      .getOrThrow<string[]>('ALLOWED_EMAIL_DOMAINS')
      .some((d) => email.endsWith(`@${d}`));
    if (!allowed) {
      return done(new UnauthorizedException('Email domain not allowed'), false);
    }
    const payload: GoogleProfilePayload = {
      email,
      name: profile.displayName ?? email,
      pictureUrl: profile.photos?.[0]?.value ?? null,
      accessToken,
      refreshToken: refreshToken ?? null,
    };
    return done(null, payload);
  }
}
```

- [ ] **Step 3: Create `jwt.strategy.ts`**

Create `apps/api/src/auth/strategies/jwt.strategy.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export type JwtStrategyPayload = {
  sub: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
      ignoreExpiration: false,
    });
  }

  validate(payload: JwtStrategyPayload): JwtStrategyPayload {
    return payload;
  }
}
```

- [ ] **Step 4: Build check**

Run: `pnpm --filter @ics-select/api build`
Expected: compiles without errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth/strategies pnpm-lock.yaml apps/api/package.json
git commit -m "feat(api): add Google OAuth and JWT passport strategies"
```

---

## Task 7: Auth guards and decorators

**Goal:** Provide reusable guards and decorators for protecting routes.

**Files:**
- Create: `apps/api/src/auth/decorators/public.decorator.ts`
- Create: `apps/api/src/auth/decorators/roles.decorator.ts`
- Create: `apps/api/src/auth/decorators/current-user.decorator.ts`
- Create: `apps/api/src/auth/guards/jwt-auth.guard.ts`
- Create: `apps/api/src/auth/guards/roles.guard.ts`

- [ ] **Step 1: Public decorator**

Create `apps/api/src/auth/decorators/public.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

- [ ] **Step 2: Roles decorator**

Create `apps/api/src/auth/decorators/roles.decorator.ts`:

```ts
import { SetMetadata } from '@nestjs/common';

export type Role = 'ADMIN' | 'MEMBER';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

- [ ] **Step 3: CurrentUser decorator**

Create `apps/api/src/auth/decorators/current-user.decorator.ts`:

```ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { JwtStrategyPayload } from '../strategies/jwt.strategy.js';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtStrategyPayload => {
    const req = ctx.switchToHttp().getRequest();
    return req.user as JwtStrategyPayload;
  },
);
```

- [ ] **Step 4: JwtAuthGuard**

Create `apps/api/src/auth/guards/jwt-auth.guard.ts`:

```ts
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

- [ ] **Step 5: RolesGuard**

Create `apps/api/src/auth/guards/roles.guard.ts`:

```ts
import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role, ROLES_KEY } from '../decorators/roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const user = context.switchToHttp().getRequest().user;
    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('Insufficient role');
    }
    return true;
  }
}
```

- [ ] **Step 6: Build check**

Run: `pnpm --filter @ics-select/api build`
Expected: compiles.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/auth/decorators apps/api/src/auth/guards
git commit -m "feat(api): add auth guards and decorators"
```

---

## Task 8: AuthService and AuthController

**Goal:** Wire the pieces together: the Google callback creates or updates a `User`, promotes bootstrap admins, issues JWT + refresh token, sets cookies, redirects to the frontend.

**Files:**
- Create: `apps/api/src/auth/auth.service.ts`
- Create: `apps/api/src/auth/auth.service.spec.ts`
- Create: `apps/api/src/auth/auth.controller.ts`
- Create: `apps/api/src/auth/auth.module.ts`

- [ ] **Step 1: Write failing AuthService tests**

Create `apps/api/src/auth/auth.service.spec.ts`:

```ts
import { AuthService } from './auth.service';

type FakeUser = {
  id: string;
  email: string;
  name: string;
  pictureUrl: string | null;
  role: 'ADMIN' | 'MEMBER';
  privacyAcceptedAt: Date | null;
};

function fakeDeps(bootstrap: string[] = []) {
  const users = new Map<string, FakeUser>();
  const prisma = {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { email: string } }) =>
        users.get(where.email) ?? null,
      ),
      create: jest.fn(async ({ data }: { data: Omit<FakeUser, 'id'> }) => {
        const id = `u-${users.size + 1}`;
        const rec = { id, ...data } as FakeUser;
        users.set(data.email, rec);
        return rec;
      }),
      update: jest.fn(async ({ where, data }: { where: { email: string }; data: Partial<FakeUser> }) => {
        const cur = users.get(where.email)!;
        const next = { ...cur, ...data };
        users.set(where.email, next);
        return next;
      }),
    },
  };
  const jwt = { sign: jest.fn(() => 'jwt.token.value') };
  const refresh = {
    issue: jest.fn(async (userId: string) => ({
      plaintext: `rt-${userId}-${Math.random()}`,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })),
    revoke: jest.fn(async () => undefined),
    validate: jest.fn(async (_t: string) => ({ id: 'rt-1', userId: 'u-1' })),
    rotate: jest.fn(async (_t: string, userId: string) => ({
      plaintext: `rt-${userId}-new`,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })),
  };
  const svc = new AuthService(prisma as any, jwt as any, refresh as any, bootstrap);
  return { svc, prisma, jwt, refresh, users };
}

describe('AuthService.loginWithGoogle', () => {
  it('creates a new user on first login', async () => {
    const { svc, users } = fakeDeps();
    const result = await svc.loginWithGoogle({
      email: 'pedro@sou.inteli.edu.br',
      name: 'Pedro',
      pictureUrl: 'http://pic',
      accessToken: 'ga',
      refreshToken: 'gr',
    });
    expect(users.size).toBe(1);
    expect(result.user.email).toBe('pedro@sou.inteli.edu.br');
    expect(result.user.role).toBe('MEMBER');
    expect(result.accessToken).toBe('jwt.token.value');
    expect(result.refreshToken.plaintext).toMatch(/^rt-/);
  });

  it('updates name and picture on subsequent login', async () => {
    const { svc, users, prisma } = fakeDeps();
    await svc.loginWithGoogle({
      email: 'pedro@sou.inteli.edu.br',
      name: 'Pedro',
      pictureUrl: 'http://old',
      accessToken: 'ga',
      refreshToken: null,
    });
    await svc.loginWithGoogle({
      email: 'pedro@sou.inteli.edu.br',
      name: 'Pedro Silva',
      pictureUrl: 'http://new',
      accessToken: 'ga2',
      refreshToken: null,
    });
    expect(users.size).toBe(1);
    expect(prisma.user.update).toHaveBeenCalled();
    const stored = users.get('pedro@sou.inteli.edu.br')!;
    expect(stored.name).toBe('Pedro Silva');
    expect(stored.pictureUrl).toBe('http://new');
  });

  it('promotes an email in BOOTSTRAP_ADMIN_EMAILS to ADMIN on first login', async () => {
    const { svc, users } = fakeDeps(['admin@sou.inteli.edu.br']);
    await svc.loginWithGoogle({
      email: 'admin@sou.inteli.edu.br',
      name: 'Admin',
      pictureUrl: null,
      accessToken: 'ga',
      refreshToken: null,
    });
    expect(users.get('admin@sou.inteli.edu.br')!.role).toBe('ADMIN');
  });
});
```

- [ ] **Step 2: Run tests to see failure**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern auth.service`
Expected: fails (no implementation yet).

- [ ] **Step 3: Implement AuthService**

Create `apps/api/src/auth/auth.service.ts`:

```ts
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { JwtTokenService } from './tokens/jwt-token.service.js';
import { RefreshTokenService } from './tokens/refresh-token.service.js';
import type { GoogleProfilePayload } from './strategies/google.strategy.js';

export const BOOTSTRAP_ADMIN_EMAILS_TOKEN = 'BOOTSTRAP_ADMIN_EMAILS_TOKEN';

type LoginResult = {
  user: {
    id: string;
    email: string;
    name: string;
    pictureUrl: string | null;
    role: 'ADMIN' | 'MEMBER';
    privacyAcceptedAt: Date | null;
  };
  accessToken: string;
  refreshToken: { plaintext: string; expiresAt: Date };
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtTokenService,
    private readonly refresh: RefreshTokenService,
    @Inject(BOOTSTRAP_ADMIN_EMAILS_TOKEN)
    private readonly bootstrapAdmins: string[],
  ) {}

  async loginWithGoogle(profile: GoogleProfilePayload): Promise<LoginResult> {
    const existing = await this.prisma.user.findUnique({ where: { email: profile.email } });
    const shouldBeAdmin = this.bootstrapAdmins.includes(profile.email);

    const user = existing
      ? await this.prisma.user.update({
          where: { email: profile.email },
          data: {
            name: profile.name,
            pictureUrl: profile.pictureUrl,
            ...(shouldBeAdmin && existing.role !== 'ADMIN' ? { role: 'ADMIN' } : {}),
          },
        })
      : await this.prisma.user.create({
          data: {
            email: profile.email,
            name: profile.name,
            pictureUrl: profile.pictureUrl,
            role: shouldBeAdmin ? 'ADMIN' : 'MEMBER',
          },
        });

    const accessToken = this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    const refreshToken = await this.refresh.issue(user.id);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        pictureUrl: user.pictureUrl,
        role: user.role,
        privacyAcceptedAt: user.privacyAcceptedAt,
      },
      accessToken,
      refreshToken,
    };
  }

  async refreshSession(plaintextRefreshToken: string): Promise<LoginResult | null> {
    const existing = await this.refresh.validate(plaintextRefreshToken);
    if (!existing) return null;
    const user = await this.prisma.user.findUnique({ where: { id: existing.userId } });
    if (!user) return null;
    const rotated = await this.refresh.rotate(plaintextRefreshToken, user.id);
    const accessToken = this.jwt.sign({ sub: user.id, email: user.email, role: user.role });
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        pictureUrl: user.pictureUrl,
        role: user.role,
        privacyAcceptedAt: user.privacyAcceptedAt,
      },
      accessToken,
      refreshToken: rotated,
    };
  }

  async logout(plaintextRefreshToken: string): Promise<void> {
    await this.refresh.revoke(plaintextRefreshToken);
  }
}
```

- [ ] **Step 4: Run tests to verify**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern auth.service`
Expected: 3 passing tests.

- [ ] **Step 5: Implement AuthController**

Create `apps/api/src/auth/auth.controller.ts`:

```ts
import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { Public } from './decorators/public.decorator.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from './strategies/jwt.strategy.js';

const REFRESH_COOKIE = 'ics_refresh';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin(): void {
    // Passport redirects to Google's consent screen
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const profile = req.user as Parameters<AuthService['loginWithGoogle']>[0];
    const result = await this.auth.loginWithGoogle(profile);
    this.setRefreshCookie(res, result.refreshToken);
    const frontend = this.config.getOrThrow<string>('FRONTEND_BASE_URL');
    const url = new URL('/auth/callback', frontend);
    url.searchParams.set('token', result.accessToken);
    res.redirect(url.toString());
  }

  @Public()
  @Post('refresh')
  async refresh(@Req() req: Request, @Res() res: Response): Promise<void> {
    const token = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? null;
    if (!token) throw new UnauthorizedException('missing refresh cookie');
    const result = await this.auth.refreshSession(token);
    if (!result) {
      res.clearCookie(REFRESH_COOKIE);
      throw new UnauthorizedException('invalid refresh');
    }
    this.setRefreshCookie(res, result.refreshToken);
    res.json({ accessToken: result.accessToken, user: result.user });
  }

  @Public()
  @Post('logout')
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    const token = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? null;
    if (token) await this.auth.logout(token);
    res.clearCookie(REFRESH_COOKIE);
    res.json({ ok: true });
  }

  @Get('me')
  me(@CurrentUser() user: JwtStrategyPayload) {
    return user;
  }

  private setRefreshCookie(
    res: Response,
    token: { plaintext: string; expiresAt: Date },
  ): void {
    const isProd = this.config.getOrThrow<string>('NODE_ENV') === 'production';
    res.cookie(REFRESH_COOKIE, token.plaintext, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      expires: token.expiresAt,
      path: '/auth',
    });
  }
}
```

- [ ] **Step 6: Create AuthModule**

Create `apps/api/src/auth/auth.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller.js';
import { AuthService, BOOTSTRAP_ADMIN_EMAILS_TOKEN } from './auth.service.js';
import { GoogleStrategy } from './strategies/google.strategy.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { JwtTokenService } from './tokens/jwt-token.service.js';
import { RefreshTokenService } from './tokens/refresh-token.service.js';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleStrategy,
    JwtStrategy,
    JwtTokenService,
    RefreshTokenService,
    {
      provide: BOOTSTRAP_ADMIN_EMAILS_TOKEN,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        config.getOrThrow<string[]>('BOOTSTRAP_ADMIN_EMAILS'),
    },
  ],
  exports: [AuthService, JwtTokenService, RefreshTokenService],
})
export class AuthModule {}
```

- [ ] **Step 7: Build check**

Run: `pnpm --filter @ics-select/api build`
Expected: clean build.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/auth
git commit -m "feat(api): add AuthService and AuthController with Google OAuth"
```

---

## Task 9: Wire auth globally into `AppModule` + `main.ts`

**Goal:** Global JWT auth guard (with `@Public()` escape hatch), ConfigModule, cookie-parser.

**Files:**
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: Update `AppModule`**

Replace `apps/api/src/app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';
import { CryptoModule } from './common/crypto/crypto.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';
import { loadEnv } from './config/env.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => {
          const env = loadEnv();
          return env as unknown as Record<string, unknown>;
        },
      ],
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
        redact: ['req.headers.authorization', 'req.headers.cookie'],
      },
    }),
    PrismaModule,
    CryptoModule,
    AuthModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
```

- [ ] **Step 2: Update `main.ts`**

Replace `apps/api/src/main.ts`:

```ts
import 'reflect-metadata';
import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.use(cookieParser());

  app.enableCors({
    origin: env.CORS_ALLOWED_ORIGINS,
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type'],
  });

  await app.listen(env.PORT);
  const logger = app.get(Logger);
  logger.log(`API listening on port ${env.PORT}`, 'Bootstrap');
}

void bootstrap();
```

- [ ] **Step 3: Mark `/health` as public**

Modify `apps/api/src/health/health.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';
import { APP_VERSION } from '@ics-select/shared';
import { Public } from '../auth/decorators/public.decorator.js';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  health(): { status: 'ok'; version: string; uptimeSeconds: number } {
    return {
      status: 'ok',
      version: APP_VERSION,
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }
}
```

- [ ] **Step 4: Run all tests and build**

Run:
```bash
pnpm --filter @ics-select/api test
pnpm --filter @ics-select/api test:e2e
pnpm --filter @ics-select/api build
```
Expected: all pass. The e2e test for `/health` still passes because it is marked public.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/app.module.ts apps/api/src/main.ts apps/api/src/health/health.controller.ts
git commit -m "feat(api): wire global JWT guard, cookie-parser, and ConfigModule"
```

---

## Task 10: Users module (me + members)

**Goal:** Endpoints for the current user to see themselves, update availability (stub for now), and for admins to list + manage members.

**Files:**
- Create: `apps/api/src/users/users.service.ts`
- Create: `apps/api/src/users/users.service.spec.ts`
- Create: `apps/api/src/users/users.controller.ts`
- Create: `apps/api/src/users/users.controller.spec.ts`
- Create: `apps/api/src/users/users.module.ts`

- [ ] **Step 1: Write failing service tests**

Create `apps/api/src/users/users.service.spec.ts`:

```ts
import { UsersService } from './users.service';

type U = { id: string; email: string; name: string; role: 'ADMIN' | 'MEMBER'; pictureUrl: string | null };

function fakePrisma(initial: U[] = []) {
  const users = new Map<string, U>(initial.map((u) => [u.id, u]));
  return {
    user: {
      findUnique: jest.fn(async ({ where: { id } }: { where: { id: string } }) =>
        users.get(id) ?? null,
      ),
      findMany: jest.fn(async () => Array.from(users.values())),
      create: jest.fn(async ({ data }: { data: Omit<U, 'id'> }) => {
        const id = `u-${users.size + 1}`;
        const rec = { id, ...data } as U;
        users.set(id, rec);
        return rec;
      }),
      delete: jest.fn(async ({ where: { id } }: { where: { id: string } }) => {
        const rec = users.get(id);
        if (!rec) throw new Error('not found');
        users.delete(id);
        return rec;
      }),
    },
  };
}

describe('UsersService', () => {
  it('getById returns the user', async () => {
    const prisma = fakePrisma([
      { id: 'u-1', email: 'a@x.com', name: 'A', role: 'ADMIN', pictureUrl: null },
    ]);
    const svc = new UsersService(prisma as any);
    const user = await svc.getById('u-1');
    expect(user?.email).toBe('a@x.com');
  });

  it('list returns all users', async () => {
    const prisma = fakePrisma([
      { id: 'u-1', email: 'a@x.com', name: 'A', role: 'ADMIN', pictureUrl: null },
      { id: 'u-2', email: 'b@x.com', name: 'B', role: 'MEMBER', pictureUrl: null },
    ]);
    const svc = new UsersService(prisma as any);
    expect((await svc.list()).length).toBe(2);
  });

  it('invite creates a MEMBER user', async () => {
    const prisma = fakePrisma();
    const svc = new UsersService(prisma as any);
    const u = await svc.invite({ email: 'new@x.com', name: 'New' });
    expect(u.role).toBe('MEMBER');
    expect(u.email).toBe('new@x.com');
  });
});
```

- [ ] **Step 2: Run test to see failure**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern users.service`
Expected: fails.

- [ ] **Step 3: Implement `UsersService`**

Create `apps/api/src/users/users.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';

type InviteInput = { email: string; name: string };

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async getByIdOrThrow(id: string) {
    const user = await this.getById(id);
    if (!user) throw new NotFoundException('user not found');
    return user;
  }

  async list() {
    return this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async invite(input: InviteInput) {
    return this.prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        name: input.name,
        role: 'MEMBER',
      },
    });
  }

  async deleteById(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }

  async acceptPrivacy(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { privacyAcceptedAt: new Date() },
    });
  }
}
```

- [ ] **Step 4: Implement `UsersController`**

Create `apps/api/src/users/users.controller.ts`:

```ts
import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { JwtStrategyPayload } from '../auth/strategies/jwt.strategy.js';
import { UsersService } from './users.service.js';

const InviteSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  async me(@CurrentUser() current: JwtStrategyPayload) {
    const user = await this.users.getByIdOrThrow(current.sub);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      pictureUrl: user.pictureUrl,
      role: user.role,
      privacyAcceptedAt: user.privacyAcceptedAt,
    };
  }

  @Roles('ADMIN')
  @Get('members')
  async list() {
    const users = await this.users.list();
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      pictureUrl: u.pictureUrl,
      role: u.role,
      createdAt: u.createdAt,
    }));
  }

  @Roles('ADMIN')
  @Get('members/:id')
  async get(@Param('id') id: string) {
    const user = await this.users.getById(id);
    if (!user) throw new NotFoundException('member not found');
    return user;
  }

  @Roles('ADMIN')
  @Post('members')
  async invite(@Body() body: unknown) {
    const parsed = InviteSchema.parse(body);
    return this.users.invite(parsed);
  }

  @Roles('ADMIN')
  @Delete('members/:id')
  async remove(@Param('id') id: string) {
    return this.users.deleteById(id);
  }
}
```

- [ ] **Step 5: Create module**

Create `apps/api/src/users/users.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';

@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 6: Wire into `AppModule`**

Add `UsersModule` to the imports in `apps/api/src/app.module.ts`.

- [ ] **Step 7: Run tests and build**

Run: `pnpm --filter @ics-select/api test && pnpm --filter @ics-select/api build`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/users apps/api/src/app.module.ts
git commit -m "feat(api): add users module with me + members CRUD"
```

---

## Task 11: Cycles module (CRUD)

**Goal:** Admin-only CRUD for cycles.

**Files:**
- Create: `apps/api/src/cycles/cycles.service.ts`
- Create: `apps/api/src/cycles/cycles.service.spec.ts`
- Create: `apps/api/src/cycles/cycles.controller.ts`
- Create: `apps/api/src/cycles/cycles.module.ts`

- [ ] **Step 1: Service test**

Create `apps/api/src/cycles/cycles.service.spec.ts`:

```ts
import { CyclesService } from './cycles.service';

type C = { id: string; name: string; startsAt: Date; endsAt: Date; status: 'ACTIVE' | 'ARCHIVED' };

function fakePrisma() {
  const cycles = new Map<string, C>();
  return {
    cycle: {
      create: jest.fn(async ({ data }: { data: Omit<C, 'id'> }) => {
        const id = `c-${cycles.size + 1}`;
        const rec = { id, ...data } as C;
        cycles.set(id, rec);
        return rec;
      }),
      findMany: jest.fn(async () => Array.from(cycles.values())),
      findUnique: jest.fn(async ({ where: { id } }: { where: { id: string } }) =>
        cycles.get(id) ?? null,
      ),
      update: jest.fn(async ({ where: { id }, data }: { where: { id: string }; data: Partial<C> }) => {
        const cur = cycles.get(id)!;
        const next = { ...cur, ...data };
        cycles.set(id, next);
        return next;
      }),
    },
    cycleMembership: {
      findMany: jest.fn(async () => []),
      create: jest.fn(async () => ({})),
      delete: jest.fn(async () => ({})),
    },
  };
}

describe('CyclesService', () => {
  it('creates a cycle as ACTIVE by default', async () => {
    const prisma = fakePrisma();
    const svc = new CyclesService(prisma as any);
    const cycle = await svc.create({
      name: '2026.1',
      startsAt: new Date('2026-04-01'),
      endsAt: new Date('2026-07-01'),
    });
    expect(cycle.status).toBe('ACTIVE');
  });

  it('archives a cycle', async () => {
    const prisma = fakePrisma();
    const svc = new CyclesService(prisma as any);
    const cycle = await svc.create({
      name: '2026.1',
      startsAt: new Date('2026-04-01'),
      endsAt: new Date('2026-07-01'),
    });
    const archived = await svc.archive(cycle.id);
    expect(archived.status).toBe('ARCHIVED');
  });
});
```

- [ ] **Step 2: Implement service**

Create `apps/api/src/cycles/cycles.service.ts`:

```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';

type CreateInput = { name: string; startsAt: Date; endsAt: Date };
type UpdateInput = Partial<CreateInput>;

@Injectable()
export class CyclesService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: CreateInput) {
    return this.prisma.cycle.create({
      data: { ...input, status: 'ACTIVE' },
    });
  }

  list() {
    return this.prisma.cycle.findMany({ orderBy: { startsAt: 'desc' } });
  }

  async getById(id: string) {
    const c = await this.prisma.cycle.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            user: true,
          },
        },
      },
    });
    if (!c) throw new NotFoundException('cycle not found');
    return c;
  }

  update(id: string, input: UpdateInput) {
    return this.prisma.cycle.update({ where: { id }, data: input });
  }

  archive(id: string) {
    return this.prisma.cycle.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }

  async addMember(cycleId: string, userId: string) {
    return this.prisma.cycleMembership.create({
      data: { cycleId, userId },
    });
  }

  async removeMember(cycleId: string, userId: string) {
    return this.prisma.cycleMembership.deleteMany({
      where: { cycleId, userId },
    });
  }
}
```

- [ ] **Step 3: Controller**

Create `apps/api/src/cycles/cycles.controller.ts`:

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { CyclesService } from './cycles.service.js';

const CreateCycleSchema = z.object({
  name: z.string().min(1),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
});

const UpdateCycleSchema = CreateCycleSchema.partial();

const AddMemberSchema = z.object({
  userId: z.string().min(1),
});

@Roles('ADMIN')
@Controller('cycles')
export class CyclesController {
  constructor(private readonly cycles: CyclesService) {}

  @Post()
  create(@Body() body: unknown) {
    const parsed = CreateCycleSchema.parse(body);
    return this.cycles.create(parsed);
  }

  @Get()
  list() {
    return this.cycles.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.cycles.getById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    const parsed = UpdateCycleSchema.parse(body);
    return this.cycles.update(id, parsed);
  }

  @Post(':id/archive')
  archive(@Param('id') id: string) {
    return this.cycles.archive(id);
  }

  @Post(':id/members')
  addMember(@Param('id') id: string, @Body() body: unknown) {
    const { userId } = AddMemberSchema.parse(body);
    return this.cycles.addMember(id, userId);
  }

  @Delete(':id/members/:userId')
  removeMember(@Param('id') id: string, @Param('userId') userId: string) {
    return this.cycles.removeMember(id, userId);
  }
}
```

- [ ] **Step 4: Module**

Create `apps/api/src/cycles/cycles.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { CyclesController } from './cycles.controller.js';
import { CyclesService } from './cycles.service.js';

@Module({
  controllers: [CyclesController],
  providers: [CyclesService],
  exports: [CyclesService],
})
export class CyclesModule {}
```

- [ ] **Step 5: Wire into `AppModule`**

Add `CyclesModule` to imports in `apps/api/src/app.module.ts`.

- [ ] **Step 6: Run tests and build**

Run: `pnpm --filter @ics-select/api test && pnpm --filter @ics-select/api build`
Expected: passing.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/cycles apps/api/src/app.module.ts
git commit -m "feat(api): add cycles CRUD module"
```

---

## Task 12: Privacy acceptance endpoint

**Goal:** `POST /me/privacy/accept` sets `User.privacyAcceptedAt`. Frontend redirects to `/privacy` if this is null.

**Files:**
- Create: `apps/api/src/privacy/privacy.controller.ts`
- Create: `apps/api/src/privacy/privacy.module.ts`

- [ ] **Step 1: Create controller**

Create `apps/api/src/privacy/privacy.controller.ts`:

```ts
import { Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../auth/strategies/jwt.strategy.js';
import { UsersService } from '../users/users.service.js';

@Controller('me/privacy')
export class PrivacyController {
  constructor(private readonly users: UsersService) {}

  @Post('accept')
  async accept(@CurrentUser() current: JwtStrategyPayload) {
    const user = await this.users.acceptPrivacy(current.sub);
    return { privacyAcceptedAt: user.privacyAcceptedAt };
  }
}
```

- [ ] **Step 2: Create module**

Create `apps/api/src/privacy/privacy.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { PrivacyController } from './privacy.controller.js';

@Module({
  imports: [UsersModule],
  controllers: [PrivacyController],
})
export class PrivacyModule {}
```

- [ ] **Step 3: Wire into `AppModule`**

Add `PrivacyModule` to imports.

- [ ] **Step 4: Build check**

Run: `pnpm --filter @ics-select/api build`

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/privacy apps/api/src/app.module.ts
git commit -m "feat(api): add privacy acceptance endpoint"
```

---

## Task 13: Frontend auth client + provider

**Goal:** TanStack Query-based API client and an auth context that reads the access token from localStorage and refreshes via the cookie.

**Files:**
- Create: `apps/web/lib/api/client.ts`
- Create: `apps/web/lib/auth/auth-context.tsx`
- Create: `apps/web/lib/auth/use-current-user.ts`
- Modify: `apps/web/app/providers.tsx`
- Modify: `apps/web/package.json` (add `@tanstack/react-query`)

- [ ] **Step 1: Install TanStack Query**

Run: `pnpm --filter @ics-select/web add @tanstack/react-query`

- [ ] **Step 2: Create `apps/web/lib/api/client.ts`**

```ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export type ApiError = { code: string; message: string; details?: unknown };

let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) window.localStorage.setItem('ics_access_token', token);
    else window.localStorage.removeItem('ics_access_token');
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') {
    accessToken = window.localStorage.getItem('ics_access_token');
  }
  return accessToken;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  if (res.status === 401) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers.set('Authorization', `Bearer ${refreshed}`);
      const retry = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers,
        credentials: 'include',
      });
      return handleResponse<T>(retry);
    }
  }
  return handleResponse<T>(res);
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: ApiError } | null;
    throw new Error(body?.error?.message ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

async function tryRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { accessToken: string };
    setAccessToken(body.accessToken);
    return body.accessToken;
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Create `apps/web/lib/auth/auth-context.tsx`**

```tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, getAccessToken, setAccessToken } from '../api/client';

type User = {
  id: string;
  email: string;
  name: string;
  pictureUrl: string | null;
  role: 'ADMIN' | 'MEMBER';
  privacyAcceptedAt: string | null;
};

type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    getAccessToken();
    setHydrated(true);
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['me'],
    queryFn: () => apiFetch<User>('/me'),
    enabled: hydrated && !!getAccessToken(),
    retry: false,
  });

  const logout = async () => {
    await apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined);
    setAccessToken(null);
    queryClient.clear();
    if (typeof window !== 'undefined') window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user: data ?? null,
        isLoading: !hydrated || isLoading,
        logout,
        refetch: async () => {
          await refetch();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
```

- [ ] **Step 4: Update `apps/web/app/providers.tsx`**

Replace contents:

```tsx
'use client';

import { HeroUIProvider } from '@heroui/react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { AuthProvider } from '../lib/auth/auth-context';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider>
        <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
          <AuthProvider>{children}</AuthProvider>
        </NextThemesProvider>
      </HeroUIProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 5: Build check**

Run: `pnpm --filter @ics-select/web build`
Expected: compiles.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib apps/web/app/providers.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add api client and auth context"
```

---

## Task 14: Login page, privacy page, auth callback, app shell

**Goal:** The UX flow: logged-out → `/login`; clicking the Google button hits the backend; backend redirects to `/auth/callback?token=...`; callback stores the token and redirects based on privacy/role.

**Files:**
- Create: `apps/web/app/login/page.tsx`
- Create: `apps/web/app/auth/callback/page.tsx`
- Create: `apps/web/app/privacy/page.tsx`
- Create: `apps/web/app/(app)/layout.tsx`
- Create: `apps/web/app/(app)/page.tsx`
- Create: `apps/web/app/(app)/me/page.tsx`
- Create: `apps/web/components/nav/app-nav.tsx`
- Modify: `apps/web/app/page.tsx` (redirect to `/login` or `/(app)` based on auth)

- [ ] **Step 1: Create `apps/web/app/login/page.tsx`**

```tsx
'use client';

import { Button } from '@heroui/react';
import { LogIn } from 'lucide-react';

export default function LoginPage() {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">ICS Select</h1>
      <p className="max-w-md text-foreground/70">
        Programa de Preparação Avançada para Entrevistas Técnicas. Use seu email Inteli
        para entrar.
      </p>
      <Button
        as="a"
        href={`${apiBase}/auth/google`}
        color="primary"
        startContent={<LogIn className="h-4 w-4" aria-hidden="true" />}
      >
        Entrar com Google
      </Button>
    </main>
  );
}
```

- [ ] **Step 2: Create `apps/web/app/auth/callback/page.tsx`**

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setAccessToken } from '../../../lib/api/client';

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      router.replace('/login');
      return;
    }
    setAccessToken(token);
    router.replace('/');
  }, [params, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-foreground/60">Conectando...</p>
    </main>
  );
}
```

- [ ] **Step 3: Create `apps/web/app/privacy/page.tsx`**

```tsx
'use client';

import { Button, Card, CardBody, CardHeader } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch } from '../../lib/api/client';
import { useAuth } from '../../lib/auth/auth-context';

export default function PrivacyPage() {
  const router = useRouter();
  const { refetch } = useAuth();
  const [loading, setLoading] = useState(false);

  const accept = async () => {
    setLoading(true);
    try {
      await apiFetch('/me/privacy/accept', { method: 'POST' });
      await refetch();
      router.replace('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-semibold">Aviso de privacidade</h1>
        </CardHeader>
        <CardBody className="space-y-4 text-sm leading-relaxed text-foreground/80">
          <p>
            Para participar do ICS Select, a plataforma coleta seu nome, email Inteli e
            foto de perfil (via Google). A partir da Fase 3, também lerá sua agenda Google
            (eventos do Calendar) para agendar sessões de estudo, e guardará suas
            reflexões e feedback sobre os itens do plano semanal.
          </p>
          <p>
            O admin do programa (o diretor educacional) pode ver todas as reflexões e o
            progresso dos membros para calibrar os próximos planos. Nada é compartilhado
            com terceiros.
          </p>
          <p>
            Você pode exportar ou excluir todos os seus dados a qualquer momento via{' '}
            <code>GET /me/export</code> e <code>DELETE /me</code>.
          </p>
          <div className="pt-2">
            <Button color="primary" isLoading={loading} onPress={accept}>
              Aceito e quero continuar
            </Button>
          </div>
        </CardBody>
      </Card>
    </main>
  );
}
```

- [ ] **Step 4: Create `apps/web/components/nav/app-nav.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { Avatar, Button } from '@heroui/react';
import { useAuth } from '../../lib/auth/auth-context';

export function AppNav() {
  const { user, logout } = useAuth();
  if (!user) return null;

  return (
    <nav className="flex items-center justify-between border-b border-foreground/10 px-6 py-3">
      <Link href="/" className="text-lg font-semibold">
        ICS Select
      </Link>
      <div className="flex items-center gap-4 text-sm">
        {user.role === 'ADMIN' ? (
          <>
            <Link href="/admin/cycles" className="text-foreground/80 hover:text-foreground">
              Ciclos
            </Link>
            <Link href="/admin/members" className="text-foreground/80 hover:text-foreground">
              Membros
            </Link>
          </>
        ) : (
          <Link href="/me" className="text-foreground/80 hover:text-foreground">
            Meu plano
          </Link>
        )}
        <div className="flex items-center gap-2">
          <Avatar src={user.pictureUrl ?? undefined} name={user.name} size="sm" />
          <span className="hidden sm:inline">{user.name}</span>
        </div>
        <Button size="sm" variant="flat" onPress={logout}>
          Sair
        </Button>
      </div>
    </nav>
  );
}
```

- [ ] **Step 5: Create `apps/web/app/(app)/layout.tsx`**

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/auth-context';
import { AppNav } from '../../components/nav/app-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace('/login');
    else if (!user.privacyAcceptedAt) router.replace('/privacy');
  }, [user, isLoading, router]);

  if (isLoading || !user || !user.privacyAcceptedAt) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-foreground/60">Carregando...</p>
      </main>
    );
  }

  return (
    <div className="min-h-screen">
      <AppNav />
      <div className="p-6">{children}</div>
    </div>
  );
}
```

- [ ] **Step 6: Create `apps/web/app/(app)/page.tsx`**

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../lib/auth/auth-context';

export default function AppHome() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    router.replace(user.role === 'ADMIN' ? '/admin/cycles' : '/me');
  }, [user, router]);

  return <p className="text-foreground/60">Redirecionando...</p>;
}
```

- [ ] **Step 7: Create `apps/web/app/(app)/me/page.tsx`**

```tsx
'use client';

import { Card, CardBody, CardHeader } from '@heroui/react';
import { useAuth } from '../../../lib/auth/auth-context';

export default function MeHomePage() {
  const { user } = useAuth();
  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">Olá, {user?.name}</h1>
        </CardHeader>
        <CardBody className="text-foreground/70">
          Seu plano de estudos semanal aparecerá aqui a partir da Fase 4.
        </CardBody>
      </Card>
    </div>
  );
}
```

- [ ] **Step 8: Update the root `apps/web/app/page.tsx`**

Replace contents:

```tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../lib/auth/auth-context';

export default function RootPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace('/login');
    else if (!user.privacyAcceptedAt) router.replace('/privacy');
    else router.replace(user.role === 'ADMIN' ? '/admin/cycles' : '/me');
  }, [user, isLoading, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-foreground/60">Carregando...</p>
    </main>
  );
}
```

- [ ] **Step 9: Build check**

Run: `pnpm --filter @ics-select/web build`
Expected: compiles.

- [ ] **Step 10: Commit**

```bash
git add apps/web/app apps/web/components
git commit -m "feat(web): add login, privacy, auth callback, and app shell"
```

---

## Task 15: Admin cycles and members pages

**Goal:** Minimal admin UI for listing and creating cycles, viewing members (carometro).

**Files:**
- Create: `apps/web/app/(app)/admin/cycles/page.tsx`
- Create: `apps/web/app/(app)/admin/cycles/[id]/page.tsx`
- Create: `apps/web/app/(app)/admin/members/page.tsx`

- [ ] **Step 1: Cycles list + create form**

Create `apps/web/app/(app)/admin/cycles/page.tsx`:

```tsx
'use client';

import { Button, Card, CardBody, Input, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Table, TableBody, TableCell, TableColumn, TableHeader, TableRow, useDisclosure } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { apiFetch } from '../../../../lib/api/client';

type Cycle = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: 'ACTIVE' | 'ARCHIVED';
};

export default function AdminCyclesPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['cycles'],
    queryFn: () => apiFetch<Cycle[]>('/cycles'),
  });
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [form, setForm] = useState({ name: '', startsAt: '', endsAt: '' });

  const createMutation = useMutation({
    mutationFn: (payload: typeof form) =>
      apiFetch<Cycle>('/cycles', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cycles'] });
      onClose();
      setForm({ name: '', startsAt: '', endsAt: '' });
    },
  });

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ciclos</h1>
        <Button color="primary" onPress={onOpen}>
          Novo ciclo
        </Button>
      </div>
      <Card>
        <CardBody>
          {isLoading ? (
            <p>Carregando...</p>
          ) : (
            <Table aria-label="Ciclos">
              <TableHeader>
                <TableColumn>Nome</TableColumn>
                <TableColumn>Início</TableColumn>
                <TableColumn>Fim</TableColumn>
                <TableColumn>Status</TableColumn>
              </TableHeader>
              <TableBody emptyContent="Nenhum ciclo ainda.">
                {(data ?? []).map((cycle) => (
                  <TableRow key={cycle.id}>
                    <TableCell>
                      <Link href={`/admin/cycles/${cycle.id}`} className="font-medium">
                        {cycle.name}
                      </Link>
                    </TableCell>
                    <TableCell>{new Date(cycle.startsAt).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{new Date(cycle.endsAt).toLocaleDateString('pt-BR')}</TableCell>
                    <TableCell>{cycle.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Modal isOpen={isOpen} onClose={onClose}>
        <ModalContent>
          <ModalHeader>Novo ciclo</ModalHeader>
          <ModalBody className="space-y-3">
            <Input
              label="Nome"
              placeholder="2026.1"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <Input
              type="date"
              label="Início"
              value={form.startsAt}
              onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))}
            />
            <Input
              type="date"
              label="Fim"
              value={form.endsAt}
              onChange={(e) => setForm((f) => ({ ...f, endsAt: e.target.value }))}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={onClose}>
              Cancelar
            </Button>
            <Button
              color="primary"
              isLoading={createMutation.isPending}
              onPress={() => createMutation.mutate(form)}
            >
              Criar
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: Cycle detail page**

Create `apps/web/app/(app)/admin/cycles/[id]/page.tsx`:

```tsx
'use client';

import { Avatar, Card, CardBody, CardHeader } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import { use } from 'react';
import { apiFetch } from '../../../../../lib/api/client';

type CycleDetail = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  status: string;
  memberships: Array<{
    id: string;
    user: { id: string; name: string; email: string; pictureUrl: string | null };
  }>;
};

export default function AdminCycleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading } = useQuery({
    queryKey: ['cycle', id],
    queryFn: () => apiFetch<CycleDetail>(`/cycles/${id}`),
  });

  if (isLoading) return <p>Carregando...</p>;
  if (!data) return <p>Ciclo não encontrado.</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Card>
        <CardHeader>
          <h1 className="text-2xl font-semibold">{data.name}</h1>
        </CardHeader>
        <CardBody className="space-y-1 text-sm text-foreground/70">
          <p>
            {new Date(data.startsAt).toLocaleDateString('pt-BR')} —{' '}
            {new Date(data.endsAt).toLocaleDateString('pt-BR')}
          </p>
          <p>Status: {data.status}</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Membros ({data.memberships.length})</h2>
        </CardHeader>
        <CardBody>
          {data.memberships.length === 0 ? (
            <p className="text-foreground/60">Nenhum membro neste ciclo ainda.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {data.memberships.map((m) => (
                <li key={m.id} className="flex flex-col items-center gap-2 rounded-md border border-foreground/10 p-3">
                  <Avatar src={m.user.pictureUrl ?? undefined} name={m.user.name} size="lg" />
                  <span className="text-sm font-medium">{m.user.name}</span>
                  <span className="text-xs text-foreground/60">{m.user.email}</span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Members page**

Create `apps/web/app/(app)/admin/members/page.tsx`:

```tsx
'use client';

import { Avatar, Card, CardBody, Chip } from '@heroui/react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../../../lib/api/client';

type Member = {
  id: string;
  email: string;
  name: string;
  pictureUrl: string | null;
  role: 'ADMIN' | 'MEMBER';
};

export default function AdminMembersPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => apiFetch<Member[]>('/members'),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="text-2xl font-semibold">Membros</h1>
      <Card>
        <CardBody>
          {isLoading ? (
            <p>Carregando...</p>
          ) : (data ?? []).length === 0 ? (
            <p className="text-foreground/60">Nenhum membro cadastrado.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {(data ?? []).map((m) => (
                <li key={m.id} className="flex flex-col items-center gap-2 rounded-md border border-foreground/10 p-4">
                  <Avatar src={m.pictureUrl ?? undefined} name={m.name} size="lg" />
                  <span className="text-sm font-medium">{m.name}</span>
                  <span className="text-xs text-foreground/60">{m.email}</span>
                  <Chip size="sm" variant="flat" color={m.role === 'ADMIN' ? 'primary' : 'default'}>
                    {m.role}
                  </Chip>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
```

- [ ] **Step 4: Build**

Run: `pnpm --filter @ics-select/web build`
Expected: compiles.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(app\)/admin
git commit -m "feat(web): add admin cycles and members pages"
```

---

## Task 16: Playwright smoke test for login + admin flow

**Goal:** E2E test that mocks the Google OAuth flow and verifies the privacy gate + admin pages.

**Files:**
- Create: `apps/web/tests/auth-flow.spec.ts`

- [ ] **Step 1: Write the test**

Create `apps/web/tests/auth-flow.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe('Auth flow', () => {
  test('login page shows Google button', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('link', { name: 'Entrar com Google' })).toBeVisible();
  });

  test('unauthenticated root redirects to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('simulated logged-in admin sees cycles nav', async ({ page }) => {
    // Seed localStorage with a fake access token; the app will call /me with it.
    // We intercept /me to return an admin user that has accepted privacy.
    await page.route('**/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'u-1',
          email: 'admin@sou.inteli.edu.br',
          name: 'Admin Teste',
          pictureUrl: null,
          role: 'ADMIN',
          privacyAcceptedAt: new Date().toISOString(),
        }),
      });
    });
    await page.route('**/cycles', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.addInitScript(() => {
      window.localStorage.setItem('ics_access_token', 'fake.jwt.token');
    });

    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Ciclos' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Ciclos' })).toBeVisible();
  });
});
```

- [ ] **Step 2: Run Playwright**

Run: `pnpm --filter @ics-select/web test`
Expected: all tests pass. The pre-existing `home.spec.ts` tests still pass because `/` now redirects — update `home.spec.ts` to point at `/login` instead:

Modify `apps/web/tests/home.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test('shows the project name and tagline', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'ICS Select' })).toBeVisible();
    await expect(
      page.getByText('Programa de Preparação Avançada para Entrevistas Técnicas'),
    ).toBeVisible();
  });

  test('visual snapshot', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('login.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});
```

Regenerate snapshots: `pnpm --filter @ics-select/web test:update`.

- [ ] **Step 3: Final run**

Run: `pnpm --filter @ics-select/web test`
Expected: all Playwright tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/web/tests
git commit -m "test(web): add auth flow e2e tests and update landing snapshot"
```

---

## Task 17: Final verification and merge

**Goal:** Confirm Phase 1 is complete and the whole repo builds/tests green.

- [ ] **Step 1: Full test suite**

Run:
```bash
pnpm install
pnpm --filter @ics-select/shared build
pnpm --filter @ics-select/prisma exec prisma generate
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @ics-select/api test:e2e
```
Expected: everything passes.

- [ ] **Step 2: Local smoke (optional, requires docker)**

If Docker is running:
```bash
docker compose up -d postgres
pnpm --filter @ics-select/prisma exec prisma migrate deploy
```
Start the api (`pnpm --filter @ics-select/api dev`) and the web (`pnpm --filter @ics-select/web dev`) in separate shells. Open `http://localhost:3000/login` and click the Google button — expect a redirect to Google's consent screen (only works if real OAuth credentials are set in `apps/api/.env`).

- [ ] **Step 3: Git log check**

Run: `git log --oneline main..HEAD`
Expected: ~16 commits covering Tasks 1-16.

- [ ] **Step 4: Controller merges to main**

The human controller (or the subagent-driven workflow) merges this branch to `main` with `--no-ff` and tags as `v0.2.0`.

Phase 1 complete. Next: Phase 2 — acervo + busca semântica.

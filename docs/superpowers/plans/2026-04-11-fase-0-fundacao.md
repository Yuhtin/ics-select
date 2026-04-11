# ICS Select — Fase 0 (Fundação) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a working monorepo with a NestJS API exposing a tested `/health` endpoint, a Next.js + HeroUI web app with a static landing page verified by Playwright, Postgres + pgvector running via Docker Compose for local dev, a multi-stage Dockerfile for the API, a Caddy-fronted production compose file for the VPS, GitHub Actions for CI and deploy, and verifiable public endpoints at `https://ics-api.daviduarte.com.br/health` and `https://ics.daviduarte.com.br`.

**Architecture:** pnpm + Turborepo monorepo with `apps/api` (NestJS + Prisma), `apps/web` (Next.js 15 App Router + HeroUI), `packages/prisma` (schema + generated client), and `packages/shared` (Zod schemas + enums). The API runs in Docker on a VPS behind Caddy (TLS via Let's Encrypt). The web runs on Vercel. Postgres with the `pgvector` extension runs in the same Docker Compose as the API. No business models are introduced in Phase 0 — only the pgvector extension enablement migration.

**Tech Stack:** Node 20 LTS, pnpm 9, Turborepo 2, TypeScript 5, NestJS 10, Prisma 5 (with `postgresqlExtensions` preview), PostgreSQL 16 + pgvector 0.7, Zod, nestjs-pino, Next.js 15, HeroUI (`@heroui/react`), Tailwind CSS 4, lucide-react, next-themes, Playwright, Vitest (for shared unit tests), Jest + Supertest (for API tests), Docker Compose, Caddy, GitHub Actions.

---

## Pre-flight (manual steps done by the human)

These are **not** plan tasks — the engineer executing this plan should confirm they are done before starting. Document them explicitly so nothing is assumed.

1. **Domain DNS:** `daviduarte.com.br` is already owned. Create two A records pointing to the VPS public IP:
   - `ics-api.daviduarte.com.br` → VPS IP
   - `ics` (for `ics.daviduarte.com.br`) → Vercel's CNAME target (configured later in Vercel)
2. **VPS:** an Ubuntu 22.04+ VPS with Docker 24+ and Docker Compose v2, SSH access via key, public IP, ports 80 and 443 open.
3. **GitHub repo:** create `github.com/daviduarte/ics-select` (private) and configure it as the remote of the local repo (`git remote add origin ...`).
4. **Vercel:** create a project linked to the GitHub repo. Set **Root Directory** to `apps/web`. Set env var `NEXT_PUBLIC_API_URL=https://ics-api.daviduarte.com.br`. Add the custom domain `ics.daviduarte.com.br`.
5. **GitHub Secrets** (for the deploy workflow, created in Task 18):
   - `VPS_HOST` — VPS IP or hostname
   - `VPS_USER` — SSH user
   - `VPS_SSH_KEY` — private SSH key (PEM)
   - `GHCR_PAT` — GitHub Personal Access Token with `write:packages` scope (for pushing Docker images to `ghcr.io`)
6. **VPS preparation (one-time, documented in README):**
   - Create directory `/opt/ics-select`
   - Copy `docker-compose.prod.yml`, `Caddyfile`, and `.env` to that directory (the `.env` contains production secrets — never committed)
   - `docker login ghcr.io` with the PAT so the VPS can pull the image

The engineer verifies these are done, then starts Task 1.

---

## File Structure

Files created or modified in Phase 0, with their responsibilities:

### Repo root

| Path | Purpose |
|---|---|
| `package.json` | Workspace root manifest, scripts wiring Turborepo |
| `pnpm-workspace.yaml` | Declares workspace packages |
| `turbo.json` | Turborepo pipeline (lint, test, build, dev) |
| `tsconfig.base.json` | Shared TypeScript compiler options |
| `.editorconfig` | Editor consistency |
| `.node-version` | Pins Node 20 |
| `.nvmrc` | Same, for nvm users |
| `.gitignore` | Update existing |
| `.env.example` | Template for root-level env vars |
| `docker-compose.yml` | **Local dev** stack: postgres+pgvector |
| `docker-compose.prod.yml` | **Production** stack: api + postgres + caddy |
| `Dockerfile` | Multi-stage build for the API |
| `Caddyfile` | Reverse proxy for `ics-api.daviduarte.com.br` |
| `README.md` | Setup, deploy, operations |
| `.github/workflows/ci.yml` | Lint + test + build on PR and push |
| `.github/workflows/deploy.yml` | Build + push image + SSH deploy on push to `main` |

### packages/shared

| Path | Purpose |
|---|---|
| `packages/shared/package.json` | Package manifest |
| `packages/shared/tsconfig.json` | Extends base |
| `packages/shared/src/index.ts` | Re-exports everything |
| `packages/shared/src/version.ts` | Version constant (used by API health) |
| `packages/shared/src/version.test.ts` | Vitest unit test |
| `packages/shared/vitest.config.ts` | Vitest config |

### packages/prisma

| Path | Purpose |
|---|---|
| `packages/prisma/package.json` | Manifest with `prisma generate` script |
| `packages/prisma/tsconfig.json` | Extends base |
| `packages/prisma/prisma/schema.prisma` | Prisma datasource + pgvector extension (no models yet) |
| `packages/prisma/prisma/migrations/0_init/migration.sql` | `CREATE EXTENSION vector` |
| `packages/prisma/prisma/migrations/migration_lock.toml` | Lock file |
| `packages/prisma/src/index.ts` | Re-exports the generated client |

### apps/api

| Path | Purpose |
|---|---|
| `apps/api/package.json` | Manifest |
| `apps/api/tsconfig.json` | Extends base + NestJS |
| `apps/api/tsconfig.build.json` | Build-only tsconfig |
| `apps/api/nest-cli.json` | Nest CLI config |
| `apps/api/jest.config.js` | Jest for unit tests |
| `apps/api/test/jest-e2e.config.js` | Jest for e2e tests |
| `apps/api/.env.example` | Template |
| `apps/api/src/main.ts` | Bootstraps the app, configures CORS, logger, global pipes/filters |
| `apps/api/src/app.module.ts` | Root module |
| `apps/api/src/config/env.ts` | Zod-validated env loader |
| `apps/api/src/config/env.spec.ts` | Unit tests for env validation |
| `apps/api/src/common/prisma/prisma.service.ts` | Injectable Prisma client |
| `apps/api/src/common/prisma/prisma.module.ts` | Global module |
| `apps/api/src/common/filters/http-exception.filter.ts` | Unified error format |
| `apps/api/src/common/filters/http-exception.filter.spec.ts` | Filter tests |
| `apps/api/src/health/health.module.ts` | Module |
| `apps/api/src/health/health.controller.ts` | `GET /health` |
| `apps/api/src/health/health.controller.spec.ts` | Unit test |
| `apps/api/test/health.e2e-spec.ts` | e2e test hitting real boot |

### apps/web

| Path | Purpose |
|---|---|
| `apps/web/package.json` | Manifest |
| `apps/web/tsconfig.json` | Next.js TS config |
| `apps/web/next.config.mjs` | Next config |
| `apps/web/tailwind.config.ts` | Tailwind + HeroUI content paths |
| `apps/web/postcss.config.mjs` | PostCSS config |
| `apps/web/.env.example` | Template |
| `apps/web/app/layout.tsx` | Root layout with ThemeProvider + HeroUIProvider |
| `apps/web/app/providers.tsx` | Client component wrapping providers |
| `apps/web/app/page.tsx` | Static landing page |
| `apps/web/app/globals.css` | Tailwind entry |
| `apps/web/playwright.config.ts` | Playwright config |
| `apps/web/tests/home.spec.ts` | Visual + content test of landing |

---

## Task 1: Initialize monorepo root

**Goal:** Lay down the workspace scaffolding so pnpm and Turborepo can orchestrate all packages. No code yet.

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `turbo.json`
- Create: `tsconfig.base.json`
- Create: `.editorconfig`
- Create: `.node-version`
- Create: `.nvmrc`
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Create `package.json` at repo root**

```json
{
  "name": "ics-select",
  "version": "0.1.0",
  "private": true,
  "packageManager": "pnpm@9.12.0",
  "engines": {
    "node": ">=20.0.0 <21.0.0"
  },
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "db:generate": "pnpm --filter @ics-select/prisma exec prisma generate",
    "db:migrate": "pnpm --filter @ics-select/prisma exec prisma migrate dev",
    "db:deploy": "pnpm --filter @ics-select/prisma exec prisma migrate deploy"
  },
  "devDependencies": {
    "turbo": "^2.1.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**", "generated/**"]
    },
    "lint": {},
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

- [ ] **Step 4: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  },
  "exclude": ["node_modules", "dist", ".next", "generated"]
}
```

- [ ] **Step 5: Create `.editorconfig`**

```
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

- [ ] **Step 6: Create `.node-version` and `.nvmrc`**

Both files contain:
```
20
```

- [ ] **Step 7: Create `.env.example` at repo root**

```env
# Root-level env vars used by docker-compose for local dev
POSTGRES_USER=ics
POSTGRES_PASSWORD=ics_dev_password
POSTGRES_DB=ics_select
POSTGRES_PORT=5432
```

- [ ] **Step 8: Update `.gitignore`**

Replace contents of existing `.gitignore` with:
```
node_modules/
dist/
.env
.env.local
.env.*.local
.next/
.turbo/
*.log
.DS_Store
coverage/
playwright-report/
test-results/
generated/
!packages/prisma/generated/.gitkeep
```

- [ ] **Step 9: Install root deps**

Run: `pnpm install`
Expected: creates `pnpm-lock.yaml`, installs turbo and typescript at the root. No workspace packages exist yet so warnings about empty workspace are OK.

- [ ] **Step 10: Verify turbo works**

Run: `pnpm turbo --version`
Expected: prints `2.x.x`.

- [ ] **Step 11: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.base.json .editorconfig .node-version .nvmrc .env.example .gitignore
git commit -m "chore: scaffold pnpm + Turborepo monorepo root"
```

---

## Task 2: Create `packages/shared` with a tested version constant

**Goal:** Validate that workspaces are wired correctly by creating the smallest possible shared package with a Vitest unit test.

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/vitest.config.ts`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/version.ts`
- Create: `packages/shared/src/version.test.ts`

- [ ] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@ics-select/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "echo \"(shared) no lint yet\"",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "build": "echo \"(shared) built-in via consumers\""
  },
  "devDependencies": {
    "vitest": "^2.1.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create `packages/shared/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
```

- [ ] **Step 4: Write the failing test first**

Create `packages/shared/src/version.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { APP_VERSION } from './version.js';

describe('APP_VERSION', () => {
  it('is a non-empty semver-ish string', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+/);
  });
});
```

Create `packages/shared/src/index.ts`:
```ts
export * from './version.js';
```

- [ ] **Step 5: Install shared deps and run test to confirm failure**

Run:
```bash
pnpm install
pnpm --filter @ics-select/shared test
```
Expected: Vitest fails because `./version.js` does not exist.

- [ ] **Step 6: Write minimal implementation**

Create `packages/shared/src/version.ts`:
```ts
export const APP_VERSION = '0.1.0';
```

- [ ] **Step 7: Run test to verify it passes**

Run: `pnpm --filter @ics-select/shared test`
Expected: 1 passing test.

- [ ] **Step 8: Verify typecheck**

Run: `pnpm --filter @ics-select/shared typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/shared pnpm-lock.yaml package.json
git commit -m "feat(shared): scaffold shared package with tested APP_VERSION"
```

---

## Task 3: Create `packages/prisma` with pgvector migration

**Goal:** Put the Prisma schema and a single migration that enables the `pgvector` extension. No domain models yet — those come in Phase 1.

**Files:**
- Create: `packages/prisma/package.json`
- Create: `packages/prisma/tsconfig.json`
- Create: `packages/prisma/prisma/schema.prisma`
- Create: `packages/prisma/prisma/migrations/0_init/migration.sql`
- Create: `packages/prisma/prisma/migrations/migration_lock.toml`
- Create: `packages/prisma/src/index.ts`
- Create: `packages/prisma/generated/.gitkeep`

- [ ] **Step 1: Create `packages/prisma/package.json`**

```json
{
  "name": "@ics-select/prisma",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "echo \"(prisma) no lint\"",
    "typecheck": "tsc --noEmit",
    "test": "echo \"(prisma) no tests\"",
    "build": "prisma generate",
    "postinstall": "prisma generate || echo \"(prisma) skipping generate, will run later\""
  },
  "devDependencies": {
    "prisma": "^5.22.0",
    "typescript": "^5.6.0"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0"
  }
}
```

- [ ] **Step 2: Create `packages/prisma/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "generated", "dist"]
}
```

- [ ] **Step 3: Create `packages/prisma/prisma/schema.prisma`**

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
```

- [ ] **Step 4: Create the initial migration directory**

Create `packages/prisma/prisma/migrations/migration_lock.toml`:
```toml
provider = "postgresql"
```

Create `packages/prisma/prisma/migrations/0_init/migration.sql`:
```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS "vector";
```

- [ ] **Step 5: Create `packages/prisma/src/index.ts`**

```ts
export * from '../generated/client/index.js';
export { PrismaClient } from '../generated/client/index.js';
```

- [ ] **Step 6: Create `packages/prisma/generated/.gitkeep`**

Empty file. Ensures the directory exists so the `!packages/prisma/generated/.gitkeep` line in `.gitignore` has something to keep.

- [ ] **Step 7: Install Prisma deps**

Run: `pnpm install`
Expected: installs `prisma` and `@prisma/client` in `packages/prisma`. `postinstall` may fail silently at this point because there is no database yet — that is fine.

- [ ] **Step 8: Generate the client against the schema**

Run: `pnpm --filter @ics-select/prisma exec prisma generate`
Expected: creates `packages/prisma/generated/client/` with the generated Prisma client. No database needed for `generate`.

- [ ] **Step 9: Verify typecheck**

Run: `pnpm --filter @ics-select/prisma typecheck`
Expected: no errors (the re-export from `index.ts` resolves).

- [ ] **Step 10: Commit**

```bash
git add packages/prisma pnpm-lock.yaml
git commit -m "feat(prisma): scaffold schema with pgvector extension migration"
```

---

## Task 4: Scaffold `apps/api` with NestJS skeleton

**Goal:** Create the NestJS application skeleton that boots, without any feature modules yet.

**Files:**
- Create: `apps/api/package.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/tsconfig.build.json`
- Create: `apps/api/nest-cli.json`
- Create: `apps/api/jest.config.js`
- Create: `apps/api/.env.example`
- Create: `apps/api/src/main.ts`
- Create: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create `apps/api/package.json`**

```json
{
  "name": "@ics-select/api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "node dist/main.js",
    "lint": "eslint \"src/**/*.ts\" \"test/**/*.ts\"",
    "typecheck": "tsc --noEmit",
    "test": "jest",
    "test:e2e": "jest --config test/jest-e2e.config.js"
  },
  "dependencies": {
    "@ics-select/prisma": "workspace:*",
    "@ics-select/shared": "workspace:*",
    "@nestjs/common": "^10.4.0",
    "@nestjs/config": "^3.3.0",
    "@nestjs/core": "^10.4.0",
    "@nestjs/platform-express": "^10.4.0",
    "nestjs-pino": "^4.1.0",
    "pino": "^9.5.0",
    "pino-http": "^10.3.0",
    "pino-pretty": "^11.3.0",
    "reflect-metadata": "^0.2.2",
    "rxjs": "^7.8.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@nestjs/cli": "^10.4.0",
    "@nestjs/schematics": "^10.2.0",
    "@nestjs/testing": "^10.4.0",
    "@types/express": "^5.0.0",
    "@types/jest": "^29.5.13",
    "@types/node": "^20.16.0",
    "@types/supertest": "^6.0.2",
    "@typescript-eslint/eslint-plugin": "^8.8.0",
    "@typescript-eslint/parser": "^8.8.0",
    "eslint": "^9.12.0",
    "jest": "^29.7.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "ts-node": "^10.9.2",
    "tsconfig-paths": "^4.2.0",
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: Create `apps/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./",
    "baseUrl": "./",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "declaration": false,
    "sourceMap": true,
    "incremental": true,
    "strictNullChecks": true,
    "noImplicitAny": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create `apps/api/tsconfig.build.json`**

```json
{
  "extends": "./tsconfig.json",
  "exclude": ["node_modules", "test", "dist", "**/*.spec.ts"]
}
```

- [ ] **Step 4: Create `apps/api/nest-cli.json`**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **Step 5: Create `apps/api/jest.config.js`**

```js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
};
```

- [ ] **Step 6: Create `apps/api/test/jest-e2e.config.js`**

```js
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testRegex: '.e2e-spec.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
};
```

- [ ] **Step 7: Create `apps/api/.env.example`**

```env
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://ics:ics_dev_password@localhost:5432/ics_select?schema=public
CORS_ALLOWED_ORIGINS=http://localhost:3000
LOG_LEVEL=debug
```

- [ ] **Step 8: Create `apps/api/src/main.ts`** (placeholder, will be expanded later)

```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on port ${port}`);
}

void bootstrap();
```

- [ ] **Step 9: Create `apps/api/src/app.module.ts`** (empty root module)

```ts
import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

- [ ] **Step 10: Install API deps**

Run: `pnpm install`
Expected: installs NestJS and friends under `apps/api/node_modules`.

- [ ] **Step 11: Verify build works**

Run: `pnpm --filter @ics-select/api build`
Expected: creates `apps/api/dist/main.js`. No runtime errors.

- [ ] **Step 12: Commit**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): scaffold NestJS skeleton"
```

---

## Task 5: Add Zod-validated env config with unit tests (TDD)

**Goal:** Make the API fail fast at boot if required env vars are missing or malformed. Use Zod.

**Files:**
- Create: `apps/api/src/config/env.ts`
- Create: `apps/api/src/config/env.spec.ts`

- [ ] **Step 1: Write the failing test first**

Create `apps/api/src/config/env.spec.ts`:
```ts
import { loadEnv } from './env';

describe('loadEnv', () => {
  const baseEnv = {
    NODE_ENV: 'test',
    PORT: '3001',
    DATABASE_URL: 'postgresql://u:p@localhost:5432/db?schema=public',
    CORS_ALLOWED_ORIGINS: 'http://localhost:3000',
    LOG_LEVEL: 'debug',
  };

  it('parses a valid env object', () => {
    const env = loadEnv(baseEnv);
    expect(env.NODE_ENV).toBe('test');
    expect(env.PORT).toBe(3001);
    expect(env.DATABASE_URL).toBe(baseEnv.DATABASE_URL);
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(['http://localhost:3000']);
    expect(env.LOG_LEVEL).toBe('debug');
  });

  it('splits CORS_ALLOWED_ORIGINS on comma', () => {
    const env = loadEnv({
      ...baseEnv,
      CORS_ALLOWED_ORIGINS: 'https://a.com,https://b.com',
    });
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(['https://a.com', 'https://b.com']);
  });

  it('throws when DATABASE_URL is missing', () => {
    const { DATABASE_URL, ...incomplete } = baseEnv;
    expect(() => loadEnv(incomplete)).toThrow(/DATABASE_URL/);
  });

  it('throws when PORT is not a number', () => {
    expect(() => loadEnv({ ...baseEnv, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('defaults LOG_LEVEL to info when omitted', () => {
    const { LOG_LEVEL, ...withoutLogLevel } = baseEnv;
    const env = loadEnv(withoutLogLevel);
    expect(env.LOG_LEVEL).toBe('info');
  });
});
```

- [ ] **Step 2: Run the test to confirm failure**

Run: `pnpm --filter @ics-select/api test`
Expected: fails with "Cannot find module './env'" or similar.

- [ ] **Step 3: Implement `env.ts`**

Create `apps/api/src/config/env.ts`:
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

Run: `pnpm --filter @ics-select/api test`
Expected: all 5 tests pass.

- [ ] **Step 5: Use `loadEnv` in `main.ts`**

Update `apps/api/src/main.ts`:
```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule);
  await app.listen(env.PORT);
  // eslint-disable-next-line no-console
  console.log(`API listening on port ${env.PORT}`);
}

void bootstrap();
```

- [ ] **Step 6: Verify build still works**

Run: `pnpm --filter @ics-select/api build`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/config apps/api/src/main.ts
git commit -m "feat(api): add Zod-validated env loader"
```

---

## Task 6: Add `PrismaService` as a global module

**Goal:** Provide a single, injectable Prisma client that connects on module init and disconnects on shutdown.

**Files:**
- Create: `apps/api/src/common/prisma/prisma.service.ts`
- Create: `apps/api/src/common/prisma/prisma.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create `PrismaService`**

Create `apps/api/src/common/prisma/prisma.service.ts`:
```ts
import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@ics-select/prisma';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }
}
```

- [ ] **Step 2: Create `PrismaModule`**

Create `apps/api/src/common/prisma/prisma.module.ts`:
```ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 3: Wire `PrismaModule` into `AppModule`**

Update `apps/api/src/app.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

- [ ] **Step 4: Verify build**

Run: `pnpm --filter @ics-select/api build`
Expected: builds cleanly. No runtime test here because Prisma connection needs a real DB (validated later in Task 14).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/common/prisma apps/api/src/app.module.ts
git commit -m "feat(api): add PrismaService as global module"
```

---

## Task 7: Add `/health` endpoint with TDD

**Goal:** Expose `GET /health` that returns `{ status, version, uptime }`. TDD: unit test first, then implementation.

**Files:**
- Create: `apps/api/src/health/health.controller.spec.ts`
- Create: `apps/api/src/health/health.controller.ts`
- Create: `apps/api/src/health/health.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Write the failing test first**

Create `apps/api/src/health/health.controller.spec.ts`:
```ts
import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();
    controller = moduleRef.get(HealthController);
  });

  it('returns status ok', () => {
    const result = controller.health();
    expect(result.status).toBe('ok');
  });

  it('returns a semver version', () => {
    const result = controller.health();
    expect(result.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('returns a non-negative uptime in seconds', () => {
    const result = controller.health();
    expect(typeof result.uptimeSeconds).toBe('number');
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern health`
Expected: Fails with "Cannot find module './health.controller'".

- [ ] **Step 3: Implement the controller**

Create `apps/api/src/health/health.controller.ts`:
```ts
import { Controller, Get } from '@nestjs/common';
import { APP_VERSION } from '@ics-select/shared';

@Controller('health')
export class HealthController {
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

- [ ] **Step 4: Create `HealthModule`**

Create `apps/api/src/health/health.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
```

- [ ] **Step 5: Wire `HealthModule` into `AppModule`**

Update `apps/api/src/app.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [PrismaModule, HealthModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern health`
Expected: all 3 tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/health apps/api/src/app.module.ts
git commit -m "feat(api): add tested /health endpoint"
```

---

## Task 8: Add e2e test booting the real app and hitting `/health`

**Goal:** Verify the whole stack (module wiring + HTTP server) works end-to-end against the real `AppModule`, without a real database.

**Files:**
- Create: `apps/api/test/health.e2e-spec.ts`
- Modify: `apps/api/src/common/prisma/prisma.service.ts` (safer connect for tests)

- [ ] **Step 1: Make `PrismaService.onModuleInit` safe when DB is not reachable**

Update `apps/api/src/common/prisma/prisma.service.ts` to swallow connection errors in test mode so the e2e test can run without spinning up a real DB:

```ts
import { Injectable, OnModuleDestroy, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaClient } from '@ics-select/prisma';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Prisma connected');
    } catch (err) {
      if (process.env.NODE_ENV === 'test') {
        this.logger.warn(`Prisma connect skipped in test: ${(err as Error).message}`);
        return;
      }
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
    } catch {
      // ignore
    }
  }
}
```

- [ ] **Step 2: Write the e2e test**

Create `apps/api/test/health.e2e-spec.ts`:
```ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('GET /health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/unused?schema=public';
    process.env.CORS_ALLOWED_ORIGINS = 'http://localhost:3000';
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 200 with status ok', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.version).toMatch(/^\d+\.\d+\.\d+/);
    expect(typeof res.body.uptimeSeconds).toBe('number');
  });
});
```

- [ ] **Step 3: Run e2e test**

Run: `pnpm --filter @ics-select/api test:e2e`
Expected: passes (the Prisma connect warning is logged but does not fail).

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/common/prisma/prisma.service.ts apps/api/test/health.e2e-spec.ts
git commit -m "test(api): add e2e test for /health"
```

---

## Task 9: Configure CORS, global validation pipe, and pino logger in `main.ts`

**Goal:** Finish the boot configuration: restricted CORS, Zod-integration-friendly validation, structured logging.

**Files:**
- Modify: `apps/api/src/main.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Update `main.ts`**

Replace `apps/api/src/main.ts`:
```ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';
import { loadEnv } from './config/env.js';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.useLogger(app.get(Logger));

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

- [ ] **Step 2: Add `LoggerModule` to `AppModule`**

Update `apps/api/src/app.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
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
    HealthModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
```

- [ ] **Step 3: Verify build**

Run: `pnpm --filter @ics-select/api build`
Expected: no errors.

- [ ] **Step 4: Verify e2e test still passes**

Run: `pnpm --filter @ics-select/api test:e2e`
Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/main.ts apps/api/src/app.module.ts
git commit -m "feat(api): configure CORS and pino logger on boot"
```

---

## Task 10: Add global HTTP exception filter with standardized error format

**Goal:** Convert any thrown error into the standardized `{ error: { code, message, details? } }` shape defined in the spec.

**Files:**
- Create: `apps/api/src/common/filters/http-exception.filter.ts`
- Create: `apps/api/src/common/filters/http-exception.filter.spec.ts`
- Modify: `apps/api/src/main.ts`

- [ ] **Step 1: Write the failing test first**

Create `apps/api/src/common/filters/http-exception.filter.spec.ts`:
```ts
import { ArgumentsHost, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

function mockHost(): { host: ArgumentsHost; statusArg: number | null; jsonArg: unknown } {
  const state: { statusArg: number | null; jsonArg: unknown } = {
    statusArg: null,
    jsonArg: null,
  };
  const response = {
    status(code: number) {
      state.statusArg = code;
      return this;
    },
    json(body: unknown) {
      state.jsonArg = body;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url: '/test' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, ...state };
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('formats a BadRequestException as VALIDATION_ERROR', () => {
    const captured = mockHost();
    const exc = new BadRequestException('bad input');
    filter.catch(exc, captured.host);
    const response = (captured.host.switchToHttp().getResponse() as { status: unknown; json: unknown }) as any;
    // We rely on the mock — reassign so the assertions see the final state.
  });
});
```

Note: the test above uses a minimal mock. We validate behavior through the actual payload the filter sends. Replace the test body with a cleaner implementation:

```ts
import { ArgumentsHost, BadRequestException, HttpException, HttpStatus, InternalServerErrorException } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

type Captured = { status?: number; body?: unknown };

function mockHost(): { host: ArgumentsHost; captured: Captured } {
  const captured: Captured = {};
  const res = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: unknown) {
      captured.body = body;
      return this;
    },
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => res,
      getRequest: () => ({ url: '/test' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, captured };
}

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();

  it('maps BadRequestException to 400 VALIDATION_ERROR', () => {
    const { host, captured } = mockHost();
    filter.catch(new BadRequestException('bad input'), host);
    expect(captured.status).toBe(400);
    expect(captured.body).toMatchObject({
      error: { code: 'VALIDATION_ERROR', message: 'bad input' },
    });
  });

  it('maps InternalServerErrorException to 500 INTERNAL', () => {
    const { host, captured } = mockHost();
    filter.catch(new InternalServerErrorException('kapow'), host);
    expect(captured.status).toBe(500);
    expect(captured.body).toMatchObject({
      error: { code: 'INTERNAL' },
    });
  });

  it('maps unknown errors to 500 INTERNAL without leaking message', () => {
    const { host, captured } = mockHost();
    filter.catch(new Error('db password is hunter2'), host);
    expect(captured.status).toBe(500);
    expect((captured.body as { error: { message: string } }).error.message).not.toContain('hunter2');
  });
});
```

- [ ] **Step 2: Run the test to confirm failure**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern http-exception`
Expected: Fails with "Cannot find module './http-exception.filter'".

- [ ] **Step 3: Implement the filter**

Create `apps/api/src/common/filters/http-exception.filter.ts`:
```ts
import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

type ErrorPayload = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const { status, payload } = this.map(exception);

    if (status >= 500) {
      this.logger.error(exception);
    }

    response.status(status).json(payload);
  }

  private map(exception: unknown): { status: number; payload: ErrorPayload } {
    if (exception instanceof BadRequestException) {
      return {
        status: 400,
        payload: {
          error: { code: 'VALIDATION_ERROR', message: exception.message },
        },
      };
    }
    if (exception instanceof UnauthorizedException) {
      return {
        status: 401,
        payload: { error: { code: 'UNAUTHENTICATED', message: exception.message } },
      };
    }
    if (exception instanceof ForbiddenException) {
      return {
        status: 403,
        payload: { error: { code: 'FORBIDDEN', message: exception.message } },
      };
    }
    if (exception instanceof NotFoundException) {
      return {
        status: 404,
        payload: { error: { code: 'NOT_FOUND', message: exception.message } },
      };
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return {
        status,
        payload: {
          error: {
            code: status >= 500 ? 'INTERNAL' : 'HTTP_ERROR',
            message: status >= 500 ? 'Internal server error' : exception.message,
          },
        },
      };
    }
    return {
      status: 500,
      payload: { error: { code: 'INTERNAL', message: 'Internal server error' } },
    };
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern http-exception`
Expected: all 3 tests pass.

- [ ] **Step 5: Wire the filter globally in `main.ts`**

Update `apps/api/src/main.ts`:
```ts
import 'reflect-metadata';
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

- [ ] **Step 6: Run all API tests**

Run: `pnpm --filter @ics-select/api test && pnpm --filter @ics-select/api test:e2e`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/common/filters apps/api/src/main.ts
git commit -m "feat(api): add global http exception filter"
```

---

## Task 11: Scaffold `apps/web` Next.js 15 app with HeroUI + Tailwind + next-themes

**Goal:** Create the frontend app with HeroUI provider, light/dark theme wiring, and a static landing page.

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.mjs`
- Create: `apps/web/postcss.config.mjs`
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/.env.example`
- Create: `apps/web/app/globals.css`
- Create: `apps/web/app/providers.tsx`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "@ics-select/web",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3000",
    "build": "next build",
    "start": "next start -p 3000",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "playwright test",
    "test:update": "playwright test --update-snapshots"
  },
  "dependencies": {
    "@heroui/react": "^2.4.0",
    "@ics-select/shared": "workspace:*",
    "framer-motion": "^11.11.0",
    "lucide-react": "^0.454.0",
    "next": "^15.0.0",
    "next-themes": "^0.3.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.48.0",
    "@types/node": "^20.16.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.20",
    "eslint": "^9.12.0",
    "eslint-config-next": "^15.0.0",
    "postcss": "^8.4.47",
    "tailwindcss": "^3.4.14",
    "typescript": "^5.6.0"
  }
}
```

Note: `tailwindcss` is pinned to v3 here because HeroUI v2.x does not yet officially support Tailwind v4. If HeroUI adds v4 support before this task runs, bump accordingly.

- [ ] **Step 2: Create `apps/web/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules", "tests"]
}
```

- [ ] **Step 3: Create `apps/web/next.config.mjs`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@heroui/react'],
};

export default nextConfig;
```

- [ ] **Step 4: Create `apps/web/postcss.config.mjs`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Create `apps/web/tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss';
import { heroui } from '@heroui/react';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {},
  },
  darkMode: 'class',
  plugins: [heroui()],
};

export default config;
```

- [ ] **Step 6: Create `apps/web/.env.example`**

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

- [ ] **Step 7: Create `apps/web/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  color-scheme: light dark;
}

html,
body {
  height: 100%;
}
```

- [ ] **Step 8: Create `apps/web/app/providers.tsx`**

```tsx
'use client';

import { HeroUIProvider } from '@heroui/react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <HeroUIProvider>
      <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
      </NextThemesProvider>
    </HeroUIProvider>
  );
}
```

- [ ] **Step 9: Create `apps/web/app/layout.tsx`**

```tsx
import type { Metadata } from 'next';
import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  title: 'ICS Select',
  description: 'Programa de Preparação Avançada para Entrevistas Técnicas',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 10: Create `apps/web/app/page.tsx`**

```tsx
import { GraduationCap } from 'lucide-react';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex items-center gap-3">
        <GraduationCap className="h-8 w-8" aria-hidden="true" />
        <h1 className="text-4xl font-semibold tracking-tight">ICS Select</h1>
      </div>
      <p className="max-w-xl text-lg text-foreground/70">
        Programa de Preparação Avançada para Entrevistas Técnicas — Inteli Consulting Society.
      </p>
      <p className="text-sm text-foreground/50">Em breve.</p>
    </main>
  );
}
```

- [ ] **Step 11: Install web deps**

Run: `pnpm install`
Expected: installs Next.js, HeroUI, Tailwind, etc.

- [ ] **Step 12: Verify build**

Run: `pnpm --filter @ics-select/web build`
Expected: Next.js builds cleanly. A `.next/` directory is created. No runtime errors.

- [ ] **Step 13: Verify dev server starts (quick sanity check)**

Run: `pnpm --filter @ics-select/web dev`
Wait 3 seconds, then open `http://localhost:3000` in a browser (or `curl -sS http://localhost:3000 | grep 'ICS Select'`). Expected: HTML contains `ICS Select`.
Stop the dev server (Ctrl+C).

- [ ] **Step 14: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat(web): scaffold Next.js 15 + HeroUI landing page"
```

---

## Task 12: Add Playwright tests for the landing page

**Goal:** Lock in the visual baseline for the landing page with a Playwright snapshot and a content check. First visual test of the project.

**Files:**
- Create: `apps/web/playwright.config.ts`
- Create: `apps/web/tests/home.spec.ts`

- [ ] **Step 1: Create `apps/web/playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 5'] } },
  ],
});
```

- [ ] **Step 2: Write the test**

Create `apps/web/tests/home.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test('shows the project name and tagline', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'ICS Select' })).toBeVisible();
    await expect(
      page.getByText('Programa de Preparação Avançada para Entrevistas Técnicas'),
    ).toBeVisible();
  });

  test('visual snapshot', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page).toHaveScreenshot('home.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.02,
    });
  });
});
```

- [ ] **Step 3: Install Playwright browsers**

Run: `pnpm --filter @ics-select/web exec playwright install chromium`
Expected: downloads Chromium binary.

- [ ] **Step 4: Generate baseline snapshot**

Run: `pnpm --filter @ics-select/web exec playwright test --update-snapshots`
Expected: both tests pass; snapshot file is created under `apps/web/tests/home.spec.ts-snapshots/`.

- [ ] **Step 5: Run the test without updating to verify stability**

Run: `pnpm --filter @ics-select/web test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/web/playwright.config.ts apps/web/tests
git commit -m "test(web): add Playwright content and visual tests for landing"
```

---

## Task 13: Create local dev `docker-compose.yml` for Postgres + pgvector

**Goal:** Let an engineer start Postgres with pgvector for local development with a single command.

**Files:**
- Create: `docker-compose.yml`
- Modify: `apps/api/.env.example` (confirm DATABASE_URL matches)

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: ics-select-postgres
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-ics}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-ics_dev_password}
      POSTGRES_DB: ${POSTGRES_DB:-ics_select}
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - ics_select_pg:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-ics} -d ${POSTGRES_DB:-ics_select}"]
      interval: 5s
      timeout: 5s
      retries: 10

volumes:
  ics_select_pg:
```

- [ ] **Step 2: Start the stack**

Run: `cp .env.example .env && docker compose up -d postgres`
Expected: container `ics-select-postgres` starts and reports healthy within ~10 seconds.

- [ ] **Step 3: Apply the Prisma migration**

Run:
```bash
export DATABASE_URL="postgresql://ics:ics_dev_password@localhost:5432/ics_select?schema=public"
pnpm --filter @ics-select/prisma exec prisma migrate deploy
```
Expected: output includes "1 migration applied" and the `vector` extension is created.

- [ ] **Step 4: Verify pgvector is enabled**

Run:
```bash
docker exec -it ics-select-postgres psql -U ics -d ics_select -c "SELECT extname FROM pg_extension WHERE extname='vector';"
```
Expected: one row with `vector`.

- [ ] **Step 5: Start the API locally and hit /health**

Run in a separate terminal:
```bash
cp apps/api/.env.example apps/api/.env
pnpm --filter @ics-select/api dev
```
Wait ~5 seconds, then in another terminal:
```bash
curl -s http://localhost:3001/health
```
Expected: JSON with `"status":"ok"`, `"version":"0.1.0"`, `"uptimeSeconds":<number>`.
Stop the dev server.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: add local dev docker-compose with postgres+pgvector"
```

---

## Task 14: Create multi-stage `Dockerfile` for the API

**Goal:** Produce a minimal runtime image for `apps/api` that pulls workspace dependencies correctly via `pnpm deploy`.

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Create `.dockerignore`**

```
node_modules
**/node_modules
.git
.github
.next
.turbo
apps/web
packages/shared/vitest.config.ts
dist
coverage
playwright-report
test-results
docs
*.log
.env*
!.env.example
```

- [ ] **Step 2: Create `Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=20-alpine

# Stage 1: deps
FROM node:${NODE_VERSION} AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/prisma/package.json packages/prisma/
RUN pnpm install --frozen-lockfile

# Stage 2: build
FROM deps AS build
COPY packages/shared packages/shared
COPY packages/prisma packages/prisma
COPY apps/api apps/api
RUN pnpm --filter @ics-select/prisma exec prisma generate
RUN pnpm --filter @ics-select/api build
RUN pnpm --filter @ics-select/api deploy --prod /out

# Stage 3: runtime
FROM node:${NODE_VERSION} AS runtime
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/dist ./dist
COPY --from=build /repo/packages/prisma/generated ./node_modules/@ics-select/prisma/generated
COPY --from=build /repo/packages/prisma/prisma ./node_modules/@ics-select/prisma/prisma
EXPOSE 3001
CMD ["node", "dist/main.js"]
```

- [ ] **Step 3: Build the image locally**

Run: `docker build -t ics-select-api:dev .`
Expected: the build completes, final image size is reasonable (under ~250MB).

- [ ] **Step 4: Run the image against the local postgres**

Run:
```bash
docker run --rm \
  --network host \
  -e NODE_ENV=production \
  -e PORT=3001 \
  -e DATABASE_URL="postgresql://ics:ics_dev_password@localhost:5432/ics_select?schema=public" \
  -e CORS_ALLOWED_ORIGINS="http://localhost:3000" \
  -e LOG_LEVEL=info \
  --name ics-api-test \
  ics-select-api:dev &
sleep 3
curl -s http://localhost:3001/health
docker stop ics-api-test || true
```
Expected: `/health` returns `{ "status": "ok", ... }`.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile .dockerignore
git commit -m "chore: add multi-stage Dockerfile for api"
```

---

## Task 15: Create production `docker-compose.prod.yml` + `Caddyfile`

**Goal:** Provide the exact stack files that will run on the VPS — API, Postgres, Caddy with TLS for `ics-api.daviduarte.com.br`.

**Files:**
- Create: `docker-compose.prod.yml`
- Create: `Caddyfile`
- Create: `.env.prod.example`

- [ ] **Step 1: Create `docker-compose.prod.yml`**

```yaml
services:
  postgres:
    image: pgvector/pgvector:pg16
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - ics_select_pg:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 5s
      retries: 10
    networks:
      - internal

  api:
    image: ghcr.io/daviduarte/ics-select-api:${IMAGE_TAG:-latest}
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      NODE_ENV: production
      PORT: 3001
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public
      CORS_ALLOWED_ORIGINS: https://ics.daviduarte.com.br
      LOG_LEVEL: info
    networks:
      - internal
      - web

  migrate:
    image: ghcr.io/daviduarte/ics-select-api:${IMAGE_TAG:-latest}
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}?schema=public
    command: >
      sh -c "cd /app/node_modules/@ics-select/prisma && npx prisma migrate deploy"
    networks:
      - internal
    restart: "no"

  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    networks:
      - web

  # Evolution API (WhatsApp) — service definition present for completeness.
  # Not started by default in Phase 0; wired up and started in Phase 7 using:
  #   docker compose -f docker-compose.prod.yml --profile whatsapp up -d evolution
  evolution:
    image: atendai/evolution-api:v2.1.1
    restart: unless-stopped
    profiles: ["whatsapp"]
    environment:
      SERVER_TYPE: http
      SERVER_PORT: 8080
      AUTHENTICATION_API_KEY: ${EVOLUTION_API_KEY:-CHANGE_ME}
      DATABASE_ENABLED: "true"
      DATABASE_PROVIDER: postgresql
      DATABASE_CONNECTION_URI: postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/evolution?schema=public
      CACHE_REDIS_ENABLED: "false"
      CACHE_LOCAL_ENABLED: "true"
    volumes:
      - evolution_instances:/evolution/instances
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - internal

volumes:
  ics_select_pg:
  caddy_data:
  caddy_config:
  evolution_instances:

networks:
  internal:
  web:
```

- [ ] **Step 2: Create `Caddyfile`**

```
ics-api.daviduarte.com.br {
    encode zstd gzip
    reverse_proxy api:3001 {
        header_up X-Real-IP {remote_host}
        health_uri /health
        health_interval 30s
        health_timeout 5s
    }
    log {
        output stdout
        format console
    }
}
```

- [ ] **Step 3: Create `.env.prod.example`**

```env
# Copy to .env on the VPS and fill in real values (never commit .env)
POSTGRES_USER=ics
POSTGRES_PASSWORD=CHANGE_ME
POSTGRES_DB=ics_select
IMAGE_TAG=latest
# Evolution API (WhatsApp) — only used in Phase 7 when --profile whatsapp is enabled
EVOLUTION_API_KEY=CHANGE_ME
```

- [ ] **Step 4: Validate compose file syntax**

Run: `docker compose -f docker-compose.prod.yml config`
Expected: prints the expanded config without errors (missing env vars will show as empty — that is fine for syntax validation).

- [ ] **Step 5: Commit**

```bash
git add docker-compose.prod.yml Caddyfile .env.prod.example
git commit -m "chore: add production compose and Caddyfile"
```

---

## Task 16: Create GitHub Actions CI workflow

**Goal:** Run lint, typecheck, tests, and build on every push and PR. Also spin up a Postgres + pgvector service so Prisma migrate can run.

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env:
          POSTGRES_USER: ics
          POSTGRES_PASSWORD: ics_dev_password
          POSTGRES_DB: ics_select
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U ics -d ics_select"
          --health-interval 5s
          --health-timeout 5s
          --health-retries 10
    env:
      DATABASE_URL: postgresql://ics:ics_dev_password@localhost:5432/ics_select?schema=public
      CORS_ALLOWED_ORIGINS: http://localhost:3000
      NEXT_PUBLIC_API_URL: http://localhost:3001
      NODE_ENV: test
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9.12.0

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Generate Prisma client
        run: pnpm --filter @ics-select/prisma exec prisma generate

      - name: Apply Prisma migrations
        run: pnpm --filter @ics-select/prisma exec prisma migrate deploy

      - name: Typecheck
        run: pnpm typecheck

      - name: Lint
        run: pnpm lint

      - name: Unit tests (shared)
        run: pnpm --filter @ics-select/shared test

      - name: Unit tests (api)
        run: pnpm --filter @ics-select/api test

      - name: E2E tests (api)
        run: pnpm --filter @ics-select/api test:e2e

      - name: Build
        run: pnpm build

      - name: Install Playwright browsers
        run: pnpm --filter @ics-select/web exec playwright install --with-deps chromium

      - name: Run Playwright tests
        run: pnpm --filter @ics-select/web test

      - name: Upload Playwright report on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: apps/web/playwright-report
          retention-days: 7
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add GitHub Actions CI pipeline"
```

- [ ] **Step 3: Push a branch and open a PR (manual)**

Run:
```bash
git push -u origin main
```
(Or open a PR from a branch if you prefer to gate main with branch protection later.) Wait for Actions to run in the GitHub UI. Expected: all steps green.

---

## Task 17: Create GitHub Actions deploy workflow

**Goal:** On push to `main` (after CI succeeds), build the API Docker image, push it to `ghcr.io`, and trigger a remote `docker compose pull && up` on the VPS over SSH.

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create `.github/workflows/deploy.yml`**

```yaml
name: Deploy

on:
  workflow_run:
    workflows: ['CI']
    types: [completed]
    branches: [main]

jobs:
  build-and-push:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    outputs:
      image: ${{ steps.meta.outputs.image }}
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.workflow_run.head_sha }}

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Set image metadata
        id: meta
        run: |
          SHA_SHORT=$(echo "${{ github.event.workflow_run.head_sha }}" | cut -c1-7)
          echo "image=ghcr.io/${{ github.repository_owner }}/ics-select-api:${SHA_SHORT}" >> "$GITHUB_OUTPUT"
          echo "latest=ghcr.io/${{ github.repository_owner }}/ics-select-api:latest" >> "$GITHUB_OUTPUT"

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          file: ./Dockerfile
          push: true
          tags: |
            ${{ steps.meta.outputs.image }}
            ${{ steps.meta.outputs.latest }}

  deploy:
    needs: build-and-push
    runs-on: ubuntu-latest
    steps:
      - name: SSH into VPS and redeploy
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            set -euo pipefail
            cd /opt/ics-select
            docker compose -f docker-compose.prod.yml pull api migrate
            docker compose -f docker-compose.prod.yml run --rm migrate
            docker compose -f docker-compose.prod.yml up -d postgres api caddy
            docker image prune -f
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add deploy workflow to VPS via SSH"
```

- [ ] **Step 3: Trigger the first deploy (manual)**

After the CI workflow succeeds on `main`, the Deploy workflow will run automatically. Watch it in the GitHub UI. Expected: the image is pushed to `ghcr.io/daviduarte/ics-select-api:<sha>` and the VPS pulls and restarts. After it completes, run `curl -sS https://ics-api.daviduarte.com.br/health` and expect `{"status":"ok",...}`.

If the VPS step fails because `/opt/ics-select` doesn't have the compose files or `.env` yet, follow the one-time VPS setup from the README (Task 19) and retry.

---

## Task 18: Write the README covering setup, deploy, operations

**Goal:** A new engineer (or future you) can clone the repo, run it locally, understand how deploy works, and know where to look when things break.

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# ICS Select

Plataforma interna do ICS Select — Programa de Preparação Avançada para Entrevistas Técnicas (Inteli Consulting Society).

- **Design spec:** [`docs/superpowers/specs/2026-04-11-ics-select-design.md`](docs/superpowers/specs/2026-04-11-ics-select-design.md)
- **Plano de entrega:** [`docs/superpowers/plans/`](docs/superpowers/plans/)

## Stack

- Monorepo: pnpm 9 + Turborepo 2
- Backend: NestJS 10 + Prisma 5 + PostgreSQL 16 + pgvector
- Frontend: Next.js 15 + HeroUI + Tailwind 3 + lucide-react + next-themes
- Testes: Jest + Supertest (API), Playwright (web), Vitest (shared)
- Deploy: Docker Compose + Caddy na VPS + Vercel (web) + GitHub Actions

## Pré-requisitos

- Node 20 (`.nvmrc`)
- pnpm 9 (`corepack enable && corepack prepare pnpm@9.12.0 --activate`)
- Docker 24+ e Docker Compose v2

## Setup local

```bash
# 1. Instalar dependências
pnpm install

# 2. Subir o banco local
cp .env.example .env
docker compose up -d postgres

# 3. Aplicar migrações
pnpm --filter @ics-select/prisma exec prisma migrate deploy

# 4. Configurar a API
cp apps/api/.env.example apps/api/.env

# 5. Configurar o web
cp apps/web/.env.example apps/web/.env.local

# 6. Rodar tudo (em terminais separados ou via turbo)
pnpm dev
```

- API: http://localhost:3001/health
- Web: http://localhost:3000

## Comandos úteis

```bash
pnpm lint          # lint em todos os packages
pnpm typecheck     # type-check em todos os packages
pnpm test          # todos os testes (unit + e2e + playwright)
pnpm build         # build de todos os packages
pnpm db:migrate    # roda prisma migrate dev
pnpm db:generate   # regenera o client do Prisma
```

## Deploy

### Backend (VPS)

O deploy é automático via GitHub Actions em merges na branch `main`:

1. CI roda (lint, typecheck, testes, build)
2. Deploy workflow builda a imagem Docker e faz push pra `ghcr.io/daviduarte/ics-select-api`
3. SSH na VPS → `docker compose pull && migrate && up -d`

**VPS setup inicial (uma vez):**

```bash
# Na VPS, como root ou sudo
mkdir -p /opt/ics-select
cd /opt/ics-select

# Copiar docker-compose.prod.yml, Caddyfile e criar .env
scp docker-compose.prod.yml user@vps:/opt/ics-select/
scp Caddyfile user@vps:/opt/ics-select/
scp .env.prod.example user@vps:/opt/ics-select/.env
# depois editar o .env com senhas reais

# Login no GHCR com o PAT
echo $GHCR_PAT | docker login ghcr.io -u daviduarte --password-stdin

# Primeira subida
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml run --rm migrate
docker compose -f docker-compose.prod.yml up -d
```

### Frontend (Vercel)

- Projeto Vercel apontando pra este repositório
- **Root Directory:** `apps/web`
- **Build command:** `cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @ics-select/web build`
- **Install command:** (vazio, o build command já instala)
- **Output directory:** `.next` (default)
- Env var: `NEXT_PUBLIC_API_URL=https://ics-api.daviduarte.com.br`
- Domínio customizado: `ics.daviduarte.com.br`

## Secrets necessários no GitHub

| Nome | Descrição |
|---|---|
| `VPS_HOST` | IP ou hostname da VPS |
| `VPS_USER` | Usuário SSH |
| `VPS_SSH_KEY` | Chave privada (PEM) |

## Rollback

Para voltar pra uma versão anterior da API:

```bash
# Na VPS
cd /opt/ics-select
# Substitua <sha> pela tag que você quer (veja GHCR)
sed -i 's/IMAGE_TAG=.*/IMAGE_TAG=<sha>/' .env
docker compose -f docker-compose.prod.yml pull api
docker compose -f docker-compose.prod.yml up -d api
```

## Saúde e logs

- Health: `curl -sS https://ics-api.daviduarte.com.br/health`
- Logs: `docker compose -f docker-compose.prod.yml logs -f api`
- Caddy: `docker compose -f docker-compose.prod.yml logs -f caddy`
- Postgres shell: `docker compose -f docker-compose.prod.yml exec postgres psql -U ics ics_select`

## Troubleshooting

- **CI falha em "Apply Prisma migrations":** a service do Postgres não subiu a tempo; GitHub Actions retenta até 10x mas se falhar consistentemente, aumentar `--health-retries`.
- **Playwright snapshot diff no CI:** rodar `pnpm --filter @ics-select/web test:update` localmente no mesmo SO (use Docker se estiver no macOS) e commitar os snapshots novos.
- **Deploy falha em "SSH into VPS":** verificar que `VPS_SSH_KEY` no GitHub Secrets é a chave privada completa, incluindo `-----BEGIN ... -----` e `-----END ... -----`.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup, deploy, and operations"
```

---

## Task 19: End-to-end verification

**Goal:** Confirm the full Phase 0 deliverable works locally and in production. This task is pure verification — no code.

- [ ] **Step 1: Fresh local setup**

In a clean shell:
```bash
cd $(mktemp -d)
git clone git@github.com:daviduarte/ics-select.git ics-select-check
cd ics-select-check
pnpm install
cp .env.example .env
docker compose up -d postgres
pnpm --filter @ics-select/prisma exec prisma migrate deploy
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @ics-select/api dev &
API_PID=$!
sleep 5
curl -sS http://localhost:3001/health
kill $API_PID
docker compose down
```
Expected: `curl` returns `{"status":"ok","version":"0.1.0","uptimeSeconds":<n>}`.

- [ ] **Step 2: Run the whole test suite**

Run: `pnpm install && pnpm lint && pnpm typecheck && pnpm test`
Expected: zero failures.

- [ ] **Step 3: Production API**

Run: `curl -sS https://ics-api.daviduarte.com.br/health`
Expected: `{"status":"ok","version":"0.1.0","uptimeSeconds":<n>}` with valid HTTPS certificate.

- [ ] **Step 4: Production Web**

Open `https://ics.daviduarte.com.br` in a browser.
Expected: page renders with "ICS Select" heading, tagline, and "Em breve." subtitle. Light and dark mode switch correctly when system theme changes.

- [ ] **Step 5: CI green on `main`**

In the GitHub UI, confirm the latest CI and Deploy workflows on `main` are green.

- [ ] **Step 6: Tag the foundation release**

```bash
git tag -a v0.1.0 -m "Phase 0 — Fundação"
git push origin v0.1.0
```

Phase 0 is complete. Ready for Phase 1 — Auth + usuários + ciclos.

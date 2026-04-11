# ICS Select — Fase 3 (Disponibilidade + Google Calendar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Persist each member's Google OAuth tokens (encrypted), let the member declare how many minutes per weekday they can dedicate to study plus a preferred session length, and expose a thin server-side `GoogleCalendarService` that can read free/busy windows and create/update/delete events on the member's primary calendar. Ship a mobile-first availability page where the member sets those values. Phase 4 will plug this into the weekly scheduler; Phase 3 only lays the groundwork.

**Architecture:** A new `GoogleAccount` Prisma model (1:1 with `User`) stores the access/refresh tokens encrypted with the AES-GCM service from Phase 1. The Google OAuth callback in `AuthService` now persists/upserts the `GoogleAccount`. A new `MemberAvailability` model (1:1 with `User`) stores minutes per weekday + preferred session length + timezone. A `GoogleCalendarService` wraps `googleapis`; callers give it a `userId` and it decrypts the tokens, instantiates an OAuth2 client, refreshes on demand, and performs the requested operation. The frontend has `/me/availability` with sliders (HeroUI) for each weekday and a single page `/me/google` that shows the Calendar connection status (connected/reconnect button).

**Tech Stack (new in this phase):** `googleapis` npm client.

---

## Pre-flight

1. **OAuth scopes:** the Google OAuth strategy in Phase 1 already requests `email`, `profile`, `calendar.events`, `calendar.readonly` with `accessType: 'offline'` and `prompt: 'consent'`. No changes needed unless the real Google Cloud project does not have the Calendar API enabled — enable it there if not done yet.
2. **Re-consent requirement:** existing users will need to log out and back in once to trigger a fresh OAuth consent so the access + refresh tokens are captured. Document in README.

---

## File Structure

### packages/prisma
| Path | Purpose |
|---|---|
| `packages/prisma/prisma/schema.prisma` | Add `GoogleAccount`, `MemberAvailability` |
| `packages/prisma/prisma/migrations/4_google_account_availability/migration.sql` | CreateTable for both |

### apps/api
| Path | Purpose |
|---|---|
| `apps/api/src/auth/auth.service.ts` | Persist encrypted tokens on login |
| `apps/api/src/auth/auth.service.spec.ts` | Cover token persistence |
| `apps/api/src/google-calendar/google-calendar.module.ts` | Module |
| `apps/api/src/google-calendar/google-calendar.service.ts` | Wrapper around `googleapis` |
| `apps/api/src/google-calendar/google-calendar.service.spec.ts` | Unit tests with mocked client |
| `apps/api/src/availability/availability.controller.ts` | `/me/availability` |
| `apps/api/src/availability/availability.service.ts` | CRUD + upsert |
| `apps/api/src/availability/availability.service.spec.ts` | Unit tests |
| `apps/api/src/availability/availability.module.ts` | Module |
| `apps/api/src/app.module.ts` | Import new modules |

### apps/web
| Path | Purpose |
|---|---|
| `apps/web/app/(app)/me/availability/page.tsx` | Availability UI |
| `apps/web/components/nav/app-nav.tsx` | Add "Disponibilidade" link for members |

---

## Task 1: Schema + migration

**Files:**
- Modify: `packages/prisma/prisma/schema.prisma`
- Create: `packages/prisma/prisma/migrations/4_google_account_availability/migration.sql`

- [ ] **Step 1: Append to schema.prisma**

Inside `model User { ... }`, add the back-relations:

```prisma
  googleAccount GoogleAccount?
  availability  MemberAvailability?
```

Then after the existing models add:

```prisma
model GoogleAccount {
  id              String   @id @default(cuid())
  userId          String   @unique
  accessTokenEnc  String
  refreshTokenEnc String?
  expiresAt       DateTime
  scope           String
  updatedAt       DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
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

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- [ ] **Step 2: Create migration**

Create `packages/prisma/prisma/migrations/4_google_account_availability/migration.sql`:

```sql
-- CreateTable
CREATE TABLE "GoogleAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "scope" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoogleAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberAvailability" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mondayMinutes" INTEGER NOT NULL DEFAULT 0,
    "tuesdayMinutes" INTEGER NOT NULL DEFAULT 0,
    "wednesdayMinutes" INTEGER NOT NULL DEFAULT 0,
    "thursdayMinutes" INTEGER NOT NULL DEFAULT 0,
    "fridayMinutes" INTEGER NOT NULL DEFAULT 0,
    "saturdayMinutes" INTEGER NOT NULL DEFAULT 0,
    "sundayMinutes" INTEGER NOT NULL DEFAULT 0,
    "preferredSessionMinutes" INTEGER NOT NULL DEFAULT 60,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GoogleAccount_userId_key" ON "GoogleAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberAvailability_userId_key" ON "MemberAvailability"("userId");

-- AddForeignKey
ALTER TABLE "GoogleAccount" ADD CONSTRAINT "GoogleAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberAvailability" ADD CONSTRAINT "MemberAvailability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Regenerate client and apply migration**

Run:
```bash
pnpm --filter @ics-select/prisma exec prisma generate
docker compose up -d postgres
pnpm --filter @ics-select/prisma exec prisma migrate deploy
```
Expected: "1 migration applied".

- [ ] **Step 4: Commit**

```bash
git add packages/prisma/prisma/schema.prisma packages/prisma/prisma/migrations/4_google_account_availability
git commit -m "feat(prisma): add GoogleAccount and MemberAvailability models"
```

---

## Task 2: AuthService persists encrypted Google tokens

**Files:**
- Modify: `apps/api/src/auth/auth.service.ts`
- Modify: `apps/api/src/auth/auth.service.spec.ts`

- [ ] **Step 1: Update the test first**

Add a `googleAccount` fake to the prisma mock in `apps/api/src/auth/auth.service.spec.ts`. At the top of `fakeDeps`, after `const users = new Map(...)`, add:

```ts
  const googleAccounts = new Map<string, { accessTokenEnc: string; refreshTokenEnc: string | null; expiresAt: Date; scope: string; userId: string }>();
```

And inside `prisma`, add:

```ts
    googleAccount: {
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = googleAccounts.get(where.userId);
        const next = existing ? { ...existing, ...update } : { userId: where.userId, ...create };
        googleAccounts.set(where.userId, next);
        return next;
      }),
    },
```

Also add an `aes` parameter to the `AuthService` constructor call in `fakeDeps`:

```ts
  const aes = { encrypt: jest.fn((s: string) => `enc(${s})`), decrypt: jest.fn((s: string) => s.replace(/^enc\(|\)$/g, '')) };
  const svc = new AuthService(prisma as any, jwt as any, refresh as any, bootstrap, aes as any);
```

And return `googleAccounts` from `fakeDeps`:

```ts
  return { svc, prisma, jwt, refresh, users, googleAccounts, aes };
```

Add a new test:

```ts
  it('persists encrypted Google access and refresh tokens on login', async () => {
    const { svc, googleAccounts, aes } = fakeDeps();
    await svc.loginWithGoogle({
      email: 'pedro@sou.inteli.edu.br',
      name: 'Pedro',
      pictureUrl: null,
      accessToken: 'ga-plain',
      refreshToken: 'gr-plain',
    });
    expect(aes.encrypt).toHaveBeenCalledWith('ga-plain');
    expect(aes.encrypt).toHaveBeenCalledWith('gr-plain');
    const row = Array.from(googleAccounts.values())[0];
    expect(row?.accessTokenEnc).toBe('enc(ga-plain)');
    expect(row?.refreshTokenEnc).toBe('enc(gr-plain)');
  });
```

- [ ] **Step 2: Run tests to see failure**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern auth.service`
Expected: fails because `AuthService` still has 4 constructor parameters and doesn't persist tokens.

- [ ] **Step 3: Update `AuthService`**

Modify `apps/api/src/auth/auth.service.ts`:

1. Import `AesGcmService`:

```ts
import { AesGcmService } from '../common/crypto/aes-gcm.service.js';
```

2. Add the constructor parameter:

```ts
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtTokenService,
    private readonly refresh: RefreshTokenService,
    @Inject(BOOTSTRAP_ADMIN_EMAILS_TOKEN)
    private readonly bootstrapAdmins: string[],
    private readonly aes: AesGcmService,
  ) {}
```

3. Inside `loginWithGoogle`, after creating/updating the user and before building `LoginResult`, add:

```ts
    const accessTokenEnc = this.aes.encrypt(profile.accessToken);
    const refreshTokenEnc = profile.refreshToken
      ? this.aes.encrypt(profile.refreshToken)
      : null;
    // Access tokens from Google typically last 1h. We set expiresAt to 55min to leave
    // a small safety margin; the GoogleCalendarService refreshes when close to expiry.
    const expiresAt = new Date(Date.now() + 55 * 60 * 1000);
    await this.prisma.googleAccount.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        accessTokenEnc,
        refreshTokenEnc,
        expiresAt,
        scope: 'email profile https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly',
      },
      update: {
        accessTokenEnc,
        ...(refreshTokenEnc ? { refreshTokenEnc } : {}),
        expiresAt,
      },
    });
```

- [ ] **Step 4: Run tests to verify**

Run: `pnpm --filter @ics-select/api test -- --testPathPattern auth.service`
Expected: all auth service tests pass including the new one.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/auth
git commit -m "feat(api): persist encrypted Google tokens on OAuth login"
```

---

## Task 3: GoogleCalendarService

**Files:**
- Create: `apps/api/src/google-calendar/google-calendar.service.ts`
- Create: `apps/api/src/google-calendar/google-calendar.service.spec.ts`
- Create: `apps/api/src/google-calendar/google-calendar.module.ts`
- Modify: `apps/api/package.json` (add `googleapis`)
- Modify: `apps/api/src/app.module.ts` (import module)

- [ ] **Step 1: Install googleapis**

Run: `pnpm --filter @ics-select/api add googleapis`

- [ ] **Step 2: Write failing tests**

Create `apps/api/src/google-calendar/google-calendar.service.spec.ts`:

```ts
import { GoogleCalendarService } from './google-calendar.service';

type GoogleAccountRow = {
  accessTokenEnc: string;
  refreshTokenEnc: string | null;
  expiresAt: Date;
  scope: string;
};

function fakePrisma(row: GoogleAccountRow | null) {
  return {
    googleAccount: {
      findUnique: jest.fn(async () => row),
      update: jest.fn(async ({ data }: { data: Partial<GoogleAccountRow> }) => {
        if (row) Object.assign(row, data);
        return row;
      }),
    },
  };
}

const aes = {
  encrypt: jest.fn((s: string) => `enc(${s})`),
  decrypt: jest.fn((s: string) => s.replace(/^enc\(|\)$/g, '')),
};

type MockCalendar = {
  freebusy: { query: jest.Mock };
  events: { insert: jest.Mock; patch: jest.Mock; delete: jest.Mock };
};

function mockClient(): MockCalendar {
  return {
    freebusy: { query: jest.fn().mockResolvedValue({ data: { calendars: { primary: { busy: [] } } } }) },
    events: {
      insert: jest.fn().mockResolvedValue({ data: { id: 'evt-1' } }),
      patch: jest.fn().mockResolvedValue({ data: { id: 'evt-1' } }),
      delete: jest.fn().mockResolvedValue({}),
    },
  };
}

describe('GoogleCalendarService', () => {
  beforeEach(() => {
    aes.encrypt.mockClear();
    aes.decrypt.mockClear();
  });

  it('getFreeBusy decrypts the token and calls freebusy.query', async () => {
    const row = {
      accessTokenEnc: 'enc(plain-access)',
      refreshTokenEnc: 'enc(plain-refresh)',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      scope: 'calendar.events',
    };
    const prisma = fakePrisma(row);
    const client = mockClient();
    const svc = new GoogleCalendarService(prisma as any, aes as any, () => client as any);
    const result = await svc.getFreeBusy('user-1', new Date('2026-04-14'), new Date('2026-04-21'));
    expect(result).toEqual([]);
    expect(client.freebusy.query).toHaveBeenCalled();
  });

  it('createEvent returns the created event id', async () => {
    const row = {
      accessTokenEnc: 'enc(plain-access)',
      refreshTokenEnc: 'enc(plain-refresh)',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      scope: 'calendar.events',
    };
    const prisma = fakePrisma(row);
    const client = mockClient();
    const svc = new GoogleCalendarService(prisma as any, aes as any, () => client as any);
    const id = await svc.createEvent('user-1', {
      summary: 'Test',
      description: 'desc',
      start: new Date('2026-04-14T10:00:00Z'),
      end: new Date('2026-04-14T11:00:00Z'),
    });
    expect(id).toBe('evt-1');
    expect(client.events.insert).toHaveBeenCalled();
  });

  it('throws if the user has no GoogleAccount row', async () => {
    const prisma = fakePrisma(null);
    const client = mockClient();
    const svc = new GoogleCalendarService(prisma as any, aes as any, () => client as any);
    await expect(svc.getFreeBusy('u', new Date(), new Date())).rejects.toThrow(/GoogleAccount/);
  });
});
```

- [ ] **Step 3: Implement the service**

Create `apps/api/src/google-calendar/google-calendar.service.ts`:

```ts
import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { google, type calendar_v3 } from 'googleapis';
import { PrismaService } from '../common/prisma/prisma.service.js';
import { AesGcmService } from '../common/crypto/aes-gcm.service.js';

export type CreateEventInput = {
  summary: string;
  description: string;
  start: Date;
  end: Date;
};

export type FreeBusyBlock = { start: Date; end: Date };

type ClientFactory = (auth: unknown) => calendar_v3.Calendar;

@Injectable()
export class GoogleCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aes: AesGcmService,
    @Optional() private readonly clientFactory: ClientFactory = defaultClientFactory,
  ) {}

  async getFreeBusy(userId: string, timeMin: Date, timeMax: Date): Promise<FreeBusyBlock[]> {
    const client = await this.clientFor(userId);
    const res = await client.freebusy.query({
      requestBody: {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: 'primary' }],
      },
    });
    const busy = res.data.calendars?.primary?.busy ?? [];
    return busy
      .filter((b) => b.start && b.end)
      .map((b) => ({ start: new Date(b.start!), end: new Date(b.end!) }));
  }

  async createEvent(userId: string, input: CreateEventInput): Promise<string> {
    const client = await this.clientFor(userId);
    const res = await client.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.start.toISOString() },
        end: { dateTime: input.end.toISOString() },
      },
    });
    const id = res.data.id;
    if (!id) throw new Error('Google Calendar did not return an event id');
    return id;
  }

  async updateEvent(userId: string, eventId: string, input: CreateEventInput): Promise<void> {
    const client = await this.clientFor(userId);
    await client.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: {
        summary: input.summary,
        description: input.description,
        start: { dateTime: input.start.toISOString() },
        end: { dateTime: input.end.toISOString() },
      },
    });
  }

  async deleteEvent(userId: string, eventId: string): Promise<void> {
    const client = await this.clientFor(userId);
    await client.events.delete({ calendarId: 'primary', eventId });
  }

  private async clientFor(userId: string): Promise<calendar_v3.Calendar> {
    const row = await this.prisma.googleAccount.findUnique({ where: { userId } });
    if (!row) throw new NotFoundException('GoogleAccount for user not found');
    const accessToken = this.aes.decrypt(row.accessTokenEnc);
    const refreshToken = row.refreshTokenEnc ? this.aes.decrypt(row.refreshTokenEnc) : null;
    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken ?? undefined,
      expiry_date: row.expiresAt.getTime(),
    });
    return this.clientFactory(oauth2);
  }
}

function defaultClientFactory(auth: unknown): calendar_v3.Calendar {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return google.calendar({ version: 'v3', auth: auth as any });
}
```

- [ ] **Step 4: Create module**

Create `apps/api/src/google-calendar/google-calendar.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { GoogleCalendarService } from './google-calendar.service.js';

@Module({
  providers: [GoogleCalendarService],
  exports: [GoogleCalendarService],
})
export class GoogleCalendarModule {}
```

- [ ] **Step 5: Wire into `AppModule`**

Add `GoogleCalendarModule` to imports.

- [ ] **Step 6: Run tests and build**

Run: `pnpm --filter @ics-select/api test && pnpm --filter @ics-select/api build`
Expected: all pass (tests include the 3 new google-calendar ones).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/google-calendar apps/api/src/app.module.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(api): add GoogleCalendarService with free/busy + event CRUD"
```

---

## Task 4: Availability module

**Files:**
- Create: `apps/api/src/availability/availability.service.ts`
- Create: `apps/api/src/availability/availability.service.spec.ts`
- Create: `apps/api/src/availability/availability.controller.ts`
- Create: `apps/api/src/availability/availability.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Service test**

Create `apps/api/src/availability/availability.service.spec.ts`:

```ts
import { AvailabilityService } from './availability.service';

type A = {
  id: string;
  userId: string;
  mondayMinutes: number;
  tuesdayMinutes: number;
  wednesdayMinutes: number;
  thursdayMinutes: number;
  fridayMinutes: number;
  saturdayMinutes: number;
  sundayMinutes: number;
  preferredSessionMinutes: number;
  timezone: string;
};

function fakePrisma() {
  const rows = new Map<string, A>();
  return {
    rows,
    memberAvailability: {
      findUnique: jest.fn(async ({ where }: { where: { userId: string } }) =>
        rows.get(where.userId) ?? null,
      ),
      upsert: jest.fn(async ({ where, create, update }: any) => {
        const existing = rows.get(where.userId);
        const next: A = existing
          ? { ...existing, ...update }
          : { id: `a-${rows.size + 1}`, ...create };
        rows.set(where.userId, next);
        return next;
      }),
    },
  };
}

describe('AvailabilityService', () => {
  it('upsert creates a new availability row with defaults', async () => {
    const prisma = fakePrisma();
    const svc = new AvailabilityService(prisma as any);
    const row = await svc.upsert('user-1', {
      mondayMinutes: 60,
      tuesdayMinutes: 60,
      wednesdayMinutes: 0,
      thursdayMinutes: 30,
      fridayMinutes: 0,
      saturdayMinutes: 90,
      sundayMinutes: 0,
      preferredSessionMinutes: 45,
      timezone: 'America/Sao_Paulo',
    });
    expect(row.mondayMinutes).toBe(60);
    expect(row.preferredSessionMinutes).toBe(45);
    expect(prisma.rows.get('user-1')?.saturdayMinutes).toBe(90);
  });

  it('get returns null when no row exists', async () => {
    const prisma = fakePrisma();
    const svc = new AvailabilityService(prisma as any);
    expect(await svc.get('u')).toBeNull();
  });
});
```

- [ ] **Step 2: Implement service**

Create `apps/api/src/availability/availability.service.ts`:

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service.js';

export type AvailabilityInput = {
  mondayMinutes: number;
  tuesdayMinutes: number;
  wednesdayMinutes: number;
  thursdayMinutes: number;
  fridayMinutes: number;
  saturdayMinutes: number;
  sundayMinutes: number;
  preferredSessionMinutes: number;
  timezone: string;
};

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  get(userId: string) {
    return this.prisma.memberAvailability.findUnique({ where: { userId } });
  }

  upsert(userId: string, input: AvailabilityInput) {
    return this.prisma.memberAvailability.upsert({
      where: { userId },
      create: { userId, ...input },
      update: { ...input },
    });
  }
}
```

- [ ] **Step 3: Controller**

Create `apps/api/src/availability/availability.controller.ts`:

```ts
import { Body, Controller, Get, Patch } from '@nestjs/common';
import { z } from 'zod';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../auth/strategies/jwt.strategy.js';
import { AvailabilityService } from './availability.service.js';

const AvailabilitySchema = z.object({
  mondayMinutes: z.number().int().min(0).max(24 * 60),
  tuesdayMinutes: z.number().int().min(0).max(24 * 60),
  wednesdayMinutes: z.number().int().min(0).max(24 * 60),
  thursdayMinutes: z.number().int().min(0).max(24 * 60),
  fridayMinutes: z.number().int().min(0).max(24 * 60),
  saturdayMinutes: z.number().int().min(0).max(24 * 60),
  sundayMinutes: z.number().int().min(0).max(24 * 60),
  preferredSessionMinutes: z.number().int().min(15).max(240),
  timezone: z.string().default('America/Sao_Paulo'),
});

@Controller('me/availability')
export class AvailabilityController {
  constructor(private readonly availability: AvailabilityService) {}

  @Get()
  get(@CurrentUser() user: JwtStrategyPayload) {
    return this.availability.get(user.sub);
  }

  @Patch()
  upsert(@CurrentUser() user: JwtStrategyPayload, @Body() body: unknown) {
    const parsed = AvailabilitySchema.parse(body);
    return this.availability.upsert(user.sub, parsed);
  }
}
```

- [ ] **Step 4: Module**

Create `apps/api/src/availability/availability.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { AvailabilityController } from './availability.controller.js';
import { AvailabilityService } from './availability.service.js';

@Module({
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
```

- [ ] **Step 5: Wire into `AppModule`**

Add `AvailabilityModule` to imports.

- [ ] **Step 6: Run tests and build**

Run: `pnpm --filter @ics-select/api test && pnpm --filter @ics-select/api build`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/availability apps/api/src/app.module.ts
git commit -m "feat(api): add member availability module"
```

---

## Task 5: Frontend availability page

**Files:**
- Create: `apps/web/app/(app)/me/availability/page.tsx`
- Modify: `apps/web/components/nav/app-nav.tsx`

- [ ] **Step 1: Add "Disponibilidade" link to member nav**

In `apps/web/components/nav/app-nav.tsx`, replace the member-only block (`{user.role === 'MEMBER' ... }`) with:

```tsx
          <>
            <Link href="/me" className="text-foreground/80 hover:text-foreground">
              Meu plano
            </Link>
            <Link href="/me/availability" className="text-foreground/80 hover:text-foreground">
              Disponibilidade
            </Link>
          </>
```

Leave admin block unchanged.

- [ ] **Step 2: Create availability page**

Create `apps/web/app/(app)/me/availability/page.tsx`:

```tsx
'use client';

import { Button, Card, CardBody, CardHeader, Input, Select, SelectItem, Slider } from '@heroui/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../../../lib/api/client';

type Availability = {
  mondayMinutes: number;
  tuesdayMinutes: number;
  wednesdayMinutes: number;
  thursdayMinutes: number;
  fridayMinutes: number;
  saturdayMinutes: number;
  sundayMinutes: number;
  preferredSessionMinutes: number;
  timezone: string;
};

const DAYS: Array<{ key: keyof Availability; label: string }> = [
  { key: 'mondayMinutes', label: 'Segunda' },
  { key: 'tuesdayMinutes', label: 'Terça' },
  { key: 'wednesdayMinutes', label: 'Quarta' },
  { key: 'thursdayMinutes', label: 'Quinta' },
  { key: 'fridayMinutes', label: 'Sexta' },
  { key: 'saturdayMinutes', label: 'Sábado' },
  { key: 'sundayMinutes', label: 'Domingo' },
];

const DEFAULT: Availability = {
  mondayMinutes: 0,
  tuesdayMinutes: 0,
  wednesdayMinutes: 0,
  thursdayMinutes: 0,
  fridayMinutes: 0,
  saturdayMinutes: 0,
  sundayMinutes: 0,
  preferredSessionMinutes: 60,
  timezone: 'America/Sao_Paulo',
};

export default function AvailabilityPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['availability'],
    queryFn: () => apiFetch<Availability | null>('/me/availability'),
  });
  const [state, setState] = useState<Availability>(DEFAULT);

  useEffect(() => {
    if (data) setState(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch<Availability>('/me/availability', {
        method: 'PATCH',
        body: JSON.stringify(state),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['availability'] }),
  });

  if (isLoading) return <p className="text-foreground/60">Carregando...</p>;

  const totalMinutes = DAYS.reduce((sum, d) => sum + (state[d.key] as number), 0);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card>
        <CardHeader>
          <div>
            <h1 className="text-2xl font-semibold">Disponibilidade semanal</h1>
            <p className="text-sm text-foreground/60">
              Defina quantos minutos por dia você consegue dedicar ao estudo. O scheduler
              vai usar esses valores junto com o seu Google Calendar pra montar as sessões.
            </p>
          </div>
        </CardHeader>
        <CardBody className="space-y-5">
          {DAYS.map((d) => (
            <div key={d.key}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium">{d.label}</span>
                <span className="text-foreground/60">{state[d.key] as number} min</span>
              </div>
              <Slider
                aria-label={d.label}
                minValue={0}
                maxValue={240}
                step={15}
                value={state[d.key] as number}
                onChange={(v) =>
                  setState((s) => ({ ...s, [d.key]: Array.isArray(v) ? v[0] : v }))
                }
              />
            </div>
          ))}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Select
              label="Duração preferida da sessão"
              selectedKeys={[String(state.preferredSessionMinutes)]}
              onSelectionChange={(keys) => {
                const v = Number(Array.from(keys as Set<string>)[0]);
                setState((s) => ({ ...s, preferredSessionMinutes: v }));
              }}
            >
              <SelectItem key="25">25 min</SelectItem>
              <SelectItem key="45">45 min</SelectItem>
              <SelectItem key="60">60 min</SelectItem>
              <SelectItem key="90">90 min</SelectItem>
            </Select>
            <Input
              label="Timezone"
              value={state.timezone}
              onChange={(e) => setState((s) => ({ ...s, timezone: e.target.value }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground/60">Total: {totalMinutes} min / semana</p>
            <Button
              color="primary"
              isLoading={saveMutation.isPending}
              onPress={() => saveMutation.mutate()}
            >
              Salvar
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
```

- [ ] **Step 3: Build check**

Run: `pnpm --filter @ics-select/web build`
Expected: compiles.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(app\)/me/availability apps/web/components/nav/app-nav.tsx
git commit -m "feat(web): add availability page for members"
```

---

## Task 6: Verification

- [ ] **Step 1: Full test + build**

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
Expected: everything green.

- [ ] **Step 2: Git log**

Run: `git log --oneline main..HEAD`
Expected: ~5 commits for Tasks 1-5.

- [ ] **Step 3: Git status clean**

Clean except the 3 root PDFs.

Phase 3 complete. Next: Phase 4 — weekly study plans + scheduler.

# Calendar Perf + Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/me/calendar` feel instant on revisits, cut the server round-trip, and fix dark-mode visual defects on the FullCalendar grid.

**Architecture:** Four independent work streams, each self-contained and committable:
1. Backend perf — partial response on Google `events.list`, in-memory `OAuth2Client` cache keyed by userId, parallel Prisma reads in `getWeek`.
2. SWR localStorage — synchronous cache read feeds `initialData`, every fresh fetch writes back, reschedule flow keeps the cache in sync.
3. Lazy bundle — `CalendarGrid` becomes `next/dynamic` so the ~250 KB FullCalendar bundle stops blocking header/sidebar paint.
4. Visual polish — CSS token remap for FullCalendar, tightened event card hierarchy, collapsible legend, narrower sidebar.

**Tech Stack:** NestJS 10 + Prisma 5 (api) · Next.js 15 App Router + HeroUI + Tailwind 3 + TanStack Query + FullCalendar v6 (web) · Jest (api unit) · Playwright (web e2e).

**Spec:** `docs/superpowers/specs/2026-04-20-calendar-perf-polish-design.md`

---

## File map

**Backend:**
- Modify: `apps/api/src/google-calendar/google-calendar.service.ts` — add `fields`/`maxResults`, auth client cache, `invalidateAuth()`.
- Modify: `apps/api/src/google-calendar/google-calendar.service.spec.ts` — add tests for projection + caching.
- Modify: `apps/api/src/me/calendar/calendar.service.ts` — parallelize `availability` + `googleAccount`.
- Modify: `apps/api/src/me/calendar/calendar.service.spec.ts` — add test proving parallelism.
- Modify: `apps/api/src/auth/auth.service.ts` — call `invalidateAuth` after `googleAccount.upsert`.
- Modify: `apps/api/src/auth/auth.module.ts` — inject `GoogleCalendarService` (or its module) so `AuthService` can reach `invalidateAuth`.

**Frontend cache:**
- Create: `apps/web/lib/cache/calendar-cache.ts` — localStorage read/write/prune helpers.
- Create: `apps/web/lib/cache/calendar-cache.spec.ts` — unit tests for the cache helpers.
- Modify: `apps/web/lib/queries/me-calendar.ts` — wire `initialData` + post-fetch cache write; keep reschedule cache in sync.
- Modify: `apps/web/app/(member)/me/calendar/page.tsx` — loosen skeleton guard, pass `isFetching` to header.
- Modify: `apps/web/components/member/calendar/calendar-header.tsx` — add optional `isRefreshing` dot.

**Frontend lazy bundle:**
- Create: `apps/web/components/member/calendar/calendar-grid-skeleton.tsx` — grid-area skeleton (not full page).
- Modify: `apps/web/app/(member)/me/calendar/page.tsx` — swap static `CalendarGrid` import for `next/dynamic({ ssr: false })`.

**Visual polish:**
- Modify: `apps/web/app/globals.css` — `.ics-calendar-grid` token remap (page bg, today, now indicator, header border).
- Modify: `apps/web/components/member/calendar/calendar-event-external.tsx` — transparent bg + dashed border.
- Modify: `apps/web/components/member/calendar/calendar-legend.tsx` — wrap in `<details>`.
- Modify: `apps/web/app/(member)/me/calendar/page.tsx` — grid template `320px_1fr` → `280px_1fr`.

No schema changes. No new dependencies.

---

## Task 1: Backend — partial response + `maxResults` on `events.list`

Cuts Google's response payload ~5–10× on the one hot endpoint (`/me/calendar`).

**Files:**
- Modify: `apps/api/src/google-calendar/google-calendar.service.ts:58-65`
- Modify: `apps/api/src/google-calendar/google-calendar.service.spec.ts` — add assertion to existing `listEventsInRange` test.

- [ ] **Step 1: Write the failing test**

Modify the existing `'listEventsInRange maps Calendar event shape...'` test assertion (`apps/api/src/google-calendar/google-calendar.service.spec.ts` around line 157) so it also checks `fields` and `maxResults`:

```ts
expect(client.events.list).toHaveBeenCalledWith(
  expect.objectContaining({
    calendarId: 'primary',
    singleEvents: true,
    orderBy: 'startTime',
    timeMin: '2026-04-17T12:00:00.000Z',
    timeMax: '2026-04-17T13:00:00.000Z',
    maxResults: 100,
    fields: 'items(id,summary,description,start,end,location,htmlLink,conferenceData/entryPoints)',
  }),
);
```

- [ ] **Step 2: Run the test — expect FAIL**

```bash
pnpm --filter @ics-select/api test -- --testPathPattern google-calendar.service
```

Expected: the reshape test fails because the current call doesn't pass `fields` or `maxResults`.

- [ ] **Step 3: Implement — add the two arguments**

In `apps/api/src/google-calendar/google-calendar.service.ts`, change the `events.list` call:

```ts
const res = await client.events.list({
  calendarId: 'primary',
  timeMin: timeMin.toISOString(),
  timeMax: timeMax.toISOString(),
  singleEvents: true,
  orderBy: 'startTime',
  maxResults: 100,
  fields: 'items(id,summary,description,start,end,location,htmlLink,conferenceData/entryPoints)',
});
```

- [ ] **Step 4: Run the test — expect PASS**

```bash
pnpm --filter @ics-select/api test -- --testPathPattern google-calendar.service
```

Expected: all tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/google-calendar/google-calendar.service.ts apps/api/src/google-calendar/google-calendar.service.spec.ts
git commit -m "perf(api): partial response + maxResults on google events.list

Cuts Google Calendar payload ~5-10x by projecting only the fields we consume.
maxResults=100 bounds the response regardless of the user's event volume."
```

---

## Task 2: Backend — `OAuth2Client` in-memory cache

Eliminates the Prisma + AES + OAuth2 construction overhead on every calendar call within the access-token lifetime.

**Files:**
- Modify: `apps/api/src/google-calendar/google-calendar.service.ts` — add cache map, rework `clientFor`, add `invalidateAuth`.
- Modify: `apps/api/src/google-calendar/google-calendar.service.spec.ts` — add cache tests.

- [ ] **Step 1: Write the failing cache-hit test**

Append to the `'GoogleCalendarService'` describe block in the spec:

```ts
describe('auth client cache', () => {
  const row = {
    accessTokenEnc: 'enc(plain-access)',
    refreshTokenEnc: 'enc(plain-refresh)',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    scope: 'calendar.events',
  };

  it('reuses the cached client for a second call within the TTL', async () => {
    const prisma = fakePrisma({ ...row });
    const client = mockClient();
    const factory = jest.fn(() => client as any);
    const svc = new GoogleCalendarService(prisma as any, aes as any, factory);

    await svc.getFreeBusy('user-1', new Date(), new Date());
    await svc.getFreeBusy('user-1', new Date(), new Date());

    expect(prisma.googleAccount.findUnique).toHaveBeenCalledTimes(1);
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('rebuilds the client when the cached entry is past its TTL', async () => {
    const prisma = fakePrisma({ ...row, expiresAt: new Date(Date.now() + 30_000) }); // 30s out
    const client = mockClient();
    const factory = jest.fn(() => client as any);
    const svc = new GoogleCalendarService(prisma as any, aes as any, factory);

    await svc.getFreeBusy('user-1', new Date(), new Date());
    await svc.getFreeBusy('user-1', new Date(), new Date());

    // With a <60s safety window, cached entry is considered stale on second call.
    expect(prisma.googleAccount.findUnique).toHaveBeenCalledTimes(2);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('invalidateAuth drops the cache entry so the next call rebuilds', async () => {
    const prisma = fakePrisma({ ...row });
    const client = mockClient();
    const factory = jest.fn(() => client as any);
    const svc = new GoogleCalendarService(prisma as any, aes as any, factory);

    await svc.getFreeBusy('user-1', new Date(), new Date());
    svc.invalidateAuth('user-1');
    await svc.getFreeBusy('user-1', new Date(), new Date());

    expect(prisma.googleAccount.findUnique).toHaveBeenCalledTimes(2);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('scopes the cache per userId', async () => {
    const prisma = {
      googleAccount: {
        findUnique: jest.fn(async (args: any) => ({
          ...row,
          accessTokenEnc: `enc(access-${args.where.userId})`,
        })),
      },
    };
    const client = mockClient();
    const factory = jest.fn(() => client as any);
    const svc = new GoogleCalendarService(prisma as any, aes as any, factory);

    await svc.getFreeBusy('user-a', new Date(), new Date());
    await svc.getFreeBusy('user-b', new Date(), new Date());

    expect(factory).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run the tests — expect FAIL**

```bash
pnpm --filter @ics-select/api test -- --testPathPattern google-calendar.service
```

Expected: the four new tests fail because `clientFor` rebuilds every time and `invalidateAuth` doesn't exist.

- [ ] **Step 3: Implement the cache**

In `apps/api/src/google-calendar/google-calendar.service.ts`:

Add this type near the top (below the existing `type ClientFactory`):

```ts
type CachedAuth = { client: calendar_v3.Calendar; expiresAt: number };
const AUTH_TTL_SAFETY_MS = 60_000; // rebuild 60s before Google thinks the token expires
```

Add a private field on the class and a public invalidation method:

```ts
private readonly authCache = new Map<string, CachedAuth>();

invalidateAuth(userId: string): void {
  this.authCache.delete(userId);
}
```

Replace the existing `clientFor` with:

```ts
private async clientFor(userId: string): Promise<calendar_v3.Calendar> {
  const cached = this.authCache.get(userId);
  if (cached && cached.expiresAt > Date.now() + AUTH_TTL_SAFETY_MS) {
    return cached.client;
  }

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
  const client = this.clientFactory(oauth2);
  this.authCache.set(userId, { client, expiresAt: row.expiresAt.getTime() });
  return client;
}
```

- [ ] **Step 4: Run the tests — expect PASS**

```bash
pnpm --filter @ics-select/api test -- --testPathPattern google-calendar.service
```

Expected: all tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/google-calendar/google-calendar.service.ts apps/api/src/google-calendar/google-calendar.service.spec.ts
git commit -m "perf(api): cache OAuth2Client per user in GoogleCalendarService

clientFor now reuses an in-memory calendar client keyed by userId until
the stored access_token's expiry approaches. Eliminates the Prisma +
AES + OAuth2 construction overhead on every calendar hit. invalidateAuth
lets callers evict an entry when tokens are rewritten."
```

---

## Task 3: Backend — invalidate auth cache on Google re-login

Keeps the cached client consistent with the DB row after every `loginWithGoogle`.

**Files:**
- Modify: `apps/api/src/auth/auth.service.ts` — inject `GoogleCalendarService`, call `invalidateAuth` after `googleAccount.upsert`.
- Modify: `apps/api/src/auth/auth.module.ts` — import `GoogleCalendarModule` so the dependency resolves.

- [ ] **Step 1: Confirm the auth module and file paths**

```bash
cat apps/api/src/auth/auth.module.ts
cat apps/api/src/google-calendar/google-calendar.module.ts
```

Expected: `GoogleCalendarModule` exports `GoogleCalendarService`. (If it doesn't, add `exports: [GoogleCalendarService]` as part of Step 3.)

- [ ] **Step 2: Write the failing test in the auth service spec**

Find `apps/api/src/auth/auth.service.spec.ts`. Add a test in the `loginWithGoogle` describe:

```ts
it('invalidates the GoogleCalendarService auth cache after upserting GoogleAccount', async () => {
  // Arrange: the full happy-path login (use whatever setup the file already uses
  // for the "first login creates user" test — this test just asserts one extra call).
  // ... existing arrangement ...
  await service.loginWithGoogle(profile);
  expect(gcal.invalidateAuth).toHaveBeenCalledWith(createdUser.id);
});
```

If the auth service spec doesn't already have a `GoogleCalendarService` mock, add to the providers:

```ts
const gcal = { invalidateAuth: jest.fn() };
// ... in the testing module providers: ...
{ provide: GoogleCalendarService, useValue: gcal },
```

(Read the existing spec first to merge the new mock cleanly with existing setup.)

- [ ] **Step 3: Run the test — expect FAIL**

```bash
pnpm --filter @ics-select/api test -- --testPathPattern auth.service.spec
```

Expected: the new test fails because `AuthService` doesn't call `invalidateAuth`.

- [ ] **Step 4: Wire the dependency and call invalidation**

In `apps/api/src/auth/auth.module.ts`, add `GoogleCalendarModule` to `imports` (or the direct provider import if that's the local pattern):

```ts
import { GoogleCalendarModule } from '../google-calendar/google-calendar.module.js';
// ...
@Module({
  imports: [/* existing */, GoogleCalendarModule],
  // ...
})
```

If `GoogleCalendarModule` doesn't yet export `GoogleCalendarService`, add it:

```ts
// apps/api/src/google-calendar/google-calendar.module.ts
@Module({
  providers: [GoogleCalendarService, AesGcmService],
  exports: [GoogleCalendarService],
})
```

In `apps/api/src/auth/auth.service.ts`, add the dependency and invalidate after upsert:

```ts
import { GoogleCalendarService } from '../google-calendar/google-calendar.service.js';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtTokenService,
    private readonly refresh: RefreshTokenService,
    @Inject(BOOTSTRAP_ADMIN_EMAILS_TOKEN)
    private readonly bootstrapAdmins: string[],
    private readonly aes: AesGcmService,
    private readonly gcal: GoogleCalendarService,
  ) {}

  // ... loginWithGoogle — immediately after the googleAccount.upsert:
  await this.prisma.googleAccount.upsert({ /* ...existing... */ });
  this.gcal.invalidateAuth(user.id);
  // ... rest unchanged
}
```

- [ ] **Step 5: Run the test — expect PASS**

```bash
pnpm --filter @ics-select/api test -- --testPathPattern auth.service.spec
```

Expected: green.

- [ ] **Step 6: Run the full api test suite to catch wiring regressions**

```bash
pnpm --filter @ics-select/api test
```

Expected: green (including e2e bootstrap if that already runs here).

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/auth/auth.service.ts apps/api/src/auth/auth.module.ts apps/api/src/auth/auth.service.spec.ts apps/api/src/google-calendar/google-calendar.module.ts
git commit -m "perf(api): invalidate cached google client on login

AuthService.loginWithGoogle now calls GoogleCalendarService.invalidateAuth
after upserting the GoogleAccount row, so the next calendar hit sees the
fresh access token instead of a stale cached OAuth2Client."
```

---

## Task 4: Backend — parallelize `getWeek` preamble

`availability` and `googleAccount` both come from Prisma and are independent — `Promise.all` removes the sequential stall.

**Files:**
- Modify: `apps/api/src/me/calendar/calendar.service.ts:55-76`
- Modify: `apps/api/src/me/calendar/calendar.service.spec.ts` — add parallelism assertion.

- [ ] **Step 1: Write the failing parallelism test**

In `apps/api/src/me/calendar/calendar.service.spec.ts`, add inside the `getWeek` describe:

```ts
it('fetches availability and googleAccount in parallel', async () => {
  const resolveAvailability = { value: null as any };
  const resolveGoogle = { value: null as any };
  prisma.memberAvailability.findUnique.mockImplementationOnce(
    () => new Promise((r) => { resolveAvailability.value = r; }),
  );
  prisma.googleAccount.findUnique.mockImplementationOnce(
    () => new Promise((r) => { resolveGoogle.value = r; }),
  );

  const pending = service.getWeek('user-1', weekStart);

  // Both Prisma calls must be in-flight before either resolves,
  // which only happens if they were initiated in parallel.
  await Promise.resolve();
  expect(resolveAvailability.value).toBeDefined();
  expect(resolveGoogle.value).toBeDefined();

  resolveAvailability.value({ timezone: 'America/Sao_Paulo' });
  resolveGoogle.value(null);
  await pending;
});
```

- [ ] **Step 2: Run the test — expect FAIL**

```bash
pnpm --filter @ics-select/api test -- --testPathPattern me/calendar/calendar.service.spec
```

Expected: fails. The current `await availability; await googleAccount;` sequence won't schedule the second call until the first resolves.

- [ ] **Step 3: Implement parallel reads**

In `apps/api/src/me/calendar/calendar.service.ts`, replace the two sequential `findUnique` calls at the top of `getWeek`:

```ts
const [availability, googleAccount] = await Promise.all([
  this.prisma.memberAvailability.findUnique({ where: { userId } }),
  this.prisma.googleAccount.findUnique({ where: { userId } }),
]);
const timezone = availability?.timezone ?? DEFAULT_TZ;
```

(Rest of the method — `base`, the `if (!googleAccount)` early return, the `listEventsInRange` call, the `weeklyPlanItem.findMany` enrichment — stays identical.)

- [ ] **Step 4: Run the test — expect PASS**

```bash
pnpm --filter @ics-select/api test -- --testPathPattern me/calendar/calendar.service.spec
```

Expected: green. Every other `getWeek` test in the file still passes because behavior is unchanged.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/me/calendar/calendar.service.ts apps/api/src/me/calendar/calendar.service.spec.ts
git commit -m "perf(api): parallelize availability + googleAccount reads in getWeek"
```

---

## Task 5: Frontend — `calendar-cache` helpers

Isolated, tested module. No React dependency — just `localStorage` + JSON.

**Files:**
- Create: `apps/web/lib/cache/calendar-cache.ts`
- Create: `apps/web/lib/cache/calendar-cache.spec.ts`

Note: `apps/web` currently doesn't run unit tests (only Playwright). We'll add this spec alongside the source and run it with Playwright's config only if the existing setup supports it. If the web package has no jest/vitest runner configured, fall back to relying on Playwright + TypeScript for the integration check in Task 6 — but keep the spec file so it's ready for the day a web unit runner gets added. Verify with:

```bash
cat apps/web/package.json | grep -E '"test|jest|vitest"'
```

If a runner exists, use it. If not, delete the `.spec.ts` and cover behavior via the integration test in Task 6.

- [ ] **Step 1: Write the failing test (if a web unit runner exists — otherwise skip to Step 3)**

Create `apps/web/lib/cache/calendar-cache.spec.ts`:

```ts
import { readCachedWeek, writeCachedWeek, __PREFIX, __MAX_WEEKS } from './calendar-cache';
import type { GetWeekResponse } from '../queries/me-calendar';

function sampleResponse(weekStart: string): GetWeekResponse {
  return {
    weekStart,
    weekEnd: new Date(new Date(weekStart).getTime() + 7 * 86400000).toISOString(),
    timezone: 'America/Sao_Paulo',
    hasGoogleConnection: true,
    events: [],
  };
}

describe('calendar-cache', () => {
  beforeEach(() => localStorage.clear());

  it('read returns null for a missing week', () => {
    expect(readCachedWeek(new Date('2026-04-19T00:00:00-03:00'))).toBeNull();
  });

  it('write then read roundtrips and preserves the payload', () => {
    const weekStart = new Date('2026-04-19T00:00:00-03:00');
    const payload = sampleResponse('2026-04-19T03:00:00.000Z');
    writeCachedWeek(weekStart, payload);
    const cached = readCachedWeek(weekStart);
    expect(cached).not.toBeNull();
    expect(cached!.data).toEqual(payload);
    expect(typeof cached!.updatedAt).toBe('number');
  });

  it('read returns null when the stored JSON is corrupt', () => {
    const key = `${__PREFIX}2026-04-19`;
    localStorage.setItem(key, 'not-json');
    expect(readCachedWeek(new Date('2026-04-19T00:00:00-03:00'))).toBeNull();
  });

  it('write prunes entries older than MAX_WEEKS', () => {
    const now = new Date('2026-04-19T00:00:00-03:00');
    // Seed MAX_WEEKS + 2 old entries.
    for (let i = 0; i < __MAX_WEEKS + 2; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - 7 * (i + 2));
      writeCachedWeek(d, sampleResponse(d.toISOString()));
    }
    writeCachedWeek(now, sampleResponse(now.toISOString()));
    const remaining = Object.keys(localStorage).filter((k) => k.startsWith(__PREFIX));
    expect(remaining.length).toBeLessThanOrEqual(__MAX_WEEKS);
  });

  it('tolerates quota-exceeded errors silently', () => {
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException('quota', 'QuotaExceededError');
    };
    try {
      expect(() =>
        writeCachedWeek(new Date('2026-04-19T00:00:00-03:00'), sampleResponse('x')),
      ).not.toThrow();
    } finally {
      Storage.prototype.setItem = orig;
    }
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

Only if a unit runner is configured:
```bash
pnpm --filter @ics-select/web test -- calendar-cache
```

Expected: module not found.

- [ ] **Step 3: Implement `calendar-cache.ts`**

Create `apps/web/lib/cache/calendar-cache.ts`:

```ts
import type { GetWeekResponse } from '../queries/me-calendar';

const VERSION = 'v1';
// Exported with __ prefix for tests only.
export const __PREFIX = `ics:calendar:${VERSION}:`;
export const __MAX_WEEKS = 8;

type CachedWeek = { data: GetWeekResponse; updatedAt: number };

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function keyFor(weekStart: Date): string {
  const y = weekStart.getFullYear();
  const m = String(weekStart.getMonth() + 1).padStart(2, '0');
  const d = String(weekStart.getDate()).padStart(2, '0');
  return `${__PREFIX}${y}-${m}-${d}`;
}

export function readCachedWeek(weekStart: Date): CachedWeek | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(keyFor(weekStart));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedWeek;
    if (!parsed || typeof parsed.updatedAt !== 'number' || !parsed.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedWeek(weekStart: Date, data: GetWeekResponse): void {
  if (!isBrowser()) return;
  try {
    const entry: CachedWeek = { data, updatedAt: Date.now() };
    window.localStorage.setItem(keyFor(weekStart), JSON.stringify(entry));
    prune();
  } catch {
    // Cache is an optimisation — silently tolerate quota / serialization errors.
  }
}

function prune(): void {
  if (!isBrowser()) return;
  try {
    const matches: Array<{ key: string; weekStart: string }> = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith(__PREFIX)) {
        matches.push({ key, weekStart: key.slice(__PREFIX.length) });
      }
    }
    if (matches.length <= __MAX_WEEKS) return;
    // Newest first, drop everything past MAX_WEEKS.
    matches.sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
    for (const m of matches.slice(__MAX_WEEKS)) {
      window.localStorage.removeItem(m.key);
    }
  } catch {
    // ignore
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

Only if a unit runner is configured:
```bash
pnpm --filter @ics-select/web test -- calendar-cache
```

Expected: green.

- [ ] **Step 5: Typecheck the workspace**

```bash
pnpm --filter @ics-select/web typecheck
```

Expected: no new errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/cache/calendar-cache.ts apps/web/lib/cache/calendar-cache.spec.ts
git commit -m "feat(web): localStorage cache helpers for calendar weeks

Versioned keys, JSON roundtrip with corrupt-entry tolerance, quota-exceeded
swallowing, and prune-to-MAX_WEEKS (8) on every write."
```

---

## Task 6: Frontend — wire SWR cache into `useMeCalendarWeek`

Cache is used as `initialData` so the grid paints synchronously; fresh fetches still run in background and write back.

**Files:**
- Modify: `apps/web/lib/queries/me-calendar.ts`
- Modify: `apps/web/app/(member)/me/calendar/page.tsx`
- Modify: `apps/web/components/member/calendar/calendar-header.tsx`

- [ ] **Step 1: Edit `useMeCalendarWeek` to use the cache**

In `apps/web/lib/queries/me-calendar.ts`:

```ts
'use client';

import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ItemOutcome } from '@ics-select/shared';
import { apiFetch } from '../api/client';
import { readCachedWeek, writeCachedWeek } from '../cache/calendar-cache';

// ... existing CalendarEvent + GetWeekResponse + isoDate types unchanged ...

export function useMeCalendarWeek(weekStart: Date) {
  const key = isoDate(weekStart);
  const cached = useMemo(() => readCachedWeek(weekStart), [key]);

  return useQuery({
    queryKey: ['me', 'calendar', key],
    queryFn: async () => {
      const fresh = await apiFetch<GetWeekResponse>(`/me/calendar?weekStart=${key}`);
      writeCachedWeek(weekStart, fresh);
      return fresh;
    },
    initialData: cached?.data,
    initialDataUpdatedAt: cached?.updatedAt,
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
}

export function useRescheduleEvent(weekStart: Date) {
  const qc = useQueryClient();
  const key = ['me', 'calendar', isoDate(weekStart)] as const;
  return useMutation({
    mutationFn: async (input: { eventId: string; start: string; end: string }) => {
      return apiFetch<void>(`/me/calendar/events/${input.eventId}`, {
        method: 'PATCH',
        body: JSON.stringify({ start: input.start, end: input.end }),
      });
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<GetWeekResponse>(key);
      if (previous) {
        qc.setQueryData<GetWeekResponse>(key, {
          ...previous,
          events: previous.events.map((e) =>
            e.id === input.eventId ? { ...e, start: input.start, end: input.end } : e,
          ),
        });
      }
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: async () => {
      await qc.invalidateQueries({ queryKey: key });
      const fresh = qc.getQueryData<GetWeekResponse>(key);
      if (fresh) writeCachedWeek(weekStart, fresh);
    },
  });
}
```

- [ ] **Step 2: Drop the `isLoading` gate and add the refreshing indicator**

In `apps/web/app/(member)/me/calendar/page.tsx`:

```tsx
const { data, isLoading, isFetching } = useMeCalendarWeek(weekStart);
// ...
return (
  <div className="space-y-4">
    <CalendarHeader
      weekStart={weekStart}
      weekEnd={weekEnd}
      onPrev={handlePrev}
      onNext={handleNext}
      onToday={handleToday}
      isRefreshing={isFetching && !isLoading}
    />
    {!data ? (
      <CalendarSkeleton />
    ) : (
      <>
        {!data.hasGoogleConnection && <CalendarConnectBanner variant="not_connected" />}
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <CalendarSidebar events={data.events} timezone={data.timezone} />
          <div className="space-y-4">
            <CalendarGrid
              weekStart={weekStart}
              weekEnd={weekEnd}
              timezone={data.timezone}
              events={data.events}
              onReschedule={(input) => reschedule.mutate(input)}
            />
            <CalendarLegend />
          </div>
        </div>
      </>
    )}
  </div>
);
```

(The `280px_1fr` template is the Task 9 visual change — landing it here avoids a second edit to the same file. Call it out in the commit.)

- [ ] **Step 3: Add `isRefreshing` to the header component**

In `apps/web/components/member/calendar/calendar-header.tsx`, extend the prop type and render a pulsing dot to the right of the week range:

```tsx
interface CalendarHeaderProps {
  weekStart: Date;
  weekEnd: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  isRefreshing?: boolean;
}

export function CalendarHeader({
  weekStart,
  weekEnd,
  onPrev,
  onNext,
  onToday,
  isRefreshing = false,
}: CalendarHeaderProps) {
  return (
    <div className="flex items-center justify-between border-b border-border-token pb-3">
      <div className="flex items-center gap-2">
        {/* ...existing Prev button... */}
        <span className="font-serif text-xl font-medium tabular-nums text-fg">
          {formatRange(weekStart, weekEnd)}
        </span>
        {isRefreshing && (
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-fg-faint"
            aria-label="Refreshing"
          />
        )}
        {/* ...existing Next button... */}
      </div>
      {/* ...existing Today button... */}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter @ics-select/web typecheck
```

Expected: no errors.

- [ ] **Step 5: Manual verification (local)**

```bash
pnpm dev
```

1. Open `/me/calendar`, let it load once, reload — the grid should paint immediately from cache; header shows the pulsing refresh dot for a moment.
2. DevTools → Application → Local Storage: entries under `ics:calendar:v1:YYYY-MM-DD` should appear and update.
3. Reschedule an ICS event via drag — reload — the new time persists (cache is written on `onSettled`).
4. Clear localStorage → reload → skeleton reappears briefly → then grid.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/queries/me-calendar.ts apps/web/app/(member)/me/calendar/page.tsx apps/web/components/member/calendar/calendar-header.tsx
git commit -m "feat(web): SWR localStorage cache for /me/calendar

useMeCalendarWeek reads the cached week synchronously into initialData
so the grid paints before the network round-trip completes; every fresh
fetch (and every reschedule) writes back. Header shows a pulsing dot
while a background refetch is in flight. Sidebar grid template narrows
from 320 to 280px as part of the tighter layout pass."
```

---

## Task 7: Frontend — lazy-load `CalendarGrid`

Pulls the ~250 KB FullCalendar bundle out of the page's initial JS.

**Files:**
- Create: `apps/web/components/member/calendar/calendar-grid-skeleton.tsx`
- Modify: `apps/web/app/(member)/me/calendar/page.tsx`

- [ ] **Step 1: Create the grid-area skeleton**

Create `apps/web/components/member/calendar/calendar-grid-skeleton.tsx`:

```tsx
export function CalendarGridSkeleton() {
  return (
    <div
      className="grid h-[70vh] grid-cols-7 gap-px rounded-input border border-border-token bg-border-token overflow-hidden"
      aria-label="Loading calendar grid"
    >
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="animate-pulse bg-bg-subtle" />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Swap the static import for `next/dynamic`**

In `apps/web/app/(member)/me/calendar/page.tsx`, replace the current `CalendarGrid` import line with:

```tsx
import dynamic from 'next/dynamic';
import { CalendarGridSkeleton } from '../../../../components/member/calendar/calendar-grid-skeleton';

const CalendarGrid = dynamic(
  () =>
    import('../../../../components/member/calendar/calendar-grid').then((m) => m.CalendarGrid),
  { ssr: false, loading: () => <CalendarGridSkeleton /> },
);
```

All existing usages of `<CalendarGrid ... />` inside the page JSX stay identical — the dynamic import preserves the prop shape because of the `.then((m) => m.CalendarGrid)` extraction.

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @ics-select/web typecheck
```

Expected: no errors.

- [ ] **Step 4: Build and inspect the bundle**

```bash
pnpm --filter @ics-select/web build
```

Expected: build succeeds. Scan the Next.js route summary printed at the end — the `/me/calendar` page's First Load JS should drop meaningfully vs. the prior build (FullCalendar chunks are now separate). If Next prints a route-by-route table, confirm `/me/calendar` is smaller than it was.

- [ ] **Step 5: Manual verification**

```bash
pnpm --filter @ics-select/web dev
```

Open `/me/calendar` with DevTools → Network → throttle "Slow 3G". Header + sidebar should render before the grid chunk finishes loading; the grid area shows the 7-column skeleton during the gap.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/member/calendar/calendar-grid-skeleton.tsx apps/web/app/(member)/me/calendar/page.tsx
git commit -m "perf(web): lazy-load FullCalendar bundle for /me/calendar

CalendarGrid becomes a next/dynamic import with ssr=false so the ~250KB
FullCalendar chunks stop blocking the page's initial paint. Header and
sidebar now render before the grid arrives; the grid area shows a
dedicated skeleton during the gap."
```

---

## Task 8: Visual — FullCalendar dark-mode CSS remap

Rework the `.ics-calendar-grid` token mapping so cards read against the grid and accents become visible in dark mode.

**Files:**
- Modify: `apps/web/app/globals.css:379-417` (`.ics-calendar-grid` block).

- [ ] **Step 1: Remap the FullCalendar CSS variables**

Replace the existing `.ics-calendar-grid { ... --fc-*: ... }` block with:

```css
.ics-calendar-grid {
  --fc-border-color: hsl(var(--border));
  --fc-page-bg-color: hsl(var(--bg));
  --fc-neutral-bg-color: hsl(var(--bg-subtle));
  --fc-today-bg-color: hsl(var(--primary) / 0.08);
  --fc-now-indicator-color: hsl(var(--primary));
  --fc-event-border-color: transparent;
  --fc-event-bg-color: transparent;
  --fc-event-text-color: hsl(var(--fg));
  font-family: 'Inter', ui-sans-serif, system-ui, sans-serif;
}

[data-theme='dark'] .ics-calendar-grid {
  --fc-today-bg-color: hsl(var(--primary) / 0.12);
}

.ics-calendar-grid .fc-col-header-cell {
  border-bottom: 1px solid hsl(var(--border-strong));
}

.ics-calendar-grid .fc-timegrid-now-indicator-line {
  border-top-width: 2px;
  position: relative;
}

.ics-calendar-grid .fc-timegrid-now-indicator-line::before {
  content: '';
  position: absolute;
  left: -4px;
  top: -4px;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: hsl(var(--primary));
}
```

Keep the existing `.fc-col-header-cell-cushion`, `.fc-timegrid-axis-cushion`, `.fc-timegrid-slot-label-cushion`, `.fc-event`, `.fc-timegrid-event .fc-event-main`, and `.fc-scrollgrid` rules unchanged — they stay as they are.

- [ ] **Step 2: Manual verification — both themes**

```bash
pnpm --filter @ics-select/web dev
```

Open `/me/calendar` in both light and dark (toggle via the settings page or `next-themes`):
- Light: ICS cards sit clearly on top of the grid. Today column has a faint indigo tint. Now indicator is a 2px indigo line with a dot at the left edge.
- Dark: Same impressions, with a slightly more present today tint and readable event cards (not blending into the grid background).

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "style(web): fix FullCalendar dark-mode contrast

Page background now uses --bg so --surface event cards visually sit on
top of the grid. Today tint bumped to a visible level in both themes
(0.08 light / 0.12 dark). Now indicator thickens to 2px + gains a left
dot. Day-header row switches to --border-strong for a stronger anchor."
```

---

## Task 9: Visual — External events + legend + sidebar polish

The remaining visual items from the spec.

**Files:**
- Modify: `apps/web/components/member/calendar/calendar-event-external.tsx`
- Modify: `apps/web/components/member/calendar/calendar-legend.tsx`

(Sidebar grid template `280px_1fr` was already landed in Task 6 Step 2.)

- [ ] **Step 1: External event — transparent background + dashed border**

In `apps/web/components/member/calendar/calendar-event-external.tsx`, change the root div class from `bg-bg-subtle` to `border border-dashed border-border-token`:

```tsx
return (
  <div className="flex h-full flex-col overflow-hidden rounded-input border border-dashed border-border-token px-2 py-1">
    <span className="truncate font-sans text-[11px] font-medium text-fg-soft">
      {event.title}
    </span>
    <div className="flex items-center gap-2 font-sans text-[10px] tabular-nums text-fg-mute">
      <span>{timeLabel}</span>
      {event.location && (
        <span className="inline-flex items-center gap-0.5">
          <MapPin className="h-2.5 w-2.5" strokeWidth={1.5} />
          <span className="max-w-[80px] truncate">{event.location}</span>
        </span>
      )}
      {event.meetLink && <Video className="h-2.5 w-2.5" strokeWidth={1.5} />}
    </div>
  </div>
);
```

- [ ] **Step 2: Legend — collapsible**

Rewrite `apps/web/components/member/calendar/calendar-legend.tsx`:

```tsx
const ITEMS: { label: string; cls: string }[] = [
  { label: 'Not yet', cls: 'bg-outcome-pending' },
  { label: 'Nailed it', cls: 'bg-outcome-done-easy' },
  { label: 'Got it (hard)', cls: 'bg-outcome-done-hard' },
  { label: 'Had doubts', cls: 'bg-outcome-doubts' },
  { label: 'Stuck', cls: 'bg-outcome-stuck' },
];

export function CalendarLegend() {
  return (
    <details className="border-t border-border-token pt-4 font-mono text-[10px] uppercase tracking-eyebrow text-fg-mute">
      <summary className="flex cursor-pointer items-center gap-2 list-none">
        <span className="font-semibold">Outcomes</span>
        <span className="flex items-center gap-1">
          {ITEMS.map(({ label, cls }) => (
            <span key={label} className={`inline-block h-2 w-2 rounded-full ${cls}`} aria-hidden />
          ))}
        </span>
      </summary>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        {ITEMS.map(({ label, cls }) => (
          <span key={label} className="inline-flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />
            {label}
          </span>
        ))}
      </div>
    </details>
  );
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @ics-select/web typecheck
```

Expected: green.

- [ ] **Step 4: Manual verification**

```bash
pnpm --filter @ics-select/web dev
```

- External events now read as outlined-dashed shells, not filled cards — visually subordinate to ICS.
- Legend renders as "Outcomes ● ● ● ● ●"; clicking expands the labelled list.
- Whole row reads quieter than before.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/member/calendar/calendar-event-external.tsx apps/web/components/member/calendar/calendar-legend.tsx
git commit -m "style(web): quieter external events + collapsible legend

External events lose the filled background and use a dashed outline so
they read as 'not yours'. Legend collapses to a row of dots by default;
labels appear on click."
```

---

## Task 10: Playwright — keep the page regression-free

Quick smoke that the page still renders end-to-end with the new cache/dynamic-import flow.

**Files:**
- Check existing Playwright spec coverage: run `git grep -l calendar apps/web/tests || true`. If `apps/web/tests/` has an existing calendar spec, update snapshots. If not, this task is a no-op.

- [ ] **Step 1: Inspect existing Playwright tests**

```bash
ls apps/web/tests
grep -l calendar apps/web/tests/*.ts apps/web/tests/*.spec.ts 2>/dev/null || echo 'no calendar specs'
```

- [ ] **Step 2: Run the full Playwright suite**

```bash
pnpm --filter @ics-select/web test
```

Expected: green. If snapshots fail due to the visual changes and the diffs are correct, regenerate with:

```bash
pnpm --filter @ics-select/web test:update
```

Inspect the updated PNGs before committing to confirm the diffs are only the intended visual changes.

- [ ] **Step 3: Commit snapshot updates (only if Step 2 regenerated them)**

```bash
git add apps/web/tests
git commit -m "test(web): refresh calendar playwright snapshots after visual pass"
```

---

## Task 11: Final verification

- [ ] **Step 1: Run all project checks**

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Expected: green across all three.

- [ ] **Step 2: Manual smoke against the full flow**

```bash
pnpm dev
```

1. Fresh session (cleared localStorage): `/me/calendar` loads with skeleton → grid.
2. Reload: grid paints instantly from cache; refreshing dot appears and disappears.
3. Toggle dark mode: cards, today tint, now indicator all read clearly.
4. Reschedule an ICS block by drag: optimistic update holds; reload still shows the new time.
5. External event renders as dashed outline; clicking opens its popover.
6. Network tab: `/me/calendar?weekStart=...` response size on repeated hits is noticeably smaller than before (partial projection working). First repeat hit within ~5 min of the prior one completes faster (auth cache working).

- [ ] **Step 3: No new commit unless something broke in Step 2**

The eleven commits landed across Tasks 1–10 are the change set. If Step 2 surfaces a regression, open a follow-up fix commit narrating what broke and why.

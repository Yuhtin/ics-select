# Theme preference + `/me/settings` redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persisted `themePreference` (LIGHT / DARK) on User, collect it in a new onboarding step with live preview, expose it in a redesigned `/me/settings`, and extract shared form widgets between onboarding and settings so they stop diverging.

**Architecture:** localStorage remains the runtime source of truth; every theme change also fire-and-forget writes to the DB via `PATCH /me/theme`. A central `useThemeWithSync` hook is the single surface every theme-changing component consumes (ThemeToggle, ThemePicker). Settings redesign consumes extracted widgets (`<TrackPicker>`, `<AvailabilityPresets>`, `<SessionLengthPresets>`, `<ThemePicker>`) that the onboarding also consumes — single source of visual truth.

**Tech Stack:** Prisma (PostgreSQL), NestJS + Zod inline validation, Next.js 15 App Router, next-themes, TanStack Query, Tailwind v2 tokens (`bg-surface`, `text-fg`, `border-border`), Framer Motion, lucide-react.

**Spec:** `docs/superpowers/specs/2026-04-20-theme-preference-and-settings-redesign-design.md`

---

## File Structure

### Created
- `packages/prisma/prisma/migrations/j_user_theme_preference/migration.sql` — enum + 2 columns on User.
- `packages/shared/src/domain/theme.ts` — Zod schema + TS types.
- `apps/web/lib/queries/me-theme.ts` — `useUpdateTheme` TanStack mutation.
- `apps/web/lib/theme/use-theme-sync.ts` — `useThemeWithSync` hook (next-themes + fire-and-forget DB write).
- `apps/web/components/member/theme-picker.tsx` — 2-card picker with SVG mini-previews.
- `apps/web/components/member/track-picker.tsx` — extracted from onboarding step 2.
- `apps/web/components/member/availability-presets.tsx` — extracted from onboarding step 3 (daily pill grid).
- `apps/web/components/member/session-length-presets.tsx` — extracted from onboarding step 3 (session length pills).

### Modified
- `packages/prisma/prisma/schema.prisma` — `ThemePreference` enum + two nullable fields on `User`.
- `packages/shared/src/domain/index.ts` — re-export theme domain.
- `apps/api/src/me/me.controller.ts` — add `@Patch('theme')` method.
- `apps/api/src/me/me.service.ts` — add `updateThemePreference(userId, pref)`.
- `apps/api/src/me/me.service.spec.ts` — cover new service method.
- `apps/web/components/ui/theme-toggle.tsx` — swap `useTheme` → `useThemeWithSync`.
- `apps/web/components/member/google-status-card.tsx` — add connected dot + email meta; drop `shadow-lift` from disconnected.
- `apps/web/components/member/profile-fields.tsx` — consume `PhoneInput` + `TrackPicker`.
- `apps/web/components/member/availability-grid.tsx` — consume `AvailabilityPresets` + `SessionLengthPresets`.
- `apps/web/app/(member)/me/settings/page.tsx` — add Appearance section; replace `<hr>` + `<h2>` with `<SectionLabel>`; use `useThemeWithSync`.
- `apps/web/app/(member)/me/onboarding/page.tsx` — add step 4; swap inline widgets for extracted ones; 3→4 in progress.

---

## Phase A — Database + API

### Task A1: Prisma schema

**Files:**
- Modify: `packages/prisma/prisma/schema.prisma`

- [ ] **Step 1: Add `ThemePreference` enum next to the other enums**

Insert after the `AlertType` enum block (around line 74), before `model User`:

```prisma
enum ThemePreference {
  LIGHT
  DARK
}
```

- [ ] **Step 2: Add two fields to `model User`**

Add after `updatedAt` line (around line 85), before the first relation line:

```prisma
  themePreference     ThemePreference?
  themePreferenceAt   DateTime?
```

- [ ] **Step 3: Run `prisma format`**

```bash
pnpm --filter @ics-select/prisma exec prisma format
```

Expected: no output, file reformatted.

- [ ] **Step 4: Commit**

```bash
git add packages/prisma/prisma/schema.prisma
git commit -m "feat(prisma): add ThemePreference enum + columns on User"
```

---

### Task A2: Migration SQL

**Files:**
- Create: `packages/prisma/prisma/migrations/j_user_theme_preference/migration.sql`

Naming note: existing migrations go `b_`…`i_`. Next is `j_`.

- [ ] **Step 1: Create migration file**

```sql
-- ThemePreference: user's chosen appearance. localStorage is the runtime
-- source of truth; this column is written on every change so analytics can
-- chart adoption and (in the future) hydrate on fresh devices.
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK');

ALTER TABLE "User"
  ADD COLUMN "themePreference"   "ThemePreference",
  ADD COLUMN "themePreferenceAt" TIMESTAMP(3);
```

- [ ] **Step 2: Apply migration locally**

```bash
pnpm --filter @ics-select/prisma exec prisma migrate dev --name j_user_theme_preference --create-only
```

Expected: file lands in the new folder. If Prisma wants to also auto-write SQL, accept — diff should match what we wrote.

```bash
pnpm --filter @ics-select/prisma exec prisma migrate dev
```

Expected: migration applies, client regenerates. (Requires local Postgres running — see CLAUDE.md `docker compose up -d postgres`.)

- [ ] **Step 3: Regenerate Prisma client**

```bash
pnpm db:generate
```

Expected: `generated/client` rebuilds. The `ThemePreference` enum is now a TS type.

- [ ] **Step 4: Commit**

```bash
git add packages/prisma/prisma/migrations/j_user_theme_preference/
git commit -m "feat(prisma): migration j — user.themePreference"
```

---

### Task A3: Shared Zod schema

**Files:**
- Create: `packages/shared/src/domain/theme.ts`
- Modify: `packages/shared/src/domain/index.ts`

- [ ] **Step 1: Create the domain file**

```ts
// packages/shared/src/domain/theme.ts
import { z } from 'zod';

export const THEME_PREFERENCES = ['LIGHT', 'DARK'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const updateThemePreferenceSchema = z.object({
  themePreference: z.enum(THEME_PREFERENCES),
});

export type UpdateThemePreferenceInput = z.infer<typeof updateThemePreferenceSchema>;
```

- [ ] **Step 2: Re-export from domain index**

Edit `packages/shared/src/domain/index.ts`. Current content:

```ts
export * from './outcome.js';
export * from './track.js';
export * from './alert.js';
```

Add one line at the end:

```ts
export * from './theme.js';
```

- [ ] **Step 3: Build the shared package**

```bash
pnpm --filter @ics-select/shared build
```

Expected: `packages/shared/dist/` updates. Required because `apps/api` resolves `@ics-select/shared` at runtime (see CLAUDE.md).

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/domain/theme.ts packages/shared/src/domain/index.ts packages/shared/dist
git commit -m "feat(shared): theme preference domain schema"
```

---

### Task A4: Service method + unit test

**Files:**
- Modify: `apps/api/src/me/me.service.ts`
- Modify: `apps/api/src/me/me.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Open `apps/api/src/me/me.service.spec.ts`. The existing `fakePrisma` already stubs `user.findUnique` and `user.delete`. Extend it with an `update` mock and add a new describe block.

Replace the current `fakePrisma` body's `user:` section:

```ts
  return {
    user: {
      findUnique: jest.fn(async () => user),
      delete: jest.fn(async () => user),
      update: jest.fn(async ({ data }: { data: any }) => ({ ...user, ...data })),
    },
    memberAvailability: { findUnique: jest.fn(async () => null) },
    cycleMembership: { findMany: jest.fn(async () => []) },
    weeklyPlan: { findMany: jest.fn(async () => []) },
    classAttendance: { findMany: jest.fn(async () => []) },
  };
```

Append this test to the `describe('MeService', ...)` block:

```ts
  it('updateThemePreference writes both columns keyed on userId', async () => {
    const prisma = fakePrisma();
    const svc = new MeService(prisma as any);
    const before = Date.now();
    await svc.updateThemePreference('u-1', 'DARK');
    const after = Date.now();

    expect(prisma.user.update).toHaveBeenCalledTimes(1);
    const call = prisma.user.update.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'u-1' });
    expect(call.data.themePreference).toBe('DARK');
    const writtenAt = call.data.themePreferenceAt as Date;
    expect(writtenAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(writtenAt.getTime()).toBeLessThanOrEqual(after);
  });

  it('updateThemePreference is idempotent — second call overwrites', async () => {
    const prisma = fakePrisma();
    const svc = new MeService(prisma as any);
    await svc.updateThemePreference('u-1', 'LIGHT');
    await svc.updateThemePreference('u-1', 'DARK');
    expect(prisma.user.update).toHaveBeenCalledTimes(2);
    expect(prisma.user.update.mock.calls[1][0].data.themePreference).toBe('DARK');
  });
```

- [ ] **Step 2: Run the tests, verify they fail**

```bash
pnpm --filter @ics-select/api test -- --testPathPattern me.service
```

Expected: FAIL with `svc.updateThemePreference is not a function`.

- [ ] **Step 3: Implement the service method**

Open `apps/api/src/me/me.service.ts`. Add at top of file:

```ts
import type { ThemePreference } from '@ics-select/shared';
```

Add this method inside the `MeService` class, after `deleteUser`:

```ts
  async updateThemePreference(userId: string, preference: ThemePreference) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        themePreference: preference,
        themePreferenceAt: new Date(),
      },
    });
    return { ok: true };
  }
```

- [ ] **Step 4: Run tests, verify pass**

```bash
pnpm --filter @ics-select/api test -- --testPathPattern me.service
```

Expected: PASS. All 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/me/me.service.ts apps/api/src/me/me.service.spec.ts
git commit -m "feat(api): MeService.updateThemePreference"
```

---

### Task A5: Controller route + controller test

**Files:**
- Modify: `apps/api/src/me/me.controller.ts`
- Modify: `apps/api/src/me/me.service.spec.ts`

**Spec deviation note:** the spec also called for an e2e test at `apps/api/test/me-theme.e2e-spec.ts`. The codebase currently has **no e2e infrastructure** (no `apps/api/test/` directory, no e2e-spec file anywhere, no `test:e2e` script in `apps/api/package.json`). Scaffolding an entire e2e framework for one endpoint is out of scope; we cover the controller with a lightweight Nest controller unit test (`me.service.spec.ts`) instead. If e2e infra is added later in the project, add this endpoint to the first e2e suite.

- [ ] **Step 1: Add the route method**

Replace the full content of `apps/api/src/me/me.controller.ts`:

```ts
import { Body, Controller, Delete, Get, HttpCode, Patch } from '@nestjs/common';
import { updateThemePreferenceSchema } from '@ics-select/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { JwtStrategyPayload } from '../auth/strategies/jwt.strategy.js';
import { MeService } from './me.service.js';

@Controller('me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get('export')
  export(@CurrentUser() user: JwtStrategyPayload) {
    return this.me.exportForUser(user.sub);
  }

  @Delete()
  delete(@CurrentUser() user: JwtStrategyPayload) {
    return this.me.deleteUser(user.sub);
  }

  @Patch('theme')
  @HttpCode(204)
  async updateTheme(
    @CurrentUser() user: JwtStrategyPayload,
    @Body() body: unknown,
  ) {
    const parsed = updateThemePreferenceSchema.parse(body);
    await this.me.updateThemePreference(user.sub, parsed.themePreference);
  }
}
```

Notes: Zod inline matches `UsersController.invite` convention. `@HttpCode(204)` because we don't return a body.

- [ ] **Step 2: Build the API to confirm compile**

```bash
pnpm --filter @ics-select/api build
```

Expected: no TS errors. (Skips lint — next task handles lint+typecheck.)

- [ ] **Step 3: Add a controller-level test**

Append to `apps/api/src/me/me.service.spec.ts`:

```ts
import { MeController } from './me.controller';

describe('MeController', () => {
  it('updateTheme parses body and delegates to service', async () => {
    const prisma = fakePrisma();
    const svc = new MeService(prisma as any);
    const controller = new MeController(svc);
    const user = { sub: 'u-1', email: 'a@x.com', role: 'MEMBER' } as any;

    await controller.updateTheme(user, { themePreference: 'DARK' });

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u-1' },
        data: expect.objectContaining({ themePreference: 'DARK' }),
      }),
    );
  });

  it('updateTheme rejects invalid enum via Zod', async () => {
    const prisma = fakePrisma();
    const svc = new MeService(prisma as any);
    const controller = new MeController(svc);
    const user = { sub: 'u-1', email: 'a@x.com', role: 'MEMBER' } as any;

    await expect(
      controller.updateTheme(user, { themePreference: 'SYSTEM' } as any),
    ).rejects.toThrow();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
```

Run:

```bash
pnpm --filter @ics-select/api test -- --testPathPattern me.service
```

Expected: all tests PASS.

- [ ] **Step 4: Smoke test manually (optional but recommended)**

Start the stack:

```bash
pnpm dev
```

In another shell, get a JWT cookie by logging in to the frontend, then:

```bash
curl -X PATCH http://localhost:3001/me/theme \
  -H 'Content-Type: application/json' \
  -H 'Cookie: <your ics session cookie>' \
  -d '{"themePreference":"DARK"}' -i
```

Expected: `HTTP/1.1 204 No Content`. Check Prisma Studio (`pnpm --filter @ics-select/prisma exec prisma studio`) — the row has `themePreference=DARK` and `themePreferenceAt` filled.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/me/me.controller.ts apps/api/src/me/me.service.spec.ts
git commit -m "feat(api): PATCH /me/theme endpoint"
```

---

## Phase B — Client persistence layer

### Task B1: `useUpdateTheme` query hook

**Files:**
- Create: `apps/web/lib/queries/me-theme.ts`

- [ ] **Step 1: Create the hook**

```ts
// apps/web/lib/queries/me-theme.ts
'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { ThemePreference } from '@ics-select/shared';
import { apiFetch } from '../api/client';

export function useUpdateTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { themePreference: ThemePreference }) =>
      apiFetch('/me/theme', { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}
```

Pattern mirrors `useUpdateAvailability` / `useUpdateProfile` in `lib/queries/me-settings.ts`.

- [ ] **Step 2: Typecheck web**

```bash
pnpm --filter @ics-select/web typecheck
```

Expected: no errors. If the shared package types aren't picked up, confirm `packages/shared/dist` exists.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/queries/me-theme.ts
git commit -m "feat(web): useUpdateTheme mutation"
```

---

### Task B2: `useThemeWithSync` central hook

**Files:**
- Create: `apps/web/lib/theme/use-theme-sync.ts`

- [ ] **Step 1: Create the hook**

```ts
// apps/web/lib/theme/use-theme-sync.ts
'use client';
import { useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '../auth/auth-context';
import { useUpdateTheme } from '../queries/me-theme';

export function useThemeWithSync() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const update = useUpdateTheme();
  const { user } = useAuth();

  const setAndPersist = useCallback(
    (next: 'light' | 'dark') => {
      setTheme(next);
      if (user) {
        update.mutate(
          { themePreference: next.toUpperCase() as 'LIGHT' | 'DARK' },
          {
            onError: (err) => {
              // Fire-and-forget — localStorage already has the choice.
              // Log for debugging; never surface to user.
              console.warn('[theme] failed to persist preference', err);
            },
          },
        );
      }
    },
    [setTheme, update, user],
  );

  return { theme, resolvedTheme, setTheme: setAndPersist, isPending: update.isPending };
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @ics-select/web typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/theme/use-theme-sync.ts
git commit -m "feat(web): useThemeWithSync central hook"
```

---

### Task B3: Migrate `ThemeToggle` to sync hook

**Files:**
- Modify: `apps/web/components/ui/theme-toggle.tsx`

- [ ] **Step 1: Swap the hook import**

Replace the import and the hook call. The rest of the component is unchanged.

Old (line 4 + line 13):

```tsx
import { useTheme } from 'next-themes';
// ...
  const { resolvedTheme, setTheme } = useTheme();
```

New:

```tsx
import { useThemeWithSync } from '../../lib/theme/use-theme-sync';
// ...
  const { resolvedTheme, setTheme } = useThemeWithSync();
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @ics-select/web typecheck
```

Expected: no errors.

- [ ] **Step 3: Manual smoke**

Run `pnpm dev`, log in, click the sun/moon icon in the topbar, verify:
- Site switches theme instantly.
- Network tab shows `PATCH /me/theme` with `{"themePreference":"DARK"}` (or LIGHT).
- `localStorage.getItem('ics-theme')` has the new value.
- Prisma Studio shows `User.themePreference` updated.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/ui/theme-toggle.tsx
git commit -m "refactor(web): ThemeToggle uses useThemeWithSync"
```

---

## Phase C — Extract shared widgets

Each extraction is: copy the JSX out of `onboarding/page.tsx` into a new file, turn it into a controlled component, replace the inline block in the onboarding with the new component call. Visual output must be identical.

### Task C1: Extract `<TrackPicker>`

**Files:**
- Create: `apps/web/components/member/track-picker.tsx`
- Modify: `apps/web/app/(member)/me/onboarding/page.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/member/track-picker.tsx
'use client';
import { clsx } from 'clsx';
import { Check } from 'lucide-react';
import { TRACKS } from '@ics-select/shared';

const TRACK_LABELS: Record<string, string> = {
  BIG_TECH: 'Big Tech',
  CONSULTING_TECH: 'Consulting Tech',
  COMPETITIVE_PROGRAMMING: 'Competitive Programming',
  STARTUP: 'Startup',
  OTHER: 'Other',
};

const TRACK_DESCRIPTIONS: Record<string, string> = {
  BIG_TECH: 'Google, Meta, Amazon, Microsoft. Algorithms and system design.',
  CONSULTING_TECH: 'McKinsey Tech, BCG GAMMA. Case-style technical interviews.',
  COMPETITIVE_PROGRAMMING: 'ACM ICPC, IOI. Competitive patterns, tight problem sets.',
  STARTUP: 'High-agency engineering. Ship fast, reason from first principles.',
  OTHER: "I'll sort the specifics with the director.",
};

interface TrackPickerProps {
  value: string;
  onChange: (next: string) => void;
}

export function TrackPicker({ value, onChange }: TrackPickerProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {TRACKS.map((t) => {
        const active = value === t;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={clsx(
              'group relative flex h-full flex-col items-start gap-1.5 rounded-tile border px-4 py-3.5 text-left transition-all',
              active
                ? 'border-primary bg-primary-soft ring-2 ring-primary/30'
                : 'border-border-token bg-surface hover:-translate-y-[1px] hover:border-border-strong',
            )}
          >
            <span
              className={clsx(
                'font-sans text-sm font-semibold',
                active ? 'text-primary' : 'text-fg',
              )}
            >
              {TRACK_LABELS[t] ?? t}
            </span>
            <span className="font-sans text-[13px] leading-relaxed text-fg-soft">
              {TRACK_DESCRIPTIONS[t]}
            </span>
            {active && (
              <span
                className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-fg"
                aria-hidden
              >
                <Check className="h-3 w-3" strokeWidth={2.5} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
```

Note: uses `strokeWidth={2.5}` to match the existing onboarding convention exactly (preserving visual parity).

- [ ] **Step 2: Replace inline block in onboarding**

Open `apps/web/app/(member)/me/onboarding/page.tsx`. Find the step 1 block (currently step index `1` in the switch, rendering the track grid). Replace the `<div className="grid gap-3 sm:grid-cols-2">...</div>` (lines ~188–226) with:

```tsx
                <TrackPicker value={track} onChange={setTrack} />
```

Add the import at the top of the file:

```tsx
import { TrackPicker } from '../../../../components/member/track-picker';
```

Remove the now-unused `TRACK_LABELS`, `TRACK_DESCRIPTIONS` constants and the `Check` / `clsx` imports **only if** they are not used by other steps. Verify before removing (step 2 Availability uses `clsx`, Check is used in Progress). Keep them if still referenced.

- [ ] **Step 3: Typecheck + manual smoke**

```bash
pnpm --filter @ics-select/web typecheck
```

Start dev, open `/me/onboarding`, confirm step 2 looks exactly like before (border, selection ring, descriptions). If any spacing changed, diff against git HEAD.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/member/track-picker.tsx apps/web/app/\(member\)/me/onboarding/page.tsx
git commit -m "refactor(web): extract TrackPicker"
```

---

### Task C2: Extract `<AvailabilityPresets>`

**Files:**
- Create: `apps/web/components/member/availability-presets.tsx`
- Modify: `apps/web/app/(member)/me/onboarding/page.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/member/availability-presets.tsx
'use client';
import { clsx } from 'clsx';

export type DayKey =
  | 'mondayMinutes'
  | 'tuesdayMinutes'
  | 'wednesdayMinutes'
  | 'thursdayMinutes'
  | 'fridayMinutes'
  | 'saturdayMinutes'
  | 'sundayMinutes';

export type AvailabilityMinutes = Record<DayKey, number>;

const DAYS: Array<{ key: DayKey; short: string }> = [
  { key: 'mondayMinutes', short: 'Mon' },
  { key: 'tuesdayMinutes', short: 'Tue' },
  { key: 'wednesdayMinutes', short: 'Wed' },
  { key: 'thursdayMinutes', short: 'Thu' },
  { key: 'fridayMinutes', short: 'Fri' },
  { key: 'saturdayMinutes', short: 'Sat' },
  { key: 'sundayMinutes', short: 'Sun' },
];

const MINUTE_PRESETS = [0, 30, 60, 90, 120, 180];

interface Props {
  value: AvailabilityMinutes;
  onChange: (next: AvailabilityMinutes) => void;
}

export function AvailabilityPresets({ value, onChange }: Props) {
  return (
    <div className="space-y-2.5">
      {DAYS.map((d) => (
        <div
          key={d.key}
          className="flex items-center gap-3 rounded-input border border-border-token bg-surface px-3 py-2"
        >
          <span className="w-14 font-mono text-[11px] font-semibold uppercase tracking-eyebrow text-fg-mute">
            {d.short}
          </span>
          <div className="flex flex-1 flex-wrap gap-1.5">
            {MINUTE_PRESETS.map((mins) => {
              const active = value[d.key] === mins;
              return (
                <button
                  key={mins}
                  type="button"
                  onClick={() => onChange({ ...value, [d.key]: mins })}
                  className={clsx(
                    'rounded-pill border px-2.5 py-1 font-mono text-[11px] font-semibold transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-fg'
                      : 'border-border-token bg-surface text-fg-soft hover:border-border-strong hover:text-fg',
                  )}
                >
                  {mins === 0 ? 'off' : `${mins}m`}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Replace inline block in onboarding**

Open the onboarding page. Find the step 2 block (step index `2` in the switch, currently the `<div className="space-y-2.5">...</div>` rendering the day rows).

Replace that block with:

```tsx
                <AvailabilityPresets value={availability} onChange={setAvailability} />
```

Add import (single combined line):

```tsx
import {
  AvailabilityPresets,
  type AvailabilityMinutes,
} from '../../../../components/member/availability-presets';
```

Remove the now-unused `DAYS` array and `MINUTE_PRESETS` constant from the onboarding page. Also remove the local `DayKey` type declaration (lines 45–52 in the old file) — it was only used to index `DAYS`, which is gone. Replace the local `Availability` type alias with the imported `AvailabilityMinutes`:

Before (around line 54):

```tsx
type Availability = Record<DayKey, number>;
```

After:

```tsx
type Availability = AvailabilityMinutes;
```

- [ ] **Step 3: Typecheck + smoke**

```bash
pnpm --filter @ics-select/web typecheck
```

Start dev, go to onboarding step 3. Verify 7-day grid looks exactly as before.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/member/availability-presets.tsx apps/web/app/\(member\)/me/onboarding/page.tsx
git commit -m "refactor(web): extract AvailabilityPresets"
```

---

### Task C3: Extract `<SessionLengthPresets>`

**Files:**
- Create: `apps/web/components/member/session-length-presets.tsx`
- Modify: `apps/web/app/(member)/me/onboarding/page.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/member/session-length-presets.tsx
'use client';
import { clsx } from 'clsx';

const SESSION_PRESETS = [15, 30, 45, 60, 90];

interface Props {
  value: number;
  onChange: (next: number) => void;
}

export function SessionLengthPresets({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-2">
      {SESSION_PRESETS.map((mins) => {
        const active = value === mins;
        return (
          <button
            key={mins}
            type="button"
            onClick={() => onChange(mins)}
            className={clsx(
              'rounded-pill border px-3 py-1.5 font-mono text-[12px] font-semibold transition-colors',
              active
                ? 'border-primary bg-primary text-primary-fg'
                : 'border-border-token bg-surface text-fg-soft hover:border-border-strong hover:text-fg',
            )}
          >
            {mins} min
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Replace inline block in onboarding**

In the onboarding page step 2 block, replace the `<div className="mt-3 flex flex-wrap gap-2">...</div>` (the session-length pills) with:

```tsx
                  <SessionLengthPresets value={sessionMin} onChange={setSessionMin} />
```

Keep the surrounding eyebrow, heading, and paragraph. Add import:

```tsx
import { SessionLengthPresets } from '../../../../components/member/session-length-presets';
```

Remove the now-unused `SESSION_PRESETS` constant from the onboarding page.

- [ ] **Step 3: Typecheck + smoke**

```bash
pnpm --filter @ics-select/web typecheck
```

Visual diff onboarding step 3 — pills identical.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/member/session-length-presets.tsx apps/web/app/\(member\)/me/onboarding/page.tsx
git commit -m "refactor(web): extract SessionLengthPresets"
```

---

### Task C4: Create `<ThemePicker>`

**Files:**
- Create: `apps/web/components/member/theme-picker.tsx`

- [ ] **Step 1: Create the component**

```tsx
// apps/web/components/member/theme-picker.tsx
'use client';
import { clsx } from 'clsx';
import { Check } from 'lucide-react';

interface Props {
  value: 'light' | 'dark';
  onChange: (next: 'light' | 'dark') => void;
  /** Minor padding/sizing variation between onboarding and settings. */
  size?: 'onboarding' | 'settings';
}

export function ThemePicker({ value, onChange, size = 'onboarding' }: Props) {
  const padding = size === 'settings' ? 'p-3' : 'p-4';
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ThemeCard
        variant="light"
        active={value === 'light'}
        onClick={() => onChange('light')}
        padding={padding}
      />
      <ThemeCard
        variant="dark"
        active={value === 'dark'}
        onClick={() => onChange('dark')}
        padding={padding}
      />
    </div>
  );
}

interface CardProps {
  variant: 'light' | 'dark';
  active: boolean;
  onClick: () => void;
  padding: string;
}

function ThemeCard({ variant, active, onClick, padding }: CardProps) {
  const label = variant === 'light' ? 'Light' : 'Dark';
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        'group relative flex flex-col gap-3 rounded-tile border text-left transition-all',
        padding,
        active
          ? 'border-primary bg-primary-soft ring-2 ring-primary/30'
          : 'border-border-token bg-surface hover:-translate-y-[1px] hover:border-border-strong',
      )}
    >
      <ThemePreviewSvg variant={variant} />
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={clsx(
            'h-2 w-2 rounded-full',
            variant === 'light' ? 'bg-[#14181F]' : 'bg-[#F1F3F9]',
            variant === 'dark' && 'ring-1 ring-border-token',
          )}
        />
        <span
          className={clsx(
            'font-sans text-sm font-semibold',
            active ? 'text-primary' : 'text-fg',
          )}
        >
          {label}
        </span>
      </div>
      {active && (
        <span
          className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-fg"
          aria-hidden
        >
          <Check className="h-3 w-3" strokeWidth={2} />
        </span>
      )}
    </button>
  );
}

/**
 * Static SVG mini-preview. Colors are hardcoded so the "Dark" card looks dark
 * even when the site is currently in Light mode (and vice versa).
 */
function ThemePreviewSvg({ variant }: { variant: 'light' | 'dark' }) {
  const palette =
    variant === 'light'
      ? { bg: '#F7F8FA', subtle: '#F1F3F6', ink: '#14181F', inkSoft: '#4B525C', accent: '#4F46E5', rule: '#E4E7EC', surface: '#FFFFFF' }
      : { bg: '#161A23', subtle: '#1C202B', ink: '#F1F3F9', inkSoft: '#9AA0AB', accent: '#7B72F5', rule: '#2A2F3B', surface: '#1F242F' };

  return (
    <svg
      viewBox="0 0 160 96"
      role="img"
      aria-label={`${variant === 'light' ? 'Light' : 'Dark'} theme preview`}
      className="w-full rounded-[6px]"
    >
      <rect width="160" height="96" fill={palette.bg} rx="6" />
      {/* topbar */}
      <rect x="0" y="0" width="160" height="14" fill={palette.subtle} />
      <rect x="8" y="5" width="28" height="4" fill={palette.ink} rx="1" />
      <rect x="144" y="4" width="8" height="6" fill={palette.inkSoft} rx="1" />
      {/* sidebar */}
      <rect x="0" y="14" width="36" height="82" fill={palette.surface} stroke={palette.rule} />
      <rect x="6" y="22" width="22" height="3" fill={palette.inkSoft} rx="1" />
      <rect x="6" y="30" width="18" height="3" fill={palette.inkSoft} rx="1" />
      <rect x="6" y="38" width="22" height="3" fill={palette.accent} rx="1" />
      <rect x="6" y="46" width="14" height="3" fill={palette.inkSoft} rx="1" />
      {/* main card */}
      <rect x="44" y="22" width="108" height="66" fill={palette.surface} stroke={palette.rule} rx="4" />
      <rect x="50" y="30" width="48" height="5" fill={palette.ink} rx="1" />
      <rect x="50" y="40" width="80" height="3" fill={palette.inkSoft} rx="1" />
      <rect x="50" y="46" width="70" height="3" fill={palette.inkSoft} rx="1" />
      {/* list rows */}
      <rect x="50" y="58" width="3" height="8" fill={palette.accent} rx="1" />
      <rect x="57" y="58" width="60" height="3" fill={palette.ink} rx="1" />
      <rect x="57" y="64" width="36" height="2" fill={palette.inkSoft} rx="1" />
      <rect x="50" y="74" width="3" height="8" fill={palette.inkSoft} rx="1" />
      <rect x="57" y="74" width="54" height="3" fill={palette.ink} rx="1" />
      <rect x="57" y="80" width="30" height="2" fill={palette.inkSoft} rx="1" />
    </svg>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @ics-select/web typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/member/theme-picker.tsx
git commit -m "feat(web): ThemePicker component with SVG mini-previews"
```

---

## Phase D — Onboarding step 4

### Task D1: Wire step 4 into onboarding

**Files:**
- Modify: `apps/web/app/(member)/me/onboarding/page.tsx`

- [ ] **Step 1: Extend `StepId` + state**

Find `type StepId = 0 | 1 | 2;` (around line 69). Change to:

```tsx
type StepId = 0 | 1 | 2 | 3;
```

Find the component body (`export default function MemberOnboardingPage()`). Add the new imports at the top of the file:

```tsx
import { ThemePicker } from '../../../../components/member/theme-picker';
import { useThemeWithSync } from '../../../../lib/theme/use-theme-sync';
import { useUpdateTheme } from '../../../../lib/queries/me-theme';
```

Inside the component body, alongside the other hook calls:

```tsx
  const { resolvedTheme, setTheme } = useThemeWithSync();
  const updateTheme = useUpdateTheme();
```

- [ ] **Step 2: Update `canAdvance`**

Find:

```tsx
  const canAdvance = step === 0 ? phoneOk : step === 1 ? trackOk : availabilityOk;
```

Replace with:

```tsx
  const canAdvance =
    step === 0 ? phoneOk :
    step === 1 ? trackOk :
    step === 2 ? availabilityOk :
    true; // step 3 (theme) always has a default
```

- [ ] **Step 3: Update `handleFinish` to persist theme**

Find `handleFinish` (around line 102). Add one write before `refetch()`:

```tsx
      await updateProfile.mutateAsync({
        whatsappPhone: phone,
        targetTrack: track as (typeof TRACKS)[number],
      });
      await updateAvailability.mutateAsync({
        ...availability,
        preferredSessionMinutes: sessionMin,
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'America/Sao_Paulo',
      });
      // Theme was already persisted per-click via useThemeWithSync. This is a
      // belt-and-suspenders final write in case the user picked theme while
      // unauthenticated (we don't believe that's possible in this flow, but the
      // call is idempotent so we do it anyway). Failure does not block finish.
      try {
        const pref = (resolvedTheme === 'dark' ? 'DARK' : 'LIGHT') as 'LIGHT' | 'DARK';
        await updateTheme.mutateAsync({ themePreference: pref });
      } catch {
        // swallow — localStorage already has the choice
      }
      await refetch();
      router.replace('/me');
```

Update `submitting`:

```tsx
  const submitting =
    updateProfile.isPending || updateAvailability.isPending || updateTheme.isPending;
```

- [ ] **Step 4: Update the `Progress` component**

Find the `Progress` function (around line 369). Change the hardcoded `[0, 1, 2]` to `[0, 1, 2, 3]` and the hardcoded `{i < 2 && ...}` to `{i < 3 && ...}`:

```tsx
function Progress({ step }: { step: StepId }) {
  return (
    <ol className="flex items-center gap-3">
      {[0, 1, 2, 3].map((i) => {
        const state = i < step ? 'done' : i === step ? 'current' : 'pending';
        return (
          <li key={i} className="flex items-center gap-3">
            <motion.span
              initial={false}
              animate={{
                backgroundColor:
                  state === 'current'
                    ? 'hsl(var(--primary))'
                    : state === 'done'
                      ? 'hsl(var(--fg))'
                      : 'hsl(var(--bg-subtle))',
                color:
                  state === 'pending' ? 'hsl(var(--fg-mute))' : 'hsl(var(--primary-fg))',
                scale: state === 'current' ? 1.05 : 1,
              }}
              transition={{ duration: 0.3, ease: EASE }}
              className={clsx(
                'grid h-8 w-8 place-items-center rounded-full border font-mono text-[11px] font-bold tabular-nums',
                state === 'pending' ? 'border-border-token' : 'border-transparent',
              )}
              aria-label={`Step ${i + 1} ${state}`}
            >
              {state === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : i + 1}
            </motion.span>
            {i < 3 && (
              <motion.span
                initial={false}
                animate={{
                  backgroundColor:
                    i < step ? 'hsl(var(--fg))' : 'hsl(var(--bg-subtle))',
                }}
                transition={{ duration: 0.3, ease: EASE }}
                className="h-px w-6 sm:w-10"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 5: Update existing step eyebrows from "3" to "4"**

Find the three eyebrow strings and change `/ 3` to `/ 4`:

- `"Step 1 / 3 · WhatsApp"` → `"Step 1 / 4 · WhatsApp"`
- `"Step 2 / 3 · Track"` → `"Step 2 / 4 · Track"`
- `"Step 3 / 3 · Availability"` → `"Step 3 / 4 · Availability"`

Header copy: find `<h1 className="font-serif text-[44px]...">Three small things.</h1>` (line 140). Change to:

```tsx
<h1 className="font-serif text-[44px] font-medium leading-[1.05] tracking-tight text-fg md:text-[52px]">
  Four small things.
</h1>
```

- [ ] **Step 6: Render step 3 (ThemePicker)**

Inside the `<AnimatePresence>` block, after the `{step === 2 && ( ... )}` closing, add:

```tsx
            {step === 3 && (
              <StepCard
                eyebrow="Step 4 / 4 · Appearance"
                title="Dark or light?"
                subtitle="Preview below, the site switches as you pick. You can swap anytime in Settings."
              >
                <ThemePicker
                  value={(resolvedTheme === 'dark' ? 'dark' : 'light') as 'light' | 'dark'}
                  onChange={(next) => setTheme(next)}
                  size="onboarding"
                />
              </StepCard>
            )}
```

- [ ] **Step 7: Update Next/Finish button logic**

Find `{step < 2 ? ( ... ) : ( ... )}` (around line 324). Change `2` to `3`:

```tsx
        {step < 3 ? (
```

And update the `goTo` call one line up:

```tsx
            onClick={() => canAdvance && goTo((step + 1) as StepId)}
```

(unchanged — works automatically now that StepId is `0 | 1 | 2 | 3`).

- [ ] **Step 8: Typecheck + manual smoke**

```bash
pnpm --filter @ics-select/web typecheck
```

Clear onboarding state (delete the user's `whatsappPhone` + `CycleMembership` in Prisma Studio), log in, walk through all 4 steps. Verify:
- Progress shows 4 circles + 3 connectors.
- Eyebrows read "Step X / 4".
- Step 4 shows 2 theme cards; clicking "Dark" flips the entire onboarding to dark theme live.
- Finish button reaches `/me` and DB has `themePreference` set.

- [ ] **Step 9: Commit**

```bash
git add apps/web/app/\(member\)/me/onboarding/page.tsx
git commit -m "feat(web): onboarding step 4 — appearance preference"
```

---

## Phase E — `/me/settings` redesign

### Task E1: Refactor `ProfileFields` to consume extracted widgets

**Files:**
- Modify: `apps/web/components/member/profile-fields.tsx`

- [ ] **Step 1: Replace with extracted widgets**

Overwrite the file:

```tsx
// apps/web/components/member/profile-fields.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { Track } from '@ics-select/shared';
import { useUpdateProfile } from '../../lib/queries/me-settings';
import { SectionLabel } from '../ui/section-label';
import { Button } from '../ui/button';
import { PhoneInput } from './phone-input';
import { TrackPicker } from './track-picker';

interface ProfileFieldsProps {
  initialPhone: string | null;
  initialTrack: string | null;
}

export function ProfileFields({ initialPhone, initialTrack }: ProfileFieldsProps) {
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [track, setTrack] = useState<string>(initialTrack ?? '');
  const update = useUpdateProfile();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({
      whatsappPhone: phone.trim() || null,
      targetTrack: (track as Track) || null,
    });
  }

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      <div>
        <SectionLabel>WhatsApp phone</SectionLabel>
        <p className="mt-1 font-sans text-sm text-fg-soft">
          Used for program notifications. Include country code (e.g. +5511999999999).
        </p>
        <div className="mt-3 max-w-xs">
          <PhoneInput value={phone} onChange={setPhone} />
        </div>
      </div>

      <div>
        <SectionLabel>Career track</SectionLabel>
        <p className="mt-1 font-sans text-sm text-fg-soft">
          Informs the study plan focus for this cycle.
        </p>
        <div className="mt-3">
          <TrackPicker value={track} onChange={setTrack} />
        </div>
      </div>

      {update.isError && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="font-mono text-xs text-danger"
        >
          Failed to save. Please try again.
        </motion.p>
      )}
      {update.isSuccess && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="font-mono text-xs text-success"
        >
          Saved.
        </motion.p>
      )}

      <Button type="submit" disabled={update.isPending}>
        {update.isPending ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  );
}
```

Notes:
- `Track` type comes from `@ics-select/shared` — verify it's exported. If not exported, fall back to `(typeof TRACKS)[number]`.
- Used `text-fg-soft` / `text-danger` / `text-success` (v2 tokens, matching `track-picker.tsx`).

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @ics-select/web typecheck
```

Expected: no errors. If `Track` isn't exported, change to `import { TRACKS } from '@ics-select/shared'` and cast with `(typeof TRACKS)[number]`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/member/profile-fields.tsx
git commit -m "refactor(web): ProfileFields uses PhoneInput + TrackPicker"
```

---

### Task E2: Refactor `AvailabilityGrid` to consume extracted widgets

**Files:**
- Modify: `apps/web/components/member/availability-grid.tsx`

- [ ] **Step 1: Replace with extracted widgets**

Overwrite the file:

```tsx
// apps/web/components/member/availability-grid.tsx
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import type { AvailabilityResponse } from '../../lib/queries/me-settings';
import { useUpdateAvailability } from '../../lib/queries/me-settings';
import { SectionLabel } from '../ui/section-label';
import { Button } from '../ui/button';
import {
  AvailabilityPresets,
  type AvailabilityMinutes,
} from './availability-presets';
import { SessionLengthPresets } from './session-length-presets';

const DEFAULTS: AvailabilityResponse = {
  mondayMinutes: 0,
  tuesdayMinutes: 0,
  wednesdayMinutes: 0,
  thursdayMinutes: 0,
  fridayMinutes: 0,
  saturdayMinutes: 0,
  sundayMinutes: 0,
  preferredSessionMinutes: 30,
  timezone: 'America/Sao_Paulo',
};

interface Props {
  initial: AvailabilityResponse | null | undefined;
}

export function AvailabilityGrid({ initial }: Props) {
  const data = initial ?? DEFAULTS;
  const [form, setForm] = useState<AvailabilityResponse>({ ...DEFAULTS, ...data });
  const update = useUpdateAvailability();

  const dayMinutes: AvailabilityMinutes = {
    mondayMinutes: form.mondayMinutes,
    tuesdayMinutes: form.tuesdayMinutes,
    wednesdayMinutes: form.wednesdayMinutes,
    thursdayMinutes: form.thursdayMinutes,
    fridayMinutes: form.fridayMinutes,
    saturdayMinutes: form.saturdayMinutes,
    sundayMinutes: form.sundayMinutes,
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync(form);
  }

  return (
    <form className="space-y-8" onSubmit={handleSubmit}>
      <div>
        <SectionLabel>Daily availability</SectionLabel>
        <p className="mt-1 font-sans text-sm text-fg-soft">
          How many minutes per day you can study. Used to build your weekly plan.
        </p>
        <div className="mt-4">
          <AvailabilityPresets
            value={dayMinutes}
            onChange={(next) => setForm((prev) => ({ ...prev, ...next }))}
          />
        </div>
      </div>

      <div>
        <SectionLabel>Preferred session length</SectionLabel>
        <p className="mt-1 font-sans text-sm text-fg-soft">
          Ideal uninterrupted block. The scheduler splits items into chunks of this size.
        </p>
        <div className="mt-3">
          <SessionLengthPresets
            value={form.preferredSessionMinutes}
            onChange={(next) =>
              setForm((prev) => ({ ...prev, preferredSessionMinutes: next }))
            }
          />
        </div>
      </div>

      <div>
        <SectionLabel>Timezone</SectionLabel>
        <input
          type="text"
          value={form.timezone}
          onChange={(e) => setForm((prev) => ({ ...prev, timezone: e.target.value }))}
          placeholder="America/Sao_Paulo"
          className="mt-2 w-full max-w-xs rounded-input border border-border-token bg-surface px-3 py-1.5 font-sans text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {update.isError && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="font-mono text-xs text-danger"
        >
          Failed to save. Please try again.
        </motion.p>
      )}
      {update.isSuccess && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="font-mono text-xs text-success"
        >
          Saved.
        </motion.p>
      )}

      <Button type="submit" disabled={update.isPending}>
        {update.isPending ? 'Saving…' : 'Save availability'}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @ics-select/web typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/member/availability-grid.tsx
git commit -m "refactor(web): AvailabilityGrid uses extracted preset widgets"
```

---

### Task E3: Polish `GoogleStatusCard`

**Files:**
- Modify: `apps/web/components/member/google-status-card.tsx`

- [ ] **Step 1: Replace with polished variants**

Overwrite the file:

```tsx
// apps/web/components/member/google-status-card.tsx
'use client';

interface GoogleStatusCardProps {
  connected: boolean;
  email?: string | null;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export function GoogleStatusCard({ connected, email }: GoogleStatusCardProps) {
  if (connected) {
    return (
      <div className="rounded-card border border-border-token bg-surface p-6 space-y-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-2 w-2 rounded-full bg-outcome-done-easy"
          />
          <p className="font-sans text-sm font-semibold text-fg">Connected</p>
        </div>
        {email && (
          <p className="font-mono text-xs text-fg-mute">{email}</p>
        )}
        <p className="font-sans text-sm text-fg-soft">
          Study sessions are automatically added to your calendar when a plan is published.
        </p>
        <a
          href={`${API_URL}/auth/google`}
          className="inline-flex items-center font-sans text-xs text-fg-mute underline underline-offset-2 hover:text-fg"
        >
          Reconnect
        </a>
      </div>
    );
  }

  return (
    <div className="rounded-card border-l-4 border-danger bg-surface p-6 space-y-3">
      <p className="font-sans text-sm font-semibold text-fg">Google Calendar not connected</p>
      <p className="font-sans text-sm text-fg-soft">
        Without Google Calendar access, the scheduler cannot create events. Connect now so your plans
        land directly in your calendar.
      </p>
      <a
        href={`${API_URL}/auth/google`}
        className="inline-flex h-8 items-center justify-center gap-2 rounded-pill bg-fg px-3 text-xs font-semibold text-primary-fg transition-colors hover:bg-fg-soft"
      >
        Connect Google Calendar
      </a>
    </div>
  );
}
```

Changes vs. previous:
- New `email` prop, rendered as `font-mono text-xs text-fg-mute` when connected.
- Added `●` dot in `outcome-done-easy` in connected variant header.
- Dropped `shadow-lift` from disconnected variant.
- Migrated legacy tokens (`ink`, `rule`, `outcome-stuck`, `paper`) to v2 (`fg`, `border-token`, `danger`, `primary-fg`) for consistency with the widgets.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @ics-select/web typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/member/google-status-card.tsx
git commit -m "refactor(web): GoogleStatusCard connected dot + email meta"
```

---

### Task E4: Settings page redesign

**Files:**
- Modify: `apps/web/app/(member)/me/settings/page.tsx`

- [ ] **Step 1: Replace the page**

Overwrite the file:

```tsx
// apps/web/app/(member)/me/settings/page.tsx
'use client';

import { useAuth } from '../../../../lib/auth/auth-context';
import { useMeAvailability } from '../../../../lib/queries/me-settings';
import { useThemeWithSync } from '../../../../lib/theme/use-theme-sync';
import { AvailabilityGrid } from '../../../../components/member/availability-grid';
import { ProfileFields } from '../../../../components/member/profile-fields';
import { GoogleStatusCard } from '../../../../components/member/google-status-card';
import { ThemePicker } from '../../../../components/member/theme-picker';
import { Eyebrow } from '../../../../components/ui/eyebrow';
import { SectionLabel } from '../../../../components/ui/section-label';

export default function SettingsPage() {
  const { user } = useAuth();
  const { data: availability, isLoading } = useMeAvailability();
  const { resolvedTheme, setTheme } = useThemeWithSync();

  if (!user) {
    return (
      <p className="font-mono text-xs uppercase tracking-eyebrow text-fg-mute">Loading…</p>
    );
  }

  const currentTheme: 'light' | 'dark' = resolvedTheme === 'dark' ? 'dark' : 'light';

  return (
    <div className="max-w-2xl space-y-14">
      <div>
        <Eyebrow>Settings</Eyebrow>
        <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight text-fg">
          Your preferences.
        </h1>
      </div>

      <section>
        <SectionLabel>Appearance</SectionLabel>
        <ThemePicker value={currentTheme} onChange={setTheme} size="settings" />
        <p className="mt-3 font-sans text-sm text-fg-soft">
          Your choice syncs across devices.
        </p>
      </section>

      <section>
        <SectionLabel>Google Calendar</SectionLabel>
        <GoogleStatusCard connected={user.googleConnected} email={user.email} />
      </section>

      <section>
        <SectionLabel>Profile</SectionLabel>
        <ProfileFields
          initialPhone={user.whatsappPhone}
          initialTrack={user.targetTrack}
        />
      </section>

      <section>
        <SectionLabel>Availability</SectionLabel>
        {isLoading ? (
          <p className="font-mono text-xs uppercase tracking-eyebrow text-fg-mute">Loading…</p>
        ) : (
          <AvailabilityGrid initial={availability} />
        )}
      </section>
    </div>
  );
}
```

Changes:
- Added `<ThemePicker>` Appearance section at top.
- All section labels use `<SectionLabel>` (not `<h2>`).
- `<hr>` elements removed — `space-y-14` handles separation.
- Loading copy uses `tracking-eyebrow` + `text-fg-mute` (consistent with cohort).
- `email` passed into `GoogleStatusCard`.

- [ ] **Step 2: Confirm `user.email` is available from auth context**

Open `apps/web/lib/auth/auth-context.tsx` (or wherever `useAuth` lives) and verify `user.email` is on the type. It should be — `UsersController.me` returns `email`. If missing, add it. If the field is definitely there, skip.

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @ics-select/web typecheck
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Start dev server. Log in. Visit `/me/settings`. Verify:
- "Appearance" section appears first with two cards; current theme has the ring + check.
- Click the other theme — site flips live; `localStorage` updates; `PATCH /me/theme` fires in network tab.
- Google Calendar shows connected dot + email.
- Profile: phone has masked input, career track shows card grid.
- Availability: 7 daily rows with pills, preferred session as pills, timezone as text input.
- Save profile → "Saved." fades in.
- Save availability → "Saved." fades in.
- No `<hr>` anywhere.
- Section headers are small uppercase monospace (`<SectionLabel>`), not big h2.
- Dark mode: every section still legible; no invisible text.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(member\)/me/settings/page.tsx
git commit -m "feat(web): redesign /me/settings with Appearance + editorial sections"
```

---

## Phase F — Verification

### Task F1: Full-stack checks

- [ ] **Step 1: Lint**

```bash
pnpm lint
```

Expected: no errors (or same errors as before the PR — if the baseline has lint errors unrelated to our changes, that's fine; don't fix out of scope).

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: clean.

- [ ] **Step 3: Run all tests**

```bash
pnpm test
```

Expected:
- Shared: passes.
- API: `me.service.spec.ts` passes (including the 2 new tests).
- Web: passes (or no tests, depending on current state — there are no Playwright specs today; that's fine).

- [ ] **Step 4: Build**

```bash
pnpm build
```

Expected: clean build across all packages.

- [ ] **Step 5: Cross-device smoke**

Open two browser profiles side by side. In profile A, log in with one user, pick Dark, refresh `/me/settings`, verify dark persists. In profile B (fresh, same user, different browser), log in, verify the site loads in **light** (localStorage-master behavior — no DB hydration). Flip to Dark in profile B; verify DB now has last-written value in Prisma Studio.

- [ ] **Step 6: Onboarding full walkthrough**

Delete or nullify the test user's `whatsappPhone` and `CycleMembership` (Prisma Studio), log in, walk through all 4 steps, verify DB ends with `themePreference` set after finish.

---

## Files touched — summary

**Created (8):**
- `packages/prisma/prisma/migrations/j_user_theme_preference/migration.sql`
- `packages/shared/src/domain/theme.ts`
- `apps/web/lib/queries/me-theme.ts`
- `apps/web/lib/theme/use-theme-sync.ts`
- `apps/web/components/member/theme-picker.tsx`
- `apps/web/components/member/track-picker.tsx`
- `apps/web/components/member/availability-presets.tsx`
- `apps/web/components/member/session-length-presets.tsx`

**Modified (11):**
- `packages/prisma/prisma/schema.prisma`
- `packages/shared/src/domain/index.ts`
- `apps/api/src/me/me.controller.ts`
- `apps/api/src/me/me.service.ts`
- `apps/api/src/me/me.service.spec.ts`
- `apps/web/components/ui/theme-toggle.tsx`
- `apps/web/components/member/google-status-card.tsx`
- `apps/web/components/member/profile-fields.tsx`
- `apps/web/components/member/availability-grid.tsx`
- `apps/web/app/(member)/me/settings/page.tsx`
- `apps/web/app/(member)/me/onboarding/page.tsx`

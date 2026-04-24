# Settings Tabs Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the long-scroll `/me/settings` page with a 3-tab layout (Profile, Appearance, Availability) backed by URL routing, swap both local "Save" buttons for auto-save-on-change + a single global status indicator, and collapse the Google Calendar section into the Profile tab.

**Architecture:** `/me/settings` becomes a route group with a shared `layout.tsx` rendering the `SettingsNav` (sidebar on ≥md, sticky top pills on <md) and a `GlobalSaveIndicator` pinned at the footer. Three child routes (`profile/`, `appearance/`, `availability/`) render the existing per-section components, each stripped of its local form + Save button. A new `useAutoSaveField` hook handles debounced text inputs; all field mutations carry a shared `mutationKey: ['me']` so the indicator can aggregate via TanStack's `useIsMutating`. A minimal `SettingsErrorContext` lets the Availability tab report local overlap state to the indicator.

**Tech Stack:** Next.js 15 App Router, TanStack Query 5, HeroUI, Tailwind, lucide-react, Framer Motion, Playwright.

**Spec:** `docs/superpowers/specs/2026-04-24-settings-tabs-redesign-design.md`

---

## File Structure

### New files

- `apps/web/app/(member)/me/settings/layout.tsx` — shared layout (nav + content + indicator).
- `apps/web/app/(member)/me/settings/profile/page.tsx` — ProfileFields + GoogleStatusCard.
- `apps/web/app/(member)/me/settings/appearance/page.tsx` — ThemePicker.
- `apps/web/app/(member)/me/settings/availability/page.tsx` — AvailabilityGrid.
- `apps/web/components/member/settings-nav.tsx` — the sidebar/pills tab component.
- `apps/web/components/member/global-save-indicator.tsx` — aggregated save state UI.
- `apps/web/components/member/settings-error-context.tsx` — React context for overlap flag.
- `apps/web/lib/forms/use-auto-save-field.ts` — generic debounced auto-save hook.
- `apps/web/lib/forms/use-auto-save-field.spec.ts` — unit tests for the hook (Vitest/Jest).
- `apps/web/tests/settings-tabs.spec.ts` — Playwright smoke for the tabbed layout + indicator.

### Modified files

- `apps/web/app/(member)/me/settings/page.tsx` — becomes a redirect to `/me/settings/profile`.
- `apps/web/lib/queries/me-settings.ts` — add `mutationKey: ['me', 'profile' | 'availability']` to both mutations.
- `apps/web/lib/queries/me-theme.ts` — add `mutationKey: ['me', 'theme']`.
- `apps/web/components/member/profile-fields.tsx` — remove `<form>` + Save button; wire auto-save.
- `apps/web/components/member/availability-grid.tsx` — remove `<form>` + Save button; wire auto-save; publish overlap state via `SettingsErrorContext`.
- `apps/web/tests/availability-slots.spec.ts` — update the overlap assertion to target the global indicator instead of the removed local Save button.

---

## Task 1: Add `mutationKey: ['me', ...]` to the three mutations

**Files:**
- Modify: `apps/web/lib/queries/me-settings.ts`
- Modify: `apps/web/lib/queries/me-theme.ts`

The `GlobalSaveIndicator` needs a way to count in-flight mutations across all settings forms. TanStack's `useIsMutating({ mutationKey: [...] })` matches by prefix, so tagging every `/me/*` mutation with `['me', '<domain>']` lets the indicator listen on `['me']` and catch them all.

- [ ] **Step 1: Edit `me-settings.ts`**

Open `apps/web/lib/queries/me-settings.ts`. Add `mutationKey` to both `useMutation` calls:

```ts
export function useUpdateAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['me', 'availability'],
    mutationFn: (input: AvailabilityPatch) =>
      apiFetch('/me/availability', { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me', 'availability'] }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['me', 'profile'],
    mutationFn: (input: { whatsappPhone?: string | null; targetTrack?: string | null }) =>
      apiFetch('/me/profile', { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}
```

- [ ] **Step 2: Edit `me-theme.ts`**

Open `apps/web/lib/queries/me-theme.ts`. Add `mutationKey`:

```ts
export function useUpdateTheme() {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['me', 'theme'],
    mutationFn: (input: { themePreference: ThemePreference }) =>
      apiFetch('/me/theme', { method: 'PATCH', body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: passes. No consumer imports are affected (mutationKey is additive).

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/queries/me-settings.ts apps/web/lib/queries/me-theme.ts
git commit -m "feat(web): tag settings mutations with ['me', ...] key"
```

---

## Task 2: `useAutoSaveField` hook (TDD)

**Files:**
- Create: `apps/web/lib/forms/use-auto-save-field.ts`
- Create: `apps/web/lib/forms/use-auto-save-field.spec.ts`

The hook wraps a debounced text input. State is local; every change resets the debounce; `onBlur` flushes immediately; `validate` gates `save` so invalid entries never PATCH.

- [ ] **Step 1: Ensure Vitest is set up for the web package**

Run: `ls apps/web/vitest.config.* 2>/dev/null; cat apps/web/package.json | grep -A 1 '"test"'`

If no `vitest.config.ts` and no unit-test script exists (only Playwright), fall back to a pure Node test that doesn't need a React renderer. Use `@testing-library/react` if already installed; otherwise implement the hook in a form that's testable without rendering (see Step 3 below — it's written so the core debounce logic is extracted as a pure function).

If you discover that `@testing-library/react` is NOT installed and no web-side unit test infra exists, **do not add it as part of this task**. Instead:
- Write the hook as specified (Step 3).
- Implement the tests against the pure helper function inside the hook file using the existing API unit test runner (Jest) by colocating the helper in `apps/api/src/...` — NO, that's wrong.
- Correct fallback: write the tests using the Node `node:test` runtime against the pure helper. Details in Step 2 below.

- [ ] **Step 2: Write failing tests**

Create `apps/web/lib/forms/use-auto-save-field.spec.ts`:

```ts
// Test the pure debounce helper exported from the hook file. The hook itself
// is a thin wrapper around this helper + React's useState/useRef; behavior
// is fully characterized by the helper.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAutoSaveDriver } from './use-auto-save-field';

beforeEach(() => { vi.useFakeTimers(); });

describe('createAutoSaveDriver', () => {
  it('debounces save until quiet for debounceMs', async () => {
    const save = vi.fn(async () => {});
    const driver = createAutoSaveDriver({ save, debounceMs: 800 });

    driver.onChange('a');
    driver.onChange('ab');
    driver.onChange('abc');
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(799);
    expect(save).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(save).toHaveBeenCalledWith('abc');
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('onBlur flushes pending save immediately', async () => {
    const save = vi.fn(async () => {});
    const driver = createAutoSaveDriver({ save, debounceMs: 800 });

    driver.onChange('hello');
    driver.onBlur();
    expect(save).toHaveBeenCalledWith('hello');
  });

  it('validate false suppresses the save call', async () => {
    const save = vi.fn(async () => {});
    const driver = createAutoSaveDriver({
      save,
      debounceMs: 800,
      validate: (v: string) => v.length >= 3,
    });

    driver.onChange('ab'); // invalid
    vi.advanceTimersByTime(800);
    expect(save).not.toHaveBeenCalled();

    driver.onChange('abc'); // valid
    vi.advanceTimersByTime(800);
    expect(save).toHaveBeenCalledWith('abc');
  });

  it('dispose flushes pending save on unmount', async () => {
    const save = vi.fn(async () => {});
    const driver = createAutoSaveDriver({ save, debounceMs: 800 });

    driver.onChange('pending');
    driver.dispose();
    expect(save).toHaveBeenCalledWith('pending');
  });

  it('does not fire save when value equals the last-saved value', async () => {
    const save = vi.fn(async () => {});
    const driver = createAutoSaveDriver({ save, debounceMs: 800, initial: 'hello' });

    driver.onChange('hello'); // same as initial
    vi.advanceTimersByTime(800);
    expect(save).not.toHaveBeenCalled();

    driver.onChange('world');
    vi.advanceTimersByTime(800);
    expect(save).toHaveBeenCalledWith('world');
  });
});
```

- [ ] **Step 3: Implement the hook**

Create `apps/web/lib/forms/use-auto-save-field.ts`:

```ts
'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

export type AutoSaveOptions<T> = {
  initial: T;
  save: (value: T) => void | Promise<unknown>;
  validate?: (value: T) => boolean;
  debounceMs?: number;
};

export type AutoSaveDriver<T> = {
  onChange: (value: T) => void;
  onBlur: () => void;
  dispose: () => void;
};

/**
 * Pure driver that captures the debounce/validate/flush logic. Lives
 * outside of React so we can unit-test it with fake timers.
 */
export function createAutoSaveDriver<T>(opts: AutoSaveOptions<T>): AutoSaveDriver<T> {
  const { save, validate, debounceMs = 800 } = opts;
  let pendingValue: T | undefined = undefined;
  let lastSaved: T | undefined = opts.initial;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (pendingValue === undefined) return;
    const value = pendingValue;
    pendingValue = undefined;
    if (validate && !validate(value)) return;
    if (Object.is(value, lastSaved)) return;
    lastSaved = value;
    void save(value);
  };

  return {
    onChange(value: T) {
      pendingValue = value;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, debounceMs);
    },
    onBlur() {
      flush();
    },
    dispose() {
      flush();
    },
  };
}

export type UseAutoSaveField<T> = {
  value: T;
  onChange: (value: T) => void;
  onBlur: () => void;
  invalid: boolean;
};

/**
 * React wrapper around createAutoSaveDriver. Tracks local state, flushes
 * pending save on unmount, exposes `invalid` for field-level error styling.
 */
export function useAutoSaveField<T>(opts: AutoSaveOptions<T>): UseAutoSaveField<T> {
  const [value, setValue] = useState<T>(opts.initial);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const driver = useMemo(
    () =>
      createAutoSaveDriver<T>({
        initial: opts.initial,
        save: (v) => optsRef.current.save(v),
        validate: (v) => (optsRef.current.validate ? optsRef.current.validate(v) : true),
        debounceMs: opts.debounceMs,
      }),
    // Driver is created once per mount. Updates to save/validate flow through optsRef.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    return () => driver.dispose();
  }, [driver]);

  return {
    value,
    onChange: (v: T) => {
      setValue(v);
      driver.onChange(v);
    },
    onBlur: () => driver.onBlur(),
    invalid: opts.validate ? !opts.validate(value) : false,
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @ics-select/web test -- --run lib/forms/use-auto-save-field.spec.ts`

If Vitest is not configured for the web package, check whether `package.json` has a vitest dep and script. If not, add a minimal config:

Create `apps/web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.spec.ts'],
  },
});
```

Add a script to `apps/web/package.json`:

```json
"test:unit": "vitest run"
```

Install vitest as a dev dep if missing: `pnpm --filter @ics-select/web add -D vitest`

Then run: `pnpm --filter @ics-select/web test:unit`

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/forms/use-auto-save-field.ts \
        apps/web/lib/forms/use-auto-save-field.spec.ts \
        apps/web/vitest.config.ts \
        apps/web/package.json \
        pnpm-lock.yaml
git commit -m "feat(web): useAutoSaveField hook with debounce + blur + dispose"
```

(If vitest was already configured, drop `vitest.config.ts` and `pnpm-lock.yaml` from the add.)

---

## Task 3: `SettingsErrorContext`

**Files:**
- Create: `apps/web/components/member/settings-error-context.tsx`

Minimal React context: carries a flag signaling that the current tab has a validation problem the global indicator should surface.

- [ ] **Step 1: Create the file**

Create `apps/web/components/member/settings-error-context.tsx`:

```tsx
'use client';
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type SettingsError = {
  hasOverlap: boolean;
};

type Ctx = {
  error: SettingsError;
  setError: (patch: Partial<SettingsError>) => void;
};

const SettingsErrorContext = createContext<Ctx>({
  error: { hasOverlap: false },
  setError: () => {},
});

export function SettingsErrorProvider({ children }: { children: ReactNode }) {
  const [error, setErrorState] = useState<SettingsError>({ hasOverlap: false });
  const value = useMemo<Ctx>(
    () => ({
      error,
      setError: (patch) => setErrorState((prev) => ({ ...prev, ...patch })),
    }),
    [error],
  );
  return (
    <SettingsErrorContext.Provider value={value}>{children}</SettingsErrorContext.Provider>
  );
}

export function useSettingsError() {
  return useContext(SettingsErrorContext);
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/member/settings-error-context.tsx
git commit -m "feat(web): SettingsErrorContext for overlap flag"
```

---

## Task 4: `GlobalSaveIndicator` component

**Files:**
- Create: `apps/web/components/member/global-save-indicator.tsx`

Aggregates TanStack Query's `useIsMutating` count and the `SettingsErrorContext` overlap flag into a single status pill. Tracks the most recent errored mutation for ~5s to enable a Retry affordance.

- [ ] **Step 1: Create the component**

Create `apps/web/components/member/global-save-indicator.tsx`:

```tsx
'use client';
import { useEffect, useState } from 'react';
import { useIsMutating, useQueryClient, type Mutation } from '@tanstack/react-query';
import { Check, Loader2, AlertTriangle } from 'lucide-react';
import { clsx } from 'clsx';
import { useSettingsError } from './settings-error-context';

type Status = 'idle' | 'saving' | 'error' | 'overlap';

const ERROR_VISIBLE_MS = 5_000;

export function GlobalSaveIndicator() {
  const isMutating = useIsMutating({ mutationKey: ['me'] });
  const qc = useQueryClient();
  const { error } = useSettingsError();

  const [lastError, setLastError] = useState<{
    mutation: Mutation<unknown, unknown, unknown, unknown>;
    until: number;
  } | null>(null);

  // Subscribe to the mutation cache to catch transitions into an error state.
  useEffect(() => {
    const mutationCache = qc.getMutationCache();
    const unsubscribe = mutationCache.subscribe((event) => {
      if (event.type !== 'updated') return;
      const mutation = event.mutation as Mutation<unknown, unknown, unknown, unknown>;
      const key = (mutation.options?.mutationKey as unknown[] | undefined) ?? [];
      if (!Array.isArray(key) || key[0] !== 'me') return;
      if (mutation.state.status === 'error') {
        setLastError({ mutation, until: Date.now() + ERROR_VISIBLE_MS });
      } else if (mutation.state.status === 'success') {
        setLastError((prev) => (prev && prev.mutation === mutation ? null : prev));
      }
    });
    return unsubscribe;
  }, [qc]);

  // Auto-clear the error affordance when its window expires.
  useEffect(() => {
    if (!lastError) return;
    const delay = Math.max(0, lastError.until - Date.now());
    const t = setTimeout(() => setLastError(null), delay);
    return () => clearTimeout(t);
  }, [lastError]);

  const status: Status = error.hasOverlap
    ? 'overlap'
    : isMutating > 0
    ? 'saving'
    : lastError
    ? 'error'
    : 'idle';

  const handleRetry = () => {
    if (!lastError) return;
    const m = lastError.mutation;
    const vars = (m.state.variables ?? undefined) as unknown;
    // Fire a fresh mutation against the same cache entry.
    void qc.getMutationCache().build(qc, m.options).execute(vars as never);
    setLastError(null);
  };

  return (
    <div
      className={clsx(
        'flex items-center gap-2 rounded-pill px-3 py-1 font-mono text-[11px] font-semibold',
        status === 'idle' && 'text-success',
        status === 'saving' && 'text-fg-mute',
        status === 'error' && 'text-danger',
        status === 'overlap' && 'text-outcome-stuck',
      )}
      role="status"
      aria-live="polite"
    >
      {status === 'idle' && (
        <>
          <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span>Saved</span>
        </>
      )}
      {status === 'saving' && (
        <>
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
          <span>Saving…</span>
        </>
      )}
      {status === 'error' && (
        <>
          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.5} />
          <button
            type="button"
            onClick={handleRetry}
            className="underline underline-offset-2 hover:text-fg"
          >
            Save failed — Retry
          </button>
        </>
      )}
      {status === 'overlap' && (
        <>
          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.5} />
          <span>Fix overlap to save</span>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: passes. If `Mutation` type import is problematic (TanStack Query v5 renamed some internals), fall back to `any` for the mutation handle typing — the runtime behavior is the priority.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/member/global-save-indicator.tsx
git commit -m "feat(web): GlobalSaveIndicator (Saved/Saving/Error/Overlap)"
```

---

## Task 5: `SettingsNav` component

**Files:**
- Create: `apps/web/components/member/settings-nav.tsx`

Renders the tab list in two layouts with CSS responsive classes — no conditional rendering based on screen width.

- [ ] **Step 1: Create the component**

Create `apps/web/components/member/settings-nav.tsx`:

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { User, Paintbrush, Clock, type LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';

type Tab = { href: string; label: string; icon: LucideIcon };

const TABS: Tab[] = [
  { href: '/me/settings/profile', label: 'Profile', icon: User },
  { href: '/me/settings/appearance', label: 'Appearance', icon: Paintbrush },
  { href: '/me/settings/availability', label: 'Availability', icon: Clock },
];

export function SettingsNav() {
  const pathname = usePathname();
  const activeHref = TABS.find((t) => pathname.startsWith(t.href))?.href;

  return (
    <>
      {/* Desktop sidebar */}
      <nav
        aria-label="Settings sections"
        className="hidden md:flex md:w-52 md:flex-col md:gap-0.5 md:border-r md:border-rule md:pr-4"
      >
        {TABS.map((t) => {
          const active = t.href === activeHref;
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'flex h-10 items-center gap-3 rounded-input px-3 font-sans text-sm',
                active
                  ? 'bg-paper-warm text-fg'
                  : 'text-fg-soft hover:bg-paper-warm hover:text-fg',
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.5} />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Mobile pills */}
      <nav
        aria-label="Settings sections"
        className="sticky top-0 z-10 -mx-6 mb-6 flex gap-2 overflow-x-auto border-b border-rule bg-paper px-6 py-3 md:hidden"
      >
        {TABS.map((t) => {
          const active = t.href === activeHref;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'whitespace-nowrap rounded-pill border px-4 py-1.5 font-sans text-sm transition-colors',
                active
                  ? 'border-primary bg-primary text-primary-fg'
                  : 'border-border-token bg-surface text-fg-soft hover:border-border-strong hover:text-fg',
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/member/settings-nav.tsx
git commit -m "feat(web): SettingsNav with desktop sidebar + mobile pills"
```

---

## Task 6: `settings/layout.tsx` shell

**Files:**
- Create: `apps/web/app/(member)/me/settings/layout.tsx`

Wraps all settings routes with the nav, the error provider, and the indicator. Moves the `Eyebrow` + `h1` heading here so child pages are pure content.

- [ ] **Step 1: Create the layout**

Create `apps/web/app/(member)/me/settings/layout.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Eyebrow } from '../../../../components/ui/eyebrow';
import { SettingsNav } from '../../../../components/member/settings-nav';
import { SettingsErrorProvider } from '../../../../components/member/settings-error-context';
import { GlobalSaveIndicator } from '../../../../components/member/global-save-indicator';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <SettingsErrorProvider>
      <div className="space-y-8">
        <div>
          <Eyebrow>Settings</Eyebrow>
          <h1 className="mt-3 font-serif text-4xl font-medium tracking-tight text-fg">
            Your preferences.
          </h1>
        </div>

        <div className="flex flex-col gap-8 md:flex-row md:gap-10">
          <SettingsNav />
          <div className="min-w-0 flex-1 space-y-10">{children}</div>
        </div>

        <div className="flex justify-end border-t border-rule pt-4 md:pt-6">
          <GlobalSaveIndicator />
        </div>
      </div>
    </SettingsErrorProvider>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(member\)/me/settings/layout.tsx
git commit -m "feat(web): settings layout with nav + error provider + indicator"
```

---

## Task 7: `settings/page.tsx` redirect

**Files:**
- Modify: `apps/web/app/(member)/me/settings/page.tsx`

Replaces the long-scroll page with a plain redirect. `/me/settings` naked always lands the user on the Profile tab.

- [ ] **Step 1: Overwrite the file**

Replace the full content of `apps/web/app/(member)/me/settings/page.tsx` with:

```tsx
import { redirect } from 'next/navigation';

export default function SettingsIndexPage() {
  redirect('/me/settings/profile');
}
```

Note: no `'use client'` here — it's a server component that calls `redirect()` before rendering.

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(member\)/me/settings/page.tsx
git commit -m "feat(web): /me/settings redirects to /me/settings/profile"
```

---

## Task 8: Convert `ProfileFields` to auto-save (no form, no button)

**Files:**
- Modify: `apps/web/components/member/profile-fields.tsx`

Removes the `<form>` wrapper + Save button + inline Saved/Failed messages. Wires phone into `useAutoSaveField` (debounced + blur flush) and track into immediate mutation on click.

- [ ] **Step 1: Rewrite the component**

Replace the full content of `apps/web/components/member/profile-fields.tsx` with:

```tsx
'use client';

import { useMemo } from 'react';
import { TRACKS } from '@ics-select/shared';
import { useUpdateProfile } from '../../lib/queries/me-settings';
import { useAutoSaveField } from '../../lib/forms/use-auto-save-field';
import { SectionLabel } from '../ui/section-label';
import { PhoneInput } from './phone-input';
import { TrackPicker } from './track-picker';

interface ProfileFieldsProps {
  initialPhone: string | null;
  initialTrack: string | null;
}

const PHONE_REGEX = /^\+\d{8,15}$/;

export function ProfileFields({ initialPhone, initialTrack }: ProfileFieldsProps) {
  const update = useUpdateProfile();

  const phoneField = useAutoSaveField<string>({
    initial: initialPhone ?? '',
    debounceMs: 800,
    validate: (v) => v === '' || PHONE_REGEX.test(v),
    save: (v) =>
      update.mutateAsync({ whatsappPhone: v.trim() || null }),
  });

  // Track changes fire instantly — no debounce on a chip click.
  const track = initialTrack ?? '';
  const handleTrackChange = (next: string) => {
    if (next === track) return;
    void update.mutateAsync({
      targetTrack: (next as (typeof TRACKS)[number]) || null,
    });
  };

  const phoneInvalidDisplay = useMemo(
    () => phoneField.invalid && phoneField.value.length > 0,
    [phoneField.invalid, phoneField.value],
  );

  return (
    <div className="space-y-8">
      <div>
        <SectionLabel>WhatsApp phone</SectionLabel>
        <p className="mt-1 font-sans text-sm text-fg-soft">
          Used for program notifications. Include country code (e.g. +5511999999999).
        </p>
        <div className="mt-3 max-w-xs">
          <PhoneInput
            value={phoneField.value}
            onChange={phoneField.onChange}
            onBlur={phoneField.onBlur}
            invalid={phoneInvalidDisplay}
          />
        </div>
        {phoneInvalidDisplay && (
          <p className="mt-2 font-mono text-[11px] text-danger">
            Formato inválido. Inclua o código do país (ex: +5511999999999).
          </p>
        )}
      </div>

      <div>
        <SectionLabel>Career track</SectionLabel>
        <p className="mt-1 font-sans text-sm text-fg-soft">
          Informs the study plan focus for this cycle.
        </p>
        <div className="mt-3">
          <TrackPicker value={track} onChange={handleTrackChange} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Adjust `PhoneInput` if it does not expose `onBlur` / `invalid` yet**

Run: `grep -n "onBlur\|invalid" apps/web/components/member/phone-input.tsx`

If either prop isn't surfaced, add them through. Minimal change — forward them to the underlying `<input>`:

```tsx
// inside PhoneInput props and JSX
interface PhoneInputProps {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
}

// in the JSX, pass onBlur={onBlur} and add a conditional border-danger class when invalid
```

If the props already exist, skip this step.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: passes. The old `motion.p` imports in this file are removed — that's intentional.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/member/profile-fields.tsx apps/web/components/member/phone-input.tsx
git commit -m "feat(web): ProfileFields auto-saves — no local form, no Save button"
```

(Drop `phone-input.tsx` from the add if you didn't modify it.)

---

## Task 9: Convert `AvailabilityGrid` to auto-save + publish overlap flag

**Files:**
- Modify: `apps/web/components/member/availability-grid.tsx`

Strip the `<form>` + Save button + inline success/failure messages. Every change fires the full PATCH payload. Overlap state is still computed locally; when true, auto-save is suspended and the context flag flips.

- [ ] **Step 1: Rewrite the component**

Replace the full content of `apps/web/components/member/availability-grid.tsx` with:

```tsx
'use client';

import { useEffect, useState } from 'react';
import type { AvailabilityResponse } from '../../lib/queries/me-settings';
import { useUpdateAvailability } from '../../lib/queries/me-settings';
import { useAutoSaveField } from '../../lib/forms/use-auto-save-field';
import { useSettingsError } from './settings-error-context';
import { SectionLabel } from '../ui/section-label';
import {
  AvailabilityPresets,
  type AvailabilityMinutes,
} from './availability-presets';
import { SessionLengthPresets } from './session-length-presets';
import { AvailabilitySlotEditor, hasAnyOverlap } from './availability-slot-editor';
import { AvailabilitySlotPresets } from './availability-slot-presets';

const DEFAULTS: AvailabilityResponse = {
  mondayMinutes: null,
  tuesdayMinutes: null,
  wednesdayMinutes: null,
  thursdayMinutes: null,
  fridayMinutes: null,
  saturdayMinutes: null,
  sundayMinutes: null,
  preferredSessionMinutes: 30,
  timezone: 'America/Sao_Paulo',
  slots: [],
};

interface Props {
  initial: AvailabilityResponse | null | undefined;
}

export function AvailabilityGrid({ initial }: Props) {
  const data: AvailabilityResponse = { ...DEFAULTS, ...(initial ?? {}) };
  const [form, setForm] = useState<AvailabilityResponse>(data);
  const update = useUpdateAvailability();
  const { setError } = useSettingsError();

  const overlap = hasAnyOverlap(form.slots);

  // Publish overlap state so GlobalSaveIndicator can block save + hint.
  useEffect(() => {
    setError({ hasOverlap: overlap });
    return () => setError({ hasOverlap: false });
  }, [overlap, setError]);

  // Fire a PATCH with the current full form, respecting the overlap gate.
  function commit(nextForm: AvailabilityResponse) {
    if (hasAnyOverlap(nextForm.slots)) return;
    void update.mutateAsync({
      mondayMinutes: nextForm.mondayMinutes,
      tuesdayMinutes: nextForm.tuesdayMinutes,
      wednesdayMinutes: nextForm.wednesdayMinutes,
      thursdayMinutes: nextForm.thursdayMinutes,
      fridayMinutes: nextForm.fridayMinutes,
      saturdayMinutes: nextForm.saturdayMinutes,
      sundayMinutes: nextForm.sundayMinutes,
      preferredSessionMinutes: nextForm.preferredSessionMinutes,
      timezone: nextForm.timezone,
      slots: nextForm.slots.map((s) => ({
        dayOfWeek: s.dayOfWeek,
        startMinute: s.startMinute,
        endMinute: s.endMinute,
      })),
      clearDays: [0, 1, 2, 3, 4, 5, 6],
    });
  }

  // Instant commits for button/select/chip fields.
  function setAndCommit<K extends keyof AvailabilityResponse>(key: K, value: AvailabilityResponse[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      commit(next);
      return next;
    });
  }

  function setSlotsAndCommit(next: AvailabilityResponse['slots']) {
    setForm((prev) => {
      const nextForm = { ...prev, slots: next };
      commit(nextForm);
      return nextForm;
    });
  }

  function setCapsAndCommit(next: Partial<AvailabilityResponse>) {
    setForm((prev) => {
      const nextForm = { ...prev, ...next };
      commit(nextForm);
      return nextForm;
    });
  }

  // Timezone is a free-text input — debounce + blur.
  const timezoneField = useAutoSaveField<string>({
    initial: data.timezone,
    debounceMs: 800,
    validate: (v) => v.trim().length > 0,
    save: (v) => {
      setForm((prev) => {
        const nextForm = { ...prev, timezone: v };
        commit(nextForm);
        return nextForm;
      });
    },
  });

  const dayMinutes: AvailabilityMinutes = {
    mondayMinutes: form.mondayMinutes,
    tuesdayMinutes: form.tuesdayMinutes,
    wednesdayMinutes: form.wednesdayMinutes,
    thursdayMinutes: form.thursdayMinutes,
    fridayMinutes: form.fridayMinutes,
    saturdayMinutes: form.saturdayMinutes,
    sundayMinutes: form.sundayMinutes,
  };

  return (
    <div className="space-y-8">
      <div>
        <SectionLabel>Available time slots</SectionLabel>
        <p className="mt-1 font-sans text-sm text-fg-soft">
          When you can study each day of the week. Empty day = no study scheduled.
        </p>
        <div className="mt-3">
          <AvailabilitySlotPresets
            slots={form.slots}
            onChange={setSlotsAndCommit}
          />
        </div>
        <div className="mt-3">
          <AvailabilitySlotEditor
            slots={form.slots}
            onChange={setSlotsAndCommit}
          />
        </div>
      </div>

      <div>
        <SectionLabel>Daily cap (optional)</SectionLabel>
        <p className="mt-1 font-sans text-sm text-fg-soft">
          Upper bound on study minutes per day. Pick <span className="font-mono">—</span> to use all of the day's declared slots.
        </p>
        <div className="mt-4">
          <AvailabilityPresets
            value={dayMinutes}
            onChange={(next) => setCapsAndCommit(next)}
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
            onChange={(next) => setAndCommit('preferredSessionMinutes', next)}
          />
        </div>
      </div>

      <div>
        <SectionLabel>Timezone</SectionLabel>
        <input
          type="text"
          value={timezoneField.value}
          onChange={(e) => timezoneField.onChange(e.target.value)}
          onBlur={timezoneField.onBlur}
          placeholder="America/Sao_Paulo"
          className="mt-2 w-full max-w-xs rounded-input border border-border-token bg-surface px-3 py-1.5 font-sans text-sm text-fg placeholder:text-fg-faint focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: passes. `motion` + `Button` imports that the old file had are gone — intentional.

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/member/availability-grid.tsx
git commit -m "feat(web): AvailabilityGrid auto-saves + publishes overlap to context"
```

---

## Task 10: `settings/profile/page.tsx`

**Files:**
- Create: `apps/web/app/(member)/me/settings/profile/page.tsx`

Hosts `ProfileFields` + `GoogleStatusCard`. Uses `useAuth` to fetch the current user — same pattern as the old settings page.

- [ ] **Step 1: Create the page**

Create `apps/web/app/(member)/me/settings/profile/page.tsx`:

```tsx
'use client';

import { useAuth } from '../../../../../lib/auth/auth-context';
import { ProfileFields } from '../../../../../components/member/profile-fields';
import { GoogleStatusCard } from '../../../../../components/member/google-status-card';
import { SectionLabel } from '../../../../../components/ui/section-label';

export default function ProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <p className="font-mono text-xs uppercase tracking-eyebrow text-fg-mute">
        Loading…
      </p>
    );
  }

  return (
    <div className="max-w-2xl space-y-10">
      <ProfileFields
        initialPhone={user.whatsappPhone}
        initialTrack={user.targetTrack}
      />
      <div>
        <SectionLabel>Google Calendar</SectionLabel>
        <div className="mt-3">
          <GoogleStatusCard connected={user.googleConnected} email={user.email} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(member\)/me/settings/profile/page.tsx
git commit -m "feat(web): /me/settings/profile (fields + google card)"
```

---

## Task 11: `settings/appearance/page.tsx`

**Files:**
- Create: `apps/web/app/(member)/me/settings/appearance/page.tsx`

- [ ] **Step 1: Create the page**

Create `apps/web/app/(member)/me/settings/appearance/page.tsx`:

```tsx
'use client';

import { useThemeWithSync } from '../../../../../lib/theme/use-theme-sync';
import { ThemePicker } from '../../../../../components/member/theme-picker';

export default function AppearancePage() {
  const { resolvedTheme, setTheme, mounted } = useThemeWithSync();
  const currentTheme = mounted ? (resolvedTheme === 'dark' ? 'dark' : 'light') : undefined;

  return (
    <div className="max-w-2xl space-y-4">
      <ThemePicker value={currentTheme} onChange={setTheme} size="settings" />
      <p className="font-sans text-sm text-fg-soft">Your choice syncs across devices.</p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(member\)/me/settings/appearance/page.tsx
git commit -m "feat(web): /me/settings/appearance (theme picker)"
```

---

## Task 12: `settings/availability/page.tsx`

**Files:**
- Create: `apps/web/app/(member)/me/settings/availability/page.tsx`

- [ ] **Step 1: Create the page**

Create `apps/web/app/(member)/me/settings/availability/page.tsx`:

```tsx
'use client';

import { useMeAvailability } from '../../../../../lib/queries/me-settings';
import { AvailabilityGrid } from '../../../../../components/member/availability-grid';

export default function AvailabilityPage() {
  const { data: availability, isLoading } = useMeAvailability();

  if (isLoading) {
    return (
      <p className="font-mono text-xs uppercase tracking-eyebrow text-fg-mute">
        Loading…
      </p>
    );
  }

  return (
    <div className="max-w-2xl">
      <AvailabilityGrid initial={availability} />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @ics-select/web typecheck`

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(member\)/me/settings/availability/page.tsx
git commit -m "feat(web): /me/settings/availability (grid)"
```

---

## Task 13: Update the existing Playwright availability spec

**Files:**
- Modify: `apps/web/tests/availability-slots.spec.ts`

The existing test asserts the local "Save availability" button is disabled on overlap. That button is gone after Task 9. Replace the assertion with one that targets the new `GlobalSaveIndicator`.

- [ ] **Step 1: Read the current test**

```bash
cat apps/web/tests/availability-slots.spec.ts
```

Locate the assertions targeting the local Save button (text like `/Save availability/i`).

- [ ] **Step 2: Update the URL the test navigates to**

Change the navigation target from `/me/settings` to `/me/settings/availability` — the availability editor now lives at the dedicated sub-route.

- [ ] **Step 3: Replace the Save-button assertion**

Replace any assertion like:

```ts
await expect(page.getByRole('button', { name: /Save availability/i })).toBeDisabled();
```

with:

```ts
await expect(page.getByText(/Fix overlap to save/i)).toBeVisible();
```

Keep the overlap-message assertion (`faixas se sobrepõem`) untouched — it still lives inside the day row UI.

- [ ] **Step 4: Run the spec**

Run: `pnpm --filter @ics-select/web test -- tests/availability-slots.spec.ts`

Expected: the overlap test passes against the new indicator.

If it fails because the test's auth stub (`page.addInitScript` setting `localStorage.setItem('ics_access_token', ...)`) also needs mocking of `/me/theme` or other endpoints that the new layout touches, add those `page.route` handlers. The existing fixture in this file pattern already mocks `GET /me` and `GET /me/availability` — extend it as needed.

- [ ] **Step 5: Commit**

```bash
git add apps/web/tests/availability-slots.spec.ts
git commit -m "test(web): update overlap smoke to target GlobalSaveIndicator"
```

---

## Task 14: New Playwright smoke — tabs + indicator

**Files:**
- Create: `apps/web/tests/settings-tabs.spec.ts`

Covers tab navigation and the Saving → Saved transition on a non-overlap edit.

- [ ] **Step 1: Write the test**

Create `apps/web/tests/settings-tabs.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

const ME = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test',
  role: 'MEMBER' as const,
  whatsappPhone: null,
  targetTrack: 'BIG_TECH',
  googleConnected: true,
  themePreference: 'LIGHT' as const,
};

const AVAILABILITY = {
  mondayMinutes: null,
  tuesdayMinutes: null,
  wednesdayMinutes: null,
  thursdayMinutes: null,
  fridayMinutes: null,
  saturdayMinutes: null,
  sundayMinutes: null,
  preferredSessionMinutes: 60,
  timezone: 'America/Sao_Paulo',
  slots: [
    { id: 's1', dayOfWeek: 0, startMinute: 1140, endMinute: 1320 },
  ],
};

test.describe('settings tabs', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('ics_access_token', 'fake-test-token');
    });
    await page.route(/^http:\/\/localhost:3001\/me$/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ME) }),
    );
    await page.route(/\/me\/availability$/, (route) => {
      if (route.request().method() === 'PATCH') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(AVAILABILITY),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(AVAILABILITY),
      });
    });
    await page.route(/\/me\/theme$/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
    );
    await page.route(/\/me\/profile$/, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ME) }),
    );
  });

  test('/me/settings redirects to /me/settings/profile', async ({ page }) => {
    await page.goto('/me/settings');
    await expect(page).toHaveURL(/\/me\/settings\/profile$/);
    await expect(page.getByText('WhatsApp phone')).toBeVisible();
  });

  test('navigating to Availability renders the grid and indicator reaches Saved', async ({ page }) => {
    await page.goto('/me/settings');
    await page.getByRole('link', { name: 'Availability' }).first().click();
    await expect(page).toHaveURL(/\/me\/settings\/availability$/);
    await expect(page.getByText('Available time slots')).toBeVisible();
    // Indicator idle/saved on initial render (no in-flight mutation).
    await expect(page.getByRole('status')).toContainText(/Saved/i);
  });

  test('overlap on availability surfaces in the global indicator', async ({ page }) => {
    await page.goto('/me/settings/availability');
    // Add a second Monday slot that overlaps the seeded 19:00–22:00 one.
    const monRow = page
      .locator(':is(nav,div):has(> :text-matches("^Mon$"))')
      .filter({ has: page.getByRole('button', { name: 'adicionar faixa' }) })
      .first();
    await monRow.getByRole('button', { name: 'adicionar faixa' }).click();
    const monStarts = page.getByRole('combobox', { name: 'Mon start' });
    const monEnds = page.getByRole('combobox', { name: 'Mon end' });
    await monStarts.last().selectOption('08:00');
    await monEnds.last().selectOption('20:00');

    await expect(page.getByText(/faixas se sobrepõem/i)).toBeVisible();
    await expect(page.getByRole('status')).toContainText(/Fix overlap to save/i);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `pnpm --filter @ics-select/web test -- tests/settings-tabs.spec.ts`

Expected: all three cases pass.

If the `monRow` locator fails (selector syntax depends on the actual rendered DOM), fall back to the XPath approach already established in `availability-slots.spec.ts` — the goal is to find the Mon row deterministically.

- [ ] **Step 3: Commit**

```bash
git add apps/web/tests/settings-tabs.spec.ts
git commit -m "test(web): settings tabs + indicator smoke"
```

---

## Task 15: Full verification pass

- [ ] **Step 1: Typecheck**

Run: `pnpm typecheck`

Expected: clean across all 4 packages.

- [ ] **Step 2: Unit + integration**

Run: `pnpm test`

Expected: api (347 tests), shared (5 tests), web Playwright (old + new specs). All green.

- [ ] **Step 3: Lint**

Run: `pnpm lint`

Expected: clean. Fix any new eslint violations in files this plan touched (most likely `react-hooks/exhaustive-deps` on `useMemo` in `useAutoSaveField` — that's already addressed by the inline `eslint-disable` comment in Task 2's code).

- [ ] **Step 4: Manual smoke (not automated)**

```bash
pnpm dev
```

Open `http://localhost:3000/me/settings` and verify:

- Redirects to `/me/settings/profile`.
- Sidebar visible on ≥ md width; pills visible on < md width; switching screen size swaps smoothly.
- Clicking each tab changes the URL; back button returns to the previous tab.
- Editing WhatsApp phone: pauses briefly, then indicator flips `Saving… → Saved`.
- Clicking a cap preset: indicator flickers briefly.
- Creating an overlap: indicator shows `Fix overlap to save`, text-red.
- Fixing the overlap: indicator returns to `Saved`.

- [ ] **Step 5: If anything was broken, fix + amend the relevant commit**

If manual smoke reveals a genuine bug, add a targeted fix commit (`fix(web): …`). Do not squash — keep the task-by-task history.

---

## Self-review notes

- **Spec coverage:** D1–D8 are all addressed. D1 (auto-save) = Tasks 2, 8, 9. D2 (global indicator) = Task 4. D3 (3 tabs) = Task 5. D4 (desktop sidebar) = Task 5. D5 (mobile pills) = Task 5. D6 (URL routing) = Tasks 6, 7, 10, 11, 12. D7 (Google card in Profile) = Task 10. D8 (overlap gate) = Tasks 3, 4, 9.
- **Placeholder scan:** No TBDs. The one piece of intentional flex is Task 2 Step 1 which handles the case where Vitest isn't installed yet — a specific fallback is given.
- **Type consistency:** `SettingsError.hasOverlap` is referenced identically in Tasks 3 (create), 4 (read), 9 (write). `useAutoSaveField` signature is defined once in Task 2 and consumed unchanged in Tasks 8 and 9.
- **Paths consistency:** route files live at `apps/web/app/(member)/me/settings/<tab>/page.tsx`. Component files live at `apps/web/components/member/`. Hook at `apps/web/lib/forms/`. Consistent across all tasks.

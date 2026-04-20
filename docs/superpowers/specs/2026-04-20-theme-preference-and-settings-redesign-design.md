# Theme preference + `/me/settings` redesign

**Date:** 2026-04-20
**Scope:** one PR. Frontend + backend + one Prisma migration.

## Problem

Two issues, one spec because they're coupled.

1. **`/me/settings` is the page that most diverges from the design system.** Plain `<hr>` dividers between sections, raw `<input type="number">` × 7 for daily availability, a native `<select>` for career track, zero accent usage. Everything the `(member)` shell avoids.

2. **No appearance preference.** `ThemeToggle` flips light/dark via localStorage only. There's no onboarding prompt and no way to run analytics on what members pick ("do more members pick dark after April cohort?").

These are coupled because fixing (1) means extracting the onboarding's form widgets into shared components — and the moment we do that, adding a 4th widget (ThemePicker) used by both onboarding and settings is trivial. Doing (2) first without (1) would drop a beautiful new theme picker into an otherwise crude page.

## Goals

- Persist a `themePreference` on `User` (`LIGHT | DARK`) plus `themePreferenceAt` for temporal analytics.
- `localStorage` remains the runtime source of truth (consulted on page load); the DB is write-only from the client's perspective (every change is persisted to DB but the DB is never read on boot).
- Add a final step to `/me/onboarding` where the user picks light or dark with a live preview (the whole site switches on click, GitHub-style).
- Redesign `/me/settings` to match the Magazine Editorial language of the rest of `(member)`.
- Extract the duplicated onboarding-form widgets so settings and onboarding share one implementation.

## Non-goals

- No "System" mode. (`next-themes` stays with `enableSystem={false}`.)
- No hydration of theme from DB (explicitly chosen: see "Edge cases").
- No analytics chart / dashboard — schema + write path only. Gráfico é fase posterior.
- No changes to the API envelope, auth guards, or the global Zod→400 exception mapper (existing gap documented in CLAUDE.md stays out of scope).
- No refactor of the existing onboarding track-picker selected-ring accent (tension documented below).

## Architecture

### 1. Data model

New enum + 2 columns on `User`:

```prisma
enum ThemePreference {
  LIGHT
  DARK
}

model User {
  // ... existing fields
  themePreference    ThemePreference?
  themePreferenceAt  DateTime?
}
```

Both nullable so:
- Pre-existing users (every row today) don't need a default.
- Analytics can distinguish "never chose" vs "chose light".
- `themePreferenceAt` enables cohort-over-time charts (ex: picks per onboarding week).

Migration file: `packages/prisma/prisma/migrations/i_user_theme_preference/migration.sql`. Plain `ALTER TABLE` — zero data backfill.

### 2. API

New endpoint, not a merge into `PATCH /me/profile`. Theme is a UI preference, not identity — different lifecycle, different validation, no `CycleMembership` side effects.

```
PATCH /me/theme
body:     { themePreference: "LIGHT" | "DARK" }
response: 204 No Content
auth:     required (any role)
```

Route method lives directly on the existing `MeController` (`apps/api/src/me/me.controller.ts`) as a new `@Patch('theme')`. No new controller file needed — the module has only two existing methods (`export`, `delete`) and adding a third is lighter than spinning up a sub-module.

Validation uses **Zod inline** (`updateThemePreferenceSchema.parse(body)`) matching the existing codebase convention (see `UsersController.invite`). The schema exports from `packages/shared/src` so the web client reuses it for type inference.

`MeService` gains one method: `updateThemePreference(userId, preference)`. Single `prisma.user.update` writing `themePreference` + `themePreferenceAt: new Date()`. Keyed on `user.sub` from JWT. No `userId` accepted from body.

Errors:
- Invalid enum: Zod throws → currently falls through the global filter to 500 (documented gap in CLAUDE.md). **Accepted risk** — frontend only ever sends `'LIGHT'` or `'DARK'`; invalid inputs can only arrive via direct API abuse and aren't worth diverging from the codebase-wide pattern. If/when the filter gains a `ZodError` branch, this endpoint picks up 400 for free.
- 401 handled globally by `JwtAuthGuard`.

### 3. Client persistence hook

Central hook so every theme-changing surface persists consistently. Eliminates the risk of "one more toggle added somewhere forgot to hit the DB".

```ts
// apps/web/lib/theme/use-theme-sync.ts
export function useThemeWithSync() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const update = useUpdateTheme();
  const { user } = useAuth();

  const setAndPersist = useCallback((next: 'light' | 'dark') => {
    setTheme(next);                                                    // localStorage immediate
    if (user) update.mutate({ themePreference: next.toUpperCase() as 'LIGHT' | 'DARK' });
  }, [setTheme, update, user]);

  return { theme, resolvedTheme, setTheme: setAndPersist, isPending: update.isPending };
}
```

- `update.mutate` only fires if `user` exists. Someone flipping theme from `/login` (pre-auth) only writes localStorage; their next authenticated interaction will persist.
- Fire-and-forget: we don't await, don't show spinner, don't block UI. Error is logged (swallowed) — user sees the theme change instantly; DB is eventual.
- Deduping: two fast clicks (dark→light→dark) ride React Query's natural mutation handling. Last write wins at the server; analytics loses one intermediate data point, which is acceptable.

`useUpdateTheme` is a tiny TanStack `useMutation` in `apps/web/lib/queries/me-theme.ts` that POSTs the body and returns nothing.

### 4. Refactor: `ThemeToggle` migrates to the sync hook

Single existing consumer. One-line change:

```diff
- const { resolvedTheme, setTheme } = useTheme();
+ const { resolvedTheme, setTheme } = useThemeWithSync();
```

Every new surface uses the same hook.

### 5. Onboarding — new step 4

`apps/web/app/(member)/me/onboarding/page.tsx`:

- `StepId` type extends to `0 | 1 | 2 | 3`.
- The hardcoded `[0, 1, 2]` in the `Progress` component becomes a `total={4}` prop (or kept inline as `[0,1,2,3]` — implementer's choice, no structural cost).
- Step eyebrows become `Step X / 4`.
- `canAdvance` for step 3 is always `true` (ThemePicker has a default: whatever the current `resolvedTheme` is — never empty).
- `handleFinish` chain grows to 3 writes: `updateProfile` → `updateAvailability` → `updateTheme`. Theme write failure **does not** block `refetch`/redirect — localStorage already holds the choice.

Step 4 content:

```
[Eyebrow] Step 4 / 4 · Appearance
[H2]      How do you want it to look?
[p]       You can switch anytime in Settings.

<ThemePicker value={resolvedTheme} onChange={setAndPersist} size="onboarding" />
```

### 6. `<ThemePicker>` — shared component

`apps/web/components/member/theme-picker.tsx`:

```tsx
interface Props {
  value: 'light' | 'dark';
  onChange: (next: 'light' | 'dark') => void;
  size?: 'onboarding' | 'settings'; // small padding variation if needed
}
```

- Renders 2 cards in `grid gap-3 sm:grid-cols-2`, same rhythm as the onboarding track picker.
- Each card contains a **static SVG mini-preview** (topbar strip + sidebar shape + content card). The SVG hardcodes hex values for its target theme — it does **not** use CSS vars. This ensures the "Dark" preview actually looks dark even while the site is in light mode (and vice versa).
  - Light preview hexes: bg `#F7F8FA`, subtle `#F1F3F6`, ink `#14181F`, accent `#4F46E5`.
  - Dark preview hexes: bg `#161A23`, subtle `#1C202B`, ink `#F1F3F9`, accent `#7B72F5`.
- Below the preview: dot + label (`● Light` / `● Dark`), sans 14px.
- Selected card: `border-primary bg-primary-soft ring-2 ring-primary/30` + `Check` icon (lucide, `strokeWidth={2}`, positioned absolute top-right). Matches the onboarding track picker selection language.
- Unselected card: `border-border bg-surface hover:-translate-y-[1px] hover:border-border-strong`. No `shadow-lift`. No transition on background.
- Clicks call `onChange(next)` — the parent (`useThemeWithSync`) handles the side effects.
- Works in v2 tokens (`border-border`, `bg-surface`, `text-fg`, etc.) for consistency with onboarding. Legacy aliases remain so existing sites don't need changes.

### 7. Widget extraction

Three more pairs of "onboarding uses polished version, settings uses raw version" get reconciled by lifting the onboarding version out:

| Component | File | Consumers |
|---|---|---|
| `<TrackPicker>` | `components/member/track-picker.tsx` | onboarding step 2, settings profile section |
| `<AvailabilityPresets>` | `components/member/availability-presets.tsx` | onboarding step 3, settings availability section |
| `<SessionLengthPresets>` | `components/member/session-length-presets.tsx` | onboarding step 3, settings availability section |
| `<ThemePicker>` | `components/member/theme-picker.tsx` | onboarding step 4, settings appearance section |

`<PhoneInput>` already exists and is already used by onboarding — settings just imports it.

Each extracted component is controlled: `value` + `onChange`, no internal form state. Parent pages own the form state and submit logic (unchanged).

**Risk:** extracting can accidentally drift the onboarding's visual. Mitigation: one Playwright snapshot per extracted component (run before and after extraction, diff).

### 8. `/me/settings` redesign

Before:

```
[Eyebrow] Settings
[H1]      Your preferences.

<h2>Google Calendar</h2>
<GoogleStatusCard/>
<hr>
<h2>Profile</h2>
<ProfileFields/>  — raw <input type=tel> + raw <select>
<hr>
<h2>Availability</h2>
<AvailabilityGrid/>  — 7 raw <input type=number>
```

After:

```
[Eyebrow] Settings
[H1]      Your preferences.

<SectionLabel>Appearance</SectionLabel>
<ThemePicker value={resolvedTheme} onChange={setAndPersist} size="settings"/>
<p className="font-sans text-sm text-ink-soft">Your choice syncs across devices.</p>

<SectionLabel>Google Calendar</SectionLabel>
<GoogleStatusCard .../>  — connected shows `●` in outcome-done-easy + email meta; disconnected drops shadow-lift

<SectionLabel>Profile</SectionLabel>
<form>
  <SectionLabel>WhatsApp phone</SectionLabel>
  <PhoneInput .../>

  <SectionLabel>Career track</SectionLabel>
  <TrackPicker .../>

  <Button>Save profile</Button>
</form>

<SectionLabel>Availability</SectionLabel>
<form>
  <SectionLabel>Daily availability</SectionLabel>
  <AvailabilityPresets .../>

  <SectionLabel>Preferred session length</SectionLabel>
  <SessionLengthPresets .../>

  <SectionLabel>Timezone</SectionLabel>
  <input .../>  — auto-fills from Intl.DateTimeFormat on first load if empty

  <Button>Save availability</Button>
</form>
```

Key swaps:
- `<hr>` removed. `space-y-14` already provides separation.
- Old `<h2 className="font-sans text-base font-semibold text-ink">` section titles → `<SectionLabel>`. Consistent with `/me/cohort`.
- Inner field labels already used `<SectionLabel>` and keep doing so.
- ProfileFields becomes thin: owns phone + track state, submits profile. Rendered widgets are all extracted.
- AvailabilityGrid becomes thin: owns the 7 day values + session + timezone, submits availability. Rendered widgets are all extracted.
- `GoogleStatusCard` connected variant: prefix dot in `bg-outcome-done-easy` + `<p className="font-mono text-xs text-ink-mute">{user.email}</p>`. Disconnected variant: drop `shadow-lift` (redundant with `border-l-4 border-outcome-stuck`).
- Save feedback (the "Saved." line) wraps in `<motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{duration: 0.2}}>` so it fades in instead of popping.

### 9. `next-themes` provider

Unchanged. Stays with `enableSystem={false}`, `themes={['light','dark']}`, `attribute="data-theme"`, `storageKey="ics-theme"`. The spec explicitly does **not** introduce System mode.

## Data flow summary

```
Onboarding step 4 click ─────┐
Settings ThemePicker click ──┼─► useThemeWithSync.setAndPersist(next)
ThemeToggle button click ────┘           │
                                         ├─► next-themes.setTheme(next)  → localStorage 'ics-theme'
                                         └─► useUpdateTheme.mutate({ themePreference: NEXT })
                                                   │
                                                   └─► PATCH /me/theme  → users.themePreference + users.theme_preference_at

Page load:
  providers.tsx → NextThemesProvider reads localStorage → renders correct theme
  (DB is never read on boot — by design)
```

## Edge cases & decisions

- **localStorage beats DB on boot.** If device-A user picks `DARK`, the DB stores `DARK`. On device-B (fresh) the localStorage is empty → `next-themes` default `light` → rendered light. Only when device-B user clicks the toggle does the DB catch up. **This is intentional per the design discussion.** A future cross-device hydration layer is out of scope; add it only if a user complains.
- **Pre-auth theme change** (`/login` page): localStorage updates, DB write skipped (no `user`). Next authenticated interaction that flips theme persists.
- **Fast double-click** (dark→light→dark in 500ms): React Query mutates three times; server writes three times; last one wins. Analytics sees the sequence (fine); UI is consistent (localStorage and DB agree on last value).
- **Theme write failure during onboarding finish**: swallowed. localStorage already has the choice. User is not blocked from reaching `/me`.
- **Pre-existing user visits settings and never changes theme**: `user.themePreference` stays `NULL`. Picker shows whatever `resolvedTheme` is currently applied (default `light`). Only a deliberate click persists.
- **Timezone field in settings**: if DB value is empty on first mount, fill input with `Intl.DateTimeFormat().resolvedOptions().timeZone` (same as onboarding handleFinish). If user edits and clears it, don't autofill again on re-render — treat empty as explicit.

## Known tensions

**`--primary` / `--focus` used as "selected" ring.** `docs/design-system.md` scopes `--focus` strictly to "act-now / momentum" (hero CTA, 30-day streak). The shipped onboarding track picker already uses `bg-primary-soft ring-primary/30` for selection, and this spec's ThemePicker follows that convention for internal consistency. Either the design doc should add "selection ring" to the legitimate uses of `--focus`, or the onboarding track picker should move to a different selection token. Out of scope here — tracked as a followup.

## Test strategy

**Backend (jest):**
- Extend `me.service.spec.ts` with cases for `updateThemePreference`: writes both columns; second call overwrites; invalid enum bubbles up (Zod catches in controller, not service).
- Add a controller-level test in the same spec covering the `@Patch('theme')` route: 204 on valid body; rejects without JWT (guard-level).
- E2E `test/me-theme.e2e-spec.ts`: full HTTP round-trip with real AppModule + mocked Prisma connect; PATCH sets value; second PATCH overwrites.

**Frontend (playwright):**
- Extend the existing onboarding happy-path test (if present) with step 4: click "Dark", assert `html[data-theme='dark']`, assert `localStorage.getItem('ics-theme') === 'dark'`. Finish the flow; assert mocked `PATCH /me/theme` was called with `{ themePreference: 'DARK' }`.
- New `tests/settings-redesign.spec.ts`: render `/me/settings` mocked with connected Google + `themePreference: 'DARK'`; visual snapshot; click Light; assert theme flips and mock PATCH fires.
- Visual snapshot diff for `/me/onboarding` step 2 (TrackPicker) and step 3 (availability) **before and after** extraction — catches accidental drift.

**Manual smoke:**
- Open a second browser profile, log in, verify DB value (via Prisma Studio) equals the picked theme after each click.
- Open both profiles side by side; pick dark in A; reload B; confirm B still shows what B's localStorage says (not what A wrote) — validates the "localStorage wins on boot" decision.

## Files touched

Create:
- `packages/prisma/prisma/migrations/i_user_theme_preference/migration.sql`
- `packages/shared/src/me-theme.ts` (Zod schema + types)
- `apps/api/test/me-theme.e2e-spec.ts`
- `apps/web/lib/queries/me-theme.ts`
- `apps/web/lib/theme/use-theme-sync.ts`
- `apps/web/components/member/theme-picker.tsx`
- `apps/web/components/member/track-picker.tsx`
- `apps/web/components/member/availability-presets.tsx`
- `apps/web/components/member/session-length-presets.tsx`
- `apps/web/tests/settings-redesign.spec.ts`

Modify:
- `packages/prisma/schema.prisma` (add enum + 2 columns)
- `packages/shared/src/index.ts` (re-export theme schema)
- `apps/api/src/me/me.controller.ts` (add `@Patch('theme')`)
- `apps/api/src/me/me.service.ts` (add `updateThemePreference`)
- `apps/api/src/me/me.service.spec.ts` (cover new method)
- `apps/web/components/ui/theme-toggle.tsx` (swap to `useThemeWithSync`)
- `apps/web/components/member/google-status-card.tsx` (connected dot + email meta; drop shadow-lift)
- `apps/web/components/member/profile-fields.tsx` (consume `TrackPicker` + `PhoneInput`)
- `apps/web/components/member/availability-grid.tsx` (consume `AvailabilityPresets` + `SessionLengthPresets`)
- `apps/web/app/(member)/me/settings/page.tsx` (add Appearance section; replace `<hr>` + `<h2>` with `<SectionLabel>`)
- `apps/web/app/(member)/me/onboarding/page.tsx` (add step 4; swap inline widgets for extracted ones)

Deploy order: backend (schema + endpoint) → frontend. Backward compatible — new backend ignores if frontend never PATCHes; old frontend doesn't know the endpoint exists.

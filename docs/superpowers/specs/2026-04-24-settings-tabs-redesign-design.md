# `/me/settings` Tabbed Redesign — Design Spec

**Date:** 2026-04-24
**Scope:** Restructure `/me/settings` from a long vertical scroll with two local save buttons into a 3-tab layout (iPad Settings–style sidebar on desktop, sticky top pills on mobile) with auto-save underneath and a single global save indicator.
**Branch target:** new feat branch off `main`

## Problem

Today `/me/settings` stacks four `<section>` blocks vertically:

1. **Appearance** — ThemePicker (auto-saves on change, no button).
2. **Google Calendar** — read-only status card, no save.
3. **Profile** — 2 fields + `Save profile` button submitting a form.
4. **Availability** — 4 sub-areas (slots editor, daily caps, preferred session length, timezone) + `Save availability` button submitting a form.

Two local save buttons mean the user cannot tell which one persists what. Mixed with the auto-save ThemePicker ("oh wait, that one doesn't need save?"), the mental model collapses. The Availability section alone is bigger than everything else combined, so scrolling between Profile edits and Availability tweaks is friction.

## Goals

1. **One mental model for saving.** Every change is saved automatically. The global "Save" affordance remains visible purely as confirmation — it reflects state (`Saved ✓` / `Saving…` / `Save failed — Retry`), never as the sole trigger.
2. **3 peer areas with obvious separation.** Tab navigation replaces vertical scroll. Each tab is its own URL so deep-links + browser back work.
3. **Responsive without gimmicks.** iPad-style sidebar on desktop; top sticky pills on mobile — not push-navigation, because 3 tabs don't justify a second tap.
4. **Zero regression on what already works.** Theme still auto-saves, Google card still shows status, existing PATCH endpoints (`/me/availability`, `/me/profile`) stay unchanged.

## Non-goals

- **New settings.** No new fields or new toggles are added by this spec. Only the UX shell changes.
- **Reworking the availability editor internals.** The slot editor + presets + cap presets + session length + timezone stay as they are — they just lose the surrounding form and submit button.
- **Server-side changes.** No new endpoints, no API shape edits, no migrations. Purely frontend.
- **Notification settings / WhatsApp preferences / etc.** Adding a tab for these is a future concern.
- **Per-tab dirty-state tracking.** The auto-save model removes the need to track "unsaved changes" at all — the worst-case window is 800ms of debounce on a text input.

## Decisions (confirmed during brainstorming)

| # | Question | Resolution |
|---|---|---|
| D1 | How do changes persist? | **Auto-save per field.** Buttons/selects fire immediately; text inputs debounce 800ms or fire on blur (whichever comes first). |
| D2 | Is there still a "Save" button? | **Yes, one global indicator**, reflects aggregated mutation state. Exists for user reassurance, not as the save trigger. |
| D3 | How many tabs? | **3** — Profile (+ Google Calendar card embedded), Appearance, Availability. |
| D4 | Desktop layout? | **Sidebar left (~200px) + detail right** — iPad Settings. |
| D5 | Mobile layout? | **Sticky horizontal pills at top + detail below** — 3 tabs fit comfortably in ≥360px. |
| D6 | Routing? | **URL per tab** — `/me/settings/profile`, `/me/settings/appearance`, `/me/settings/availability`. `/me/settings` redirects to `profile`. |
| D7 | Where does Google Calendar status live? | **Inside the Profile tab**, at the bottom, as an embedded card (not its own tab — it's a 1-card read-only state). |
| D8 | Overlap in Availability blocks save — how does that interact with the global button? | **Suspends auto-save locally + button shows `Fix overlap to save` (disabled)**. Resolving the overlap re-enables the normal auto-save flow. |

## Architecture

```
/me/settings
├── layout.tsx           Sidebar (desktop) + pills (mobile) + GlobalSaveIndicator footer
├── page.tsx             redirect → /me/settings/profile
├── profile/page.tsx     ProfileFields + GoogleStatusCard
├── appearance/page.tsx  ThemePicker
└── availability/page.tsx  AvailabilityGrid (slots + caps + pref + tz)
```

State crossing the layout:

```
(anywhere inside layout)
  → TanStack Query mutations on /me/* fire on every change
  → useIsMutating({ mutationKey: ['me'] }) in GlobalSaveIndicator
  → button renders Saving… / Saved ✓ / Save failed

SettingsErrorContext (React context, scoped to the layout)
  ├── AvailabilityGrid sets { hasOverlap: true } while local overlap exists
  └── GlobalSaveIndicator reads it → renders "Fix overlap to save" (disabled)
```

No global dirty state. No cross-tab coordination beyond the single overlap flag.

## Routing

- `app/(member)/me/settings/page.tsx` becomes a **server component** that does `redirect('/me/settings/profile')`. Hitting `/me/settings` naked bounces the user to the Profile tab.
- `layout.tsx` wraps all three child routes. The `useMeAvailability` query and `useAuth` hook move from the current page-level to per-child-route usage (only the child that needs the data fetches it — Next.js caches the query across navigation via TanStack Query anyway).
- Active-tab detection in the nav uses `usePathname()` — exact match against `/me/settings/{slug}`.

## Components

### `SettingsNav` — `apps/web/components/member/settings-nav.tsx`

Single responsive component rendering the tab list in two layouts:

- Desktop (md:block): vertical sidebar, 200px wide, each tab a full-width row with icon + label, active row uses `bg-paper-warm` + `border-l-2 border-focus`.
- Mobile (block md:hidden): horizontal row of pills, sticky `top-0` under the app topbar, full-width container with `overflow-x-auto` (defensive — 3 tabs fit in ≥360px but scroll is cheap insurance). Active pill uses solid `bg-primary text-primary-fg`.

Tabs config (local constant):

```tsx
const TABS = [
  { href: '/me/settings/profile',      label: 'Profile',      icon: UserIcon },
  { href: '/me/settings/appearance',   label: 'Appearance',   icon: PaintbrushIcon },
  { href: '/me/settings/availability', label: 'Availability', icon: ClockIcon },
];
```

Icons come from `lucide-react` (stroke 1.5, per project convention).

### `GlobalSaveIndicator` — `apps/web/components/member/global-save-indicator.tsx`

A `'use client'` component anchored in the layout footer. State machine:

| Condition | Label | Visual |
|---|---|---|
| `hasOverlap` (via context) | `Fix overlap to save` | disabled, `text-outcome-stuck` |
| `useIsMutating(['me']) > 0` | `Saving…` | pulse animation, spinner icon |
| Most recent mutation errored (last 5s) | `Save failed — Retry` | `text-danger`, clickable re-fires last mutation |
| Otherwise | `Saved ✓` | `text-success`, subtle check icon |

Implementation:
- `useIsMutating({ mutationKey: ['me'] })` from TanStack Query gives the count.
- Error detection via `useQueryClient().getMutationCache()` subscription, filtered to `mutationKey.includes('me')`.
- The button is always rendered (never hidden), right-aligned on desktop, full-width at the bottom of the content area on mobile.
- Clicking when `Saved ✓` is a no-op visual — re-triggers the ✓ tick animation, nothing else.
- Retry path captures the last-failed mutation and calls its `.mutate()` again with the same variables.

### `SettingsErrorContext` — `apps/web/components/member/settings-error-context.tsx`

Minimal context:

```tsx
export type SettingsError = { hasOverlap: boolean };
export const SettingsErrorContext = createContext<
  { error: SettingsError; setError: (err: Partial<SettingsError>) => void }
>({ error: { hasOverlap: false }, setError: () => {} });
```

Provider lives at the layout level. `AvailabilityGrid` consumes `setError` and updates `hasOverlap` via `useEffect` as slots change. No other consumers today; the shape stays trivial so future needs (e.g., "whatsapp phone invalid") can extend it cheaply.

## Modifications to existing components

### `apps/web/components/member/profile-fields.tsx`

Before: `<form onSubmit={...}>` wrapping inputs + `Save profile` button.

After:
- Remove the `<form>` wrapper.
- Remove the Save button.
- Keep input fields. Each field's change handler:
  - **WhatsApp phone (text input)**: debounced 800ms via a `useAutoSaveField` helper hook. On debounce fire, call `updateProfile.mutateAsync({ whatsappPhone: value })`. Also fire on blur if the debounce hasn't elapsed yet.
  - **Target track (chip selector)**: immediate on click — `updateProfile.mutateAsync({ targetTrack: value })`.
- Remove the success/error inline message — the global indicator owns that feedback. Keep field-level error styling for invalid inputs (e.g., malformed phone → red border + inline message). Invalid fields don't fire mutations (the auto-save hook only fires when the local validation passes).

### `apps/web/components/member/availability-grid.tsx`

Before: `<form onSubmit={...}>` wrapping all four sub-areas + `Save availability` button at the bottom.

After:
- Remove the `<form>` wrapper.
- Remove the Save button and the overlap-blocking error message (the global indicator shows `Fix overlap to save` instead).
- Each sub-area triggers `update.mutateAsync(...)` directly on change:
  - Slot editor changes (add/remove/edit start/end) → immediate PATCH with full `{ slots, clearDays: [0..6], preferredSessionMinutes, timezone, ...caps }` payload (same payload the current `handleSubmit` builds).
  - Cap preset click → same immediate PATCH shape.
  - Session length preset → same.
  - Timezone input → debounced 800ms, also on blur.
- The overlap-detection logic (`hasAnyOverlap(form.slots)`) stays local. When true, the component:
  - Does NOT fire mutations (auto-save suspended).
  - Calls `setError({ hasOverlap: true })` on the `SettingsErrorContext`.
  - Continues to render the per-day "faixas se sobrepõem" cue (unchanged).
- When overlap resolves, `setError({ hasOverlap: false })` + next change fires normally.

### `apps/web/components/member/theme-picker.tsx`

No change. Already auto-saves.

### `apps/web/components/member/google-status-card.tsx`

No change. Just moves to live inside the Profile tab's JSX below the profile fields.

### New helper: `apps/web/lib/forms/use-auto-save-field.ts`

```ts
// Debounced auto-save for text inputs.
//
// Usage:
//   const { value, onChange, onBlur } = useAutoSaveField({
//     initial: user.whatsappPhone ?? '',
//     save: (v) => updateProfile.mutateAsync({ whatsappPhone: v || null }),
//     validate: (v) => v === '' || /^\+\d{8,15}$/.test(v),
//     debounceMs: 800,
//   });
//
// - onChange updates local state and resets the debounce timer.
// - onBlur flushes any pending save immediately.
// - save is only called when validate(value) passes.
// - Returns the invalid flag so the field can render its error UI.
export function useAutoSaveField<T>(opts: {
  initial: T;
  save: (v: T) => Promise<unknown>;
  validate?: (v: T) => boolean;
  debounceMs?: number;
}): { value: T; onChange: (v: T) => void; onBlur: () => void; invalid: boolean };
```

Generic enough to reuse for any single-field text input. 40–60 lines.

## Data flow examples

**User types WhatsApp phone:**
1. Input `onChange` → `useAutoSaveField.onChange(newValue)` — local state updates, debounce timer resets to 800ms.
2. 800ms elapse with no further typing → validation passes → `updateProfile.mutateAsync({ whatsappPhone: newValue })`.
3. `useIsMutating(['me'])` flips to 1 → `GlobalSaveIndicator` renders `Saving…`.
4. PATCH resolves → indicator renders `Saved ✓`.

**User clicks theme toggle:**
1. `ThemePicker.onChange(theme)` → existing hook fires immediately (unchanged).
2. Indicator reflects the brief `Saving…` → `Saved ✓` transition.

**User edits an availability slot start time:**
1. Select `onChange('19:00')` → `AvailabilityGrid` state updates → `hasAnyOverlap` recomputes.
2. No overlap → `update.mutateAsync({ slots: [...], clearDays: [0..6], ...caps, pref, tz })`.
3. Indicator reflects `Saving…` → `Saved ✓`.

**User creates an overlap:**
1. Select `onChange` creates overlap → `hasAnyOverlap` returns `true` → `useEffect` calls `setError({ hasOverlap: true })`.
2. `GlobalSaveIndicator` reads context → renders `Fix overlap to save` (disabled).
3. No mutation fires.
4. User fixes the overlap → `hasAnyOverlap` returns `false` → `setError({ hasOverlap: false })` → next slot change fires PATCH normally.

**User switches tab while a text input's debounce is mid-flight:**
1. User typed in WhatsApp phone at t=0, then clicked the Availability tab at t=300ms (before the 800ms debounce fires).
2. Next.js navigates → ProfileFields unmounts → `useAutoSaveField`'s cleanup flushes the pending save (calls `save(value)` synchronously).
3. The mutation fires, `useIsMutating` counts it, indicator shows `Saving…` during the flight even though the user is now looking at the Availability tab. This is correct and desired — the save is happening, user will see `Saved ✓` shortly.

## Error cases

- **Network failure on any mutation**: TanStack Query marks the mutation as `error`. Indicator flips to `Save failed — Retry` for 5s (or until user clicks retry). Underlying cache state rolls back to the server's truth on the next successful read.
- **Text input fails validation (e.g., invalid phone)**: auto-save suppressed, field renders its local error UI. Indicator stays at whatever it was before the invalid edit (likely `Saved ✓`). The user must fix the field before any save happens.
- **Overlap in availability**: auto-save suspended, indicator shows `Fix overlap to save`. No PATCH fires.
- **Navigation away while availability has overlap**: the `AvailabilityGrid` unmounts → `useEffect` cleanup calls `setError({ hasOverlap: false })` so the global indicator doesn't show a "Fix overlap" state on the Profile tab where the user can't even see the overlap. Returning to the Availability tab re-mounts the component, which re-seeds local `slots` state from the TanStack Query cache (the last saved, valid state). **Consequence: local-only overlap entries are discarded on tab switch** — the user must retype invalid slots if they leave mid-edit. Accepted trade-off: the alternative (sessionStorage draft persistence, or blocking tab navigation during overlap) is significant engineering for a narrow case, and an invalid draft has no lasting value.
- **Navigation away with pending debounce (valid value)**: flushed on unmount (see data flow example 5).
- **Navigation away with in-flight mutation**: mutation continues on the background; on return the fresh GET reflects the new state. The cached mutation state is ephemeral per `QueryClient` — if it errored while we were away and we come back after 5s, the retry affordance is gone, but the underlying data is correct (or not, in which case the next edit will catch it).

## Styling / geometry

Follow the existing design system tokens (see `docs/design-system.md`).

- Sidebar: `w-48 md:w-52`, `border-r border-rule`, rows `h-10 px-4`, active row `bg-paper-warm` + `border-l-2 border-focus -ml-[1px]`.
- Mobile pills: `sticky top-0 z-10 bg-paper border-b border-rule`, `flex gap-2 px-4 py-3`, pills `rounded-pill px-4 py-1.5 text-sm`, active pill `bg-primary text-primary-fg`, inactive pill `border border-border-token text-fg-soft`.
- Content container: `max-w-2xl p-6 md:p-10` — unchanged from today.
- Global save indicator: desktop anchored at the bottom of the sidebar (below the last tab, full width of the sidebar); mobile anchored at the bottom of the content scroll area with `sticky bottom-0 bg-paper border-t border-rule` so it doesn't overlap content on short tabs.
- Motion: same Framer Motion conventions already in use. `Saving…` has a subtle 1s ease-in-out opacity pulse; `Saved ✓` fades in the check over 200ms. Tab switches use the default Next.js instant navigation — no custom transitions.

## Testing

### Unit (Vitest / Jest)

- `useAutoSaveField` covered by a new `apps/web/lib/forms/use-auto-save-field.spec.ts`:
  - Debounces `save` call to `debounceMs` after last change.
  - `onBlur` flushes pending save immediately.
  - Invalid value blocks save (via `validate`).
  - Cleanup on unmount flushes pending save.

### Component (Playwright smoke — extends existing `apps/web/tests/availability-slots.spec.ts` pattern)

A new `apps/web/tests/settings-tabs.spec.ts`:

1. Loads `/me/settings` → gets redirected to `/me/settings/profile`.
2. Clicks `Appearance` tab → URL changes to `/me/settings/appearance`, ThemePicker renders.
3. Clicks `Availability` tab → URL changes; slot editor renders with existing fixture data.
4. Changes a slot start time → mocks PATCH `/me/availability` → asserts the global indicator flips `Saving… → Saved ✓`.
5. Creates an overlap on the availability tab → asserts indicator shows `Fix overlap to save` and is disabled.
6. Fixes the overlap → asserts indicator returns to `Saved ✓` after the next successful mutation.

Replace the current `apps/web/tests/availability-slots.spec.ts` overlap-guard assertion (which checks the local "Save availability" button is disabled) — after this redesign that local button doesn't exist. The replacement assertion targets the `GlobalSaveIndicator` instead.

### Manual smoke (checklist, not automated)

- Keyboard-only navigation: Tab key moves focus through sidebar → first field in content → global save. Enter on a tab row navigates.
- Screen reader: tab rows announce as `button` with `aria-current="page"` on the active one.
- Mobile (<768px): pills visible, no horizontal scroll needed for 3 tabs at 360px.
- Theme switch: all three tabs render correctly in light + dark.

## Rollout

Single PR off `main` → `feat/settings-tabs-redesign`. No schema changes, no API changes, no migration. Safe to ship as a frontend-only deploy via Vercel. If a regression surfaces, a single-commit revert in `apps/web/app/(member)/me/settings/` restores the previous page.

## Out-of-scope follow-ups

- **New tabs**: Notifications (email cadence, WhatsApp opt-in), Privacy (export data, delete account), About (version + links).
- **Search within settings**: cmd-K / `/` to filter tabs by label.
- **Tab badges**: e.g., a dot on Availability when the admin flagged the member's slots as insufficient for the current plan.
- **Diff indicator on tabs**: if auto-save is ever broken or disabled for certain flows, show a dot on the tab with unsaved changes.
- **Replace the AvailabilityGrid `clearDays: [0..6]` pattern with targeted per-day PATCH**: today every auto-save sends all slots for all days. A partial payload per change would reduce wire size but requires more granular tracking — defer.

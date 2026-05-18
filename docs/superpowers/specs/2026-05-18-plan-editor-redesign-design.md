# Plan Editor · Redesign

**Date:** 2026-05-18
**Status:** Design — pending implementation plan
**Owner:** Davi (Diretor Educacional)

## Problem

The current admin plan editor (`/admin/member/[id]/plan/[planId]`) is a 3-column grid of equal width: **Context · AI Draft · Editable plan**. Two pain points:

1. **The AI panel takes ~1/3 of the screen permanently, but the admin uses it in ~15% of plan sessions** — usually as a support when in doubt, not as the default workflow. The empty-state CTA is centered and big, wasting permanent real estate.
2. **The admin can't see where items will land on the member's calendar.** The member's `/me` (Today) view shows scheduled items per day with times + unscheduled overflow; the admin has no equivalent. The scheduling state is only revealed transiently inside the `SchedulingModal` during publish/edit, then disappears.

Additionally, the admin wants to see the member's **availability slots per day + daily minute cap** while editing — so they can immediately sense whether the plan fits.

## Goals

- Reclaim the ~33% of screen currently occupied by the always-on AI panel.
- Make scheduling state — both **dry-run preview for DRAFT** and **real placements for PUBLISHED** — visible the moment the editor opens.
- Surface the member's `MemberAvailability` (daily cap + slots per weekday) inline with the scheduling preview.
- Keep the item list as the editing primitive (matches `WeeklyPlanItem.order` semantics — the scheduler is `order`-driven).
- Real-time dry-run, debounced 500ms, so the preview reflects edits without a manual click.

## Non-goals

- Drag-and-drop of items between days in the week preview. The scheduler decides day/time from `WeeklyPlanItem.order`; introducing day-pinning would require backend changes out of scope here.
- Reconciliation with edits the member makes inside Google Calendar (drift between DB `scheduledAt` and the actual event). The admin sees what the scheduler placed, not what the member moved.
- Multi-admin edit conflict resolution.
- Changing the scheduler algorithm itself.

## Layout · 5 stacked regions

All visible on entry. The Week preview requires vertical scroll on a standard 1280×800 viewport, but is fully rendered (not behind a tab/button).

### 1. Header (slim, full-width)

- Left: `← Back` → cycle page if context known, else `/admin`. Status pill (`DRAFT` / `PUBLISHED` / `COMPLETED` / `ARCHIVED`) + `plan {id-short}` in mono.
- Right: action buttons. Always-present: `[✨ Sugerir com IA]` (DRAFT only), `[Delete plan]`. PUBLISHED-only: `[Reschedule pending]`. AI button is hidden on PUBLISHED/COMPLETED/ARCHIVED.

### 2. Context strip (slim, persistent, expandable)

A single row of chips beneath the header.

```
[Retro week 2 ▾]   [Topic coverage ▾]   Cycle wk 3/8 · 4 days left   Budget 90m/day · Mon/Tue/Wed/Sat
```

- `Retro week 2 ▾` — expands an accordion showing the member's last retro (rating chip, italic-serif quote, admin notes if present). Source: existing retro card content from `ContextPanel`.
- `Topic coverage ▾` — expands the existing `TopicCoverageHeatmap` (8–12 topics with % done).
- `Cycle wk N/M · X days left` — static label. No expand.
- `Budget` — static label summarizing `MemberAvailability` (average daily cap + list of active weekdays).
- Accordion is **one-at-a-time**. Persisted in `localStorage` under key `plan-editor-context-open` (values: `'retro' | 'coverage' | null`). Default: closed.

### 3. Editor + Carry-over (two-column central block)

Editor: ~70% of width. Carry-over sidebar: ~30%, hidden when empty.

**Editor (left, ~70%):**
- Admin notes textarea at top (`rows=2`, expandable, label "Notas pro membro (opcional)"). Same model field as today (`WeeklyPlan.adminNotes`).
- Ordered list of plan items (drag/reorder via existing DnD).
- `+ Add from library` button → opens existing `LibraryPickerModal`.
- Footer with primary action:
  - DRAFT: `[Save draft]` `[Publish →]`
  - PUBLISHED: `[Apply edit →]` (Save/Publish hidden)
  - COMPLETED / ARCHIVED: no footer buttons (read-only).

**Carry-over sidebar (right, ~30%):**
- Header: "Carry-over from week N".
- Checkbox list of `context.carryOverCandidates` (members of last week's plan with `outcome IN ('PENDING','STUCK')`).
- Each row: title · outcome chip · estimated minutes.
- Selections drive: (a) the AI prompt's `carryOverItemIds`; (b) the `carried over` chip on plan items whose `libraryItemId` matches a selected candidate.
- Hidden completely when `carryOverCandidates.length === 0` or status is PUBLISHED/COMPLETED/ARCHIVED. Editor expands to full block width in that case.

### 4. Week · preview (full-width, 7 day cards)

Header row:
```
SEMANA · preview                        Total: 6h 15m · atualizando…
```
- "atualizando…" appears in italic mute while the dry-run is in flight; replaced by a brief "↻ recalculou agora há pouco" (visible ~1s) on success.

Body: 7 day cards in `grid grid-cols-7 gap-2`. Each card shows:

```
┌──────────────┐
│ Mon          │   font-serif-tool semibold 14px
│ 18 May       │   font-mono 10px mute
│ ─────────── │
│ 90m cap      │   font-mono 10px mute
│ 14:00–16:00 │   slot pills, one per line
│ 19:00–20:00 │
│ ─────────── │
│ 14:00       │   small mono time
│ ▢ Item A    │   list row, 3px left border in platform color
│ 45m         │   mono mute (LATE badge if published+overdue)
│             │
│ 14:45       │
│ ▢ Item B    │
│ 30m         │
│ ─────────── │
│ free 15m    │   green if >0, mute if 0, italic "—" if OFF
└──────────────┘
```

- Items show a 6px outcome dot (left of title). On DRAFT all are `outcome-pending` grey; on PUBLISHED they reflect the real outcome.
- Platform stripe (`detectPlatform` → 3px left border) per the existing design system.
- Click on an item: scroll the matching editor list row into view and highlight it for 2s. (No navigation; the admin item detail route is not used here.)
- **OFF day** (cap=0 AND slots empty): full card `bg-paper-warm`, label "OFF" italic, no placements possible.
- **Overflow-contributing day**: 2px left border in `outcome-stuck`, plus a footer chip "overflow".

### 5. Unscheduled (full-width, below the week, conditional)

Renders only when `overflow.length > 0`. Banner styled as a warning (border `outcome-stuck/40` + `AlertTriangle` lucide icon, no filled background — per design system rule "no full-color outcome backgrounds").

```
┌─ UNSCHEDULED · 2 items sem janela ─────────────────────────────┐
│ ⚠ Não cabem na disponibilidade declarada esta semana.          │
│                                                                 │
│ ▢ Item J · 45 min · faltam 30 min de janela                    │
│ ▢ Item K · 60 min · faltam 60 min de janela                    │
│                                                                 │
│ Possíveis soluções:                                             │
│  • Aumentar cap diário ou adicionar slot (Ir pra availability)  │
│  • Mover items pro próximo plano (deixe pro carry-over)         │
│  • Forçar publicação mesmo assim (rolam pra próxima semana)     │
└─────────────────────────────────────────────────────────────────┘
```

- Each row uses the same `ListRow` shape as the day cards.
- The `Ir pra availability` link opens `/admin/member/[id]/availability` in a new tab.

## Real-time dry-run · backend

### New endpoint: `POST /plans/:planId/preview-scheduling`

- **Auth:** `@Roles('ADMIN')` + ownership (admin can preview any plan; the existing inline guard pattern is reused).
- **Body:**
  ```ts
  {
    items: Array<{ libraryItemId: string; order: number }>;  // current editor state
    // OR omit `items` to use the plan's persisted items
  }
  ```
- **Response:**
  ```ts
  {
    placements: Array<{ itemId: string; scheduledAt: string; durationMinutes: number }>;
    overflow: Array<{ itemId: string; minutesRequired: number }>;
    weekStart: string;
    weekEnd: string;
  }
  ```
- **Behavior:** loads `MemberAvailability`, runs `SchedulerService.plan(items, availability)`, returns placements. **No persistence. No Google Calendar calls.** Pure read.
- **Errors:**
  - 422 `MEMBER_NO_AVAILABILITY` when the member has no availability rows.
  - 404 `PLAN_NOT_FOUND` if plan id is invalid or admin lacks access.
- **Performance:** scheduler runs <100ms; the only IO is the availability fetch (<10ms warm). Total p95 well under 200ms.

When the body omits `items`, the service falls back to `plan.items` from DB — useful for the initial fetch on page load before the client has any dirty state.

### Modified endpoint: `GET /plans/:planId`

Today the admin controller's plan shape omits `scheduledAt`/`scheduledMinutes` from items. The schema already persists them (used by the member home). Add both fields to the admin item DTO:

```ts
type WeeklyPlanItemAdmin = {
  // existing fields...
  scheduledAt: string | null;
  scheduledMinutes: number | null;
};
```

No migration needed. No new IO. Just serialize the existing columns.

## Real-time dry-run · frontend

### New hook: `useSchedulingPreview`

`apps/web/lib/queries/admin-plan-preview.ts`:

```ts
export function useSchedulingPreview(
  planId: string | null,
  items: Array<{ libraryItemId: string; order: number }>,
  enabled: boolean,
): {
  placements: SchedulingPlacement[];
  overflow: Array<{ itemId: string; minutesRequired: number }>;
  isFetching: boolean;
  error: Error | null;
};
```

- Internally: `useDebouncedValue(items, 500)` → `useQuery({ queryKey: ['plan-preview', planId, debouncedItemsHash], queryFn: ... })`.
- `enabled` is `false` when `items.length === 0`, status is COMPLETED/ARCHIVED, or `planId` is `'new'`.
- On error: returns last successful placements with `error` set; the WeekPreview header shows "Preview indisponível · {message}", but the week stays populated with the stale data.
- TanStack Query handles retries with default backoff.

### Component contract

`WeekPreview` is pure:

```ts
type WeekPreviewProps = {
  weekStart: string;
  availability: {
    timezone: string;
    dayBudgets: Record<Weekday, number>;
    daySlots: Record<Weekday, Array<{ start: string; end: string }>>;
  };
  placements: SchedulingPlacement[];
  items: WeeklyPlanItem[];
  overflow: Array<{ itemId: string; minutesRequired: number }>;
  isUpdating?: boolean;
  mode: 'draft' | 'published';
};
```

- `mode='draft'`: parent passes placements/overflow from `useSchedulingPreview`.
- `mode='published'`: parent derives placements from `plan.items.filter(i => i.scheduledAt).map(i => ({ itemId: i.id, scheduledAt: i.scheduledAt!, durationMinutes: i.scheduledMinutes! }))` — no hook call.

## AI · drawer

The AI panel becomes a **side drawer** triggered by `[✨ Sugerir com IA]` in the header.

- Component: `components/admin/plan-editor/ai-suggest-drawer.tsx`.
- Library: HeroUI `Drawer` (available in the installed `@heroui/drawer` package).
- Width: ~440px, slides from the right.
- Overlay: light backdrop (`bg-paper/40 backdrop-blur-sm`).
- Dismiss: ESC, click on overlay, explicit close button. Closing **does not** clear the generated draft — re-opening shows the same suggestions.
- Visible only on DRAFT (hidden when status is PUBLISHED/COMPLETED/ARCHIVED).

### Three states inside the drawer

**Empty (no draft yet):**
- Eyebrow `AI Draft · GPT-5.4-mini`.
- H2 "Sugerir um plano".
- Description: "Usa últimas 4 semanas, retro, topic coverage, carry-overs, track".
- Direction textarea (`max 200 chars`, label "Direção (opcional)").
- `[⚡ Gerar]` primary button → calls `useDraftAiPlan` mutation with `carryOverItemIds` from the parent's state.

**Loading:** centered "Gerando… (10-20s)" + spinner.

**With draft:**
- Header: italic-serif narrative + chip `{n} items · {min} min` + collapsible "⟲ Regenerar com nova direção" (textarea + Gerar). No separate modal.
- Suggested items section: cards identical to today's `ai-draft-panel.tsx` (numbered, title, format/topic/min, italic blockquote rationale, `Add to plan →`).
- Alternates section: `<details>` collapsed by default.
- `Add to plan →` invokes the existing `handleAddItem`. Added items disappear from the drawer's lists (already filtered by `addedLibraryItemIds`). The drawer stays open.

The current `regenerate-brief-modal.tsx` is absorbed — there is no separate modal anymore; the brief textarea lives inside the drawer.

## Edge cases

### Plan novo (DRAFT, 0 items)
- Editor shows an empty-state with two CTAs: `[+ Add from library]` (primary), `[✨ Sugerir com IA]` (secondary; opens drawer).
- Carry-over sidebar appears normally if candidates exist (selections still feed the AI prompt).
- Week renders blank day cards showing only `cap + slots + free Xm` — useful to gauge availability before planning. No dry-run call (items empty).

### Member without `MemberAvailability`
- Context strip: `Budget` chip shows `— · sem availability`.
- Week section replaces the grid with a banner: "Membro não configurou disponibilidade · não dá pra prever agenda" + `[Abrir availability]` button (opens `/admin/member/[id]/availability` in a new tab).
- Dry-run endpoint returns 422 `MEMBER_NO_AVAILABILITY`; the UI catches that and renders the banner above instead of stale placements.
- **Open question for implementation:** verify the current `PublicationService.publish` behavior in this state. Expected: scheduler returns all items as overflow. Confirm and document; don't change behavior.

### Sem carry-over
Sidebar hidden, editor expands to full block width.

### Plan PUBLISHED
- AI button hidden.
- Editor allows reordering and removing only items whose `outcome === 'PENDING'`. Any item whose `outcome !== 'PENDING'` (positive outcomes and `STUCK`) shows a small lock icon + tooltip "Já marcado pelo membro" and is not removable. This mirrors the existing server-side guard `CANT_REMOVE_COMPLETED_ITEM` in `publication.service.ts`, which blocks `removedItems.filter(i => i.outcome !== 'PENDING')`. The UI just surfaces what the server already enforces.
- Footer shows `[Apply edit →]`.
- Week uses `mode='published'`, no dry-run.
- Carry-over sidebar hidden.
- Banner above the editor if any item has `outcome === 'STUCK'` and was last touched >72h ago: "1 item com sinal STUCK · [ver no member detail]".

### Plan COMPLETED / ARCHIVED
Fully read-only. Editor has no footer buttons. Carry-over hidden. AI button hidden. Week renders real placements with real outcomes. Only `[Delete plan]` remains in the header.

### Dry-run failure / timeout
- Last known placements remain rendered.
- Section header shows `preview defasado` in italic mute.
- TanStack retry runs with default backoff. No manual retry button.
- 422 `MEMBER_NO_AVAILABILITY` is the one error case that swaps the whole grid for a banner instead of showing stale data.

### Multi-admin conflict
Out of scope. Existing optimistic-write semantics remain unchanged.

### Future / past weeks
The week is always rendered relative to `plan.weekStart`/`plan.weekEnd`, not "today". No date-relative logic changes.

## File inventory

### New (backend)
- `apps/api/src/weekly-plans/scheduling-preview.controller.ts` — `POST /plans/:id/preview-scheduling`.
- `apps/api/src/weekly-plans/scheduling-preview.service.ts` — thin wrapper around `SchedulerService.plan` + availability loader.
- Specs: `scheduling-preview.controller.spec.ts`, `scheduling-preview.service.spec.ts` (happy path, no availability, empty items, overflow).

### Modified (backend)
- `apps/api/src/weekly-plans/weekly-plans.controller.ts` — `GET /plans/:id` includes `scheduledAt`, `scheduledMinutes` on each item.
- `apps/api/src/weekly-plans/weekly-plans.module.ts` — registers the new controller + service.

### New (frontend)
- `apps/web/components/admin/plan-editor/ai-suggest-drawer.tsx` — replaces `ai-draft-panel.tsx` + `regenerate-brief-modal.tsx`.
- `apps/web/components/admin/plan-editor/week-preview.tsx` — 7 day cards + unscheduled banner. Pure props.
- `apps/web/components/admin/plan-editor/week-day-card.tsx` — sub-component for a single day.
- `apps/web/components/admin/plan-editor/context-strip.tsx` — chip strip + retro/topic accordion.
- `apps/web/lib/queries/admin-plan-preview.ts` — `useSchedulingPreview` hook.

### Modified (frontend)
- `apps/web/app/(admin)/admin/member/[id]/plan/[planId]/page.tsx` — replaces the 3-column grid with the new 5-region stack. Adds `aiDrawerOpen` state. Wires `useSchedulingPreview`.
- `apps/web/components/admin/plan-editor/editable-plan-panel.tsx` — removes references to the deleted Context/AI panels; keeps its own footer with Save/Publish/Apply Edit.
- `apps/web/components/admin/plan-editor/carry-over-list.tsx` — moves to the editor sidebar; no internal change.
- `apps/web/lib/queries/admin-plan-editor.ts` — `WeeklyPlanItem` type adds `scheduledAt: string | null` and `scheduledMinutes: number | null`.

### Deleted (frontend)
- `apps/web/components/admin/plan-editor/context-panel.tsx` — replaced by the context strip + carry-over sidebar.
- `apps/web/components/admin/plan-editor/ai-draft-panel.tsx` — absorbed into the drawer.
- `apps/web/components/admin/plan-editor/regenerate-brief-modal.tsx` — absorbed into the drawer.

### No migration
The DB schema already has `WeeklyPlanItem.scheduledAt` and `WeeklyPlanItem.scheduledMinutes`. No SQL changes.

## Testing strategy

- **Backend unit (`scheduling-preview.service.spec.ts`)**: happy path with multiple items + slots; member with no availability returns 422-mapped error; empty items returns empty placements; overflow case returns matching `overflow` array; verifies no Google Calendar / Prisma writes occur.
- **Backend e2e (`scheduling-preview.e2e-spec.ts`)**: admin auth required; non-owning admin still allowed (admin scope is global); status-agnostic (works for DRAFT, PUBLISHED, COMPLETED).
- **Frontend snapshot (Playwright)**: empty plan + no items renders the empty editor state with both CTAs; week renders with availability bars but no scheduled items; drawer opens on AI button click and shows the empty state.
- **Frontend Playwright e2e**: after adding two items via the library picker and waiting for the debounce window, the week renders both items as placements on the expected days; toggling a carry-over checkbox does not trigger a new preview call (it only feeds the next AI prompt).
- **Manual visual check (browser)**: verify HeroUI Drawer renders with `light` theme; verify pnpm Tailwind content path picks up Drawer styles (per the CLAUDE.md HeroUI gotcha — re-check after install).

## Open questions for implementation

1. Does `SchedulerService.plan` accept its input as a pure value, or does it require a Prisma context? If the latter, the preview service may need a small refactor to expose a pure scheduling function.
2. The "click an item in a day card highlights the editor row" interaction needs the editor list to have stable DOM ids tied to `WeeklyPlanItem.id`. Confirm or add `id={\`plan-item-${item.id}\`}` to each list row.

## Data model · availability (confirmed)

Two models combine to form one normalized availability view for the WeekPreview:

- `MemberAvailability` (1 row per user) — per-weekday minute caps (`mondayMinutes` … `sundayMinutes`), `preferredSessionMinutes`, `timezone`, `calendarBusy`.
- `AvailabilitySlot` (N rows per user) — `dayOfWeek` (0–6) + `startMinute` + `endMinute` (minute-of-day). One row per concrete slot.

The preview service composes both into the props shape `{ timezone, dayBudgets, daySlots }` consumed by `WeekPreview`. The hook contract stays decoupled from the schema.

## Known limitations

- **Calendar drift unhandled.** If the member moves an event in Google Calendar after publish, the admin's Week preview shows the original `scheduledAt`, not the moved time. Reconciliation is future work.
- **No day-pinning.** The admin can't say "this item on Wednesday morning"; the scheduler chooses from order. A future iteration could add manual pins (would require backend changes and a new column on `WeeklyPlanItem`).

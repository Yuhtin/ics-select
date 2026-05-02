# Retro Redesign — Design Spec

**Date:** 2026-05-02
**Scope:** Rework `/me/retro` from three blind open-ended textareas into a guided weekly debrief: a stats + outcome ribbon at the top, then three pointed questions, two of which are anchored to specific items the member touched that week.
**Branch target:** new feat branch off `main`

## Problem

The current `/me/retro` is three open textareas — *What clicked* / *What got stuck* / *Next week, I want* — with pt-BR placeholder hints, gated by a Fri 18:00 → Sun 23:59 local window. There is no week context on the page: the member writes from memory.

Two failure modes follow:

- **Form is blind.** The member writes "study went well this week" without seeing the actual outcomes (4 nailed, 2 hard, 1 doubts, 1 stuck, 1 skipped) or the items themselves. Reflection collapses into vibes — exactly the data the admin can't act on.
- **Questions are vague.** "What clicked" / "What got stuck" don't force specificity. A member can submit a valid retro that says nothing the admin can use, because the prompts don't ask them to anchor in anything concrete.

The retro is the only signal the admin has from the member's voice (apart from outcome enums). When it produces "tudo bem" or "achei legal", the next plan loses one of its main inputs.

## Goals

1. **Show the week's reality on screen.** A stats ribbon (`4 nailed · 2 hard · 1 doubts · 1 stuck · 1 skipped · 3h studied`) and the items list with outcome chips — so the member writes against fact, not memory.
2. **Anchor reflection in items.** Two of the three prompts pick from a dropdown of the week's items. The member can't write "I got stuck somewhere" — they have to pick *which* item.
3. **Preserve the admin loop.** Stuck/valued item references travel into `WeeklyRetro` as FKs, so the plan editor's panel 1 can render clickable chips ("dúvida em: SQL Explained ↗") that jump to the linked item.
4. **No regression on existing data.** Old retros (with only the three text fields) keep displaying. The new fields are additive and nullable; closed-window read-only behavior is unchanged.

## Non-goals

- **Member-facing retro history.** Members continue seeing only the current week's retro. A timeline view ("see my last 4 retros") is a separate feature; out of scope.
- **Visual redesign.** The user explicitly does not want a visual overhaul — only functional changes. Existing typography (Newsreader H1, Inter chrome) and layout language stay.
- **Required fields / submit gating.** The retro stays fully optional, same as today. The new structure should *invite* deeper answers; not force them.
- **Window changes.** Fri 18:00 → Sun 23:59 local stays. The closed-state red banner stays.
- **Carry-over rendering on `/me`.** The home page already surfaces the latest DOUBTS/STUCK reflection from prior plans via `pickCarryOverReflection`. That path is unchanged — the new fields don't replace it.
- **Admin notifications when a retro is submitted.** The plan editor pulls retros at draft time; no real-time push.

## Decisions confirmed in brainstorm

| # | Decision | Choice |
|---|---|---|
| D1 | What goes in the recap? | **B (medium)** — stats ribbon + items list with outcome chips. No topic coverage, no week-over-week comparison. |
| D2 | Question count | **3** — same triad as today (stuck / valued / wish), each pointed differently. Not 2, not 4. |
| D3 | Anchoring mechanic | **Dropdown picker** — member selects an item from a constrained list (only DOUBTS/STUCK for #1; only DONE_EASY/DONE_HARD for #2). No free-text item naming. |
| D4 | Wording of "what clicked" replacement | *"Qual item dessa semana mais valeu a pena? · Por quê?"* (member rejected "clicou" / "marcou" / "ensinou" — picked "valeu a pena"). |
| D5 | Required vs optional | **Optional** — same as today. Submit accepts any subset. Item picker without text and text without picker both legal. |
| D6 | Stuck question gating | **Render only if any item has DOUBTS or STUCK.** A member who finished the week clean doesn't see this question. |
| D7 | Valued question gating | **Render always; offer "nenhum" as an explicit dropdown option** when no items are DONE_EASY/DONE_HARD. The member can still write text without picking. |
| D8 | Schema strategy | **Add two FK columns** to `WeeklyRetro`: `valuedItemId` and `stuckItemId`. Both `String?`, FK to `WeeklyPlanItem`, `onDelete: SetNull`. Existing text columns repurposed (no rename — see Data model). |
| D9 | Member-facing history | **Out of scope.** No `/me/retro/history` page, no list of past retros on `/me/retro`. |
| D10 | Admin chip rendering | **Yes**, in the plan editor panel 1 retros block — when `valuedItemId` or `stuckItemId` is set, render the title as a clickable chip that jumps to that item. Free text without an item id renders as plain quote (today's behavior). |

## Architecture

### Page composition

`/me/retro` composes top-down:

1. **Eyebrow + heading** — `WEEK 17 RETRO` mono eyebrow + Newsreader `How was this week?` H1 + subtitle. Same as today.
2. **Closed-state banner** (only if window closed) — same red `Retro closed — window reopens Fri 18:00 local.` faixa as today.
3. **Recap block (new)** — only renders when there is a current-week plan to recap.
   - Stats ribbon: `4 nailed · 2 hard · 1 doubts · 1 stuck · 1 skipped · 3h studied`. Tabular-nums, mono-style. `Xh Ym studied` is the sum of `scheduledMinutes` for items with outcome `DONE_EASY` or `DONE_HARD`.
   - Items list: each `WeeklyPlanItem` rendered with its outcome chip, title, and a tiny meta line (platform · estimated minutes). Sorted by `order`.
   - If the member has no published plan for the current week, the recap block is hidden entirely (the questions block also adapts — see #4).
4. **Questions block (new)** — three pointed prompts:
   1. **Stuck** (renders only if any item is DOUBTS or STUCK):
      - Label: *"Qual item dessa semana travou ou ficou com dúvida?"*
      - Picker: dropdown listing DOUBTS/STUCK items by title.
      - Textarea: *"O que falta pra desbloquear?"*
   2. **Valued** (renders whenever a current-week plan exists, even if no item is DONE):
      - Label: *"Qual item dessa semana mais valeu a pena?"*
      - Picker: dropdown listing DONE_EASY/DONE_HARD items, plus a literal `Nenhum` option at the top. If the week has zero DONE items, the picker shows only `Nenhum` — the member can still write text reflecting on why nothing valued landed.
      - Textarea: *"Por quê?"*
   3. **Next-plan wish** (always renders):
      - Label: *"1 coisa que você quer no próximo plano"*
      - Textarea, placeholder: *"ex: 'menos LeetCode, mais system design' / 'item Y específico' / 'só 4 itens, essa semana foi pesada' / 'mais conteúdo em pt-BR'"*
   4. *Submit* button — same as today (`Submit retro` / `Update retro`).
5. **Empty-week fallback** — when no current-week plan exists at all, hide the recap block, Q1, and Q2 (nothing to anchor to). Q3 still renders so the member can leave a "next plan" wish. Closed-state banner still gates submission as today.

### Data model

`WeeklyRetro` gains two nullable FK columns:

```prisma
model WeeklyRetro {
  // ... existing fields ...
  valuedItemId  String?
  stuckItemId   String?

  valuedItem WeeklyPlanItem? @relation("RetroValuedItem", fields: [valuedItemId], references: [id], onDelete: SetNull)
  stuckItem  WeeklyPlanItem? @relation("RetroStuckItem",  fields: [stuckItemId],  references: [id], onDelete: SetNull)
}
```

Naming rationale — keeping the existing text columns:
- `whatClicked` continues to hold the *"valued reason"* text (Q2 textarea). The Prisma column doesn't get renamed; only the semantics shift, documented inline.
- `whatStuck` continues to hold the *"stuck blocker"* text (Q1 textarea). Same.
- `nextWeekWish` is unchanged in name and semantics.

A rename (`whatClicked → valuedReason`) would require a migration with `RENAME COLUMN`, plus all callers (admin plan editor, home carry-over picker, member detail retros tab) updated in lockstep — five files. The semantic shift is small enough to absorb via comments at the model and DTO level. We accept the slight name drift in exchange for a one-column-add migration.

`WeeklyPlanItem` gets the inverse relations:

```prisma
model WeeklyPlanItem {
  // ... existing fields ...
  valuedInRetros WeeklyRetro[] @relation("RetroValuedItem")
  stuckInRetros  WeeklyRetro[] @relation("RetroStuckItem")
}
```

Migration is additive (two nullable columns, two FKs, no backfill, no data loss). Old retros remain valid and render unchanged.

### API surface

`GET /me/retro/current` response shape changes additively:

```ts
type RetroCurrentResponse = {
  open: boolean;
  retro: WeeklyRetro | null; // includes new valuedItemId, stuckItemId
  windowOpensAt: string;
  windowClosesAt: string;
  weekRecap: WeekRecap | null;  // NEW; null when no current-week plan exists
};

type WeekRecap = {
  stats: {
    nailed: number;
    hard: number;
    doubts: number;
    stuck: number;
    skipped: number;
    minutesStudied: number;
  };
  items: Array<{
    id: string;
    title: string;
    format: string;
    estimatedMinutes: number;
    url: string | null;
    outcome: ItemOutcome;
    order: number;
  }>;
};
```

`POST /me/retro` request DTO grows two optional fields:

```ts
const SubmitRetroSchema = z.object({
  whatClicked: z.string().max(1000).optional(),
  whatStuck: z.string().max(1000).optional(),
  nextWeekWish: z.string().max(1000).optional(),
  valuedItemId: z.string().cuid().nullable().optional(),
  stuckItemId: z.string().cuid().nullable().optional(),
});
```

Server-side validation:
- If `valuedItemId` is provided, the linked `WeeklyPlanItem` must belong to a `WeeklyPlan` owned by the caller and must fall in the *current retro week* (`weekStart`). Otherwise reject with `INVALID_ITEM_REFERENCE`.
- Same for `stuckItemId`.
- No other constraint — text without item id is fine (free retro), item id without text is fine (just a signal).
- The `outcome` of the referenced item is **not** validated. The frontend offers only DOUBTS/STUCK in the stuck dropdown, but if a member crafts a request setting `stuckItemId` to a DONE item, the server stores it. We trust the frontend to constrain the picker; backend just records.

### Frontend

- **`apps/web/lib/queries/me-retro.ts`** — extend `RetroCurrentResponse` with `weekRecap`. Update `useSubmitRetro` mutation to accept the two new id fields. Same `tanstack/react-query` patterns.
- **`apps/web/components/member/retro-form.tsx`** — rewrite. Three states render conditionally based on the recap (recap present, recap absent, window closed). The form holds 5 controlled values: `whatClicked`, `whatStuck`, `nextWeekWish`, `valuedItemId`, `stuckItemId`. The two pickers are HeroUI `Select` components wired to the recap items.
- **`apps/web/components/member/retro-recap.tsx`** (new) — pure presentational: stats ribbon + items list with outcome chips. Reuses `OutcomeDot` / `ListRow` patterns from the home page.

No new routes. `/me/retro/history` is explicitly out of scope.

### Admin plan editor integration

`apps/web/components/admin/member-detail/retros-tab.tsx` and the plan-editor panel 1 retro block render retros today as plain blockquotes. With the new fields, when `valuedItemId` or `stuckItemId` is non-null and the linked item still exists, render the item title as a chip with `→` icon. Click navigates to `/admin/member/[id]/plan/[planId]?focusItemId=<id>` (the plan editor already supports the focus param for the carry-over flow).

If the linked item has been deleted (FK is `SetNull`), the chip falls back to plain text with no link.

### Backend

- **`apps/api/src/me/retro/retro.service.ts`**:
  - `getCurrent()` builds the new `weekRecap` block. It loads the current-week `WeeklyPlan` via the same `weekStart` already computed by `computeWindow`, includes its items + `libraryItem`, and aggregates `stats` + `minutesStudied`.
  - `submit()` accepts the two new id fields; validates ownership + week match before upsert.
- **`apps/api/src/me/retro/dto.ts`** — extends `SubmitRetroSchema`.
- **`packages/prisma/prisma/schema.prisma`** — adds the two columns + relations. New numbered migration `q_weekly_retro_item_links` (or whatever the next letter is at PR time).

## Testing strategy

- **Unit (jest)** — `retro.service.spec.ts` already covers the window logic and submit flow. Extend with:
  - `getCurrent()` returns `weekRecap` populated when a plan exists, `null` otherwise.
  - `submit()` accepts `valuedItemId`/`stuckItemId` when the items belong to the caller's current-week plan.
  - `submit()` rejects ids belonging to another user's plan or another week's plan.
  - Existing tests (no item ids) continue to pass — additivity guard.
- **Schema** — run `prisma migrate dev` locally + Jest schema sanity (the existing schema test that just compiles).
- **Frontend** — playwright happy-path: load `/me/retro` with a current-week plan, see stats ribbon + items list, fill the picker + textarea + wish, submit, verify response. No screenshot asserts (visual stays).
- **Admin chip rendering** — extend `retros-tab.tsx` test (if one exists; otherwise add a small one) to verify the chip appears when ids are set and falls back to plain text when ids are null.

## Open questions

None. All A/B/C decisions confirmed in the brainstorm. Implementation can proceed.

## Out-of-band notes

- **Migration naming** — the next migration letter at PR time is what it is. Don't hardcode `q_` here; use whatever's next under `packages/prisma/prisma/migrations/`.
- **Comment hygiene** — when keeping `whatClicked` / `whatStuck` column names with new semantics, add a one-line model-level Prisma comment explaining the drift, and a matching DTO-level comment in `dto.ts`. Don't repaint every caller.
- **Carry-over reflection on `/me`** — `HomeService.pickCarryOverReflection` queries `WeeklyPlanItem.reflection` (per-item reflection field, separate from the retro). It is unrelated to this redesign. Don't touch it.

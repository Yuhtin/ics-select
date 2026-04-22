# Foundations Skip — Design Spec

**Date:** 2026-04-22
**Scope:** Let members mark foundations items as "already known" (zero-time completion) and let admins flag skippable items during plan draft. No new schema topics — reuses the existing `foundations` topic (`order=-1`) as the routing key.
**Branch target:** new feat branch off `main`

## Problem

Every member's first weekly plan is expected to include a handful of foundations items — a LeetCode onboarding video, Git / GitHub PR flow, Bash basics, Big-O vocabulary — bundled under the `foundations` topic (`order=-1`). Most of these items are 2–9 minutes each; the full dossier is ~40 minutes.

Roughly half the incoming members already know a subset of these tools. Forcing Maria Clara, who has been doing LeetCode for two years, to sit through "LeetCode vai te fazer melhorar como dev?" and mark it `DONE_EASY` is friction with zero learning return. It also distorts the weekly budget: 40 minutes of foundations consume a real slot in the scheduler that the student could have used for harder material.

Today the only way to "skip" is:

- Admin does not include the item in the draft (requires the admin to remember who knows what, per member, every cycle).
- Member watches and marks `DONE_EASY` (fake data — didn't actually watch — and still burns calendar time).

Neither scales.

## Goals

1. **Member self-skip.** On any foundations item, the member can mark "I already know this" in one click. The item transitions to a terminal state that counts toward topic completion and consumes zero time in the weekly budget.
2. **Admin-side visibility.** In the weekly plan draft editor, any foundations item shows a "skippable" affordance so the admin can drop it from the draft before publication, per member.
3. **No Calendar pollution.** A skipped item never creates a Google Calendar event; if skipped after publish, its event is removed.
4. **Topic coverage stays honest.** A skip counts toward `foundations` completion %, but admin analytics can distinguish *actual learning* from *skip* for cohort-level reporting.
5. **Zero regression** on non-foundations items — the existing outcome flow (`PENDING` → `DONE_EASY` / `DONE_HARD` / `DOUBTS` / `STUCK`) is untouched.

## Non-goals

- Extending skip to non-foundations items. A student can't skip the sorting dossier even if they claim to know it; that's what outcome grading is for.
- Re-doing onboarding. The user explicitly stated onboarding has already happened — no onboarding checklist, no bulk skip flow.
- Changing AI recommendations. `DiagnoseService` and `DraftPlanService` already iterate `item.topics` to compute coverage; they'll read skipped items the same way they read completed ones. Tuning AI prompts for skip-vs-done signal is a future concern.
- Re-including foundations items automatically in future weeks once skipped. If a skipped item is relevant again later (unlikely for foundations), the admin re-adds it manually.

## Decisions to confirm (before implementation)

| # | Question | Options | Proposed |
|---|---|---|---|
| D1 | What is the data model for "skipped"? | (a) New enum value `SKIPPED` on `ItemOutcome`; (b) Reuse `DONE_EASY`; (c) New boolean column `skipped` orthogonal to outcome | **(a)** — `SKIPPED` is honest data; `DONE_EASY` would lie about whether the item was consumed, and analytics / AI / retrospective would conflate the two. Migration cost is small (one enum value, plus UI renders for the new state). |
| D2 | Which items are skippable? | (a) Any item whose primary topic is `foundations`; (b) Any item that has `foundations` in its `topicSlugs` (primary OR cover); (c) New `LibraryItem.isSkippable` flag | **(b)** — Big-O appears in `sorting`/`array`/`foundations`; its "home" is `sorting` but it's foundational. A student who knows Big-O should be able to skip it from any surface. Topic-based keeps curation as the single source of truth; no new schema field to maintain. |
| D3 | Who can skip? | (a) Member only; (b) Admin only (on member's behalf); (c) Both | **(c)** — Members self-skip (feature B in the brainstorm). Admins also skip during draft editing (feature C) because they see the full cohort and can pre-empt friction before the plan is published. |
| D4 | Can a skip be undone? | (a) No, terminal; (b) Yes, returns to `PENDING` | **(b)** — reversible. Students misclick; admins change their mind. The UI should confirm the action but not block undo. |
| D5 | Calendar behavior | (a) Skip during draft → no event created; (b) Skip after publish → event deleted; (c) Unskip after publish → event recreated via scheduler | **All three.** (c) is the trickiest — the scheduler allocates by day budget; re-inserting one item mid-week may not fit. Fallback: unskip returns the item to `PENDING` but does *not* auto-schedule; a banner prompts the admin to re-run publication or the member to manually book time. |
| D6 | Does skip count toward topic completion %? | (a) Yes — same weight as `DONE_*`; (b) No — counted separately; (c) Partial credit | **(a)** — from the student's perspective, they already know the material, so foundations is "covered" for them. Admin analytics (D7) can still break the number down. |
| D7 | Admin-visible distinction between skip and done | (a) Shown separately in cohort analytics; (b) Collapsed into "completed" | **(a)** — the admin home already has a "progress per member" surface; skip count should be a separate column so the admin sees who's skipping a lot (might indicate over-qualified onboarding) vs who's actually learning. |

## Architecture

### Data model

- **`ItemOutcome` enum** gains one value: `SKIPPED`. Migration is additive (no backfill, no data loss); Prisma regenerate + one schema migration.
- **No new columns, no new tables.** Skippability is derived at query time: an item is skippable iff `foundations` appears in its `topics` (primary OR cover).
- **No changes to `LibraryItem`, `Topic`, `LibraryItemTopic`, or `WeeklyPlan`.**

### API surface

Two surfaces already exist and just need extension:

1. **Member-facing skip endpoint.** The outcome-update endpoint (already used when a member marks `DONE_EASY`/`STUCK`/etc.) accepts the new `SKIPPED` value. Server validates:
   - Caller owns the `WeeklyPlanItem` (or is ADMIN).
   - The underlying `LibraryItem`'s topics include `foundations`. Rejects otherwise with a clear error (non-skippable item).
   - Transitions to `SKIPPED` and triggers Calendar cleanup (below).
2. **Admin draft-edit endpoint.** The admin plan editor already mutates draft items (add/remove/reorder). No new endpoint — the admin removes the item from the draft via the existing flow. The only new piece is a **read-side** indication: the plan-detail response includes a `skippable: boolean` per item so the UI can render the badge (C).

### Calendar side effects

- **Skip during draft (plan is `DRAFT`):** no event exists yet; no-op.
- **Skip after publish (plan is `PUBLISHED`):** the service finds the Calendar event via the `ICS ID: <planId>/<itemId>` marker in the description (the existing mechanism; see `CLAUDE.md` on weekly plan flow) and deletes it. Calendar API failures are swallowed and logged, consistent with the existing `PublicationService` behavior.
- **Unskip after publish:** item returns to `PENDING`. No auto-scheduling (see D5). The UI surfaces a hint prompting re-publication or manual booking.

### Member UI impact

- **Plan day view / item detail** (surface TBD as part of the member revamp — see CLAUDE.md on `(member)` route group):
  - Item row for a skippable item shows a secondary action "I already know this".
  - Tapping it opens a confirm (one line: "Mark as already known? You can undo this.") and on confirm calls the outcome-update endpoint with `SKIPPED`.
  - After skip, the row is visually de-emphasized but still present (struck-through title, muted color, small "skipped" pill). A small "undo" affordance remains for 24 hours, then the row collapses into the "already known" section of the day.
- **Foundations dossier** (if a dedicated entry point exists): shows a per-item skip toggle with the same semantics, so a new member can sweep through the dossier in seconds if they already know most of it. This is a convenience layer over the per-item action — not a separate endpoint.

### Admin UI impact

- **Plan draft editor (`/admin/member/[id]/plan/[planId]/`):**
  - Each item that is skippable (from the API's `skippable` field) shows a compact badge (gray, `--ink-mute`, no strong color — it's informational, not actionable warning). Label: "skippable" or similar, single word.
  - Existing remove-from-draft action is unchanged; the badge is purely a hint to the admin ("consider checking whether this member already knows this").
  - Optionally, a per-member "already known" quick-toggle that pre-fills `SKIPPED` outcomes on the items in the draft that the admin knows the member has covered — this is a polish, low priority, can ship later.
- **Admin home / member detail:**
  - Progress columns (if they exist today showing `DONE` count) gain a `SKIPPED` count shown as a distinct number or a small secondary label, so the admin sees at a glance that "Maria Clara — 6 completed, 4 skipped" vs "Pedro — 3 completed, 0 skipped". Exact presentation per design-system.md.

### Analytics / reporting

- Topic coverage: `SKIPPED` counts like `DONE_*`. Existing code paths (`HomeService.computeTopicCoverage`, `MemberDetailService.computeTopicCoverage`, `PlanContextService.computeTopicCoverage`, `DraftPlanService`) extend the "completed" predicate from `outcome IN (DONE_EASY, DONE_HARD, DOUBTS, STUCK)` to include `SKIPPED`.
- Admin cohort view: new count for `SKIPPED` per member per week.
- AI: no prompt change. The AI already consumes coverage % numbers, not the raw outcome. If we later decide the AI should know "this member skips foundations aggressively, recommend harder week-2 content", that's a follow-up.

## Scope breakdown (what changes where — for a future plan doc, not to implement yet)

| Layer | Change |
|---|---|
| Prisma schema | Add `SKIPPED` to `ItemOutcome` enum + migration |
| API — outcome update | Accept `SKIPPED`; validate item is foundations-tagged; trigger Calendar cleanup |
| API — plan read | Include `skippable: boolean` per item in plan-detail response |
| API — PublicationService | If an item is already `SKIPPED` at publish time, do not schedule it and do not create a Calendar event |
| API — coverage helpers | Treat `SKIPPED` as "completed" for topic % in `HomeService`, `MemberDetailService`, `PlanContextService`, `DraftPlanService` |
| Google Calendar service | Support "delete event by `ICS ID` marker" (may already exist for plan-delete; verify) |
| Web — member plan UI | Per-item skip action + `SKIPPED` visual state + undo affordance |
| Web — admin plan editor | `skippable` badge on draft items |
| Web — admin cohort views | `SKIPPED` count column |
| Seed / content | None. Foundations items already seeded (see `feat(library): seed foundations onboarding + hashmap topic`, commit `626fd35` on `main`). |

## Out of scope

- Onboarding-time bulk skip. Members self-skip item-by-item when they encounter the plan; the UX doesn't need a separate onboarding step because onboarding already happened.
- Extending skip to non-foundations items (e.g. "I already know sorting" — use outcome grading or ask the admin).
- Tuning AI recommendations based on skip patterns.
- Cohort-level bulk skip (admin applies a skip to many members at once). Per-member in the draft editor is enough for the current cycle size (≤12 members).
- Analytics dashboards beyond a single `SKIPPED` count column.

## Open questions

1. **Visual treatment of a skipped item in the member UI** — struck-through + muted, or collapsed into an "already known" section? Depends on the member revamp surface that is still being designed; deferred to the design review of that surface.
2. **Calendar event ID lookup cost.** Deleting a Calendar event on skip needs the `ICS ID: <planId>/<itemId>` marker to be searchable. If the current implementation walks the whole calendar, this is fine for now (12 members × ~4 events each = 48 events max). If it becomes a hot path, cache the Google event ID on `WeeklyPlanItem`. Out of scope for this iteration unless profiling shows it matters.
3. **Undo timeout.** 24h is a guess. The real answer comes from watching the first cycle — if nobody uses undo, drop it; if people misclick and undo an hour later, keep it.
